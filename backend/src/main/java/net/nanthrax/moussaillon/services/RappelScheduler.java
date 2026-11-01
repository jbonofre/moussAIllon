package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
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
 * Relances de paiement automatiques des factures émises non soldées.
 * Les délais (J+N) sont paramétrés une fois pour toutes sur la société et comptés à partir
 * de la date d'échéance de la facture, ou de sa date d'émission si aucune échéance n'est renseignée.
 */
@ApplicationScoped
public class RappelScheduler {

    private static final DateTimeFormatter FORMAT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Inject
    Mailer mailer;

    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional
    public void envoyerRelances() {
        SocieteEntity societe = SocieteEntity.findById(1L);
        if (societe == null) {
            return;
        }
        Integer[] delais = { societe.relance1Jours, societe.relance2Jours, societe.relance3Jours };
        LocalDate today = LocalDate.now();

        List<VenteEntity> factures = VenteEntity.list("status = ?1 and client is not null", VenteEntity.Status.FACTURE_PRETE);
        for (VenteEntity vente : factures) {
            if (!vente.client.consentement || vente.client.email == null || vente.client.email.isBlank()) {
                continue;
            }
            if (VenteResource.soldeDu(vente) <= 0.005) {
                continue;
            }
            LocalDate depart = dateDepartRelance(vente);
            if (depart == null) {
                continue;
            }
            int niveau = niveauAtteint(delais, ChronoUnit.DAYS.between(depart, today));
            // Une seule relance par passage : la plus avancée atteinte, sans rattraper les précédentes.
            if (niveau > vente.niveauRelance) {
                envoyerRelance(vente, niveau);
                vente.niveauRelance = niveau;
            }
        }
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

    private static LocalDate toLocalDate(Timestamp timestamp) {
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
        String subject = appliquerVariables(template != null ? template.sujet : EmailTemplateResource.RELANCE_SUJET, variables);
        String body = appliquerVariables(template != null ? template.contenu : EmailTemplateResource.RELANCE_CONTENU, variables);

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
