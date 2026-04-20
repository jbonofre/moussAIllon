package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;

import java.util.List;

@Path("/catalogue/moteurs")
@ApplicationScoped
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class MoteurCatalogueResource {

    @GET
    public List<MoteurCatalogueEntity> list() {
        return MoteurCatalogueEntity.listAll();
    }

    @GET
    @Path("{id}")
    public MoteurCatalogueEntity get(@PathParam("id") Long id) {
        MoteurCatalogueEntity entity = MoteurCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le moteur (" + id + ") n'est pas trouvé", 404);
        }
        return entity;
    }

    @GET
    @Path("/search")
    public List<MoteurCatalogueEntity> search(@QueryParam("q") String query) {
        if (query == null || query.trim().isEmpty()) {
            return MoteurCatalogueEntity.listAll();
        }
        String q = "%" + query.toLowerCase() + "%";
        return MoteurCatalogueEntity.find(
            "lower(modele) like ?1 or lower(marque) like ?1 or lower(type) like ?1",
            q
        ).list();
    }

    @POST
    @Transactional
    public MoteurCatalogueEntity create(MoteurCatalogueEntity moteur) {
        moteur.persist();
        return moteur;
    }

    @PUT
    @Path("{id}")
    @Transactional
    public MoteurCatalogueEntity update(@PathParam("id") Long id, MoteurCatalogueEntity moteur) {
        MoteurCatalogueEntity entity = MoteurCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le moteur (" + id + ") n'est pas trouvé", 404);
        }

        // update the relevant fields
        entity.modele = moteur.modele;
        entity.marque = moteur.marque;
        entity.type = moteur.type;
        entity.description = moteur.description;
        entity.anneeDebut = moteur.anneeDebut;
        entity.anneeFin = moteur.anneeFin;
        entity.evaluation = moteur.evaluation;
        entity.images = moteur.images;
        entity.documents = moteur.documents;
        entity.puissanceCv = moteur.puissanceCv;
        entity.puissanceKw = moteur.puissanceKw;
        entity.longueurArbre = moteur.longueurArbre;
        entity.arbre = moteur.arbre;
        entity.demarrage = moteur.demarrage;
        entity.direction = moteur.direction;
        entity.cylindres = moteur.cylindres;
        entity.cylindree = moteur.cylindree;
        entity.regime = moteur.regime;
        entity.huileRecommandee = moteur.huileRecommandee;
        entity.stock = moteur.stock;
        entity.stockAlerte = moteur.stockAlerte;
        entity.emplacement = moteur.emplacement;
        entity.prixPublic = moteur.prixPublic;
        entity.frais = moteur.frais;
        entity.tauxMarge = moteur.tauxMarge;
        entity.tauxMarque = moteur.tauxMarque;
        entity.prixVenteHT = moteur.prixVenteHT;
        entity.tva = moteur.tva;
        entity.montantTVA = moteur.montantTVA;
        entity.prixVenteTTC = moteur.prixVenteTTC;
        entity.helicesCompatibles = moteur.helicesCompatibles;

        // Panache updates are flushed automatically at transaction close
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") Long id) {
        MoteurCatalogueEntity entity = MoteurCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le moteur (" + id + ") n'est pas trouvé", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }
}
