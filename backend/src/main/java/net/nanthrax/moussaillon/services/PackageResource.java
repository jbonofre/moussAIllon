package net.nanthrax.moussaillon.services;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

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
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.PackageEntity;
import net.nanthrax.moussaillon.persistence.PackageLigneEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;

@Path("/catalogue/packages")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PackageResource {

    @GET
    public List<PackageEntity> list() {
        return PackageEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<PackageEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return PackageEntity.listAll();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        return PackageEntity.list("LOWER(designation) LIKE ?1 OR LOWER(ref) LIKE ?1 OR LOWER(description) LIKE ?1", likePattern);
    }

    @GET
    @Path("{id}")
    public PackageEntity get(@PathParam("id") long id) {
        return charger(id);
    }

    @POST
    @Transactional
    public Response create(PackageEntity pack) {
        valider(pack);
        PackageEntity entity = new PackageEntity();
        entity.designation = pack.designation;
        entity.ref = pack.ref;
        entity.description = pack.description;
        entity.lignes.addAll(resoudreLignes(pack.lignes));
        entity.persist();
        if (ReferenceInterne.absente(entity.ref)) {
            entity.ref = ReferenceInterne.generer("PKG", entity.id);
        }
        return Response.status(Response.Status.CREATED).entity(entity).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public PackageEntity update(@PathParam("id") long id, PackageEntity pack) {
        PackageEntity entity = charger(id);
        valider(pack);
        entity.designation = pack.designation;
        entity.ref = pack.ref;
        entity.description = pack.description;
        List<PackageLigneEntity> lignes = resoudreLignes(pack.lignes);
        entity.lignes.clear();
        entity.lignes.addAll(lignes);
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(@PathParam("id") long id) {
        charger(id).delete();
        return Response.status(204).build();
    }

    private PackageEntity charger(long id) {
        PackageEntity entity = PackageEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le package (" + id + ") n'est pas trouvé", 404);
        }
        return entity;
    }

    private void valider(PackageEntity pack) {
        if (pack == null || pack.designation == null || pack.designation.isBlank()) {
            throw new WebApplicationException("La désignation du package est requise", 400);
        }
    }

    /**
     * Reconstruit les lignes à partir des articles réellement présents au catalogue : le client n'envoie
     * que des identifiants, et une ligne doit désigner un article, et un seul.
     */
    private List<PackageLigneEntity> resoudreLignes(List<PackageLigneEntity> lignes) {
        List<PackageLigneEntity> result = new ArrayList<>();
        if (lignes == null) {
            return result;
        }
        for (PackageLigneEntity ligne : lignes) {
            if (ligne == null) {
                continue;
            }
            PackageLigneEntity resolue = new PackageLigneEntity();
            int articles = 0;
            if (ligne.produit != null) {
                resolue.produit = article(ligne.produit.id, id -> ProduitCatalogueEntity.findById(id), "produit");
                articles++;
            }
            if (ligne.bateau != null) {
                resolue.bateau = article(ligne.bateau.id, id -> BateauCatalogueEntity.findById(id), "bateau");
                articles++;
            }
            if (ligne.moteur != null) {
                resolue.moteur = article(ligne.moteur.id, id -> MoteurCatalogueEntity.findById(id), "moteur");
                articles++;
            }
            if (ligne.helice != null) {
                resolue.helice = article(ligne.helice.id, id -> HeliceCatalogueEntity.findById(id), "hélice");
                articles++;
            }
            if (ligne.remorque != null) {
                resolue.remorque = article(ligne.remorque.id, id -> RemorqueCatalogueEntity.findById(id), "remorque");
                articles++;
            }
            if (articles != 1) {
                throw new WebApplicationException("Chaque ligne du package doit désigner un article du catalogue, et un seul", 400);
            }
            resolue.quantite = Math.max(1, ligne.quantite);
            result.add(resolue);
        }
        return result;
    }

    private <T> T article(Long id, Function<Long, T> chargeur, String type) {
        T entity = id == null ? null : chargeur.apply(id);
        if (entity == null) {
            throw new WebApplicationException("Article du catalogue introuvable (" + type + " " + id + ")", 400);
        }
        return entity;
    }

}
