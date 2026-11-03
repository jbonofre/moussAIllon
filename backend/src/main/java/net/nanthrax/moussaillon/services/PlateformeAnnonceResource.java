package net.nanthrax.moussaillon.services;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.AnnonceEntity;
import net.nanthrax.moussaillon.persistence.PlateformeAnnonceEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;

@Path("/plateformes-annonces")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PlateformeAnnonceResource {

    // Plateformes alimentées par un flux ; les autres restent un simple suivi manuel de la diffusion
    static final List<String> PLATEFORMES = List.of("LEBONCOIN", "BOAT24", "YOUBOAT");

    static final List<String> FORMATS = List.of("NAUTIX");

    private static final SecureRandom RANDOM = new SecureRandom();

    @ConfigProperty(name = "annonces.public-url")
    String urlPublique;

    @GET
    public List<PlateformeAnnonceEntity> list() {
        SocieteEntity societe = SocieteEntity.findById(1L);
        List<PlateformeAnnonceEntity> plateformes = PlateformeAnnonceEntity.listAll();
        plateformes.forEach(p -> completer(p, societe));
        return plateformes;
    }

    @PUT
    @Path("{code}")
    @Transactional
    public PlateformeAnnonceEntity enregistrer(@PathParam("code") String code, PlateformeAnnonceEntity data) {
        String plateformeCode = verifierCode(code);
        if (data == null) {
            throw new WebApplicationException("La configuration est requise", 400);
        }
        String format = data.format == null ? FORMATS.get(0) : data.format.trim().toUpperCase();
        if (!FORMATS.contains(format)) {
            throw new WebApplicationException("Format de flux inconnu : " + data.format, 400);
        }
        PlateformeAnnonceEntity plateforme = PlateformeAnnonceEntity.find("code", plateformeCode).firstResult();
        if (plateforme == null) {
            plateforme = new PlateformeAnnonceEntity();
            plateforme.code = plateformeCode;
            plateforme.jeton = nouveauJeton();
            plateforme.persist();
        }
        plateforme.actif = data.actif;
        plateforme.format = format;
        plateforme.notes = data.notes;
        completer(plateforme, SocieteEntity.findById(1L));
        return plateforme;
    }

    // À utiliser si l'URL du flux a fuité : l'ancienne URL cesse de fonctionner
    @POST
    @Path("{code}/jeton")
    @Consumes(MediaType.WILDCARD)
    @Transactional
    public PlateformeAnnonceEntity regenererJeton(@PathParam("code") String code) {
        PlateformeAnnonceEntity plateforme = PlateformeAnnonceEntity.find("code", verifierCode(code)).firstResult();
        if (plateforme == null) {
            throw new WebApplicationException("La plateforme (" + code + ") n'est pas configurée", 404);
        }
        plateforme.jeton = nouveauJeton();
        completer(plateforme, SocieteEntity.findById(1L));
        return plateforme;
    }

    private void completer(PlateformeAnnonceEntity plateforme, SocieteEntity societe) {
        List<AnnonceEntity> annonces = PlateformeAnnonceEntity.annoncesDiffusees(plateforme.code);
        plateforme.urlFlux = NautixFlux.urlAbsolue("/api/flux/annonces/" + plateforme.code.toLowerCase() + ".xml?token=" + plateforme.jeton, urlPublique);
        plateforme.nombreAnnonces = annonces.size();
        plateforme.avertissements.clear();
        if (urlPublique.contains("localhost") || urlPublique.contains("127.0.0.1")) {
            plateforme.avertissements.add("URL publique de l'application non configurée (variable ANNONCES_PUBLIC_URL) : "
                    + "les plateformes ne pourront lire ni le flux ni les photos");
        }
        plateforme.avertissements.addAll(NautixFlux.avertissements(societe));
        plateforme.avertissements.addAll(NautixFlux.avertissements(annonces));
    }

    private static String verifierCode(String code) {
        String plateformeCode = code == null ? "" : code.trim().toUpperCase();
        if (!PLATEFORMES.contains(plateformeCode)) {
            throw new WebApplicationException("Plateforme non prise en charge : " + code, 400);
        }
        return plateformeCode;
    }

    private static String nouveauJeton() {
        byte[] octets = new byte[24];
        RANDOM.nextBytes(octets);
        return HexFormat.of().formatHex(octets);
    }

}
