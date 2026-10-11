package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import org.jboss.logging.Logger;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import net.nanthrax.moussaillon.persistence.BateauClientEntity;
import net.nanthrax.moussaillon.persistence.EmailTemplateEntity;
import net.nanthrax.moussaillon.persistence.MoteurClientEntity;
import net.nanthrax.moussaillon.persistence.RemorqueClientEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

/**
 * Gère le signal « prêt à récupérer » : posé sur une vente (prestation) et sur son bateau / moteur / remorque
 * client lorsque toutes les interventions sont terminées, avec envoi d'un mail au client. L'utilisateur
 * l'annule lorsque le client est venu récupérer son matériel.
 */
@ApplicationScoped
public class PretRecuperationService {

    private static final Logger LOG = Logger.getLogger(PretRecuperationService.class);

    @Inject
    Mailer mailer;

    /** Toutes les interventions non annulées sont terminées, et il y en a au moins une. */
    static boolean toutTermine(VenteEntity vente) {
        boolean allDone = vente.venteForfaits.stream()
                .allMatch(vf -> vf.status == VenteForfaitEntity.Status.TERMINEE || vf.status == VenteForfaitEntity.Status.ANNULEE)
                && vente.venteServices.stream()
                .allMatch(vs -> vs.status == VenteServiceEntity.Status.TERMINEE || vs.status == VenteServiceEntity.Status.ANNULEE);
        boolean atLeastOne = vente.venteForfaits.stream().anyMatch(vf -> vf.status == VenteForfaitEntity.Status.TERMINEE)
                || vente.venteServices.stream().anyMatch(vs -> vs.status == VenteServiceEntity.Status.TERMINEE);
        return allDone && atLeastOne;
    }

    /**
     * À appeler après toute modification d'une intervention. Pose le signal (et envoie le mail) à la première
     * fois où tout est terminé ; le retire si une intervention est rouverte.
     */
    public void evaluer(VenteEntity vente) {
        if (vente == null || (vente.venteForfaits.isEmpty() && vente.venteServices.isEmpty())) {
            return;
        }
        if (toutTermine(vente)) {
            if (!vente.pretRecuperationNotifie) {
                Timestamp now = new Timestamp(System.currentTimeMillis());
                vente.pretRecuperationNotifie = true;
                vente.datePretRecuperation = now;
                BateauClientEntity bateau = bateau(vente);
                if (bateau != null) bateau.datePretRecuperation = now;
                MoteurClientEntity moteur = moteur(vente);
                if (moteur != null) moteur.datePretRecuperation = now;
                RemorqueClientEntity remorque = remorque(vente);
                if (remorque != null) remorque.datePretRecuperation = now;
                envoyerMail(vente);
            }
        } else if (vente.pretRecuperationNotifie || vente.datePretRecuperation != null) {
            vente.pretRecuperationNotifie = false;
            retirerSignal(vente);
        }
    }

    /** Le client est venu récupérer son matériel : retire le signal de la vente et de son matériel. */
    public void annuler(VenteEntity vente) {
        retirerSignal(vente);
    }

    public void annulerBateau(BateauClientEntity bateau) {
        bateau.datePretRecuperation = null;
        retirerVentesSansMateriel(VenteEntity.list("bateau", bateau));
    }

    public void annulerMoteur(MoteurClientEntity moteur) {
        moteur.datePretRecuperation = null;
        retirerVentesSansMateriel(VenteEntity.list("moteur", moteur));
    }

    public void annulerRemorque(RemorqueClientEntity remorque) {
        remorque.datePretRecuperation = null;
        retirerVentesSansMateriel(VenteEntity.list("remorque", remorque));
    }

    private void retirerVentesSansMateriel(List<VenteEntity> ventes) {
        for (VenteEntity v : ventes) {
            boolean materielPret = (v.bateau != null && v.bateau.datePretRecuperation != null)
                    || (v.moteur != null && v.moteur.datePretRecuperation != null)
                    || (v.remorque != null && v.remorque.datePretRecuperation != null);
            if (!materielPret) {
                v.datePretRecuperation = null;
            }
        }
    }

    private void retirerSignal(VenteEntity vente) {
        vente.datePretRecuperation = null;
        // Le matériel reste signalé tant qu'une autre prestation le déclare prêt
        BateauClientEntity bateau = bateau(vente);
        if (bateau != null && !autreVentePrete("bateau", bateau, vente)) {
            bateau.datePretRecuperation = null;
        }
        MoteurClientEntity moteur = moteur(vente);
        if (moteur != null && !autreVentePrete("moteur", moteur, vente)) {
            moteur.datePretRecuperation = null;
        }
        RemorqueClientEntity remorque = remorque(vente);
        if (remorque != null && !autreVentePrete("remorque", remorque, vente)) {
            remorque.datePretRecuperation = null;
        }
    }

    // Les références portées par une vente désérialisée peuvent être détachées : on recharge l'entité gérée
    private static BateauClientEntity bateau(VenteEntity vente) {
        return vente.bateau != null && vente.bateau.id != null ? BateauClientEntity.findById(vente.bateau.id) : null;
    }

    private static MoteurClientEntity moteur(VenteEntity vente) {
        return vente.moteur != null && vente.moteur.id != null ? MoteurClientEntity.findById(vente.moteur.id) : null;
    }

    private static RemorqueClientEntity remorque(VenteEntity vente) {
        return vente.remorque != null && vente.remorque.id != null ? RemorqueClientEntity.findById(vente.remorque.id) : null;
    }

    private boolean autreVentePrete(String champ, Object materiel, VenteEntity vente) {
        return VenteEntity.count(champ + " = ?1 and datePretRecuperation is not null and id <> ?2",
                materiel, vente.id) > 0;
    }

    private void envoyerMail(VenteEntity vente) {
        if (vente.client == null || !vente.client.consentement
                || vente.client.email == null || vente.client.email.isBlank()) {
            return;
        }
        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";
        String client = vente.client.nom != null ? vente.client.nom : "";
        String reference = String.valueOf(vente.id);
        String materiel = libelleMateriel(vente);

        EmailTemplateEntity template = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.PRET_A_RECUPERER);
        String subject;
        String body;
        if (template != null) {
            subject = remplacer(template.sujet, client, materiel, reference, societeNom);
            body = remplacer(template.contenu, client, materiel, reference, societeNom);
        } else {
            subject = "Votre matériel est prêt - " + societeNom;
            body = "<p>Bonjour " + client + ",</p>"
                    + "<p>Les travaux sur votre " + materiel + " sont terminés (référence #" + reference
                    + ") : vous pouvez venir le récupérer.</p>"
                    + "<p>Cordialement,<br/>" + societeNom + "</p>";
        }
        try {
            mailer.send(Mail.withHtml(vente.client.email, subject, body));
        } catch (RuntimeException e) {
            LOG.warn("Impossible d'envoyer le mail « prêt à récupérer » pour la vente " + vente.id, e);
        }
    }

    private static String remplacer(String texte, String client, String materiel, String reference, String societe) {
        return texte.replace("{client}", client)
                .replace("{materiel}", materiel)
                .replace("{reference}", reference)
                .replace("{societe}", societe);
    }

    private static String libelleMateriel(VenteEntity vente) {
        List<String> parts = new ArrayList<>();
        if (vente.bateau != null) parts.add(vente.bateau.name != null && !vente.bateau.name.isBlank()
                ? "bateau « " + vente.bateau.name + " »" : "bateau");
        if (vente.moteur != null) parts.add("moteur");
        if (vente.remorque != null) parts.add("remorque");
        return parts.isEmpty() ? "matériel" : String.join(" / ", parts);
    }
}
