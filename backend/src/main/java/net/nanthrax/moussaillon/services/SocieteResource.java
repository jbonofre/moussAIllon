package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.SocieteEntity;

@Path("/societe")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SocieteResource {

    @GET
    public SocieteEntity get() {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        return entity;
    }

    @PUT
    @Transactional
    public SocieteEntity update(SocieteEntity societe) {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }

        entity.nom = societe.nom;
        entity.siren = societe.siren;
        entity.siret = societe.siret;
        entity.ape = societe.ape;
        entity.rcs = societe.rcs;
        entity.forme = societe.forme;
        entity.capital = societe.capital;
        entity.numerotva = societe.numerotva;
        entity.adresse = societe.adresse;
        entity.telephone = societe.telephone;
        entity.email = societe.email;
        entity.bancaire = societe.bancaire;
        entity.images = societe.images;

        return entity;
    }

}
