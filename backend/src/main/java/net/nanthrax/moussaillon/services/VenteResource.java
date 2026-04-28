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
import net.nanthrax.moussaillon.persistence.EmailTemplateEntity;
import net.nanthrax.moussaillon.persistence.ForfaitEntity;
import net.nanthrax.moussaillon.persistence.ForfaitProduitEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ServiceEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.TaskEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
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
        String modePaiement = entity.modePaiement != null ? entity.modePaiement.name() : "-";

        // Build invoice lines
        StringBuilder lignes = new StringBuilder();
        if (entity.venteForfaits != null) {
            for (VenteForfaitEntity vf : entity.venteForfaits) {
                String nom = vf.forfait != null ? vf.forfait.nom : "Forfait";
                lignes.append("- Forfait : ").append(nom).append(" x").append(vf.quantite);
                if (showPrices) {
                    double total = vf.forfait != null ? vf.forfait.prixTTC * vf.quantite : 0;
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                }
                lignes.append("\n");
            }
        }
        if (entity.produits != null) {
            Map<Long, int[]> produitCount = new HashMap<>();
            Map<Long, ProduitCatalogueEntity> produitMap = new HashMap<>();
            for (ProduitCatalogueEntity p : entity.produits) {
                if (p.id != null) {
                    produitCount.computeIfAbsent(p.id, k -> new int[]{0, 0});
                    produitCount.get(p.id)[0]++;
                    produitCount.get(p.id)[1] += (int) (p.prixVenteTTC * 100);
                    produitMap.putIfAbsent(p.id, p);
                }
            }
            for (Map.Entry<Long, int[]> entry : produitCount.entrySet()) {
                ProduitCatalogueEntity p = produitMap.get(entry.getKey());
                String nom = p.nom + (p.marque != null ? " (" + p.marque + ")" : "");
                int qty = entry.getValue()[0];
                lignes.append("- Produit : ").append(nom).append(" x").append(qty);
                if (showPrices) {
                    double total = entry.getValue()[1] / 100.0;
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
                }
                lignes.append("\n");
            }
        }
        if (entity.venteServices != null) {
            for (VenteServiceEntity vs : entity.venteServices) {
                String nom = vs.service != null ? vs.service.nom : "Service";
                lignes.append("- Service : ").append(nom).append(" x").append(vs.quantite);
                if (showPrices) {
                    double total = vs.service != null ? vs.service.prixTTC * vs.quantite : 0;
                    lignes.append(" = ").append(String.format("%.2f EUR", total));
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
            @QueryParam("comptoir") Boolean comptoir
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
        if (comptoir != null) {
            query.append(query.length() == 0 ? "" : " and ").append("comptoir = ?").append(params.size() + 1);
            params.add(comptoir);
        }
        if (query.length() == 0) {
            return VenteEntity.listAll();
        }
        return VenteEntity.list(query.toString(), params.toArray());
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
                if (incoming.techniciens != null) {
                    cloned.techniciens.addAll(incoming.techniciens);
                }
                cloned.datePlanification = incoming.datePlanification;
                cloned.dateDebut = incoming.dateDebut;
                cloned.dateFin = incoming.dateFin;
                cloned.status = incoming.status;
                cloned.statusDate = incoming.statusDate;
                cloned.dureeReelle = incoming.dureeReelle;
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
                if (incoming.techniciens != null) {
                    cloned.techniciens.addAll(incoming.techniciens);
                }
                cloned.datePlanification = incoming.datePlanification;
                cloned.dateDebut = incoming.dateDebut;
                cloned.dateFin = incoming.dateFin;
                cloned.status = incoming.status;
                cloned.statusDate = incoming.statusDate;
                cloned.dureeReelle = incoming.dureeReelle;
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

        // Update produits
        if (entity.produits != null) {
            entity.produits.clear();
        }
        if (vente.produits != null) {
            if (entity.produits == null) {
                entity.produits = vente.produits;
            } else {
                entity.produits.addAll(vente.produits);
            }
        }

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

        entity.images = vente.images != null ? vente.images : new java.util.ArrayList<>();
        entity.documents = vente.documents != null ? vente.documents : new java.util.ArrayList<>();
        entity.date = vente.date;
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

        return entity;
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
        if (vente.produits != null) {
            for (ProduitCatalogueEntity produit : vente.produits) {
                ProduitCatalogueEntity p = ProduitCatalogueEntity.findById(produit.id);
                if (p != null) {
                    p.stock = Math.max(0, p.stock - 1);
                }
            }
        }
        for (VenteForfaitEntity vf : vente.venteForfaits) {
            if (vf.forfait != null) {
                ForfaitEntity f = ForfaitEntity.findById(vf.forfait.id);
                if (f != null && f.produits != null) {
                    for (ForfaitProduitEntity fp : f.produits) {
                        if (fp.produit != null) {
                            ProduitCatalogueEntity p = ProduitCatalogueEntity.findById(fp.produit.id);
                            if (p != null) {
                                p.stock = Math.max(0, p.stock - fp.quantite * vf.quantite);
                            }
                        }
                    }
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
