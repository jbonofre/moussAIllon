package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

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

@ApplicationScoped
public class RappelScheduler {

    @Inject
    Mailer mailer;

    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional
    public void envoyerRappels() {
        LocalDate today = LocalDate.now();

        List<VenteEntity> ventes = VenteEntity.list(
                "status in (?1, ?2) and date is not null and client is not null",
                VenteEntity.Status.DEVIS, VenteEntity.Status.FACTURE_EN_ATTENTE);

        for (VenteEntity vente : ventes) {
            if (vente.client == null || !vente.client.consentement || vente.client.email == null || vente.client.email.isBlank()) {
                continue;
            }

            LocalDate dateVente = new Timestamp(vente.date.getTime()).toLocalDateTime().toLocalDate();
            long joursRestants = ChronoUnit.DAYS.between(today, dateVente);

            if (!vente.rappel1Envoye && vente.rappel1Jours != null && joursRestants <= vente.rappel1Jours) {
                envoyerRappel(vente, 1);
                vente.rappel1Envoye = true;
            }

            if (!vente.rappel2Envoye && vente.rappel2Jours != null && joursRestants <= vente.rappel2Jours) {
                envoyerRappel(vente, 2);
                vente.rappel2Envoye = true;
            }

            if (!vente.rappel3Envoye && vente.rappel3Jours != null && joursRestants <= vente.rappel3Jours) {
                envoyerRappel(vente, 3);
                vente.rappel3Envoye = true;
            }
        }
    }

    public void envoyerRappel(VenteEntity vente, int numeroRappel) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";
        String clientName = vente.client.prenom != null ? vente.client.prenom : vente.client.nom;

        String typeLabel = "prestation";

        String datePrevue = vente.date != null
                ? new Timestamp(vente.date.getTime()).toLocalDateTime().toLocalDate().toString()
                : "non définie";

        String numeroRappelStr = numeroRappel > 0 ? String.valueOf(numeroRappel) : "";

        EmailTemplateEntity template = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.RAPPEL);
        String subject;
        String body;
        if (template != null) {
            subject = applyVariables(template.sujet, clientName, typeLabel, vente, datePrevue, societeNom, numeroRappelStr);
            body = applyVariables(template.contenu, clientName, typeLabel, vente, datePrevue, societeNom, numeroRappelStr);
        } else {
            subject = numeroRappel > 0
                    ? "Rappel " + numeroRappel + " - Votre " + typeLabel + " - " + societeNom
                    : "Rappel - Votre " + typeLabel + " - " + societeNom;
            body = "Bonjour " + clientName + ",\n\n"
                    + "Ceci est un rappel concernant votre " + typeLabel
                    + " (référence #" + vente.id + ").\n\n"
                    + "Date prévue : " + datePrevue + "\n"
                    + "Montant TTC : " + String.format("%.2f", vente.prixVenteTTC) + " EUR\n\n"
                    + "N'hésitez pas à nous contacter pour toute question.\n\n"
                    + "Cordialement,\n" + societeNom;
        }

        mailer.send(Mail.withHtml(vente.client.email, subject, body));

        RappelHistoriqueEntity historique = new RappelHistoriqueEntity();
        historique.vente = vente;
        historique.numeroRappel = numeroRappel;
        historique.destinataire = vente.client.email;
        historique.sujet = subject;
        historique.contenu = body;
        historique.dateEnvoi = new Timestamp(System.currentTimeMillis());
        historique.persist();
    }

    private String applyVariables(String text, String clientName, String typeLabel, VenteEntity vente, String datePrevue, String societeNom, String numeroRappel) {
        return text
                .replace("{client}", clientName)
                .replace("{typeVente}", typeLabel)
                .replace("{reference}", String.valueOf(vente.id))
                .replace("{datePrevue}", datePrevue)
                .replace("{montantTTC}", String.format("%.2f", vente.prixVenteTTC))
                .replace("{societe}", societeNom)
                .replace("{numeroRappel}", numeroRappel);
    }
}
