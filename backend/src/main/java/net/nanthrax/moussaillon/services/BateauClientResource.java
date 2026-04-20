package net.nanthrax.moussaillon.services;

import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.BateauClientEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

@Path("/bateaux")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BateauClientResource {

    @GET
    public List<BateauClientEntity> listAll() {
        return BateauClientEntity.listAll();
    }

    @GET
    @Path("/{id}")
    public BateauClientEntity getById(@PathParam("id") Long id) {
        BateauClientEntity bateau = BateauClientEntity.findById(id);
        if (bateau == null) {
            throw new NotFoundException();
        }
        return bateau;
    }

    @GET
    @Path("/search")
    public List<BateauClientEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return BateauClientEntity.listAll();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        return BateauClientEntity.list("LOWER(name) like ?1 or LOWER(immatriculation) like ?1", likePattern);
    }

    @POST
    @Transactional
    public Response create(BateauClientEntity entity) {
        entity.id = null; // Ensure a new entity is created
        
        // Convert proprietaires IDs to entities
        if (entity.proprietaires != null) {
            List<ClientEntity> proprietairesEntities = new ArrayList<>();
            for (ClientEntity p : entity.proprietaires) {
                if (p != null && p.id != null) {
                    ClientEntity client = ClientEntity.findById(p.id);
                    if (client != null) {
                        proprietairesEntities.add(client);
                    }
                }
            }
            entity.proprietaires = proprietairesEntities;
        }
        
        // Convert modele ID to entity
        if (entity.modele != null && entity.modele.id != null) {
            entity.modele = BateauCatalogueEntity.findById(entity.modele.id);
        }
        
        // Convert moteurs IDs to entities
        if (entity.moteurs != null) {
            List<MoteurCatalogueEntity> moteursEntities = new ArrayList<>();
            for (MoteurCatalogueEntity m : entity.moteurs) {
                if (m != null && m.id != null) {
                    MoteurCatalogueEntity moteur = MoteurCatalogueEntity.findById(m.id);
                    if (moteur != null) {
                        moteursEntities.add(moteur);
                    }
                }
            }
            entity.moteurs = moteursEntities;
        }
        
        if (entity.dateCreation == null) {
            entity.dateCreation = new Timestamp(System.currentTimeMillis());
        }
        entity.persist();
        return Response.status(Response.Status.CREATED).entity(entity).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public Response update(@PathParam("id") Long id, BateauClientEntity updated) {
        BateauClientEntity entity = BateauClientEntity.findById(id);
        if (entity == null) {
            throw new NotFoundException();
        }
        // Update simple fields
        entity.name = updated.name;
        entity.images = updated.images;
        entity.documents = updated.documents;
        entity.immatriculation = updated.immatriculation;
        entity.numeroSerie = updated.numeroSerie;
        entity.numeroClef = updated.numeroClef;
        entity.dateMeS = updated.dateMeS;
        entity.dateAchat = updated.dateAchat;
        entity.dateFinDeGuarantie = updated.dateFinDeGuarantie;
        entity.localisation = updated.localisation;
        entity.localisationGps = updated.localisationGps;
        
        // Convert proprietaires IDs to entities
        if (updated.proprietaires != null) {
            List<ClientEntity> proprietairesEntities = new ArrayList<>();
            for (ClientEntity p : updated.proprietaires) {
                if (p != null && p.id != null) {
                    ClientEntity client = ClientEntity.findById(p.id);
                    if (client != null) {
                        proprietairesEntities.add(client);
                    }
                }
            }
            entity.proprietaires = proprietairesEntities;
        } else {
            entity.proprietaires = new ArrayList<>();
        }
        
        // Convert modele ID to entity
        if (updated.modele != null && updated.modele.id != null) {
            entity.modele = BateauCatalogueEntity.findById(updated.modele.id);
        } else {
            entity.modele = null;
        }
        
        // Convert moteurs IDs to entities
        if (updated.moteurs != null) {
            List<MoteurCatalogueEntity> moteursEntities = new ArrayList<>();
            for (MoteurCatalogueEntity m : updated.moteurs) {
                if (m != null && m.id != null) {
                    MoteurCatalogueEntity moteur = MoteurCatalogueEntity.findById(m.id);
                    if (moteur != null) {
                        moteursEntities.add(moteur);
                    }
                }
            }
            entity.moteurs = moteursEntities;
        } else {
            entity.moteurs = new ArrayList<>();
        }
        
        entity.equipements = updated.equipements != null ? updated.equipements : new ArrayList<>();

        return Response.ok(entity).build();
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response delete(@PathParam("id") Long id) {
        boolean deleted = BateauClientEntity.deleteById(id);
        if (!deleted) {
            throw new NotFoundException();
        }
        return Response.noContent().build();
    }
}
