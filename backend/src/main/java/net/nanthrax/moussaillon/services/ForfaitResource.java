package net.nanthrax.moussaillon.services;

import java.util.ArrayList;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
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
import net.nanthrax.moussaillon.persistence.ForfaitEntity;

@Path("/forfaits")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ForfaitResource {

    @GET
    public List<ForfaitEntity> list() {
        return ForfaitEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<ForfaitEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return ForfaitEntity.listAll();
        }

        String likePattern = "%" + q.toLowerCase() + "%";
        return ForfaitEntity.list(
                "select distinct f from ForfaitEntity f"
                        + " left join f.bateauxClientsAssocies bc"
                        + " left join bc.modele bcm"
                        + " left join bc.moteurs bcmot"
                        + " left join f.moteursClientsAssocies mc"
                        + " left join mc.modele mcm"
                        + " left join mc.proprietaire mcp"
                        + " where LOWER(f.nom) LIKE ?1 OR LOWER(f.reference) LIKE ?1"
                        + " OR LOWER(bc.name) LIKE ?1 OR LOWER(bc.immatriculation) LIKE ?1 OR LOWER(bc.numeroSerie) LIKE ?1"
                        + " OR LOWER(bcm.designation) LIKE ?1 OR LOWER(bcmot.designation) LIKE ?1"
                        + " OR LOWER(mc.numeroSerie) LIKE ?1 OR LOWER(mcm.designation) LIKE ?1 OR LOWER(mcp.nom) LIKE ?1",
                likePattern);
    }

    @POST
    @Transactional
    public Response create(ForfaitEntity forfait) {
        forfait.persist();
        return Response.status(Response.Status.CREATED).entity(forfait).build();
    }

    @GET
    @Path("{id}")
    public ForfaitEntity get(@PathParam("id") long id) {
        ForfaitEntity entity = ForfaitEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le forfait (" + id + ") n'est pas trouve", 404);
        }
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") long id) {
        ForfaitEntity entity = ForfaitEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le forfait (" + id + ") n'est pas trouve", 404);
        }

        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public ForfaitEntity update(@PathParam("id") long id, ForfaitEntity forfait) {
        ForfaitEntity entity = ForfaitEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le forfait (" + id + ") n'est pas trouve", 404);
        }

        entity.nom = forfait.nom;
        entity.moteursAssocies = forfait.moteursAssocies;
        entity.bateauxAssocies = forfait.bateauxAssocies;
        entity.bateauxClientsAssocies = forfait.bateauxClientsAssocies != null
                ? forfait.bateauxClientsAssocies : new ArrayList<>();
        entity.moteursClientsAssocies = forfait.moteursClientsAssocies != null
                ? forfait.moteursClientsAssocies : new ArrayList<>();
        entity.produits.clear();
        if (forfait.produits != null) {
            entity.produits.addAll(forfait.produits);
        }
        entity.mainOeuvres.clear();
        if (forfait.mainOeuvres != null) {
            entity.mainOeuvres.addAll(forfait.mainOeuvres);
        }
        entity.dureeEstimee = forfait.dureeEstimee;
        entity.heuresFonctionnement = forfait.heuresFonctionnement;
        entity.joursFrequence = forfait.joursFrequence;
        entity.prixHT = forfait.prixHT;
        entity.tva = forfait.tva;
        entity.montantTVA = forfait.montantTVA;
        entity.prixTTC = forfait.prixTTC;
        entity.reference = forfait.reference;
        entity.taches.clear();
        if (forfait.taches != null) {
            entity.taches.addAll(forfait.taches);
        }

        return entity;
    }
}
