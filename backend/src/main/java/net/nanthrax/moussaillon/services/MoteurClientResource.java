package net.nanthrax.moussaillon.services;

import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.ForfaitEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurClientEntity;

import java.sql.Timestamp;
import java.util.List;

@Path("/moteurs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MoteurClientResource {

    @jakarta.inject.Inject
    PretRecuperationService pretRecuperationService;

    @GET
    public List<MoteurClientEntity> listAll() {
        return MoteurClientEntity.listAll();
    }

    @GET
    @Path("/{id}")
    public MoteurClientEntity getById(@PathParam("id") Long id) {
        return MoteurClientEntity.findById(id);
    }

    @GET
    @Path("/search")
    public List<MoteurClientEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return MoteurClientEntity.listAll();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        return MoteurClientEntity.list("LOWER(numeroSerie) like ?1", likePattern);
    }

    @POST
    @Transactional
    public MoteurClientEntity create(MoteurClientEntity moteur) {
        if (moteur.proprietaire != null && moteur.proprietaire.id != null) {
            moteur.proprietaire = ClientEntity.findById(moteur.proprietaire.id);
        }
        if (moteur.modele != null && moteur.modele.id != null) {
            moteur.modele = MoteurCatalogueEntity.findById(moteur.modele.id);
        }
        moteur.id = null;
        if (moteur.dateCreation == null) {
            moteur.dateCreation = new Timestamp(System.currentTimeMillis());
        }
        moteur.persist();
        return moteur;
    }

    /** Le client est venu récupérer son matériel : annule le signal « prêt à récupérer ». */
    @POST
    @Path("/{id}/recupere")
    @Consumes(MediaType.WILDCARD)
    @Transactional
    public MoteurClientEntity marquerRecupere(@PathParam("id") Long id) {
        MoteurClientEntity moteur = MoteurClientEntity.findById(id);
        if (moteur == null) {
            throw new NotFoundException();
        }
        pretRecuperationService.annulerMoteur(moteur);
        return moteur;
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public MoteurClientEntity update(@PathParam("id") Long id, MoteurClientEntity updatedMoteur) {
        MoteurClientEntity moteur = MoteurClientEntity.findById(id);
        if (moteur == null) {
            throw new NotFoundException();
        }
        moteur.images = updatedMoteur.images;
        moteur.documents = updatedMoteur.documents;
        moteur.numeroSerie = updatedMoteur.numeroSerie;
        moteur.numeroClef = updatedMoteur.numeroClef;
        moteur.dateMeS = updatedMoteur.dateMeS;
        moteur.dateAchat = updatedMoteur.dateAchat;
        moteur.dateFinDeGuarantie = updatedMoteur.dateFinDeGuarantie;

        if (updatedMoteur.proprietaire != null && updatedMoteur.proprietaire.id != null) {
            moteur.proprietaire = ClientEntity.findById(updatedMoteur.proprietaire.id);
        } else {
            moteur.proprietaire = null;
        }

        if (updatedMoteur.modele != null && updatedMoteur.modele.id != null) {
            moteur.modele = MoteurCatalogueEntity.findById(updatedMoteur.modele.id);
        } else {
            moteur.modele = null;
        }

        return moteur;
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public void delete(@PathParam("id") Long id) {
        MoteurClientEntity moteur = MoteurClientEntity.findById(id);
        if (moteur == null) {
            throw new NotFoundException();
        }
        List<ForfaitEntity> forfaits = ForfaitEntity.list(
                "select f from ForfaitEntity f join f.moteursClientsAssocies m where m.id = ?1", id);
        for (ForfaitEntity forfait : forfaits) {
            forfait.moteursClientsAssocies.removeIf(m -> id.equals(m.id));
        }
        moteur.delete();
    }
}
