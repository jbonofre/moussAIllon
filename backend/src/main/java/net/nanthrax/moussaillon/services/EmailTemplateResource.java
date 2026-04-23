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
            return Response.ok().build();
        }

        EmailTemplateEntity rappel = new EmailTemplateEntity();
        rappel.type = EmailTemplateEntity.Type.RAPPEL;
        rappel.sujet = "Rappel {numeroRappel} - Votre {typeVente} - {societe}";
        rappel.contenu = "<p>Bonjour {client},</p>"
                + "<p>Ceci est un rappel concernant votre {typeVente} (référence #{reference}).</p>"
                + "<p>Date prévue : {datePrevue}<br/>Montant TTC : {montantTTC} EUR</p>"
                + "<p>N'hésitez pas à nous contacter pour toute question.</p>"
                + "<p>Cordialement,<br/>{societe}</p>";
        rappel.description = "Variables disponibles : {client}, {typeVente}, {reference}, {datePrevue}, {montantTTC}, {societe}, {numeroRappel}";
        rappel.persist();

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

        return Response.status(Response.Status.CREATED).build();
    }

}
