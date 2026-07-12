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
import net.nanthrax.moussaillon.persistence.BateauClientEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.EmailSequenceEtapeEntity;
import net.nanthrax.moussaillon.persistence.EmailSequenceEtapeEntity.Cible;
import net.nanthrax.moussaillon.persistence.EmailSequenceHistoriqueEntity;
import net.nanthrax.moussaillon.persistence.MoteurClientEntity;
import net.nanthrax.moussaillon.persistence.RemorqueClientEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import org.jboss.logging.Logger;

@ApplicationScoped
public class EmailSequenceScheduler {

    private static final Logger LOG = Logger.getLogger(EmailSequenceScheduler.class);

    @Inject
    Mailer mailer;

    @Scheduled(cron = "0 5 8 * * ?")
    @Transactional
    public void envoyerSequences() {
        LocalDate today = LocalDate.now();

        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";

        traiterClients(today, societeNom);
        traiterBateaux(today, societeNom);
        traiterMoteurs(today, societeNom);
        traiterRemorques(today, societeNom);
    }

    /**
     * Déclenche immédiatement (sans attendre le cron du lendemain) l'étape de bienvenue
     * (delaiJours = 0) pour un bateau qui vient d'être enregistré, c'est-à-dire une "entrée en parc".
     */
    @Transactional
    public void declencherEntreeEnParc(BateauClientEntity bateau) {
        List<EmailSequenceEtapeEntity> etapes = EmailSequenceEtapeEntity.listActivesByCible(Cible.BATEAU);
        if (etapes.isEmpty()) return;

        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";

        traiterBateau(LocalDate.now(), societeNom, etapes, bateau);
    }

    private void traiterClients(LocalDate today, String societeNom) {
        List<EmailSequenceEtapeEntity> etapes = EmailSequenceEtapeEntity.listActivesByCible(Cible.CLIENT);
        if (etapes.isEmpty()) return;

        List<ClientEntity> clients = ClientEntity.list("dateCreation is not null and email is not null and consentement = true");
        for (ClientEntity client : clients) {
            if (client.email == null || client.email.isBlank()) continue;
            LocalDate dateCreation = client.dateCreation.toLocalDateTime().toLocalDate();
            String clientName = client.prenom != null && !client.prenom.isBlank() ? client.prenom : client.nom;

            for (EmailSequenceEtapeEntity etape : etapes) {
                long jours = ChronoUnit.DAYS.between(dateCreation, today);
                if (jours >= etape.delaiJours && !EmailSequenceHistoriqueEntity.dejaSent(Cible.CLIENT, client.id, etape.id)) {
                    String subject = applyClientVariables(etape.sujet, clientName, societeNom, client);
                    String body = applyClientVariables(etape.contenu, clientName, societeNom, client);
                    envoyerEtape(Cible.CLIENT, client.id, client.email, etape, subject, body);
                }
            }
        }
    }

    private void traiterBateaux(LocalDate today, String societeNom) {
        List<EmailSequenceEtapeEntity> etapes = EmailSequenceEtapeEntity.listActivesByCible(Cible.BATEAU);
        if (etapes.isEmpty()) return;

        List<BateauClientEntity> bateaux = BateauClientEntity.list("dateCreation is not null");
        for (BateauClientEntity bateau : bateaux) {
            traiterBateau(today, societeNom, etapes, bateau);
        }
    }

    private void traiterBateau(LocalDate today, String societeNom, List<EmailSequenceEtapeEntity> etapes, BateauClientEntity bateau) {
        if (bateau.proprietaires == null || bateau.proprietaires.isEmpty()) return;
        if (bateau.dateCreation == null) return;
        LocalDate dateCreation = bateau.dateCreation.toLocalDateTime().toLocalDate();

        for (ClientEntity proprietaire : bateau.proprietaires) {
            if (!proprietaire.consentement) continue;
            if (proprietaire.email == null || proprietaire.email.isBlank()) continue;
            String clientName = proprietaire.prenom != null && !proprietaire.prenom.isBlank() ? proprietaire.prenom : proprietaire.nom;
            String bateauNom = bateau.name != null ? bateau.name : (bateau.immatriculation != null ? bateau.immatriculation : String.valueOf(bateau.id));

            for (EmailSequenceEtapeEntity etape : etapes) {
                long jours = ChronoUnit.DAYS.between(dateCreation, today);
                if (jours >= etape.delaiJours && !EmailSequenceHistoriqueEntity.dejaSent(Cible.BATEAU, bateau.id, etape.id)) {
                    String subject = applyEquipementVariables(etape.sujet, clientName, societeNom, bateauNom, proprietaire);
                    String body = applyEquipementVariables(etape.contenu, clientName, societeNom, bateauNom, proprietaire);
                    envoyerEtape(Cible.BATEAU, bateau.id, proprietaire.email, etape, subject, body);
                }
            }
        }
    }

    private void traiterMoteurs(LocalDate today, String societeNom) {
        List<EmailSequenceEtapeEntity> etapes = EmailSequenceEtapeEntity.listActivesByCible(Cible.MOTEUR);
        if (etapes.isEmpty()) return;

        List<MoteurClientEntity> moteurs = MoteurClientEntity.list("dateCreation is not null");
        for (MoteurClientEntity moteur : moteurs) {
            if (moteur.proprietaire == null || !moteur.proprietaire.consentement || moteur.proprietaire.email == null || moteur.proprietaire.email.isBlank()) continue;
            LocalDate dateCreation = moteur.dateCreation.toLocalDateTime().toLocalDate();
            String clientName = moteur.proprietaire.prenom != null && !moteur.proprietaire.prenom.isBlank() ? moteur.proprietaire.prenom : moteur.proprietaire.nom;
            String moteurNom = moteur.numeroSerie != null ? moteur.numeroSerie : String.valueOf(moteur.id);

            for (EmailSequenceEtapeEntity etape : etapes) {
                long jours = ChronoUnit.DAYS.between(dateCreation, today);
                if (jours >= etape.delaiJours && !EmailSequenceHistoriqueEntity.dejaSent(Cible.MOTEUR, moteur.id, etape.id)) {
                    String subject = applyEquipementVariables(etape.sujet, clientName, societeNom, moteurNom, moteur.proprietaire);
                    String body = applyEquipementVariables(etape.contenu, clientName, societeNom, moteurNom, moteur.proprietaire);
                    envoyerEtape(Cible.MOTEUR, moteur.id, moteur.proprietaire.email, etape, subject, body);
                }
            }
        }
    }

    private void traiterRemorques(LocalDate today, String societeNom) {
        List<EmailSequenceEtapeEntity> etapes = EmailSequenceEtapeEntity.listActivesByCible(Cible.REMORQUE);
        if (etapes.isEmpty()) return;

        List<RemorqueClientEntity> remorques = RemorqueClientEntity.list("dateCreation is not null");
        for (RemorqueClientEntity remorque : remorques) {
            if (remorque.proprietaire == null || !remorque.proprietaire.consentement || remorque.proprietaire.email == null || remorque.proprietaire.email.isBlank()) continue;
            LocalDate dateCreation = remorque.dateCreation.toLocalDateTime().toLocalDate();
            String clientName = remorque.proprietaire.prenom != null && !remorque.proprietaire.prenom.isBlank() ? remorque.proprietaire.prenom : remorque.proprietaire.nom;
            String remorqueNom = remorque.immatriculation != null ? remorque.immatriculation : String.valueOf(remorque.id);

            for (EmailSequenceEtapeEntity etape : etapes) {
                long jours = ChronoUnit.DAYS.between(dateCreation, today);
                if (jours >= etape.delaiJours && !EmailSequenceHistoriqueEntity.dejaSent(Cible.REMORQUE, remorque.id, etape.id)) {
                    String subject = applyEquipementVariables(etape.sujet, clientName, societeNom, remorqueNom, remorque.proprietaire);
                    String body = applyEquipementVariables(etape.contenu, clientName, societeNom, remorqueNom, remorque.proprietaire);
                    envoyerEtape(Cible.REMORQUE, remorque.id, remorque.proprietaire.email, etape, subject, body);
                }
            }
        }
    }

    private void envoyerEtape(Cible cible, long cibleId, String email, EmailSequenceEtapeEntity etape, String subject, String body) {
        try {
            mailer.send(Mail.withHtml(email, subject, body));
        } catch (Exception e) {
            LOG.warnf(e, "Échec de l'envoi de l'email de séquence (cible=%s, cibleId=%d, etapeId=%d) à %s", cible, cibleId, etape.id, email);
            return;
        }

        EmailSequenceHistoriqueEntity historique = new EmailSequenceHistoriqueEntity();
        historique.cible = cible;
        historique.cibleId = cibleId;
        historique.etape = etape;
        historique.destinataire = email;
        historique.sujet = subject;
        historique.contenu = body;
        historique.dateEnvoi = new Timestamp(System.currentTimeMillis());
        historique.persist();
    }

    private String applyClientVariables(String text, String clientName, String societeNom, ClientEntity client) {
        return text
                .replace("{client}", clientName)
                .replace("{societe}", societeNom)
                .replace("{email}", client.email != null ? client.email : "")
                .replace("{telephone}", client.telephone != null ? client.telephone : "");
    }

    private String applyEquipementVariables(String text, String clientName, String societeNom, String equipementNom, ClientEntity proprietaire) {
        return text
                .replace("{client}", clientName)
                .replace("{societe}", societeNom)
                .replace("{equipement}", equipementNom)
                .replace("{email}", proprietaire.email != null ? proprietaire.email : "")
                .replace("{telephone}", proprietaire.telephone != null ? proprietaire.telephone : "");
    }

}
