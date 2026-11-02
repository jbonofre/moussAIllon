package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.MainOeuvreEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ServiceEntity;
import net.nanthrax.moussaillon.persistence.ServiceMainOeuvreEntity;
import net.nanthrax.moussaillon.persistence.ServiceProduitEntity;
import net.nanthrax.moussaillon.persistence.TaskEntity;

import java.util.ArrayList;
import java.util.List;

@Path("/services")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ServiceResource {

    @GET
    public List<ServiceEntity> list() {
        return ServiceEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<ServiceEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return ServiceEntity.listAll();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        return ServiceEntity.list("LOWER(nom) LIKE ?1 OR LOWER(description) LIKE ?1", likePattern);
    }

    @POST
    @Transactional
    public ServiceEntity create(ServiceEntity service) {
        resolveRelations(service);
        service.persist();
        return service;
    }

    @GET
    @Path("{id}")
    public ServiceEntity get(long id) {
        ServiceEntity entity = ServiceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le service (" + id + ") n'est pas trouvé", 404);
        }
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(long id) {
        ServiceEntity entity = ServiceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le service (" + id + ") n'est pas trouvé", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public ServiceEntity update(long id, ServiceEntity service) {
        ServiceEntity entity = ServiceEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le service (" + id + ") n'est pas trouvé", 404);
        }

        entity.nom = service.nom;
        entity.description = service.description;
        entity.dureeEstimee = service.dureeEstimee;
        entity.prixHT = service.prixHT;
        entity.tva = service.tva;
        entity.montantTVA = service.montantTVA;
        entity.prixTTC = service.prixTTC;

        // Update main d'oeuvres
        entity.mainOeuvres.clear();
        if (service.mainOeuvres != null) {
            for (ServiceMainOeuvreEntity item : service.mainOeuvres) {
                ServiceMainOeuvreEntity newItem = new ServiceMainOeuvreEntity();
                if (item.mainOeuvre != null && item.mainOeuvre.id != null) {
                    newItem.mainOeuvre = MainOeuvreEntity.findById(item.mainOeuvre.id);
                }
                newItem.quantite = item.quantite;
                entity.mainOeuvres.add(newItem);
            }
        }

        // Update produits
        entity.produits.clear();
        if (service.produits != null) {
            for (ServiceProduitEntity item : service.produits) {
                ServiceProduitEntity newItem = new ServiceProduitEntity();
                if (item.produit != null && item.produit.id != null) {
                    newItem.produit = ProduitCatalogueEntity.findById(item.produit.id);
                }
                newItem.quantite = item.quantite;
                entity.produits.add(newItem);
            }
        }

        // Update taches
        entity.taches.clear();
        if (service.taches != null) {
            for (TaskEntity tache : service.taches) {
                TaskEntity newTache = new TaskEntity();
                newTache.nom = tache.nom;
                newTache.description = tache.description;
                newTache.mainOeuvreIndex = tache.mainOeuvreIndex;
                newTache.done = tache.done;
                entity.taches.add(newTache);
            }
        }

        return entity;
    }

    private void resolveRelations(ServiceEntity service) {
        if (service.mainOeuvres != null) {
            List<ServiceMainOeuvreEntity> resolved = new ArrayList<>();
            for (ServiceMainOeuvreEntity item : service.mainOeuvres) {
                if (item.mainOeuvre != null && item.mainOeuvre.id != null) {
                    item.mainOeuvre = MainOeuvreEntity.findById(item.mainOeuvre.id);
                }
                resolved.add(item);
            }
            service.mainOeuvres = resolved;
        }
        if (service.produits != null) {
            List<ServiceProduitEntity> resolved = new ArrayList<>();
            for (ServiceProduitEntity item : service.produits) {
                if (item.produit != null && item.produit.id != null) {
                    item.produit = ProduitCatalogueEntity.findById(item.produit.id);
                }
                resolved.add(item);
            }
            service.produits = resolved;
        }
    }
}
