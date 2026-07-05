package net.nanthrax.moussaillon.services;

import java.sql.Date;
import java.util.ArrayList;
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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.ForfaitEntity;
import net.nanthrax.moussaillon.persistence.ForfaitProduitEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ServiceProduitEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.TaskEntity;
import net.nanthrax.moussaillon.persistence.TechnicienEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteProduitEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

@Path("/technicien-portal")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TechnicienPortalResource {

    @Inject
    Mailer mailer;

    @Inject
    TokenService tokenService;

    public static class LoginRequest {
        public String email;
        public String motDePasse;
    }

    public static class AuthResponse {
        public String token;
        public long id;
        public String nom;
        public String prenom;
        public String email;
        public String telephone;
        public String couleur;
    }

    public static class ChangePasswordRequest {
        public Long technicienId;
        public String currentPassword;
        public String newPassword;
    }

    public static class PlanningItemUpdateRequest {
        public String status;
        public double dureeReelle;
        public String dateDebut;
        public String dateFin;
        public String incidentDate;
        public String incidentDetails;
        public String notes;
        public List<ChecklistUpdate> taches;
        public List<String> images;
        public List<String> documents;
    }

    public static class ChecklistUpdate {
        public Long taskId;
        public boolean done;
    }

    public static class AddProduitRequest {
        public Long produitId;
        public int quantite;
    }

    public static class ChecklistItem {
        public Long id;
        public String nom;
        public String description;
        public boolean done;
    }

    public static class ProduitItem {
        public Long id;
        public String nom;
        public String marque;
        public String categorie;
        public String ref;
        public String emplacement;
        public int quantite;
    }

    public static class PlanningItemWithVente {
        public Long itemId;
        public Long venteId;
        public String itemType; // "forfait" or "service"
        public String itemNom;
        public String itemStatus;
        public String datePlanification;
        public String dateDebut;
        public String dateFin;
        public String statusDate;
        public String notes;
        public double dureeReelle;
        public double dureeEstimee;
        public String incidentDate;
        public String incidentDetails;
        public String clientNom;
        public String venteType;
        public String bateauNom;
        public int quantite;
        public List<ChecklistItem> taches;
        public List<ProduitItem> produits;
        public List<ProduitItem> produitsExtra;
        public List<String> images;
        public List<String> documents;

        public static PlanningItemWithVente fromForfait(VenteForfaitEntity vf, VenteEntity vente) {
            PlanningItemWithVente item = new PlanningItemWithVente();
            item.itemId = vf.id;
            item.venteId = vente.id;
            item.itemType = "forfait";
            item.itemNom = vf.forfait != null ? vf.forfait.nom : "";
            item.itemStatus = vf.status != null ? vf.status.name() : null;
            item.datePlanification = vf.datePlanification != null ? vf.datePlanification.toString() : null;
            item.dateDebut = vf.dateDebut != null ? vf.dateDebut.toString() : null;
            item.dateFin = vf.dateFin != null ? vf.dateFin.toString() : null;
            item.statusDate = vf.statusDate != null ? vf.statusDate.toString() : null;
            item.notes = vf.notes;
            item.dureeReelle = vf.dureeReelle;
            item.dureeEstimee = vf.forfait != null ? vf.forfait.dureeEstimee : 0;
            item.incidentDate = vf.incidentDate != null ? vf.incidentDate.toString() : null;
            item.incidentDetails = vf.incidentDetails;
            item.quantite = vf.quantite;
            if (vente.client != null) {
                item.clientNom = (vente.client.prenom != null ? vente.client.prenom + " " : "") + vente.client.nom;
            }
            item.venteType = vente.status != null ? vente.status.name() : null;
            if (vente.bateau != null) {
                item.bateauNom = vente.bateau.name;
            }
            item.taches = new ArrayList<>();
            if (vf.taches != null) {
                for (TaskEntity t : vf.taches) {
                    ChecklistItem ci = new ChecklistItem();
                    ci.id = t.id;
                    ci.nom = t.nom;
                    ci.description = t.description;
                    ci.done = t.done;
                    item.taches.add(ci);
                }
            }
            item.produits = new ArrayList<>();
            if (vf.forfait != null && vf.forfait.produits != null) {
                for (ForfaitProduitEntity fp : vf.forfait.produits) {
                    if (fp.produit != null) {
                        ProduitItem pi = new ProduitItem();
                        pi.id = fp.produit.id;
                        pi.nom = fp.produit.nom;
                        pi.marque = fp.produit.marque;
                        pi.categorie = fp.produit.categorie;
                        pi.ref = fp.produit.ref;
                        pi.emplacement = fp.produit.emplacement;
                        pi.quantite = fp.quantite;
                        item.produits.add(pi);
                    }
                }
            }
            item.produitsExtra = collectProduitsTechnicien(vente);
            item.images = new ArrayList<>();
            if (vente.images != null) {
                item.images.addAll(vente.images);
            }
            if (vf.images != null) {
                for (String img : vf.images) {
                    if (!item.images.contains(img)) {
                        item.images.add(img);
                    }
                }
            }
            item.documents = new ArrayList<>();
            if (vente.documents != null) {
                item.documents.addAll(vente.documents);
            }
            if (vf.documents != null) {
                for (String doc : vf.documents) {
                    if (!item.documents.contains(doc)) {
                        item.documents.add(doc);
                    }
                }
            }
            return item;
        }

        public static PlanningItemWithVente fromService(VenteServiceEntity vs, VenteEntity vente) {
            PlanningItemWithVente item = new PlanningItemWithVente();
            item.itemId = vs.id;
            item.venteId = vente.id;
            item.itemType = "service";
            item.itemNom = vs.service != null ? vs.service.nom : "";
            item.itemStatus = vs.status != null ? vs.status.name() : null;
            item.datePlanification = vs.datePlanification != null ? vs.datePlanification.toString() : null;
            item.dateDebut = vs.dateDebut != null ? vs.dateDebut.toString() : null;
            item.dateFin = vs.dateFin != null ? vs.dateFin.toString() : null;
            item.statusDate = vs.statusDate != null ? vs.statusDate.toString() : null;
            item.notes = vs.notes;
            item.dureeReelle = vs.dureeReelle;
            item.dureeEstimee = vs.service != null ? vs.service.dureeEstimee : 0;
            item.incidentDate = vs.incidentDate != null ? vs.incidentDate.toString() : null;
            item.incidentDetails = vs.incidentDetails;
            item.quantite = vs.quantite;
            if (vente.client != null) {
                item.clientNom = (vente.client.prenom != null ? vente.client.prenom + " " : "") + vente.client.nom;
            }
            item.venteType = vente.status != null ? vente.status.name() : null;
            if (vente.bateau != null) {
                item.bateauNom = vente.bateau.name;
            }
            item.taches = new ArrayList<>();
            if (vs.taches != null) {
                for (TaskEntity t : vs.taches) {
                    ChecklistItem ci = new ChecklistItem();
                    ci.id = t.id;
                    ci.nom = t.nom;
                    ci.description = t.description;
                    ci.done = t.done;
                    item.taches.add(ci);
                }
            }
            item.produits = new ArrayList<>();
            if (vs.service != null && vs.service.produits != null) {
                for (ServiceProduitEntity sp : vs.service.produits) {
                    if (sp.produit != null) {
                        ProduitItem pi = new ProduitItem();
                        pi.id = sp.produit.id;
                        pi.nom = sp.produit.nom;
                        pi.marque = sp.produit.marque;
                        pi.categorie = sp.produit.categorie;
                        pi.ref = sp.produit.ref;
                        pi.emplacement = sp.produit.emplacement;
                        pi.quantite = sp.quantite;
                        item.produits.add(pi);
                    }
                }
            }
            item.produitsExtra = collectProduitsTechnicien(vente);
            item.images = new ArrayList<>();
            if (vente.images != null) {
                item.images.addAll(vente.images);
            }
            if (vs.images != null) {
                for (String img : vs.images) {
                    if (!item.images.contains(img)) {
                        item.images.add(img);
                    }
                }
            }
            item.documents = new ArrayList<>();
            if (vente.documents != null) {
                item.documents.addAll(vente.documents);
            }
            if (vs.documents != null) {
                for (String doc : vs.documents) {
                    if (!item.documents.contains(doc)) {
                        item.documents.add(doc);
                    }
                }
            }
            return item;
        }
    }

    @POST
    @Path("/login")
    @Transactional
    public Response login(LoginRequest request) {
        if (request == null || request.email == null || request.email.isBlank()) {
            throw new WebApplicationException("L'email est requis", Response.Status.BAD_REQUEST);
        }
        List<TechnicienEntity> techniciens = TechnicienEntity.list(
                "LOWER(email) = ?1", request.email.toLowerCase().trim());
        if (techniciens.isEmpty()) {
            throw new WebApplicationException("Aucun technicien trouve avec cet email", Response.Status.UNAUTHORIZED);
        }
        TechnicienEntity technicien = techniciens.get(0);
        if (technicien.motDePasse != null && !technicien.motDePasse.isBlank()) {
            if (request.motDePasse == null || !PasswordUtil.verify(request.motDePasse, technicien.motDePasse)) {
                throw new WebApplicationException("Mot de passe invalide", Response.Status.UNAUTHORIZED);
            }
            // Opportunistic rehash of legacy plaintext passwords
            if (PasswordUtil.needsRehash(technicien.motDePasse)) {
                technicien.motDePasse = PasswordUtil.hash(request.motDePasse);
            }
        }

        AuthResponse auth = new AuthResponse();
        auth.token = tokenService.generateToken(String.valueOf(technicien.id), "technicien", technicien.email, technicien.id);
        auth.id = technicien.id;
        auth.nom = technicien.nom;
        auth.prenom = technicien.prenom;
        auth.email = technicien.email;
        auth.telephone = technicien.telephone;
        auth.couleur = technicien.couleur;
        return Response.ok(auth).build();
    }

    @POST
    @Path("/change-password")
    @Transactional
    public Response changePassword(ChangePasswordRequest request) {
        if (request == null || request.technicienId == null) {
            throw new WebApplicationException("L'identifiant du technicien est requis", Response.Status.BAD_REQUEST);
        }
        if (request.newPassword == null || request.newPassword.isBlank()) {
            throw new WebApplicationException("Le nouveau mot de passe est requis", Response.Status.BAD_REQUEST);
        }
        TechnicienEntity technicien = TechnicienEntity.findById(request.technicienId);
        if (technicien == null) {
            throw new WebApplicationException("Technicien non trouve", Response.Status.NOT_FOUND);
        }
        if (technicien.motDePasse != null && !technicien.motDePasse.isBlank()) {
            if (request.currentPassword == null || !PasswordUtil.verify(request.currentPassword, technicien.motDePasse)) {
                throw new WebApplicationException("Mot de passe actuel invalide", Response.Status.UNAUTHORIZED);
            }
        }
        technicien.motDePasse = PasswordUtil.hash(request.newPassword);
        return Response.noContent().build();
    }

    public static class ObjectifResponse {
        public Integer cibleInterventions;
        public Double cibleHeures;
    }

    @GET
    @Path("/techniciens/{id}/objectif")
    public ObjectifResponse getTechnicienObjectif(@PathParam("id") long technicienId) {
        TechnicienEntity technicien = TechnicienEntity.findById(technicienId);
        if (technicien == null) {
            throw new WebApplicationException("Technicien non trouve", Response.Status.NOT_FOUND);
        }
        ObjectifResponse response = new ObjectifResponse();
        response.cibleInterventions = technicien.cibleInterventions;
        response.cibleHeures = technicien.cibleHeures;
        return response;
    }

    @GET
    @Path("/techniciens/{id}/taches")
    public List<PlanningItemWithVente> getTechnicienTasks(@PathParam("id") long technicienId) {
        TechnicienEntity technicien = TechnicienEntity.findById(technicienId);
        if (technicien == null) {
            throw new WebApplicationException("Technicien non trouve", Response.Status.NOT_FOUND);
        }

        List<VenteEntity> ventes = VenteEntity.listAll();
        List<PlanningItemWithVente> result = new ArrayList<>();
        for (VenteEntity vente : ventes) {
            if (vente.venteForfaits != null) {
                for (VenteForfaitEntity vf : vente.venteForfaits) {
                    if (vf.techniciens != null && vf.techniciens.stream().anyMatch(t -> t.id.equals(technicienId))) {
                        result.add(PlanningItemWithVente.fromForfait(vf, vente));
                    }
                }
            }
            if (vente.venteServices != null) {
                for (VenteServiceEntity vs : vente.venteServices) {
                    if (vs.techniciens != null && vs.techniciens.stream().anyMatch(t -> t.id.equals(technicienId))) {
                        result.add(PlanningItemWithVente.fromService(vs, vente));
                    }
                }
            }
        }
        return result;
    }

    @PUT
    @Path("/forfaits/{itemId}")
    @Transactional
    public PlanningItemWithVente updateForfaitItem(@PathParam("itemId") long itemId, PlanningItemUpdateRequest request) {
        VenteForfaitEntity vf = VenteForfaitEntity.findById(itemId);
        if (vf == null) {
            throw new WebApplicationException("Element non trouve", Response.Status.NOT_FOUND);
        }

        if (request.status != null && !request.status.isBlank()) {
            vf.status = VenteForfaitEntity.Status.valueOf(request.status);
        }
        vf.dureeReelle = request.dureeReelle;
        if (request.dateDebut != null && !request.dateDebut.isBlank()) {
            vf.dateDebut = java.sql.Timestamp.valueOf(java.time.LocalDateTime.parse(request.dateDebut));
        }
        if (request.dateFin != null && !request.dateFin.isBlank()) {
            vf.dateFin = java.sql.Timestamp.valueOf(java.time.LocalDateTime.parse(request.dateFin));
        }
        if (request.notes != null) {
            vf.notes = request.notes;
        }
        if ("INCIDENT".equals(request.status)) {
            if (request.incidentDate != null && !request.incidentDate.isBlank()) {
                vf.incidentDate = Date.valueOf(request.incidentDate.length() > 10 ? request.incidentDate.substring(0, 10) : request.incidentDate);
            }
            vf.incidentDetails = request.incidentDetails;
        }

        // Update images and documents (append only)
        if (request.images != null) {
            vf.images = request.images;
        }
        if (request.documents != null) {
            vf.documents = request.documents;
        }

        // Update checklist items
        if (request.taches != null) {
            for (ChecklistUpdate cu : request.taches) {
                if (cu.taskId != null) {
                    TaskEntity task = TaskEntity.findById(cu.taskId);
                    if (task != null) {
                        task.done = cu.done;
                    }
                }
            }
        }

        // Find parent vente
        List<VenteEntity> ventes = VenteEntity.list("SELECT v FROM VenteEntity v JOIN v.venteForfaits vf WHERE vf.id = ?1", itemId);
        VenteEntity parentVente = ventes.isEmpty() ? null : ventes.get(0);

        // Send incident notification
        if (vf.status == VenteForfaitEntity.Status.INCIDENT && parentVente != null
                && parentVente.client != null && parentVente.client.email != null && !parentVente.client.email.isBlank()) {
            String nom = vf.forfait != null ? vf.forfait.nom : "Forfait";
            sendIncidentNotification(parentVente, nom, vf.incidentDetails, vf.incidentDate);
        }

        // Decrement stock
        if (vf.status == VenteForfaitEntity.Status.EN_COURS && parentVente != null && !parentVente.stockDecremented) {
            decrementStock(parentVente);
            parentVente.stockDecremented = true;
        }

        if (parentVente == null) {
            return PlanningItemWithVente.fromForfait(vf, new VenteEntity());
        }
        return PlanningItemWithVente.fromForfait(vf, parentVente);
    }

    @PUT
    @Path("/services/{itemId}")
    @Transactional
    public PlanningItemWithVente updateServiceItem(@PathParam("itemId") long itemId, PlanningItemUpdateRequest request) {
        VenteServiceEntity vs = VenteServiceEntity.findById(itemId);
        if (vs == null) {
            throw new WebApplicationException("Element non trouve", Response.Status.NOT_FOUND);
        }

        if (request.status != null && !request.status.isBlank()) {
            vs.status = VenteServiceEntity.Status.valueOf(request.status);
        }
        vs.dureeReelle = request.dureeReelle;
        if (request.dateDebut != null && !request.dateDebut.isBlank()) {
            vs.dateDebut = java.sql.Timestamp.valueOf(java.time.LocalDateTime.parse(request.dateDebut));
        }
        if (request.dateFin != null && !request.dateFin.isBlank()) {
            vs.dateFin = java.sql.Timestamp.valueOf(java.time.LocalDateTime.parse(request.dateFin));
        }
        if (request.notes != null) {
            vs.notes = request.notes;
        }
        if ("INCIDENT".equals(request.status)) {
            if (request.incidentDate != null && !request.incidentDate.isBlank()) {
                vs.incidentDate = Date.valueOf(request.incidentDate.length() > 10 ? request.incidentDate.substring(0, 10) : request.incidentDate);
            }
            vs.incidentDetails = request.incidentDetails;
        }

        // Update images and documents (append only)
        if (request.images != null) {
            vs.images = request.images;
        }
        if (request.documents != null) {
            vs.documents = request.documents;
        }

        // Update checklist items
        if (request.taches != null) {
            for (ChecklistUpdate cu : request.taches) {
                if (cu.taskId != null) {
                    TaskEntity task = TaskEntity.findById(cu.taskId);
                    if (task != null) {
                        task.done = cu.done;
                    }
                }
            }
        }

        // Find parent vente
        List<VenteEntity> ventes = VenteEntity.list("SELECT v FROM VenteEntity v JOIN v.venteServices vs WHERE vs.id = ?1", itemId);
        VenteEntity parentVente = ventes.isEmpty() ? null : ventes.get(0);

        // Send incident notification
        if (vs.status == VenteServiceEntity.Status.INCIDENT && parentVente != null
                && parentVente.client != null && parentVente.client.email != null && !parentVente.client.email.isBlank()) {
            String nom = vs.service != null ? vs.service.nom : "Service";
            sendIncidentNotification(parentVente, nom, vs.incidentDetails, vs.incidentDate);
        }

        // Decrement stock
        if (vs.status == VenteServiceEntity.Status.EN_COURS && parentVente != null && !parentVente.stockDecremented) {
            decrementStock(parentVente);
            parentVente.stockDecremented = true;
        }

        if (parentVente == null) {
            return PlanningItemWithVente.fromService(vs, new VenteEntity());
        }
        return PlanningItemWithVente.fromService(vs, parentVente);
    }

    @GET
    @Path("/produits")
    public List<ProduitItem> getCatalogueProduits() {
        List<ProduitCatalogueEntity> all = ProduitCatalogueEntity.listAll();
        List<ProduitItem> result = new ArrayList<>();
        for (ProduitCatalogueEntity p : all) {
            ProduitItem pi = new ProduitItem();
            pi.id = p.id;
            pi.nom = p.nom;
            pi.marque = p.marque;
            pi.categorie = p.categorie;
            pi.ref = p.ref;
            pi.emplacement = p.emplacement;
            pi.quantite = p.stock;
            result.add(pi);
        }
        return result;
    }

    @POST
    @Path("/forfaits/{itemId}/produits")
    @Transactional
    public PlanningItemWithVente addProduitToForfait(@PathParam("itemId") long itemId, AddProduitRequest request) {
        VenteForfaitEntity vf = VenteForfaitEntity.findById(itemId);
        if (vf == null) {
            throw new WebApplicationException("Element non trouve", Response.Status.NOT_FOUND);
        }
        VenteEntity parentVente = venteParenteForfait(itemId);
        ajouterProduitAVente(parentVente, request);
        return PlanningItemWithVente.fromForfait(vf, parentVente);
    }

    @DELETE
    @Path("/forfaits/{itemId}/produits/{produitLigneId}")
    @Transactional
    public PlanningItemWithVente removeProduitFromForfait(@PathParam("itemId") long itemId, @PathParam("produitLigneId") long produitLigneId) {
        VenteForfaitEntity vf = VenteForfaitEntity.findById(itemId);
        if (vf == null) {
            throw new WebApplicationException("Element non trouve", Response.Status.NOT_FOUND);
        }
        VenteEntity parentVente = venteParenteForfait(itemId);
        retirerProduitDeVente(parentVente, produitLigneId);
        return PlanningItemWithVente.fromForfait(vf, parentVente);
    }

    @POST
    @Path("/services/{itemId}/produits")
    @Transactional
    public PlanningItemWithVente addProduitToService(@PathParam("itemId") long itemId, AddProduitRequest request) {
        VenteServiceEntity vs = VenteServiceEntity.findById(itemId);
        if (vs == null) {
            throw new WebApplicationException("Element non trouve", Response.Status.NOT_FOUND);
        }
        VenteEntity parentVente = venteParenteService(itemId);
        ajouterProduitAVente(parentVente, request);
        return PlanningItemWithVente.fromService(vs, parentVente);
    }

    @DELETE
    @Path("/services/{itemId}/produits/{produitLigneId}")
    @Transactional
    public PlanningItemWithVente removeProduitFromService(@PathParam("itemId") long itemId, @PathParam("produitLigneId") long produitLigneId) {
        VenteServiceEntity vs = VenteServiceEntity.findById(itemId);
        if (vs == null) {
            throw new WebApplicationException("Element non trouve", Response.Status.NOT_FOUND);
        }
        VenteEntity parentVente = venteParenteService(itemId);
        retirerProduitDeVente(parentVente, produitLigneId);
        return PlanningItemWithVente.fromService(vs, parentVente);
    }

    private static VenteEntity venteParenteForfait(long forfaitId) {
        List<VenteEntity> ventes = VenteEntity.list("SELECT v FROM VenteEntity v JOIN v.venteForfaits vf WHERE vf.id = ?1", forfaitId);
        return ventes.isEmpty() ? null : ventes.get(0);
    }

    private static VenteEntity venteParenteService(long serviceId) {
        List<VenteEntity> ventes = VenteEntity.list("SELECT v FROM VenteEntity v JOIN v.venteServices vs WHERE vs.id = ?1", serviceId);
        return ventes.isEmpty() ? null : ventes.get(0);
    }

    // Ajoute le produit comme vraie ligne de la vente (venteProduits) et met a jour les montants.
    private void ajouterProduitAVente(VenteEntity vente, AddProduitRequest request) {
        if (vente == null) {
            throw new WebApplicationException("Prestation parente non trouvee", Response.Status.NOT_FOUND);
        }
        if (request == null || request.produitId == null) {
            throw new WebApplicationException("L'identifiant du produit est requis", Response.Status.BAD_REQUEST);
        }
        ProduitCatalogueEntity produit = ProduitCatalogueEntity.findById(request.produitId);
        if (produit == null) {
            throw new WebApplicationException("Produit non trouve", Response.Status.NOT_FOUND);
        }
        int quantite = request.quantite > 0 ? request.quantite : 1;
        VenteProduitEntity ligne = new VenteProduitEntity();
        ligne.produit = produit;
        ligne.quantite = quantite;
        ligne.ajouteParTechnicien = true;
        vente.venteProduits.add(ligne);
        appliquerDeltaMontant(vente, produit.prixVenteTTC * quantite);
    }

    // Retire une ligne produit ajoutee par le technicien et met a jour les montants.
    private void retirerProduitDeVente(VenteEntity vente, long produitLigneId) {
        if (vente == null) {
            throw new WebApplicationException("Prestation parente non trouvee", Response.Status.NOT_FOUND);
        }
        VenteProduitEntity ligne = vente.venteProduits.stream()
                .filter(vp -> vp.ajouteParTechnicien && vp.id != null && vp.id.equals(produitLigneId))
                .findFirst().orElse(null);
        if (ligne == null) {
            return;
        }
        double delta = ligne.produit != null ? -(ligne.produit.prixVenteTTC * ligne.quantite) : 0.0;
        vente.venteProduits.remove(ligne);
        appliquerDeltaMontant(vente, delta);
    }

    // Applique un delta TTC et recalcule les montants derives de la vente.
    private static void appliquerDeltaMontant(VenteEntity vente, double deltaTTC) {
        vente.montantTTC = arrondi(vente.montantTTC + deltaTTC);
        double tva = vente.tva;
        vente.montantTVA = (100.0 + tva) != 0.0 ? arrondi(vente.montantTTC / (100.0 + tva) * tva) : 0.0;
        vente.montantHT = arrondi(vente.montantTTC - vente.montantTVA);
        vente.prixVenteTTC = arrondi(vente.montantTTC - vente.remise);
    }

    private static double arrondi(double valeur) {
        return Math.round(valeur * 100.0) / 100.0;
    }

    // Construit la liste des produits ajoutes par le technicien pour l'affichage.
    private static List<ProduitItem> collectProduitsTechnicien(VenteEntity vente) {
        List<ProduitItem> result = new ArrayList<>();
        if (vente == null || vente.venteProduits == null) {
            return result;
        }
        for (VenteProduitEntity vp : vente.venteProduits) {
            if (vp.ajouteParTechnicien && vp.produit != null) {
                ProduitItem pi = new ProduitItem();
                pi.id = vp.id;
                pi.nom = vp.produit.nom;
                pi.marque = vp.produit.marque;
                pi.categorie = vp.produit.categorie;
                pi.ref = vp.produit.ref;
                pi.emplacement = vp.produit.emplacement;
                pi.quantite = vp.quantite;
                result.add(pi);
            }
        }
        return result;
    }

    private void sendIncidentNotification(VenteEntity vente, String itemNom, String incidentDetails, java.sql.Date incidentDate) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";
        String clientName = vente.client.prenom != null ? vente.client.prenom : vente.client.nom;

        String subject = "Incident sur votre intervention - " + societeNom;
        String body = "Bonjour " + clientName + ",\n\n"
                + "Nous vous informons qu'un incident a ete signale sur l'intervention \"" + itemNom + "\".\n\n";
        if (incidentDetails != null && !incidentDetails.isBlank()) {
            body += "Details : " + incidentDetails + "\n\n";
        }
        if (incidentDate != null) {
            body += "Date de l'incident : " + incidentDate + "\n\n";
        }
        body += "Notre equipe met tout en oeuvre pour resoudre la situation dans les meilleurs delais.\n\n"
                + "Cordialement,\n" + societeNom;

        mailer.send(Mail.withText(vente.client.email, subject, body));
    }

    private void decrementStock(VenteEntity vente) {
        if (vente.venteProduits != null) {
            for (net.nanthrax.moussaillon.persistence.VenteProduitEntity vp : vente.venteProduits) {
                if (vp.produit == null || vp.produit.id == null) continue;
                ProduitCatalogueEntity p = ProduitCatalogueEntity.findById(vp.produit.id);
                if (p != null) {
                    p.stock = Math.max(0, p.stock - Math.max(1, vp.quantite));
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
}
