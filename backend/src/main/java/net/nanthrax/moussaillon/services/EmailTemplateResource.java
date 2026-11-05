package net.nanthrax.moussaillon.services;

import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.EmailTemplateEntity;

@Path("/email-templates")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class EmailTemplateResource {

    // Modèle de type RAPPEL : relance de paiement d'une facture émise non soldée.
    static final String RELANCE_SUJET = "Relance de paiement - Facture {numeroFacture} - {societe}";
    static final String RELANCE_CONTENU = "<p>Bonjour {client},</p>"
            + "<p>Sauf erreur de notre part, votre facture {numeroFacture} du {dateFacture} n'est pas encore entièrement réglée.</p>"
            + "<p>Montant TTC : {montantTTC} EUR<br/>Déjà réglé : {montantRegle} EUR<br/>"
            + "<strong>Solde dû : {soldeDu} EUR</strong><br/>Date d'échéance : {dateEcheance}</p>"
            + "<p>Nous vous remercions de bien vouloir procéder à son règlement dans les meilleurs délais. "
            + "Si vous l'avez réglée entre-temps, merci de ne pas tenir compte de ce message.</p>"
            + "<p>Cordialement,<br/>{societe}</p>";
    static final String RELANCE_DESCRIPTION = "Variables disponibles : {client}, {numeroFacture}, {dateFacture}, {dateEcheance}, {montantTTC}, "
            + "{montantRegle}, {soldeDu}, {numeroRelance}, {conditionsPaiement}, {penalitesRetard}, {indemniteForfaitaire}, {societe}";

    // Modèle de type RELANCE_DEVIS : relance d'un devis/OR en attente de signature.
    static final String RELANCE_DEVIS_SUJET = "Votre {typeDevis} {numeroDevis} - {societe}";
    static final String RELANCE_DEVIS_CONTENU = "<p>Bonjour {client},</p>"
            + "<p>Nous vous avons adressé le {dateDevis} notre {typeDevis} {numeroDevis}, pour lequel nous n'avons pas encore "
            + "reçu votre accord.</p>"
            + "<p>Nous restons à votre disposition pour toute question ou modification, "
            + "et pour planifier l'intervention dès réception de votre bon pour accord.</p>"
            + "<p>Si vous avez déjà donné suite, merci de ne pas tenir compte de ce message.</p>"
            + "<p>Cordialement,<br/>{societe}</p>";
    static final String RELANCE_DEVIS_DESCRIPTION = "Variables disponibles : {client}, {typeDevis}, {numeroDevis}, {dateDevis}, "
            + "{montantTTC}, {numeroRelance}, {societe}";

    // Modèle de type RELANCE_2 : deuxième relance de paiement, plus ferme.
    static final String RELANCE_2_SUJET = "Deuxième relance - Facture {numeroFacture} - {societe}";
    static final String RELANCE_2_CONTENU = "<p>Bonjour {client},</p>"
            + "<p>Malgré notre précédente relance, votre facture {numeroFacture} du {dateFacture} n'est toujours pas "
            + "entièrement réglée.</p>"
            + "<p>Montant TTC : {montantTTC} EUR<br/>Déjà réglé : {montantRegle} EUR<br/>"
            + "<strong>Solde dû : {soldeDu} EUR</strong><br/>Date d'échéance : {dateEcheance}</p>"
            + "<p>Nous vous demandons de bien vouloir procéder à son règlement sous huit jours. Passé ce délai, "
            + "les pénalités de retard prévues par nos conditions de paiement pourront vous être appliquées.</p>"
            + "<p>Si vous l'avez réglée entre-temps, merci de ne pas tenir compte de ce message.</p>"
            + "<p>Cordialement,<br/>{societe}</p>";

    // Modèle de type RELANCE_3 : mise en demeure de payer, reprise dans le courrier quand la relance 3 part par courrier.
    static final String RELANCE_3_SUJET = "Mise en demeure de payer - Facture {numeroFacture} - {societe}";
    static final String RELANCE_3_CONTENU = "<p>Madame, Monsieur,</p>"
            + "<p>Malgré nos relances précédentes, votre facture {numeroFacture} du {dateFacture} reste impayée à ce jour.</p>"
            + "<p>Montant TTC : {montantTTC} EUR<br/>Déjà réglé : {montantRegle} EUR<br/>"
            + "<strong>Solde dû : {soldeDu} EUR</strong><br/>Date d'échéance : {dateEcheance}</p>"
            + "<p>Par la présente, nous vous mettons en demeure de nous régler la somme de {soldeDu} EUR dans un délai "
            + "de huit jours à compter de sa réception.</p>"
            + "<p>À défaut de règlement dans ce délai, nous nous réservons le droit d'engager une procédure de recouvrement, "
            + "sans autre avis. Les pénalités de retard et l'indemnité forfaitaire pour frais de recouvrement prévues par nos "
            + "conditions de paiement pourront vous être réclamées.</p>"
            + "<p>Si vous avez procédé au règlement entre-temps, merci de ne pas tenir compte de ce message.</p>"
            + "<p>Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>"
            + "<p>{societe}</p>";

    // Modèle de type RELANCE_DEVIS_2 : deuxième relance d'un devis/OR en attente de signature.
    static final String RELANCE_DEVIS_2_SUJET = "Relance : votre {typeDevis} {numeroDevis} - {societe}";
    static final String RELANCE_DEVIS_2_CONTENU = "<p>Bonjour {client},</p>"
            + "<p>Nous revenons vers vous au sujet de notre {typeDevis} {numeroDevis} du {dateDevis}, d'un montant de "
            + "{montantTTC} EUR TTC, pour lequel nous n'avons pas encore reçu votre accord.</p>"
            + "<p>Avez-vous pu en prendre connaissance ? Nous pouvons l'ajuster à vos besoins, "
            + "et planifierons l'intervention dès réception de votre bon pour accord.</p>"
            + "<p>Si vous avez déjà donné suite, merci de ne pas tenir compte de ce message.</p>"
            + "<p>Cordialement,<br/>{societe}</p>";

    // Modèle de type RELANCE_DEVIS_3 : dernière relance d'un devis/OR en attente de signature.
    static final String RELANCE_DEVIS_3_SUJET = "Dernière relance : votre {typeDevis} {numeroDevis} - {societe}";
    static final String RELANCE_DEVIS_3_CONTENU = "<p>Bonjour {client},</p>"
            + "<p>Sans retour de votre part concernant notre {typeDevis} {numeroDevis} du {dateDevis} "
            + "({montantTTC} EUR TTC), nous nous permettons une dernière relance.</p>"
            + "<p>Pour y donner suite, il vous suffit de nous retourner votre bon pour accord : nous planifierons "
            + "l'intervention selon les disponibilités de l'atelier. Sans réponse de votre part, nous considérerons "
            + "que vous ne souhaitez pas donner suite.</p>"
            + "<p>Cordialement,<br/>{societe}</p>";

    // Modèles des relances 1 à 3, de paiement et de devis/OR
    private static final EmailTemplateEntity.Type[] RELANCES_PAIEMENT = {
        EmailTemplateEntity.Type.RAPPEL, EmailTemplateEntity.Type.RELANCE_2, EmailTemplateEntity.Type.RELANCE_3
    };
    private static final EmailTemplateEntity.Type[] RELANCES_DEVIS = {
        EmailTemplateEntity.Type.RELANCE_DEVIS, EmailTemplateEntity.Type.RELANCE_DEVIS_2, EmailTemplateEntity.Type.RELANCE_DEVIS_3
    };

    // Ancien modèle par défaut (rappel avant la date de la prestation), remplacé s'il n'a pas été personnalisé.
    private static final String ANCIEN_RAPPEL_SUJET = "Rappel {numeroRappel} - Votre {typeVente} - {societe}";
    private static final String ANCIEN_RAPPEL_CONTENU = "<p>Bonjour {client},</p>"
            + "<p>Ceci est un rappel concernant votre {typeVente} (référence #{reference}).</p>"
            + "<p>Date prévue : {datePrevue}<br/>Montant TTC : {montantTTC} EUR</p>"
            + "<p>N'hésitez pas à nous contacter pour toute question.</p>"
            + "<p>Cordialement,<br/>{societe}</p>";

    @GET
    public List<EmailTemplateEntity> list() {
        return EmailTemplateEntity.listAll();
    }

    @GET
    @Path("{id}")
    public EmailTemplateEntity get(@PathParam("id") long id) {
        EmailTemplateEntity entity = EmailTemplateEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le modèle d'email (" + id + ") n'est pas trouvé", 404);
        }
        return entity;
    }

    @PUT
    @Path("{id}")
    @Transactional
    public EmailTemplateEntity update(@PathParam("id") long id, EmailTemplateEntity template) {
        EmailTemplateEntity entity = EmailTemplateEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le modèle d'email (" + id + ") n'est pas trouvé", 404);
        }
        entity.sujet = template.sujet;
        entity.contenu = template.contenu;
        entity.description = template.description;
        return entity;
    }

    @POST
    @Path("/init")
    @Transactional
    public Response init() {
        if (EmailTemplateEntity.count() > 0) {
            // Ajouter le template FACTURE s'il n'existe pas encore (migration)
            if (EmailTemplateEntity.findByType(EmailTemplateEntity.Type.FACTURE) == null) {
                EmailTemplateEntity facture = new EmailTemplateEntity();
                facture.type = EmailTemplateEntity.Type.FACTURE;
                facture.sujet = "Votre {typeVente} #{reference} - {societe}";
                facture.contenu = "<p>Bonjour {client},</p>"
                        + "<p>Veuillez trouver les informations de votre {typeVente} #{reference}.</p>"
                        + "<table><tr><td><strong>Date</strong></td><td>{date}</td></tr>"
                        + "<tr><td><strong>Type</strong></td><td>{typeVente}</td></tr>"
                        + "<tr><td><strong>Statut</strong></td><td>{statut}</td></tr>"
                        + "<tr><td><strong>Prix vente TTC</strong></td><td>{prixVenteTTC}</td></tr>"
                        + "<tr><td><strong>Mode de paiement</strong></td><td>{modePaiement}</td></tr></table>"
                        + "<p><strong>Lignes :</strong><br/>{lignes}</p>"
                        + "<p>N'hésitez pas à nous contacter pour toute question.</p>"
                        + "<p>Cordialement,<br/>{societe}</p>";
                facture.description = "Variables disponibles : {client}, {typeVente}, {reference}, {date}, {statut}, {prixVenteTTC}, {modePaiement}, {lignes}, {societe}";
                facture.persist();
            }
            // Ajouter le template AVOIR s'il n'existe pas encore (migration)
            if (EmailTemplateEntity.findByType(EmailTemplateEntity.Type.AVOIR) == null) {
                EmailTemplateEntity avoir = new EmailTemplateEntity();
                avoir.type = EmailTemplateEntity.Type.AVOIR;
                avoir.sujet = "Votre avoir #{reference} - {societe}";
                avoir.contenu = "<p>Bonjour {client},</p>"
                        + "<p>Nous vous adressons votre avoir #{reference}.</p>"
                        + "<table><tr><td><strong>Date</strong></td><td>{date}</td></tr>"
                        + "<tr><td><strong>Motif</strong></td><td>{motif}</td></tr>"
                        + "<tr><td><strong>Facture d'origine</strong></td><td>{venteRef}</td></tr>"
                        + "<tr><td><strong>Montant TTC</strong></td><td>{montantTTC}</td></tr></table>"
                        + "<p><strong>Lignes :</strong><br/>{lignes}</p>"
                        + "<p>N'hésitez pas à nous contacter pour toute question.</p>"
                        + "<p>Cordialement,<br/>{societe}</p>";
                avoir.description = "Variables disponibles : {client}, {reference}, {date}, {motif}, {venteRef}, {montantTTC}, {lignes}, {societe}";
                avoir.persist();
            }
            if (EmailTemplateEntity.findByType(EmailTemplateEntity.Type.PRET_A_RECUPERER) == null) {
                creerTemplatePret().persist();
            }
            creerModelesRelanceManquants();
            return Response.ok().build();
        }

        creerModelesRelanceManquants();

        EmailTemplateEntity incident = new EmailTemplateEntity();
        incident.type = EmailTemplateEntity.Type.INCIDENT;
        incident.sujet = "Incident sur votre intervention - {societe}";
        incident.contenu = "<p>Bonjour {client},</p>"
                + "<p>Nous vous informons qu'un incident a été signalé sur l'intervention \"{intervention}\".</p>"
                + "<p>{details}{dateIncident}</p>"
                + "<p>Notre équipe met tout en œuvre pour résoudre la situation dans les meilleurs délais.</p>"
                + "<p>Cordialement,<br/>{societe}</p>";
        incident.description = "Variables disponibles : {client}, {intervention}, {details}, {dateIncident}, {societe}";
        incident.persist();

        EmailTemplateEntity facture = new EmailTemplateEntity();
        facture.type = EmailTemplateEntity.Type.FACTURE;
        facture.sujet = "Votre {typeVente} #{reference} - {societe}";
        facture.contenu = "<p>Bonjour {client},</p>"
                + "<p>Veuillez trouver les informations de votre {typeVente} #{reference}.</p>"
                + "<table><tr><td><strong>Date</strong></td><td>{date}</td></tr>"
                + "<tr><td><strong>Type</strong></td><td>{typeVente}</td></tr>"
                + "<tr><td><strong>Statut</strong></td><td>{statut}</td></tr>"
                + "<tr><td><strong>Prix vente TTC</strong></td><td>{prixVenteTTC}</td></tr>"
                + "<tr><td><strong>Mode de paiement</strong></td><td>{modePaiement}</td></tr></table>"
                + "<p><strong>Lignes :</strong><br/>{lignes}</p>"
                + "<p>N'hésitez pas à nous contacter pour toute question.</p>"
                + "<p>Cordialement,<br/>{societe}</p>";
        facture.description = "Variables disponibles : {client}, {typeVente}, {reference}, {date}, {statut}, {prixVenteTTC}, {modePaiement}, {lignes}, {societe}";
        facture.persist();

        EmailTemplateEntity avoir = new EmailTemplateEntity();
        avoir.type = EmailTemplateEntity.Type.AVOIR;
        avoir.sujet = "Votre avoir #{reference} - {societe}";
        avoir.contenu = "<p>Bonjour {client},</p>"
                + "<p>Nous vous adressons votre avoir #{reference}.</p>"
                + "<table><tr><td><strong>Date</strong></td><td>{date}</td></tr>"
                + "<tr><td><strong>Motif</strong></td><td>{motif}</td></tr>"
                + "<tr><td><strong>Facture d'origine</strong></td><td>{venteRef}</td></tr>"
                + "<tr><td><strong>Montant TTC</strong></td><td>{montantTTC}</td></tr></table>"
                + "<p><strong>Lignes :</strong><br/>{lignes}</p>"
                + "<p>N'hésitez pas à nous contacter pour toute question.</p>"
                + "<p>Cordialement,<br/>{societe}</p>";
        avoir.description = "Variables disponibles : {client}, {reference}, {date}, {motif}, {venteRef}, {montantTTC}, {lignes}, {societe}";
        avoir.persist();

        creerTemplatePret().persist();

        return Response.status(Response.Status.CREATED).build();
    }

    /** Crée les modèles des relances 1 à 3 (paiement et devis) qui n'existent pas encore. */
    private static void creerModelesRelanceManquants() {
        for (EmailTemplateEntity.Type[] types : List.of(RELANCES_PAIEMENT, RELANCES_DEVIS)) {
            for (EmailTemplateEntity.Type type : types) {
                if (EmailTemplateEntity.findByType(type) == null) {
                    modeleRelanceParDefaut(type).persist();
                }
            }
        }
    }

    /**
     * Modèle de la relance n° {@code niveau} (1 à 3) de paiement ou de devis/OR, ou son contenu par défaut
     * s'il n'a pas encore été créé.
     */
    static EmailTemplateEntity modeleRelance(boolean devis, int niveau) {
        EmailTemplateEntity.Type type = (devis ? RELANCES_DEVIS : RELANCES_PAIEMENT)[Math.max(1, Math.min(niveau, 3)) - 1];
        EmailTemplateEntity modele = EmailTemplateEntity.findByType(type);
        return modele != null ? modele : modeleRelanceParDefaut(type);
    }

    private static EmailTemplateEntity modeleRelanceParDefaut(EmailTemplateEntity.Type type) {
        EmailTemplateEntity relance = new EmailTemplateEntity();
        relance.type = type;
        relance.description = RELANCE_DESCRIPTION;
        switch (type) {
            case RELANCE_2 -> {
                relance.sujet = RELANCE_2_SUJET;
                relance.contenu = RELANCE_2_CONTENU;
            }
            case RELANCE_3 -> {
                relance.sujet = RELANCE_3_SUJET;
                relance.contenu = RELANCE_3_CONTENU;
            }
            case RELANCE_DEVIS -> {
                relance.sujet = RELANCE_DEVIS_SUJET;
                relance.contenu = RELANCE_DEVIS_CONTENU;
                relance.description = RELANCE_DEVIS_DESCRIPTION;
            }
            case RELANCE_DEVIS_2 -> {
                relance.sujet = RELANCE_DEVIS_2_SUJET;
                relance.contenu = RELANCE_DEVIS_2_CONTENU;
                relance.description = RELANCE_DEVIS_DESCRIPTION;
            }
            case RELANCE_DEVIS_3 -> {
                relance.sujet = RELANCE_DEVIS_3_SUJET;
                relance.contenu = RELANCE_DEVIS_3_CONTENU;
                relance.description = RELANCE_DEVIS_DESCRIPTION;
            }
            default -> {
                relance.sujet = RELANCE_SUJET;
                relance.contenu = RELANCE_CONTENU;
            }
        }
        return relance;
    }

    /**
     * Les rappels avant prestation sont devenus des relances de paiement : le modèle RAPPEL
     * resté à son contenu par défaut prend le nouveau texte, un modèle personnalisé est conservé.
     * Idempotent, appelé au démarrage.
     */
    static void migrerModeleRelance() {
        EmailTemplateEntity rappel = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.RAPPEL);
        if (rappel == null) {
            return;
        }
        if (ANCIEN_RAPPEL_SUJET.equals(rappel.sujet)) {
            rappel.sujet = RELANCE_SUJET;
        }
        if (ANCIEN_RAPPEL_CONTENU.equals(rappel.contenu)) {
            rappel.contenu = RELANCE_CONTENU;
        }
        rappel.description = RELANCE_DESCRIPTION;
    }

    private static EmailTemplateEntity creerTemplatePret() {
        EmailTemplateEntity pret = new EmailTemplateEntity();
        pret.type = EmailTemplateEntity.Type.PRET_A_RECUPERER;
        pret.sujet = "Votre matériel est prêt - {societe}";
        pret.contenu = "<p>Bonjour {client},</p>"
                + "<p>Les travaux sur votre {materiel} sont terminés (référence #{reference}) : "
                + "vous pouvez venir le récupérer.</p>"
                + "<p>N'hésitez pas à nous contacter pour convenir d'un rendez-vous.</p>"
                + "<p>Cordialement,<br/>{societe}</p>";
        pret.description = "Variables disponibles : {client}, {materiel}, {reference}, {societe}";
        return pret;
    }

}
