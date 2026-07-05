package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.SocieteEntity;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

@Path("/societe")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SocieteResource {

    static final double MONTANT_ACTIVATION = 350.0;
    static final double MONTANT_ABONNEMENT_MENSUEL = 150.0;
    static final double MONTANT_ABONNEMENT_ANNUEL = 1650.0; // 11 mois × 150 € (1 mois offert)

    public static class PaiementRequest {
        public String type; // MENSUEL | ANNUEL
        public String signature;
    }

    @GET
    @Transactional
    public SocieteEntity get() {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        initAbonnement(entity);
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
        // Les informations d'abonnement sont en lecture seule : elles ne sont pas
        // modifiables par le client et restent gérées par le serveur.
        initAbonnement(entity);

        return entity;
    }

    @POST
    @Path("/paiement")
    @Transactional
    public SocieteEntity payer(PaiementRequest request) {
        if (request.type == null || (!request.type.equals("MENSUEL") && !request.type.equals("ANNUEL"))) {
            throw new WebApplicationException("Type de paiement invalide (MENSUEL ou ANNUEL attendu)", 400);
        }
        if (request.signature == null || request.signature.isBlank()) {
            throw new WebApplicationException("La signature est requise", 400);
        }
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        initAbonnement(entity);

        int mois = request.type.equals("ANNUEL") ? 12 : 1;
        entity.abonnementProchainPaiementDate = Timestamp.valueOf(
            entity.abonnementProchainPaiementDate.toLocalDateTime().plusMonths(mois));

        return entity;
    }

    /**
     * Renseigne, si nécessaire, les informations d'abonnement du compte :
     * date d'activation = date de création du compte, montant d'activation de 350 €,
     * prochaine échéance un mois plus tard pour un montant de 150 €.
     */
    private void initAbonnement(SocieteEntity entity) {
        if (entity.dateCreation == null) {
            entity.dateCreation = Timestamp.from(Instant.now());
        }
        if (entity.abonnementActivationDate == null) {
            entity.abonnementActivationDate = entity.dateCreation;
        }
        if (entity.abonnementActivationMontant == null) {
            entity.abonnementActivationMontant = MONTANT_ACTIVATION;
        }
        if (entity.abonnementProchainPaiementDate == null) {
            entity.abonnementProchainPaiementDate = Timestamp.valueOf(
                entity.abonnementActivationDate.toLocalDateTime().plusMonths(1));
        }
        if (entity.abonnementProchainPaiementMontant == null) {
            entity.abonnementProchainPaiementMontant = MONTANT_ABONNEMENT_MENSUEL;
        }
    }

}
