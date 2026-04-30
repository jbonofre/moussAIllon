package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.util.List;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.AvoirEntity;
import net.nanthrax.moussaillon.persistence.AvoirLigneEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.EmailTemplateEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

@Path("/avoirs")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AvoirResource {

    @Inject
    Mailer mailer;

    @GET
    public List<AvoirEntity> list() {
        return AvoirEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<AvoirEntity> search(
            @QueryParam("clientId") Long clientId,
            @QueryParam("venteId") Long venteId,
            @QueryParam("status") String status) {
        if (clientId != null && venteId != null) {
            return AvoirEntity.list("client.id = ?1 AND vente.id = ?2", clientId, venteId);
        }
        if (clientId != null) {
            return AvoirEntity.list("client.id = ?1", clientId);
        }
        if (venteId != null) {
            return AvoirEntity.list("vente.id = ?1", venteId);
        }
        if (status != null && !status.isBlank()) {
            try {
                AvoirEntity.Status s = AvoirEntity.Status.valueOf(status);
                return AvoirEntity.list("status = ?1", s);
            } catch (IllegalArgumentException e) {
                throw new WebApplicationException("Statut invalide : " + status, 400);
            }
        }
        return AvoirEntity.listAll();
    }

    @GET
    @Path("{id}")
    public AvoirEntity get(@PathParam("id") long id) {
        AvoirEntity entity = AvoirEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'avoir (" + id + ") n'est pas trouvé", 404);
        }
        return entity;
    }

    @POST
    @Transactional
    public AvoirEntity create(AvoirEntity avoir) {
        if (avoir.client == null || avoir.client.id == null) {
            throw new WebApplicationException("Le client est requis", 400);
        }
        ClientEntity client = ClientEntity.findById(avoir.client.id);
        if (client == null) {
            throw new WebApplicationException("Le client (" + avoir.client.id + ") n'est pas trouvé", 404);
        }
        avoir.client = client;

        if (avoir.vente != null && avoir.vente.id != null) {
            VenteEntity vente = VenteEntity.findById(avoir.vente.id);
            if (vente == null) {
                throw new WebApplicationException("La vente (" + avoir.vente.id + ") n'est pas trouvée", 404);
            }
            avoir.vente = vente;
        } else {
            avoir.vente = null;
        }

        avoir.status = AvoirEntity.Status.BROUILLON;
        avoir.dateCreation = new Timestamp(System.currentTimeMillis());

        avoir.persist();
        return avoir;
    }

    public static class GenerateAvoirRequest {
        public String motif;
        public String notes;
    }

    @POST
    @Path("from-vente/{venteId}")
    @Transactional
    public AvoirEntity generateFromVente(@PathParam("venteId") long venteId, GenerateAvoirRequest request) {
        VenteEntity vente = VenteEntity.findById(venteId);
        if (vente == null) {
            throw new WebApplicationException("La vente (" + venteId + ") n'est pas trouvée", 404);
        }
        if (vente.client == null) {
            throw new WebApplicationException("La vente n'a pas de client associé", 400);
        }
        if (request == null || request.motif == null || request.motif.isBlank()) {
            throw new WebApplicationException("Le motif est requis", 400);
        }

        AvoirEntity avoir = new AvoirEntity();
        avoir.status = AvoirEntity.Status.BROUILLON;
        avoir.client = vente.client;
        avoir.vente = vente;
        avoir.motif = request.motif.trim();
        avoir.notes = request.notes;
        avoir.dateCreation = new Timestamp(System.currentTimeMillis());

        double tvaTaux = vente.tva > 0 ? vente.tva : 20.0;

        // Lignes depuis les forfaits
        if (vente.venteForfaits != null) {
            for (VenteForfaitEntity vf : vente.venteForfaits) {
                if (vf.forfait == null) continue;
                AvoirLigneEntity ligne = new AvoirLigneEntity();
                ligne.designation = vf.forfait.nom != null ? vf.forfait.nom : "Forfait";
                ligne.quantite = Math.max(1, vf.quantite);
                ligne.prixUnitaireHT = vf.forfait.prixHT;
                ligne.tva = vf.forfait.tva > 0 ? vf.forfait.tva : tvaTaux;
                ligne.montantTVA = round2(ligne.prixUnitaireHT * ligne.quantite * (ligne.tva / 100.0));
                ligne.totalTTC = round2(vf.forfait.prixTTC * ligne.quantite);
                avoir.lignes.add(ligne);
            }
        }

        // Lignes depuis les services
        if (vente.venteServices != null) {
            for (VenteServiceEntity vs : vente.venteServices) {
                if (vs.service == null) continue;
                AvoirLigneEntity ligne = new AvoirLigneEntity();
                ligne.designation = vs.service.nom != null ? vs.service.nom : "Service";
                ligne.quantite = Math.max(1, vs.quantite);
                ligne.prixUnitaireHT = vs.service.prixHT;
                ligne.tva = vs.service.tva > 0 ? vs.service.tva : tvaTaux;
                ligne.montantTVA = round2(ligne.prixUnitaireHT * ligne.quantite * (ligne.tva / 100.0));
                ligne.totalTTC = round2(vs.service.prixTTC * ligne.quantite);
                avoir.lignes.add(ligne);
            }
        }

        // Lignes depuis les produits (regroupés par id)
        if (vente.produits != null && !vente.produits.isEmpty()) {
            java.util.Map<Long, int[]> counts = new java.util.LinkedHashMap<>();
            java.util.Map<Long, ProduitCatalogueEntity> byId = new java.util.LinkedHashMap<>();
            for (ProduitCatalogueEntity p : vente.produits) {
                if (p == null || p.id == null) continue;
                counts.computeIfAbsent(p.id, k -> new int[]{0});
                counts.get(p.id)[0]++;
                byId.putIfAbsent(p.id, p);
            }
            for (java.util.Map.Entry<Long, int[]> entry : counts.entrySet()) {
                ProduitCatalogueEntity p = byId.get(entry.getKey());
                if (p == null) continue;
                int qty = entry.getValue()[0];
                AvoirLigneEntity ligne = new AvoirLigneEntity();
                String nom = p.nom != null ? p.nom : "Produit";
                if (p.marque != null && !p.marque.isBlank()) nom += " (" + p.marque + ")";
                ligne.designation = nom;
                ligne.quantite = qty;
                ligne.prixUnitaireHT = p.prixVenteHT;
                ligne.tva = p.tva > 0 ? p.tva : tvaTaux;
                ligne.montantTVA = round2(ligne.prixUnitaireHT * qty * (ligne.tva / 100.0));
                ligne.totalTTC = round2(p.prixVenteTTC * qty);
                avoir.lignes.add(ligne);
            }
        }

        // Totaux globaux
        avoir.tva = tvaTaux;
        avoir.montantHT = round2(avoir.lignes.stream().mapToDouble(l -> l.prixUnitaireHT * l.quantite).sum());
        avoir.montantTVA = round2(avoir.lignes.stream().mapToDouble(l -> l.montantTVA).sum());
        avoir.montantTTC = round2(avoir.lignes.stream().mapToDouble(l -> l.totalTTC).sum());

        avoir.persist();
        return avoir;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    @PUT
    @Path("{id}")
    @Transactional
    public AvoirEntity update(@PathParam("id") long id, AvoirEntity data) {
        AvoirEntity entity = AvoirEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'avoir (" + id + ") n'est pas trouvé", 404);
        }
        if (entity.status == AvoirEntity.Status.REMBOURSE || entity.status == AvoirEntity.Status.ANNULE) {
            throw new WebApplicationException("Un avoir remboursé ou annulé ne peut pas être modifié", 400);
        }

        if (data.client != null && data.client.id != null) {
            ClientEntity client = ClientEntity.findById(data.client.id);
            if (client == null) {
                throw new WebApplicationException("Le client (" + data.client.id + ") n'est pas trouvé", 404);
            }
            entity.client = client;
        }

        if (data.vente != null && data.vente.id != null) {
            VenteEntity vente = VenteEntity.findById(data.vente.id);
            if (vente == null) {
                throw new WebApplicationException("La vente (" + data.vente.id + ") n'est pas trouvée", 404);
            }
            entity.vente = vente;
        } else {
            entity.vente = null;
        }

        entity.motif = data.motif;
        entity.notes = data.notes;
        entity.montantHT = data.montantHT;
        entity.tva = data.tva;
        entity.montantTVA = data.montantTVA;
        entity.montantTTC = data.montantTTC;
        entity.modeRemboursement = data.modeRemboursement;

        entity.lignes.clear();
        if (data.lignes != null) {
            for (AvoirLigneEntity ligne : data.lignes) {
                AvoirLigneEntity l = new AvoirLigneEntity();
                l.designation = ligne.designation;
                l.quantite = ligne.quantite;
                l.prixUnitaireHT = ligne.prixUnitaireHT;
                l.tva = ligne.tva;
                l.montantTVA = ligne.montantTVA;
                l.totalTTC = ligne.totalTTC;
                entity.lignes.add(l);
            }
        }

        return entity;
    }

    @POST
    @Path("{id}/emettre")
    @Transactional
    public AvoirEntity emettre(@PathParam("id") long id) {
        AvoirEntity entity = AvoirEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'avoir (" + id + ") n'est pas trouvé", 404);
        }
        if (entity.status != AvoirEntity.Status.BROUILLON) {
            throw new WebApplicationException("Seul un avoir en brouillon peut être émis", 400);
        }
        entity.status = AvoirEntity.Status.EMIS;
        entity.dateEmission = new Timestamp(System.currentTimeMillis());
        return entity;
    }

    @POST
    @Path("{id}/rembourser")
    @Transactional
    public AvoirEntity rembourser(@PathParam("id") long id) {
        AvoirEntity entity = AvoirEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'avoir (" + id + ") n'est pas trouvé", 404);
        }
        if (entity.status != AvoirEntity.Status.EMIS) {
            throw new WebApplicationException("Seul un avoir émis peut être marqué comme remboursé", 400);
        }
        entity.status = AvoirEntity.Status.REMBOURSE;
        entity.dateRemboursement = new Timestamp(System.currentTimeMillis());
        return entity;
    }

    @POST
    @Path("{id}/annuler")
    @Transactional
    public AvoirEntity annuler(@PathParam("id") long id) {
        AvoirEntity entity = AvoirEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'avoir (" + id + ") n'est pas trouvé", 404);
        }
        if (entity.status == AvoirEntity.Status.REMBOURSE) {
            throw new WebApplicationException("Un avoir déjà remboursé ne peut pas être annulé", 400);
        }
        entity.status = AvoirEntity.Status.ANNULE;
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") long id) {
        AvoirEntity entity = AvoirEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'avoir (" + id + ") n'est pas trouvé", 404);
        }
        if (entity.status != AvoirEntity.Status.BROUILLON) {
            throw new WebApplicationException("Seul un avoir en brouillon peut être supprimé", 400);
        }
        entity.delete();
        return Response.noContent().build();
    }

    @POST
    @Path("{id}/email")
    @Transactional
    public Response envoyerEmail(@PathParam("id") long id) {
        AvoirEntity entity = AvoirEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'avoir (" + id + ") n'est pas trouvé", 404);
        }
        if (entity.client == null || entity.client.email == null || entity.client.email.isBlank()) {
            throw new WebApplicationException("Le client n'a pas d'adresse email", 400);
        }

        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";
        String clientName = entity.client.prenom != null ? entity.client.prenom : entity.client.nom;
        String dateStr = entity.dateEmission != null
                ? new Timestamp(entity.dateEmission.getTime()).toLocalDateTime().toLocalDate().toString()
                : "-";
        String montantTTC = String.format("%.2f EUR", entity.montantTTC);
        String motif = entity.motif != null ? entity.motif : "-";
        String venteRef = entity.vente != null ? "#" + entity.vente.id : "-";

        StringBuilder lignes = new StringBuilder();
        if (entity.lignes != null && !entity.lignes.isEmpty()) {
            for (AvoirLigneEntity ligne : entity.lignes) {
                lignes.append("- ").append(ligne.designation)
                        .append(" x").append(ligne.quantite)
                        .append(" = ").append(String.format("%.2f EUR", ligne.totalTTC))
                        .append("\n");
            }
        } else {
            lignes.append("Aucun élément");
        }

        EmailTemplateEntity template = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.AVOIR);
        String subject;
        String body;
        if (template != null) {
            subject = template.sujet
                    .replace("{client}", clientName)
                    .replace("{reference}", String.valueOf(entity.id))
                    .replace("{date}", dateStr)
                    .replace("{motif}", motif)
                    .replace("{montantTTC}", montantTTC)
                    .replace("{venteRef}", venteRef)
                    .replace("{lignes}", lignes.toString().trim())
                    .replace("{societe}", societeNom);
            body = template.contenu
                    .replace("{client}", clientName)
                    .replace("{reference}", String.valueOf(entity.id))
                    .replace("{date}", dateStr)
                    .replace("{motif}", motif)
                    .replace("{montantTTC}", montantTTC)
                    .replace("{venteRef}", venteRef)
                    .replace("{lignes}", lignes.toString().trim())
                    .replace("{societe}", societeNom);
        } else {
            subject = "Votre avoir #" + entity.id + " - " + societeNom;
            body = "<p>Bonjour " + clientName + ",</p>"
                    + "<p>Veuillez trouver ci-dessous les informations de votre avoir #" + entity.id + ".</p>"
                    + "<table>"
                    + "<tr><td><strong>Date</strong></td><td>" + dateStr + "</td></tr>"
                    + "<tr><td><strong>Motif</strong></td><td>" + motif + "</td></tr>"
                    + (entity.vente != null ? "<tr><td><strong>Facture d'origine</strong></td><td>" + venteRef + "</td></tr>" : "")
                    + "<tr><td><strong>Montant TTC</strong></td><td>" + montantTTC + "</td></tr>"
                    + "</table>"
                    + "<p><strong>Lignes :</strong><br/>" + lignes.toString().trim().replace("\n", "<br/>") + "</p>"
                    + "<p>Cordialement,<br/>" + societeNom + "</p>";
        }

        mailer.send(Mail.withHtml(entity.client.email, subject, body));
        return Response.ok().build();
    }

}
