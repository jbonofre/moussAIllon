package net.nanthrax.moussaillon.services;

import io.smallrye.jwt.build.Jwt;
import io.smallrye.jwt.build.JwtClaimsBuilder;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Duration;
import java.util.Set;

@ApplicationScoped
public class TokenService {

    /** Jeton d'un utilisateur, client ou technicien du chantier courant. */
    public String generateToken(String subject, String role, String email, Long entityId) {
        return generateToken(subject, Set.of(role), email, entityId);
    }

    public String generateToken(String subject, Set<String> groups, String email, Long entityId) {
        return generateToken(ChantierContexte.courant(), subject, groups, email, entityId);
    }

    /**
     * Jeton portant le chantier de l'appelant (claim chantier), qui désigne les données de ses requêtes.
     * Sans chantier (administrateur de l'instance), le jeton n'en porte pas.
     */
    public String generateToken(String chantier, String subject, Set<String> groups, String email, Long entityId) {
        JwtClaimsBuilder claims = Jwt.issuer("moussaillon")
                .subject(subject)
                .groups(groups)
                .claim("email", email != null ? email : "")
                .claim("entityId", entityId != null ? entityId : 0L);
        if (chantier != null && !ChantierContexte.AUCUN.equals(chantier) && !ChantierContexte.RACINE.equals(chantier)) {
            claims.claim(ChantierFilter.CLAIM, chantier);
        }
        return claims.expiresIn(Duration.ofHours(24)).sign();
    }

}
