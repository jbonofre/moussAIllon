package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import io.quarkus.hibernate.orm.panache.PanacheQuery;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Path("/catalogue/remorques")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RemorqueCatalogResource {

    @GET
    public List<RemorqueCatalogueEntity> list() {
        return RemorqueCatalogueEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<RemorqueCatalogueEntity> search(
            @QueryParam("modele") String modele,
            @QueryParam("marque") String marque,
            @QueryParam("description") String description
    ) {
        String query = "";
        boolean first = true;
        if (modele != null && !modele.isEmpty()) {
            query += (first ? "" : " and ") + "lower(modele) like :modele";
            first = false;
        }
        if (marque != null && !marque.isEmpty()) {
            query += (first ? "" : " and ") + "lower(marque) like :marque";
            first = false;
        }
        if (description != null && !description.isEmpty()) {
            query += (first ? "" : " and ") + "lower(description) like :description";
            first = false;
        }
        if (query.isEmpty()) {
            return RemorqueCatalogueEntity.listAll();
        }

        Map<String, Object> params = new HashMap<>();
        if (modele != null && !modele.isEmpty()) {
            params.put("modele", "%" + modele.toLowerCase() + "%");
        }
        if (marque != null && !marque.isEmpty()) {
            params.put("marque", "%" + marque.toLowerCase() + "%");
        }
        if (description != null && !description.isEmpty()) {
            params.put("description", "%" + description.toLowerCase() + "%");
        }

        PanacheQuery<RemorqueCatalogueEntity> panacheQuery = RemorqueCatalogueEntity.find(query,
            params.isEmpty() ? Collections.emptyMap() : params);
        return panacheQuery.list();
    }

    @POST
    @Transactional
    public RemorqueCatalogueEntity create(RemorqueCatalogueEntity remorque) {
        remorque.persist();
        return remorque;
    }

    @GET
    @Path("{id}")
    public RemorqueCatalogueEntity get(@PathParam("id") Long id) {
        RemorqueCatalogueEntity entity = RemorqueCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La remorque (" + id + ") n'est pas trouvée", 404);
        }
        return entity;
    }

    @PUT
    @Path("{id}")
    @Transactional
    public RemorqueCatalogueEntity update(@PathParam("id") Long id, RemorqueCatalogueEntity remorque) {
        RemorqueCatalogueEntity entity = RemorqueCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La remorque (" + id + ") n'est pas trouvée", 404);
        }
        entity.modele = remorque.modele;
        entity.marque = remorque.marque;
        entity.description = remorque.description;
        entity.anneeDebut = remorque.anneeDebut;
        entity.anneeFin = remorque.anneeFin;
        entity.evaluation = remorque.evaluation;
        entity.ptac = remorque.ptac;
        entity.chargeAVide = remorque.chargeAVide;
        entity.chargeUtile = remorque.chargeUtile;
        entity.longueur = remorque.longueur;
        entity.largeur = remorque.largeur;
        entity.longueurMaxBateau = remorque.longueurMaxBateau;
        entity.largeurMaxBateau = remorque.largeurMaxBateau;
        entity.fleche = remorque.fleche;
        entity.typeChassis = remorque.typeChassis;
        entity.roues = remorque.roues;
        entity.equipement = remorque.equipement;
        entity.stock = remorque.stock;
        entity.stockAlerte = remorque.stockAlerte;
        entity.emplacement = remorque.emplacement;
        entity.prixPublic = remorque.prixPublic;
        entity.frais = remorque.frais;
        entity.tauxMarge = remorque.tauxMarge;
        entity.tauxMarque = remorque.tauxMarque;
        entity.prixVenteHT = remorque.prixVenteHT;
        entity.tva = remorque.tva;
        entity.montantTVA = remorque.montantTVA;
        entity.prixVenteTTC = remorque.prixVenteTTC;
        entity.images = remorque.images;
        entity.documents = remorque.documents;
        // Panache will flush the update at transaction end
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") Long id) {
        RemorqueCatalogueEntity entity = RemorqueCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("La remorque (" + id + ") n'est pas trouvée", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }
}
