package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import io.quarkus.hibernate.orm.panache.PanacheQuery;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Path("/catalogue/helices")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class HeliceCatalogueResource {

    @GET
    public List<HeliceCatalogueEntity> list() {
        return HeliceCatalogueEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<HeliceCatalogueEntity> search(
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
            return HeliceCatalogueEntity.listAll();
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

        PanacheQuery<HeliceCatalogueEntity> panacheQuery = HeliceCatalogueEntity.find(query,
            params.isEmpty() ? Collections.emptyMap() : params);
        return panacheQuery.list();
    }

    @POST
    @Transactional
    public HeliceCatalogueEntity create(HeliceCatalogueEntity helice) {
        helice.persist();
        return helice;
    }

    @GET
    @Path("{id}")
    public HeliceCatalogueEntity get(long id) {
        HeliceCatalogueEntity entity = HeliceCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'hélice (" + id + ") n'est pas trouvée", 404);
        }
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(long id) {
        HeliceCatalogueEntity entity = HeliceCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'hélice (" + id + ") n'est pas trouvée", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public HeliceCatalogueEntity update(long id, HeliceCatalogueEntity helice) {
        HeliceCatalogueEntity entity = HeliceCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("L'hélice (" + id + ") n'est pas trouvée", 404);
        }

        entity.modele = helice.modele;
        entity.marque = helice.marque;
        entity.description = helice.description;
        entity.anneeDebut = helice.anneeDebut;
        entity.anneeFin = helice.anneeFin;
        entity.evaluation = helice.evaluation;
        entity.diametre = helice.diametre;
        entity.pas = helice.pas;
        entity.pales = helice.pales;
        entity.cannelures = helice.cannelures;
        entity.moteursCompatibles = helice.moteursCompatibles;
        entity.prixPublic = helice.prixPublic;
        entity.frais = helice.frais;
        entity.tauxMarge = helice.tauxMarge;
        entity.tauxMarque = helice.tauxMarque;
        entity.prixVenteHT = helice.prixVenteHT;
        entity.tva = helice.tva;
        entity.montantTVA = helice.montantTVA;
        entity.prixVenteTTC = helice.prixVenteTTC;
        entity.images = helice.images;
        entity.documents = helice.documents;

        return entity;
    }

}
