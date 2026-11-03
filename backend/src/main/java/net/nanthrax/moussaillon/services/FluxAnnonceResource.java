package net.nanthrax.moussaillon.services;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.OffsetDateTime;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.PlateformeAnnonceEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;

// Flux lu par les plateformes d'annonces : public, protégé par le jeton de chaque plateforme
@Path("/flux/annonces")
@ApplicationScoped
public class FluxAnnonceResource {

    @ConfigProperty(name = "annonces.public-url")
    String urlPublique;

    @GET
    @Path("{code}.xml")
    @Produces(MediaType.APPLICATION_XML + ";charset=UTF-8")
    @Transactional
    public String flux(@PathParam("code") String code, @QueryParam("token") String token) {
        PlateformeAnnonceEntity plateforme = PlateformeAnnonceEntity.find("code", code.toUpperCase()).firstResult();
        // Même réponse si la plateforme est inconnue, désactivée ou le jeton faux : rien n'est révélé
        if (plateforme == null || !plateforme.actif || !jetonValide(plateforme.jeton, token)) {
            throw new NotFoundException();
        }
        plateforme.derniereLecture = new Timestamp(System.currentTimeMillis());
        return NautixFlux.generer(PlateformeAnnonceEntity.annoncesDiffusees(plateforme.code),
                SocieteEntity.findById(1L), urlPublique, OffsetDateTime.now());
    }

    private static boolean jetonValide(String attendu, String recu) {
        return attendu != null && recu != null
                && MessageDigest.isEqual(attendu.getBytes(StandardCharsets.UTF_8), recu.getBytes(StandardCharsets.UTF_8));
    }

}
