package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.EmailTemplateEntity;
import net.nanthrax.moussaillon.persistence.ForfaitEntity;
import net.nanthrax.moussaillon.persistence.ForfaitProduitEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitMouvementEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ServiceEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.TaskEntity;
import net.nanthrax.moussaillon.persistence.VenteBateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteHeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteMoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VentePaiementEntity;
import net.nanthrax.moussaillon.persistence.VenteProduitEntity;
import net.nanthrax.moussaillon.persistence.VenteRemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

@Path("/ventes")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class VenteResource {

    @Inject
    Mailer mailer;

    @Inject
    RappelScheduler rappelScheduler;

    @Inject
    FacturXService facturXService;

    @GET
    @Path("{id}/facturx")
    @Produces("application/pdf")
    @Transactional
    public Response telechargerFacturX(@PathParam("id") long id) {
        VenteEntity vente = VenteEntity.findById(id);
        if (vente == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvée", 404);
        }
        if (vente.status != VenteEntity.Status.FACTURE_PRETE && vente.status != VenteEntity.Status.FACTURE_PAYEE) {
            throw new WebApplicationException(
                Response.status(Response.Status.BAD_REQUEST)
                    .entity(java.util.Map.of("error", "La facturation électronique n'est disponible que pour les factures prêtes ou payées"))
                    .build());
        }

        SocieteEntity societe = SocieteEntity.findById(1L);

        try {
            byte[] pdfFacturX = facturXService.generer(vente, societe);
            String filename = (vente.numeroFacture != null ? vente.numeroFacture : "facture-" + id) + ".pdf";
            return Response.ok(pdfFacturX)
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .header("Content-Type", "application/pdf")
                .build();
        } catch (Exception e) {
            throw new WebApplicationException(
                Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(java.util.Map.of("error", "Erreur lors de la génération Factur-X : " + e.getMessage()))
                    .build());
        }
    }

    @POST
    @Path("{id}/email")
    @Transactional
    public Response envoyerFactureEmail(@PathParam("id") long id) {
        VenteEntity entity = VenteEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvée", 404);
        }
        if (entity.client == null || entity.client.email == null || entity.client.email.isBlank()) {
            throw new WebApplicationException("Le client n'a pas d'adresse email", 400);
        }

        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";
        String clientName = entity.client.prenom != null ? entity.client.prenom : entity.client.nom;
        String dateStr = entity.date != null
                ? new Timestamp(entity.date.getTime()).toLocalDateTime().toLocalDate().toString()
                : "-";
        boolean isDevis = entity.status == VenteEntity.Status.DEVIS;
        boolean isOrdreReparation = isDevis && entity.ordreDeReparation;
        boolean showPrices = !isOrdreReparation;
        String typeLabel = isOrdreReparation ? "Ordre de Réparation" : (isDevis ? "Devis" : "Facture");
        String statutLabel = entity.status != null ? entity.status.name() : "-";
        String prixVenteTTC = String.format("%.2f EUR", entity.prixVenteTTC);
        String modePaiement;
        if (entity.paiements != null && !entity.paiements.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (VentePaiementEntity p : entity.paiements) {
                if (sb.length() > 0) sb.append(", ");
                sb.append(p.mode.name()).append(" ").append(String.format("%.2f", p.montant)).append(" EUR");
                if (p.mode == VentePaiementEntity.Mode.AVOIR && p.avoir != null) {
                    sb.append(" (avoir #").append(p.avoir.id).append(")");
                }
            }
            modePaiement = sb.toString();
        } else {
            modePaiement = entity.modePaiement != null ? entity.modePaiement.name() : "-";
        }

        // Build invoice lines
        StringBuilder lignes = new StringBuilder();
        if (entity.venteForfaits != null) {
            for (VenteForfaitEntity vf : entity.venteForfaits) {
                String nom = vf.forfait != null ? vf.forfait.nom : "Forfait";
                lignes.append("- Forfait : ").append(nom).append(" x").append(vf.quantite);
                if (showPrices) {
                    double base = vf.forfait != null ? vf.forfait.prixTTC * vf.quantite : 0;
                    double total = Math.max(0, base - vf.remise);
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                    if (vf.remise > 0) {
                        lignes.append(" (remise ").append(String.format("%.2f EUR", vf.remise)).append(")");
                    }
                }
                lignes.append("\n");
            }
        }
        if (entity.venteProduits != null) {
            for (VenteProduitEntity vp : entity.venteProduits) {
                if (vp.produit == null) continue;
                String nom = vp.produit.nom + (vp.produit.marque != null ? " (" + vp.produit.marque + ")" : "");
                lignes.append("- Produit : ").append(nom).append(" x").append(vp.quantite);
                if (showPrices) {
                    double base = vp.produit.prixVenteTTC * vp.quantite;
                    double total = Math.max(0, base - vp.remise);
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                    if (vp.remise > 0) {
                        lignes.append(" (remise ").append(String.format("%.2f EUR", vp.remise)).append(")");
                    }
                }
                lignes.append("\n");
            }
        }
        if (entity.venteServices != null) {
            for (VenteServiceEntity vs : entity.venteServices) {
                String nom = vs.service != null ? vs.service.nom : "Service";
                lignes.append("- Service : ").append(nom).append(" x").append(vs.quantite);
                if (showPrices) {
                    double base = vs.service != null ? vs.service.prixTTC * vs.quantite : 0;
                    double total = Math.max(0, base - vs.remise);
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                    if (vs.remise > 0) {
                        lignes.append(" (remise ").append(String.format("%.2f EUR", vs.remise)).append(")");
                    }
                }
                lignes.append("\n");
            }
        }
        if (entity.venteBateauxCatalogue != null) {
            for (VenteBateauCatalogueEntity vb : entity.venteBateauxCatalogue) {
                if (vb.bateau == null) continue;
                String nom = vb.bateau.marque + " " + vb.bateau.modele;
                lignes.append("- Bateau : ").append(nom).append(" x").append(vb.quantite);
                if (showPrices) {
                    double base = vb.bateau.prixVenteTTC * vb.quantite;
                    double total = Math.max(0, base - vb.remise);
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                    if (vb.remise > 0) {
                        lignes.append(" (remise ").append(String.format("%.2f EUR", vb.remise)).append(")");
                    }
                }
                lignes.append("\n");
            }
        }
        if (entity.venteMoteursCatalogue != null) {
            for (VenteMoteurCatalogueEntity vm : entity.venteMoteursCatalogue) {
                if (vm.moteur == null) continue;
                String nom = vm.moteur.marque + " " + vm.moteur.modele;
                lignes.append("- Moteur : ").append(nom).append(" x").append(vm.quantite);
                if (showPrices) {
                    double base = vm.moteur.prixVenteTTC * vm.quantite;
                    double total = Math.max(0, base - vm.remise);
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                    if (vm.remise > 0) {
                        lignes.append(" (remise ").append(String.format("%.2f EUR", vm.remise)).append(")");
                    }
                }
                lignes.append("\n");
            }
        }
        if (entity.venteHelicesCatalogue != null) {
            for (VenteHeliceCatalogueEntity vh : entity.venteHelicesCatalogue) {
                if (vh.helice == null) continue;
                String nom = vh.helice.marque + " " + vh.helice.modele;
                lignes.append("- Hélice : ").append(nom).append(" x").append(vh.quantite);
                if (showPrices) {
                    double base = vh.helice.prixVenteTTC * vh.quantite;
                    double total = Math.max(0, base - vh.remise);
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                    if (vh.remise > 0) {
                        lignes.append(" (remise ").append(String.format("%.2f EUR", vh.remise)).append(")");
                    }
                }
                lignes.append("\n");
            }
        }
        if (entity.venteRemorquesCatalogue != null) {
            for (VenteRemorqueCatalogueEntity vr : entity.venteRemorquesCatalogue) {
                if (vr.remorque == null) continue;
                String nom = vr.remorque.marque + " " + vr.remorque.modele;
                lignes.append("- Remorque : ").append(nom).append(" x").append(vr.quantite);
                if (showPrices) {
                    double base = vr.remorque.prixVenteTTC * vr.quantite;
                    double total = Math.max(0, base - vr.remise);
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                    if (vr.remise > 0) {
                        lignes.append(" (remise ").append(String.format("%.2f EUR", vr.remise)).append(")");
                    }
                }
                lignes.append("\n");
            }
        }
        if (lignes.length() == 0) {
            lignes.append("Aucun élément");
        }

        EmailTemplateEntity template = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.FACTURE);
        String subject;
        String body;
        if (template != null) {
            subject = template.sujet
                    .replace("{client}", clientName)
                    .replace("{typeVente}", typeLabel)
                    .replace("{reference}", String.valueOf(entity.id))
                    .replace("{date}", dateStr)
                    .replace("{statut}", statutLabel)
                    .replace("{prixVenteTTC}", prixVenteTTC)
                    .replace("{modePaiement}", modePaiement)
                    .replace("{lignes}", lignes.toString().trim())
                    .replace("{societe}", societeNom);
            body = template.contenu
                    .replace("{client}", clientName)
                    .replace("{typeVente}", typeLabel)
                    .replace("{reference}", String.valueOf(entity.id))
                    .replace("{date}", dateStr)
                    .replace("{statut}", statutLabel)
                    .replace("{prixVenteTTC}", prixVenteTTC)
                    .replace("{modePaiement}", modePaiement)
                    .replace("{lignes}", lignes.toString().trim())
                    .replace("{societe}", societeNom);
        } else {
            subject = "Votre " + typeLabel + " #" + entity.id + " - " + societeNom;
            StringBuilder bodyBuilder = new StringBuilder();
            bodyBuilder.append("Bonjour ").append(clientName).append(",\n\n")
                    .append("Veuillez trouver les informations de votre ").append(typeLabel).append(" #").append(entity.id).append(".\n\n")
                    .append("Date             : ").append(dateStr).append("\n");
            if (showPrices) {
                bodyBuilder.append("Prix vente TTC   : ").append(prixVenteTTC).append("\n")
                        .append("Mode de paiement : ").append(modePaiement).append("\n");
            }
            bodyBuilder.append("\nDétails :\n").append(lignes).append("\n")
                    .append("Cordialement,\n").append(societeNom);
            body = bodyBuilder.toString();
        }

        mailer.send(Mail.withHtml(entity.client.email, subject, body));
        return Response.ok().build();
    }

    @POST
    @Path("{id}/rappel")
    @Transactional
    public Response envoyerRappelManuel(@PathParam("id") long id) {
        VenteEntity entity = VenteEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvee", 404);
        }
        if (entity.client == null || entity.client.email == null || entity.client.email.isBlank()) {
            throw new WebApplicationException("Le client n'a pas d'adresse email", 400);
        }
        rappelScheduler.envoyerRappel(entity, 0);
        return Response.ok().build();
    }

    @GET
    public List<VenteEntity> list() {
        return VenteEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<VenteEntity> search(
            @QueryParam("status") String status,
            @QueryParam("clientId") Long clientId,
            @QueryParam("bateauId") Long bateauId,
            @QueryParam("moteurId") Long moteurId,
            @QueryParam("remorqueId") Long remorqueId,
            @QueryParam("comptoir") Boolean comptoir,
            @QueryParam("limit") Integer limit
    ) {
        VenteEntity.Status parsedStatus = parseStatus(status);
        StringBuilder query = new StringBuilder();
        List<Object> params = new ArrayList<>();
        if (parsedStatus != null) {
            query.append(query.length() == 0 ? "" : " and ").append("status = ?").append(params.size() + 1);
            params.add(parsedStatus);
        }
        if (clientId != null) {
            query.append(query.length() == 0 ? "" : " and ").append("client.id = ?").append(params.size() + 1);
            params.add(clientId);
        }
        if (bateauId != null) {
            query.append(query.length() == 0 ? "" : " and ").append("bateau.id = ?").append(params.size() + 1);
            params.add(bateauId);
        }
        if (moteurId != null) {
            query.append(query.length() == 0 ? "" : " and ").append("moteur.id = ?").append(params.size() + 1);
            params.add(moteurId);
        }
        if (remorqueId != null) {
            query.append(query.length() == 0 ? "" : " and ").append("remorque.id = ?").append(params.size() + 1);
            params.add(remorqueId);
        }
        if (comptoir != null) {
            query.append(query.length() == 0 ? "" : " and ").append("comptoir = ?").append(params.size() + 1);
            params.add(comptoir);
        }
        io.quarkus.panache.common.Sort sort = io.quarkus.panache.common.Sort.by("date").descending();
        List<VenteEntity> results;
        if (query.length() == 0) {
            results = VenteEntity.listAll(sort);
        } else {
            results = VenteEntity.list(query.toString(), sort, params.toArray());
        }
        if (limit != null && limit > 0 && results.size() > limit) {
            return results.subList(0, limit);
        }
        return results;
    }

    @POST
    @Transactional
    public Response create(VenteEntity vente) {
        vente.id = null;
        // Copy template taches from catalogue forfait if none provided
        if (vente.venteForfaits != null) {
            for (VenteForfaitEntity vf : vente.venteForfaits) {
                if ((vf.taches == null || vf.taches.isEmpty()) && vf.forfait != null && vf.forfait.id != null) {
                    ForfaitEntity catalogueForfait = ForfaitEntity.findById(vf.forfait.id);
                    if (catalogueForfait != null && catalogueForfait.taches != null) {
                        if (vf.taches == null) vf.taches = new java.util.ArrayList<>();
                        for (TaskEntity t : catalogueForfait.taches) {
                            TaskEntity ct = new TaskEntity();
                            ct.nom = t.nom;
                            ct.description = t.description;
                            ct.done = false;
                            vf.taches.add(ct);
                        }
                    }
                }
            }
        }
        // Copy template taches from catalogue service if none provided
        if (vente.venteServices != null) {
            for (VenteServiceEntity vs : vente.venteServices) {
                if ((vs.taches == null || vs.taches.isEmpty()) && vs.service != null && vs.service.id != null) {
                    ServiceEntity catalogueService = ServiceEntity.findById(vs.service.id);
                    if (catalogueService != null && catalogueService.taches != null) {
                        if (vs.taches == null) vs.taches = new java.util.ArrayList<>();
                        for (TaskEntity t : catalogueService.taches) {
                            TaskEntity ct = new TaskEntity();
                            ct.nom = t.nom;
                            ct.description = t.description;
                            ct.done = false;
                            vs.taches.add(ct);
                        }
                    }
                }
            }
        }
        if (vente.dateDevis == null) {
            vente.dateDevis = new Timestamp(System.currentTimeMillis());
        }
        vente.persist();
        return Response.status(Response.Status.CREATED).entity(vente).build();
    }

    @GET
    @Path("{id}")
    public VenteEntity get(@PathParam("id") long id) {
        VenteEntity entity = VenteEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvee", 404);
        }
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") long id) {
        VenteEntity entity = VenteEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvee", 404);
        }

        if (entity.status == VenteEntity.Status.FACTURE_PAYEE) {
            throw new WebApplicationException(
                Response.status(Response.Status.BAD_REQUEST)
                    .entity(java.util.Map.of("error", "Une vente payée ne peut pas être supprimée"))
                    .build());
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public VenteEntity update(@PathParam("id") long id, VenteEntity vente) {
        VenteEntity entity = VenteEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvee", 404);
        }

        if (entity.status == VenteEntity.Status.FACTURE_PAYEE) {
            throw new WebApplicationException(
                Response.status(Response.Status.BAD_REQUEST)
                    .entity(java.util.Map.of("error", "Une vente payée ne peut pas être modifiée"))
                    .build());
        }

        // Track step date history on transitions
        Timestamp now = new Timestamp(System.currentTimeMillis());
        if (vente.status != entity.status || vente.bonPourAccord != entity.bonPourAccord) {
            if (vente.status == VenteEntity.Status.DEVIS && !vente.bonPourAccord && entity.dateDevis == null) {
                entity.dateDevis = now;
            }
            if (vente.bonPourAccord && !entity.bonPourAccord && entity.dateBonPourAccord == null) {
                entity.dateBonPourAccord = now;
            }
            if (vente.status == VenteEntity.Status.FACTURE_EN_ATTENTE && entity.status != VenteEntity.Status.FACTURE_EN_ATTENTE && entity.dateFactureEnAttente == null) {
                entity.dateFactureEnAttente = now;
            }
            if (vente.status == VenteEntity.Status.FACTURE_PRETE && entity.status != VenteEntity.Status.FACTURE_PRETE && entity.dateFacturePrete == null) {
                entity.dateFacturePrete = now;
            }
            if (vente.status == VenteEntity.Status.FACTURE_PAYEE && entity.status != VenteEntity.Status.FACTURE_PAYEE && entity.dateFacturePayee == null) {
                entity.dateFacturePayee = now;
            }
        }
        entity.status = vente.status;
        entity.bonPourAccord = vente.bonPourAccord;
        entity.ordreDeReparation = vente.ordreDeReparation;
        entity.comptoir = vente.comptoir;
        if (vente.signatureBonPourAccord != null) {
            entity.signatureBonPourAccord = vente.signatureBonPourAccord;
        }
        entity.client = vente.client;
        entity.bateau = vente.bateau;
        entity.moteur = vente.moteur;
        entity.remorque = vente.remorque;

        // Update venteForfaits
        entity.venteForfaits.clear();
        if (vente.venteForfaits != null) {
            for (VenteForfaitEntity incoming : vente.venteForfaits) {
                VenteForfaitEntity cloned = new VenteForfaitEntity();
                cloned.forfait = incoming.forfait;
                cloned.quantite = incoming.quantite;
                cloned.remise = incoming.remise;
                cloned.remisePourcentage = incoming.remisePourcentage;
                if (incoming.techniciens != null) {
                    cloned.techniciens.addAll(incoming.techniciens);
                }
                cloned.datePlanification = incoming.datePlanification;
                cloned.dateDebut = incoming.dateDebut;
                cloned.dateFin = incoming.dateFin;
                cloned.status = incoming.status;
                cloned.statusDate = incoming.statusDate;
                cloned.dureeReelle = incoming.dureeReelle;
                cloned.dureePlanifiee = incoming.dureePlanifiee;
                cloned.incidentDate = incoming.incidentDate;
                cloned.incidentDetails = incoming.incidentDetails;
                cloned.notes = incoming.notes;
                if (incoming.taches != null && !incoming.taches.isEmpty()) {
                    for (TaskEntity t : incoming.taches) {
                        TaskEntity ct = new TaskEntity();
                        ct.nom = t.nom;
                        ct.description = t.description;
                        ct.done = t.done;
                        cloned.taches.add(ct);
                    }
                } else if (cloned.forfait != null && cloned.forfait.id != null) {
                    // Copy template taches from catalogue forfait if none provided
                    ForfaitEntity catalogueForfait = ForfaitEntity.findById(cloned.forfait.id);
                    if (catalogueForfait != null && catalogueForfait.taches != null) {
                        for (TaskEntity t : catalogueForfait.taches) {
                            TaskEntity ct = new TaskEntity();
                            ct.nom = t.nom;
                            ct.description = t.description;
                            ct.done = false;
                            cloned.taches.add(ct);
                        }
                    }
                }
                cloned.images = incoming.images != null ? new java.util.ArrayList<>(incoming.images) : new java.util.ArrayList<>();
                cloned.documents = incoming.documents != null ? new java.util.ArrayList<>(incoming.documents) : new java.util.ArrayList<>();
                entity.venteForfaits.add(cloned);
            }
        }

        // Update venteServices
        entity.venteServices.clear();
        if (vente.venteServices != null) {
            for (VenteServiceEntity incoming : vente.venteServices) {
                VenteServiceEntity cloned = new VenteServiceEntity();
                cloned.service = incoming.service;
                cloned.quantite = incoming.quantite;
                cloned.remise = incoming.remise;
                cloned.remisePourcentage = incoming.remisePourcentage;
                if (incoming.techniciens != null) {
                    cloned.techniciens.addAll(incoming.techniciens);
                }
                cloned.datePlanification = incoming.datePlanification;
                cloned.dateDebut = incoming.dateDebut;
                cloned.dateFin = incoming.dateFin;
                cloned.status = incoming.status;
                cloned.statusDate = incoming.statusDate;
                cloned.dureeReelle = incoming.dureeReelle;
                cloned.dureePlanifiee = incoming.dureePlanifiee;
                cloned.incidentDate = incoming.incidentDate;
                cloned.incidentDetails = incoming.incidentDetails;
                cloned.notes = incoming.notes;
                if (incoming.taches != null && !incoming.taches.isEmpty()) {
                    for (TaskEntity t : incoming.taches) {
                        TaskEntity ct = new TaskEntity();
                        ct.nom = t.nom;
                        ct.description = t.description;
                        ct.done = t.done;
                        cloned.taches.add(ct);
                    }
                } else {
                    // Copy template taches from catalogue service if none provided
                    ServiceEntity catalogueService = incoming.service != null && incoming.service.id != null ? ServiceEntity.findById(incoming.service.id) : null;
                    if (catalogueService != null && catalogueService.taches != null) {
                        for (TaskEntity t : catalogueService.taches) {
                            TaskEntity ct = new TaskEntity();
                            ct.nom = t.nom;
                            ct.description = t.description;
                            ct.done = false;
                            cloned.taches.add(ct);
                        }
                    }
                }
                cloned.images = incoming.images != null ? new java.util.ArrayList<>(incoming.images) : new java.util.ArrayList<>();
                cloned.documents = incoming.documents != null ? new java.util.ArrayList<>(incoming.documents) : new java.util.ArrayList<>();
                entity.venteServices.add(cloned);
            }
        }

        // Update venteProduits (new line entity with quantite + remise per line)
        entity.venteProduits.clear();
        if (vente.venteProduits != null && !vente.venteProduits.isEmpty()) {
            for (VenteProduitEntity incoming : vente.venteProduits) {
                VenteProduitEntity cloned = new VenteProduitEntity();
                cloned.produit = incoming.produit;
                cloned.quantite = incoming.quantite;
                cloned.remise = incoming.remise;
                cloned.remisePourcentage = incoming.remisePourcentage;
                entity.venteProduits.add(cloned);
            }
        } else if (vente.produits != null) {
            // Legacy @ManyToMany list (no quantite/remise) sent instead of venteProduits
            for (ProduitCatalogueEntity incoming : vente.produits) {
                VenteProduitEntity cloned = new VenteProduitEntity();
                cloned.produit = incoming;
                cloned.quantite = 1;
                entity.venteProduits.add(cloned);
            }
        }
        // Clear legacy @ManyToMany list (data is now stored in venteProduits)
        if (entity.produits != null) {
            entity.produits.clear();
        }

        // Update venteBateauxCatalogue
        entity.venteBateauxCatalogue.clear();
        if (vente.venteBateauxCatalogue != null) {
            for (VenteBateauCatalogueEntity incoming : vente.venteBateauxCatalogue) {
                VenteBateauCatalogueEntity cloned = new VenteBateauCatalogueEntity();
                cloned.bateau = incoming.bateau;
                cloned.quantite = incoming.quantite;
                cloned.remise = incoming.remise;
                cloned.remisePourcentage = incoming.remisePourcentage;
                entity.venteBateauxCatalogue.add(cloned);
            }
        }
        entity.bateauxCatalogue.clear();

        // Update venteMoteursCatalogue
        entity.venteMoteursCatalogue.clear();
        if (vente.venteMoteursCatalogue != null) {
            for (VenteMoteurCatalogueEntity incoming : vente.venteMoteursCatalogue) {
                VenteMoteurCatalogueEntity cloned = new VenteMoteurCatalogueEntity();
                cloned.moteur = incoming.moteur;
                cloned.quantite = incoming.quantite;
                cloned.remise = incoming.remise;
                cloned.remisePourcentage = incoming.remisePourcentage;
                entity.venteMoteursCatalogue.add(cloned);
            }
        }
        entity.moteursCatalogue.clear();

        // Update venteHelicesCatalogue
        entity.venteHelicesCatalogue.clear();
        if (vente.venteHelicesCatalogue != null) {
            for (VenteHeliceCatalogueEntity incoming : vente.venteHelicesCatalogue) {
                VenteHeliceCatalogueEntity cloned = new VenteHeliceCatalogueEntity();
                cloned.helice = incoming.helice;
                cloned.quantite = incoming.quantite;
                cloned.remise = incoming.remise;
                cloned.remisePourcentage = incoming.remisePourcentage;
                entity.venteHelicesCatalogue.add(cloned);
            }
        }
        entity.helicesCatalogue.clear();

        // Update venteRemorquesCatalogue
        entity.venteRemorquesCatalogue.clear();
        if (vente.venteRemorquesCatalogue != null) {
            for (VenteRemorqueCatalogueEntity incoming : vente.venteRemorquesCatalogue) {
                VenteRemorqueCatalogueEntity cloned = new VenteRemorqueCatalogueEntity();
                cloned.remorque = incoming.remorque;
                cloned.quantite = incoming.quantite;
                cloned.remise = incoming.remise;
                cloned.remisePourcentage = incoming.remisePourcentage;
                entity.venteRemorquesCatalogue.add(cloned);
            }
        }
        entity.remorquesCatalogue.clear();

        // Send incident notification email for any INCIDENT items
        if (entity.client != null && entity.client.email != null && !entity.client.email.isBlank()) {
            for (VenteForfaitEntity vf : entity.venteForfaits) {
                if (vf.status == VenteForfaitEntity.Status.INCIDENT) {
                    String nom = vf.forfait != null ? vf.forfait.nom : "Forfait";
                    sendIncidentNotification(entity, nom, vf.incidentDetails, vf.incidentDate);
                }
            }
            for (VenteServiceEntity vs : entity.venteServices) {
                if (vs.status == VenteServiceEntity.Status.INCIDENT) {
                    String nom = vs.service != null ? vs.service.nom : "Service";
                    sendIncidentNotification(entity, nom, vs.incidentDetails, vs.incidentDate);
                }
            }
        }

        // Validate planification: bonPourAccord required for scheduling
        if (!entity.bonPourAccord) {
            for (VenteForfaitEntity vf : entity.venteForfaits) {
                if (vf.status != null && vf.status != VenteForfaitEntity.Status.EN_ATTENTE) {
                    throw new WebApplicationException("Le bon pour accord est requis avant de planifier les interventions", 400);
                }
            }
            for (VenteServiceEntity vs : entity.venteServices) {
                if (vs.status != null && vs.status != VenteServiceEntity.Status.EN_ATTENTE) {
                    throw new WebApplicationException("Le bon pour accord est requis avant de planifier les interventions", 400);
                }
            }
        }

        // Decrement stock when an item transitions to EN_COURS (once per vente)
        if (!entity.stockDecremented) {
            boolean hasEnCours = entity.venteForfaits.stream()
                    .anyMatch(vf -> vf.status == VenteForfaitEntity.Status.EN_COURS)
                    || entity.venteServices.stream()
                    .anyMatch(vs -> vs.status == VenteServiceEntity.Status.EN_COURS);
            if (hasEnCours) {
                decrementStock(entity);
                entity.stockDecremented = true;
            }
        }

        // Validate manual transition to FACTURE_PRETE: all tasks must be TERMINEE/ANNULEE
        boolean hasForfaitsOrServices = !entity.venteForfaits.isEmpty() || !entity.venteServices.isEmpty();
        if (entity.status == VenteEntity.Status.FACTURE_PRETE && hasForfaitsOrServices) {
            boolean allDone = entity.venteForfaits.stream()
                    .allMatch(vf -> vf.status == VenteForfaitEntity.Status.TERMINEE || vf.status == VenteForfaitEntity.Status.ANNULEE)
                    && entity.venteServices.stream()
                    .allMatch(vs -> vs.status == VenteServiceEntity.Status.TERMINEE || vs.status == VenteServiceEntity.Status.ANNULEE);
            boolean hasAtLeastOne = entity.venteForfaits.stream()
                    .anyMatch(vf -> vf.status == VenteForfaitEntity.Status.TERMINEE)
                    || entity.venteServices.stream()
                    .anyMatch(vs -> vs.status == VenteServiceEntity.Status.TERMINEE);
            if (!allDone || !hasAtLeastOne) {
                throw new WebApplicationException(
                    "Toutes les prestations doivent être terminées avant de passer en facture complète",
                    Response.status(Response.Status.BAD_REQUEST)
                        .entity(java.util.Map.of("error", "Toutes les prestations doivent être terminées avant de passer en facture complète"))
                        .build());
            }
        }

        // Auto-compute status: FACTURE_PRETE when all forfaits/services are TERMINEE
        if (hasForfaitsOrServices && entity.bonPourAccord
                && entity.status != VenteEntity.Status.FACTURE_PAYEE) {
            boolean allTerminee = entity.venteForfaits.stream()
                    .allMatch(vf -> vf.status == VenteForfaitEntity.Status.TERMINEE || vf.status == VenteForfaitEntity.Status.ANNULEE)
                    && entity.venteServices.stream()
                    .allMatch(vs -> vs.status == VenteServiceEntity.Status.TERMINEE || vs.status == VenteServiceEntity.Status.ANNULEE);
            boolean hasAtLeastOneTerminee = entity.venteForfaits.stream()
                    .anyMatch(vf -> vf.status == VenteForfaitEntity.Status.TERMINEE)
                    || entity.venteServices.stream()
                    .anyMatch(vs -> vs.status == VenteServiceEntity.Status.TERMINEE);
            if (allTerminee && hasAtLeastOneTerminee) {
                entity.status = VenteEntity.Status.FACTURE_PRETE;
                if (entity.dateFacturePrete == null) {
                    entity.dateFacturePrete = new Timestamp(System.currentTimeMillis());
                }
            }
        }

        // Fallback: decrement stock once the sale reaches FACTURE_PRETE or FACTURE_PAYEE,
        // for sales without EN_COURS phase (e.g. comptoir, which can skip FACTURE_PRETE entirely)
        if (!entity.stockDecremented
                && (entity.status == VenteEntity.Status.FACTURE_PRETE || entity.status == VenteEntity.Status.FACTURE_PAYEE)) {
            decrementStock(entity);
            entity.stockDecremented = true;
        }

        entity.images = vente.images != null ? vente.images : new java.util.ArrayList<>();
        entity.documents = vente.documents != null ? vente.documents : new java.util.ArrayList<>();
        entity.date = vente.date;
        entity.dateEcheance = vente.dateEcheance;
        entity.conditionsPaiement = vente.conditionsPaiement;
        entity.penalitesRetard = vente.penalitesRetard;
        entity.indemniteForfaitaire = vente.indemniteForfaitaire;
        entity.remise = vente.remise;
        entity.montantTTC = vente.montantTTC;
        entity.tva = vente.tva;
        entity.montantTVA = vente.montantTVA;
        entity.prixVenteTTC = vente.prixVenteTTC;
        entity.modePaiement = vente.modePaiement;

        // Reinitialiser les drapeaux d'envoi si les intervalles ont change
        if (!java.util.Objects.equals(entity.rappel1Jours, vente.rappel1Jours)) {
            entity.rappel1Envoye = false;
        }
        if (!java.util.Objects.equals(entity.rappel2Jours, vente.rappel2Jours)) {
            entity.rappel2Envoye = false;
        }
        if (!java.util.Objects.equals(entity.rappel3Jours, vente.rappel3Jours)) {
            entity.rappel3Envoye = false;
        }
        entity.rappel1Jours = vente.rappel1Jours;
        entity.rappel2Jours = vente.rappel2Jours;
        entity.rappel3Jours = vente.rappel3Jours;

        if (entity.status == VenteEntity.Status.FACTURE_PRETE && entity.numeroFacture == null) {
            int year = java.time.LocalDate.now().getYear();
            entity.numeroFacture = String.format("FACT-%d-%05d", year, entity.id);
        }

        return entity;
    }

    public static class AjouterPaiementRequest {
        public String mode;
        public double montant;
        public String notes;
        public Long avoirId;
    }

    public static class PaiementGroupeRequest {
        public List<Long> venteIds;
        public String mode;
        public double montant;
        public String notes;
    }

    @POST
    @Path("/paiement-groupe")
    @Transactional
    public Response addPaiementGroupe(PaiementGroupeRequest request) {
        if (request.venteIds == null || request.venteIds.isEmpty()) {
            throw new WebApplicationException("Aucune vente sélectionnée", 400);
        }
        if (request.montant <= 0) {
            throw new WebApplicationException("Le montant doit être supérieur à zéro", 400);
        }
        VentePaiementEntity.Mode mode;
        try {
            mode = VentePaiementEntity.Mode.valueOf(request.mode);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new WebApplicationException("Mode de paiement invalide : " + request.mode, 400);
        }
        if (mode == VentePaiementEntity.Mode.AVOIR) {
            throw new WebApplicationException("Le mode AVOIR n'est pas supporté pour un règlement groupé", 400);
        }
        List<VenteEntity> ventes = new ArrayList<>();
        for (Long vid : request.venteIds) {
            VenteEntity v = VenteEntity.findById(vid);
            if (v == null) {
                throw new WebApplicationException("Vente (" + vid + ") non trouvée", 404);
            }
            if (v.status != VenteEntity.Status.FACTURE_PRETE) {
                throw new WebApplicationException("La vente (" + vid + ") n'est pas en statut 'Facture prête'", 400);
            }
            ventes.add(v);
        }
        ventes.sort(java.util.Comparator.comparingLong(v -> v.dateDevis != null ? v.dateDevis.getTime() : 0L));
        double restant = Math.round(request.montant * 100.0) / 100.0;
        int count = 0;
        Timestamp now = new Timestamp(System.currentTimeMillis());
        for (VenteEntity vente : ventes) {
            if (restant <= 0.005) break;
            double totalPaye = vente.paiements.stream().mapToDouble(p -> p.montant).sum();
            double balance = Math.round((vente.prixVenteTTC - totalPaye) * 100.0) / 100.0;
            if (balance <= 0.005) continue;
            double montantPaiement = Math.min(balance, Math.round(restant * 100.0) / 100.0);
            VentePaiementEntity paiement = new VentePaiementEntity();
            paiement.mode = mode;
            paiement.montant = montantPaiement;
            paiement.date = now;
            paiement.notes = request.notes;
            vente.paiements.add(paiement);
            restant = Math.round((restant - montantPaiement) * 100.0) / 100.0;
            count++;
        }
        if (count == 0) {
            throw new WebApplicationException("Aucun paiement appliqué (toutes les ventes sont déjà soldées)", 400);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("count", count);
        result.put("applique", Math.round((request.montant - restant) * 100.0) / 100.0);
        result.put("restant", Math.max(0, restant));
        return Response.ok(result).build();
    }

    @POST
    @Path("{id}/paiements")
    @Transactional
    public VentePaiementEntity addPaiement(@PathParam("id") long id, AjouterPaiementRequest request) {
        VenteEntity entity = VenteEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvée", 404);
        }
        if (entity.status == VenteEntity.Status.FACTURE_PAYEE) {
            throw new WebApplicationException("Une vente payée ne peut plus être modifiée", 400);
        }
        if (entity.status != VenteEntity.Status.FACTURE_PRETE) {
            throw new WebApplicationException("Les paiements ne peuvent être ajoutés qu'à une facture prête", 400);
        }
        if (request.montant <= 0) {
            throw new WebApplicationException("Le montant doit être supérieur à zéro", 400);
        }

        VentePaiementEntity.Mode mode;
        try {
            mode = VentePaiementEntity.Mode.valueOf(request.mode);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new WebApplicationException("Mode de paiement invalide : " + request.mode, 400);
        }

        VentePaiementEntity paiement = new VentePaiementEntity();
        paiement.mode = mode;
        paiement.montant = request.montant;
        paiement.date = new Timestamp(System.currentTimeMillis());
        paiement.notes = request.notes;

        if (mode == VentePaiementEntity.Mode.AVOIR) {
            if (request.avoirId == null) {
                throw new WebApplicationException("Un avoir doit être sélectionné pour le mode AVOIR", 400);
            }
            AvoirEntity avoir = AvoirEntity.findById(request.avoirId);
            if (avoir == null) {
                throw new WebApplicationException("L'avoir (" + request.avoirId + ") n'est pas trouvé", 404);
            }
            if (avoir.status != AvoirEntity.Status.EMIS) {
                throw new WebApplicationException("Seul un avoir émis peut être appliqué", 400);
            }
            double restant = Math.round((avoir.montantTTC - avoir.montantUtilise) * 100.0) / 100.0;
            if (request.montant > restant + 0.005) {
                throw new WebApplicationException(
                    "Le montant appliqué (" + String.format("%.2f", request.montant) +
                    ") dépasse le solde disponible de l'avoir (" + String.format("%.2f", restant) + ")", 400);
            }
            avoir.montantUtilise = Math.min(avoir.montantTTC,
                Math.round((avoir.montantUtilise + request.montant) * 100.0) / 100.0);
            paiement.avoir = avoir;
        }

        entity.paiements.add(paiement);
        return paiement;
    }

    @DELETE
    @Path("{id}/paiements/{paiementId}")
    @Transactional
    public Response removePaiement(@PathParam("id") long id, @PathParam("paiementId") long paiementId) {
        VenteEntity entity = VenteEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvée", 404);
        }
        if (entity.status == VenteEntity.Status.FACTURE_PAYEE) {
            throw new WebApplicationException("Une vente payée ne peut plus être modifiée", 400);
        }

        VentePaiementEntity toRemove = entity.paiements.stream()
            .filter(p -> p.id != null && p.id == paiementId)
            .findFirst()
            .orElseThrow(() -> new WebApplicationException("Paiement (" + paiementId + ") non trouvé", 404));

        if (toRemove.mode == VentePaiementEntity.Mode.AVOIR && toRemove.avoir != null) {
            AvoirEntity avoir = AvoirEntity.findById(toRemove.avoir.id);
            if (avoir != null) {
                avoir.montantUtilise = Math.max(0,
                    Math.round((avoir.montantUtilise - toRemove.montant) * 100.0) / 100.0);
            }
        }

        entity.paiements.remove(toRemove);
        return Response.noContent().build();
    }

    private void sendIncidentNotification(VenteEntity vente, String itemNom, String incidentDetails, java.sql.Date incidentDate) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";
        String clientName = vente.client.prenom != null ? vente.client.prenom : vente.client.nom;

        String detailsBlock = "";
        if (incidentDetails != null && !incidentDetails.isBlank()) {
            detailsBlock = "Détails : " + incidentDetails + "\n\n";
        }
        String dateBlock = "";
        if (incidentDate != null) {
            dateBlock = "Date de l'incident : " + incidentDate + "\n\n";
        }

        EmailTemplateEntity template = EmailTemplateEntity.findByType(EmailTemplateEntity.Type.INCIDENT);
        String subject;
        String body;
        if (template != null) {
            subject = template.sujet
                    .replace("{client}", clientName)
                    .replace("{intervention}", itemNom)
                    .replace("{details}", detailsBlock)
                    .replace("{dateIncident}", dateBlock)
                    .replace("{societe}", societeNom);
            body = template.contenu
                    .replace("{client}", clientName)
                    .replace("{intervention}", itemNom)
                    .replace("{details}", detailsBlock)
                    .replace("{dateIncident}", dateBlock)
                    .replace("{societe}", societeNom);
        } else {
            subject = "Incident sur votre intervention - " + societeNom;
            body = "Bonjour " + clientName + ",\n\n"
                    + "Nous vous informons qu'un incident a été signalé sur l'intervention \"" + itemNom + "\".\n\n"
                    + detailsBlock
                    + dateBlock
                    + "Notre équipe met tout en œuvre pour résoudre la situation dans les meilleurs délais.\n\n"
                    + "Cordialement,\n" + societeNom;
        }

        mailer.send(Mail.withHtml(vente.client.email, subject, body));
    }

    private void decrementStock(VenteEntity vente) {
        Map<Long, Integer> produitQuantites = new HashMap<>();
        if (vente.venteProduits != null) {
            for (VenteProduitEntity vp : vente.venteProduits) {
                if (vp.produit == null || vp.produit.id == null) continue;
                produitQuantites.merge(vp.produit.id, Math.max(1, vp.quantite), Integer::sum);
            }
        }
        for (VenteForfaitEntity vf : vente.venteForfaits) {
            if (vf.forfait != null) {
                ForfaitEntity f = ForfaitEntity.findById(vf.forfait.id);
                if (f != null && f.produits != null) {
                    for (ForfaitProduitEntity fp : f.produits) {
                        if (fp.produit != null) {
                            produitQuantites.merge(fp.produit.id, fp.quantite * vf.quantite, Integer::sum);
                        }
                    }
                }
            }
        }
        for (Map.Entry<Long, Integer> entry : produitQuantites.entrySet()) {
            ProduitCatalogueEntity p = ProduitCatalogueEntity.findById(entry.getKey());
            if (p != null) {
                p.stock = Math.max(0, p.stock - entry.getValue());
                ProduitMouvementEntity mouvement = new ProduitMouvementEntity();
                mouvement.produit = p;
                mouvement.type = ProduitMouvementEntity.Type.VENTE;
                mouvement.quantite = entry.getValue();
                mouvement.stockApres = p.stock;
                mouvement.vente = vente;
                mouvement.date = new Timestamp(System.currentTimeMillis());
                mouvement.persist();
            }
        }
        if (vente.venteBateauxCatalogue != null) {
            for (VenteBateauCatalogueEntity vb : vente.venteBateauxCatalogue) {
                if (vb.bateau == null || vb.bateau.id == null) continue;
                BateauCatalogueEntity b = BateauCatalogueEntity.findById(vb.bateau.id);
                if (b != null) {
                    b.stock = Math.max(0, b.stock - Math.max(1, vb.quantite));
                }
            }
        }
        if (vente.venteMoteursCatalogue != null) {
            for (VenteMoteurCatalogueEntity vm : vente.venteMoteursCatalogue) {
                if (vm.moteur == null || vm.moteur.id == null) continue;
                MoteurCatalogueEntity m = MoteurCatalogueEntity.findById(vm.moteur.id);
                if (m != null) {
                    m.stock = Math.max(0, m.stock - Math.max(1, vm.quantite));
                }
            }
        }
        if (vente.venteRemorquesCatalogue != null) {
            for (VenteRemorqueCatalogueEntity vr : vente.venteRemorquesCatalogue) {
                if (vr.remorque == null || vr.remorque.id == null) continue;
                RemorqueCatalogueEntity r = RemorqueCatalogueEntity.findById(vr.remorque.id);
                if (r != null) {
                    r.stock = Math.max(0, r.stock - Math.max(1, vr.quantite));
                }
            }
        }
    }

    private VenteEntity.Status parseStatus(String status) {
        if (status == null || status.trim().isEmpty()) {
            return null;
        }
        try {
            return VenteEntity.Status.valueOf(status.trim());
        } catch (IllegalArgumentException ex) {
            throw new WebApplicationException("Statut de vente invalide: " + status, 400);
        }
    }

}
