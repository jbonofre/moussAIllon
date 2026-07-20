package net.nanthrax.moussaillon.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.SocietePaiementEntity;

import java.sql.Timestamp;
import java.time.Instant;

@Path("/societe")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SocieteResource {

    static final double MONTANT_ACTIVATION = 350.0;
    static final double MONTANT_ABONNEMENT_MENSUEL = 150.0;
    static final double MONTANT_ABONNEMENT_ANNUEL = 1650.0; // 11 mois × 150 € (1 mois offert)

    // Délai de rétractation après résiliation avant blocage effectif des accès.
    static final int DUREE_RETRACTATION_JOURS = 14;

    public static class PaiementRequest {
        public String type; // MENSUEL | ANNUEL
        public String mode; // CHEQUE | VIREMENT | CARTE | ESPÈCES
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
        entity.stripePaymentLinkMensuel = societe.stripePaymentLinkMensuel;
        entity.stripePaymentLinkAnnuel = societe.stripePaymentLinkAnnuel;
        entity.payplugPaymentLinkMensuel = societe.payplugPaymentLinkMensuel;
        entity.payplugPaymentLinkAnnuel = societe.payplugPaymentLinkAnnuel;
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
        SocietePaiementEntity.Mode mode;
        try {
            mode = SocietePaiementEntity.Mode.valueOf(request.mode);
        } catch (Exception e) {
            throw new WebApplicationException("Mode de paiement invalide", 400);
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
        double montant = request.type.equals("ANNUEL") ? MONTANT_ABONNEMENT_ANNUEL : MONTANT_ABONNEMENT_MENSUEL;

        entity.abonnementProchainPaiementDate = Timestamp.valueOf(
            entity.abonnementProchainPaiementDate.toLocalDateTime().plusMonths(mois));

        SocietePaiementEntity paiement = new SocietePaiementEntity();
        paiement.type = SocietePaiementEntity.Type.valueOf(request.type);
        paiement.montant = montant;
        paiement.mode = mode;
        paiement.date = Timestamp.from(Instant.now());
        paiement.societe = entity;
        paiement.persist();
        entity.paiements.add(0, paiement);

        return entity;
    }

    @POST
    @Path("/resilier")
    @Transactional
    public SocieteEntity resilier() {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        if (entity.abonnementResilie) {
            throw new WebApplicationException("L'abonnement est déjà résilié", 400);
        }

        entity.abonnementResilie = true;
        entity.abonnementResiliationDate = Timestamp.from(Instant.now());
        initAbonnement(entity);

        return entity;
    }

    @POST
    @Path("/reactiver")
    @Transactional
    public SocieteEntity reactiver() {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null) {
            throw new WebApplicationException("La société n'est pas trouvée", 404);
        }
        if (!entity.abonnementResilie) {
            throw new WebApplicationException("L'abonnement n'est pas résilié", 400);
        }

        entity.abonnementResilie = false;
        entity.abonnementResiliationDate = null;
        initAbonnement(entity);

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

        if (entity.abonnementResilie && entity.abonnementResiliationDate != null) {
            entity.abonnementBlocageDate = Timestamp.valueOf(
                entity.abonnementResiliationDate.toLocalDateTime().plusDays(DUREE_RETRACTATION_JOURS));
            entity.accesBloque = Timestamp.from(Instant.now()).after(entity.abonnementBlocageDate);
        } else {
            entity.abonnementBlocageDate = null;
            entity.accesBloque = false;
        }
    }

    /**
     * Indique si les accès (login) doivent être bloqués : abonnement résilié depuis plus
     * longtemps que le délai de rétractation ({@link #DUREE_RETRACTATION_JOURS} jours).
     * Utilisé par les points d'authentification (chantier, technicien, client).
     */
    public static boolean accesBloque() {
        SocieteEntity entity = SocieteEntity.findById(1);
        if (entity == null || !entity.abonnementResilie || entity.abonnementResiliationDate == null) {
            return false;
        }
        Timestamp dateBlocage = Timestamp.valueOf(
            entity.abonnementResiliationDate.toLocalDateTime().plusDays(DUREE_RETRACTATION_JOURS));
        return Timestamp.from(Instant.now()).after(dateBlocage);
    }

}
