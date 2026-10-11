package net.nanthrax.moussaillon.services;

import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueClientEntity;

import java.sql.Timestamp;
import java.util.List;

@Path("/remorques")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RemorqueClientResource {

    @jakarta.inject.Inject
    PretRecuperationService pretRecuperationService;

    @GET
    public List<RemorqueClientEntity> listAll() {
        return RemorqueClientEntity.listAll();
    }

    @GET
    @Path("/{id}")
    public RemorqueClientEntity getById(@PathParam("id") Long id) {
        return RemorqueClientEntity.findById(id);
    }

    @GET
    @Path("/search")
    public List<RemorqueClientEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return RemorqueClientEntity.listAll();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        return RemorqueClientEntity.list("LOWER(immatriculation) like ?1", likePattern);
    }

    @POST
    @Transactional
    public RemorqueClientEntity create(RemorqueClientEntity remorque) {
        if (remorque.proprietaire != null && remorque.proprietaire.id != null) {
            remorque.proprietaire = ClientEntity.findById(remorque.proprietaire.id);
        }
        if (remorque.modele != null && remorque.modele.id != null) {
            remorque.modele = RemorqueCatalogueEntity.findById(remorque.modele.id);
        }
        remorque.id = null;
        if (remorque.dateCreation == null) {
            remorque.dateCreation = new Timestamp(System.currentTimeMillis());
        }
        remorque.persist();
        return remorque;
    }

    /** Le client est venu récupérer son matériel : annule le signal « prêt à récupérer ». */
    @POST
    @Path("/{id}/recupere")
    @Consumes(MediaType.WILDCARD)
    @Transactional
    public RemorqueClientEntity marquerRecupere(@PathParam("id") Long id) {
        RemorqueClientEntity remorque = RemorqueClientEntity.findById(id);
        if (remorque == null) {
            throw new NotFoundException();
        }
        pretRecuperationService.annulerRemorque(remorque);
        return remorque;
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public RemorqueClientEntity update(@PathParam("id") Long id, RemorqueClientEntity updatedRemorque) {
        RemorqueClientEntity remorque = RemorqueClientEntity.findById(id);
        if (remorque == null) {
            throw new NotFoundException();
        }
        remorque.images = updatedRemorque.images;
        remorque.documents = updatedRemorque.documents;
        remorque.immatriculation = updatedRemorque.immatriculation;
        remorque.dateMeS = updatedRemorque.dateMeS;
        remorque.dateAchat = updatedRemorque.dateAchat;
        remorque.dateFinDeGuarantie = updatedRemorque.dateFinDeGuarantie;

        if (updatedRemorque.proprietaire != null && updatedRemorque.proprietaire.id != null) {
            remorque.proprietaire = ClientEntity.findById(updatedRemorque.proprietaire.id);
        } else {
            remorque.proprietaire = null;
        }

        if (updatedRemorque.modele != null && updatedRemorque.modele.id != null) {
            remorque.modele = RemorqueCatalogueEntity.findById(updatedRemorque.modele.id);
        } else {
            remorque.modele = null;
        }

        return remorque;
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public void delete(@PathParam("id") Long id) {
        RemorqueClientEntity remorque = RemorqueClientEntity.findById(id);
        if (remorque == null) {
            throw new NotFoundException();
        }
        remorque.delete();
    }
}
