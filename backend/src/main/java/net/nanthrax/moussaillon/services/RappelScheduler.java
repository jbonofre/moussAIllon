package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import net.nanthrax.moussaillon.persistence.EmailTemplateEntity;
import net.nanthrax.moussaillon.persistence.RappelHistoriqueEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;

/**
 * Relances par email, dont les délais (J+N) sont paramétrés une fois pour toutes sur la société :
 * <ul>
 *   <li>relances de paiement des factures émises non soldées, comptées à partir de la date d'échéance de la facture,
 *   ou de sa date d'émission si aucune échéance n'est renseignée ;</li>
 *   <li>relances des devis/OR en attente de signature, comptées à partir de la date du devis.</li>
 * </ul>
 * Selon le paramétrage de la société, les relances dues sont envoyées automatiquement chaque matin, ou attendent
 * d'être validées dans le journal des relances ({@link RelanceResource}). Les ventes dont les relances sont suspendues
 * (sur la vente ou sur le client) ne sont pas relancées.
 */
@ApplicationScoped
public class RappelScheduler {

    private static final DateTimeFormatter FORMAT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Relance due pour une vente : la plus avancée dont le délai est écoulé, ni envoyée ni ignorée. */
    public record RelanceDue(VenteEntity vente, boolean devis, int niveau, LocalDate depart) {}

    @Inject
    Mailer mailer;

    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional
    public void envoyerRelances() {
        SocieteEntity societe = SocieteEntity.findById(1L);
        // Sans envoi automatique, les relances attendent d'être validées dans le journal des relances.
        if (societe == null || !societe.relancesAutomatiques) {
            return;
        }
        relancesFactures(societe, LocalDate.now()).forEach(this::envoyer);
    }

    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional
    public void envoyerRelancesDevis() {
        SocieteEntity societe = SocieteEntity.findById(1L);
        if (societe == null || !societe.relancesAutomatiques) {
            return;
        }
        relancesDevis(societe, LocalDate.now()).forEach(this::envoyer);
    }

    /** Relances de paiement et de devis dues à la date donnée. */
    public static List<RelanceDue> relancesDues(SocieteEntity societe, LocalDate today) {
        List<RelanceDue> relances = new ArrayList<>(relancesFactures(societe, today));
        relances.addAll(relancesDevis(societe, today));
        return relances;
    }

    /** Factures émises non soldées des clients qui ont donné leur consentement, dont une relance est due. */
    static List<RelanceDue> relancesFactures(SocieteEntity societe, LocalDate today) {
        Integer[] delais = { societe.relance1Jours, societe.relance2Jours, societe.relance3Jours };
        List<RelanceDue> relances = new ArrayList<>();
        List<VenteEntity> factures = VenteEntity.list("status = ?1 and client is not null", VenteEntity.Status.FACTURE_PRETE);
        for (VenteEntity vente : factures) {
            if (!relancable(vente, today) || VenteResource.soldeDu(vente) <= 0.005) {
                continue;
            }
            LocalDate depart = dateDepartRelance(vente);
            if (depart == null) {
                continue;
            }
            int niveau = niveauAtteint(delais, ChronoUnit.DAYS.between(depart, today));
            // Une seule relance par passage : la plus avancée atteinte, sans rattraper les précédentes.
            if (niveau > vente.niveauRelance) {
                relances.add(new RelanceDue(vente, false, niveau, depart));
            }
        }
        return relances;
    }

    /**
     * Devis/OR en attente de signature (ni acceptés, ni refusés) des clients qui ont donné leur consentement, dont une
     * relance est due. Une prestation rouverte après son démarrage (forfait ajouté) n'est pas relancée : le client est
     * déjà en contact avec l'atelier.
     */
    static List<RelanceDue> relancesDevis(SocieteEntity societe, LocalDate today) {
        Integer[] delais = { societe.relanceDevis1Jours, societe.relanceDevis2Jours, societe.relanceDevis3Jours };
        List<RelanceDue> relances = new ArrayList<>();
        List<VenteEntity> devis = VenteEntity.list(VenteResource.DEVIS_EN_ATTENTE
                + " and client is not null and dateFactureEnAttente is null", VenteEntity.Status.DEVIS);
        for (VenteEntity vente : devis) {
            if (!relancable(vente, today)) {
                continue;
            }
            LocalDate depart = toLocalDate(dateDevis(vente));
            if (depart == null) {
                continue;
            }
            int niveau = niveauAtteint(delais, ChronoUnit.DAYS.between(depart, today));
            if (niveau > vente.niveauRelanceDevis) {
                relances.add(new RelanceDue(vente, true, niveau, depart));
            }
        }
        return relances;
    }

    /** Client joignable par email, qui a donné son consentement, et relances non suspendues. */
    private static boolean relancable(VenteEntity vente, LocalDate today) {
        return vente.client.consentement && vente.client.email != null && !vente.client.email.isBlank()
                && !relancesSuspendues(vente, today);
    }

    /** Relances suspendues sur le client, ou sur la vente sans date de fin ou jusqu'à une date pas encore dépassée. */
    public static boolean relancesSuspendues(VenteEntity vente, LocalDate today) {
        if (vente.client != null && vente.client.relancesSuspendues) {
            return true;
        }
        return vente.dateSuspensionRelances != null
                && (vente.finSuspensionRelances == null || !toLocalDate(vente.finSuspensionRelances).isBefore(today));
    }

    /** Envoie la relance due et la marque comme envoyée. */
    public void envoyer(RelanceDue relance) {
        if (relance.devis()) {
            envoyerRelanceDevis(relance.vente(), relance.niveau());
            relance.vente().niveauRelanceDevis = relance.niveau();
        } else {
            envoyerRelance(relance.vente(), relance.niveau());
            relance.vente().niveauRelance = relance.niveau();
        }
    }

    /** Écarte la relance due sans l'envoyer : elle est marquée comme traitée et inscrite à l'historique. */
    public void ignorer(RelanceDue relance, String motif) {
        VenteEntity vente = relance.vente();
        if (relance.devis()) {
            vente.niveauRelanceDevis = relance.niveau();
        } else {
            vente.niveauRelance = relance.niveau();
        }
        RappelHistoriqueEntity historique = new RappelHistoriqueEntity();
        historique.vente = vente;
        historique.numeroRappel = relance.niveau();
        historique.destinataire = vente.client.email;
        historique.sujet = "Relance " + relance.niveau() + " ignorée";
        historique.ignoree = true;
        historique.motif = motif;
        historique.dateEnvoi = new Timestamp(System.currentTimeMillis());
        historique.persist();
    }

    /** Plus haut numéro de relance dont le délai est écoulé (0 si aucun). */
    static int niveauAtteint(Integer[] delais, long joursEcoules) {
        int niveau = 0;
        for (int i = 0; i < delais.length; i++) {
            if (delais[i] != null && joursEcoules >= delais[i]) {
                niveau = i + 1;
            }
        }
        return niveau;
    }

    /** Date d'échéance si renseignée, sinon date d'émission de la facture. */
    static LocalDate dateDepartRelance(VenteEntity vente) {
        if (vente.dateEcheance != null) {
            return toLocalDate(vente.dateEcheance);
        }
        return toLocalDate(dateFacture(vente));
    }

    private static Timestamp dateFacture(VenteEntity vente) {
        return vente.dateFacturePrete != null ? vente.dateFacturePrete : vente.date;
    }

    static Timestamp dateDevis(VenteEntity vente) {
        return vente.dateDevis != null ? vente.dateDevis : vente.date;
    }

    static LocalDate toLocalDate(Timestamp timestamp) {
        return timestamp != null ? timestamp.toLocalDateTime().toLocalDate() : null;
    }

    private static String formatDate(Timestamp timestamp) {
        return timestamp != null ? FORMAT_DATE.format(toLocalDate(timestamp)) : "non définie";
    }

    /** Envoie la relance n° {@code numeroRelance} (0 = relance manuelle) et l'inscrit à l'historique. */
    public void envoyerRelance(VenteEntity vente, int numeroRelance) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";
        String numeroFacture = vente.numeroFacture != null ? vente.numeroFacture : String.valueOf(vente.id);
        double soldeDu = VenteResource.soldeDu(vente);

        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("{client}", vente.client.nom != null ? vente.client.nom : "");
        variables.put("{numeroFacture}", numeroFacture);
        variables.put("{dateFacture}", formatDate(dateFacture(vente)));
        variables.put("{dateEcheance}", formatDate(vente.dateEcheance));
        variables.put("{montantTTC}", String.format("%.2f", vente.prixVenteTTC));
        variables.put("{montantRegle}", String.format("%.2f", vente.prixVenteTTC - soldeDu));
        variables.put("{soldeDu}", String.format("%.2f", soldeDu));
        variables.put("{numeroRelance}", numeroRelance > 0 ? String.valueOf(numeroRelance) : "");
        // Conditions figurant sur la facture (celles de la société à l'émission)
        variables.put("{conditionsPaiement}", vente.conditionsPaiement != null ? vente.conditionsPaiement : "");
        variables.put("{penalitesRetard}", vente.penalitesRetard != null ? vente.penalitesRetard : "");
        variables.put("{indemniteForfaitaire}", String.format("%.2f", vente.indemniteForfaitaire));
        variables.put("{societe}", societeNom);
        // Variables de l'ancien modèle de rappel, conservées pour les modèles déjà personnalisés
        variables.put("{reference}", numeroFacture);
        variables.put("{typeVente}", "facture");
        variables.put("{datePrevue}", formatDate(vente.date));
        variables.put("{numeroRappel}", numeroRelance > 0 ? String.valueOf(numeroRelance) : "");

        EmailTemplateEntity template = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.RAPPEL);
        envoyer(vente, numeroRelance,
            appliquerVariables(template != null ? template.sujet : EmailTemplateResource.RELANCE_SUJET, variables),
            appliquerVariables(template != null ? template.contenu : EmailTemplateResource.RELANCE_CONTENU, variables));
    }

    /** Envoie la relance n° {@code numeroRelance} (0 = relance manuelle) du devis/OR et l'inscrit à l'historique. */
    public void envoyerRelanceDevis(VenteEntity vente, int numeroRelance) {
        SocieteEntity societe = SocieteEntity.findById(1L);

        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("{client}", vente.client.nom != null ? vente.client.nom : "");
        variables.put("{typeDevis}", vente.ordreDeReparation ? "ordre de réparation" : "devis");
        variables.put("{numeroDevis}", vente.numeroFacture != null ? vente.numeroFacture : String.valueOf(vente.id));
        variables.put("{dateDevis}", formatDate(dateDevis(vente)));
        variables.put("{montantTTC}", String.format("%.2f", vente.prixVenteTTC));
        variables.put("{numeroRelance}", numeroRelance > 0 ? String.valueOf(numeroRelance) : "");
        variables.put("{societe}", societe != null ? societe.nom : "moussAIllon");

        EmailTemplateEntity template = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.RELANCE_DEVIS);
        envoyer(vente, numeroRelance,
            appliquerVariables(template != null ? template.sujet : EmailTemplateResource.RELANCE_DEVIS_SUJET, variables),
            appliquerVariables(template != null ? template.contenu : EmailTemplateResource.RELANCE_DEVIS_CONTENU, variables));
    }

    private void envoyer(VenteEntity vente, int numeroRelance, String subject, String body) {
        mailer.send(Mail.withHtml(vente.client.email, subject, body));

        RappelHistoriqueEntity historique = new RappelHistoriqueEntity();
        historique.vente = vente;
        historique.numeroRappel = numeroRelance;
        historique.destinataire = vente.client.email;
        historique.sujet = subject;
        historique.contenu = body;
        historique.dateEnvoi = new Timestamp(System.currentTimeMillis());
        historique.persist();
    }

    private static String appliquerVariables(String texte, Map<String, String> variables) {
        String resultat = texte;
        for (Map.Entry<String, String> variable : variables.entrySet()) {
            resultat = resultat.replace(variable.getKey(), variable.getValue());
        }
        return resultat;
    }
}
