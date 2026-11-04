package net.nanthrax.moussaillon.services;

import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Duration;
import java.util.Set;

@ApplicationScoped
public class TokenService {

    public String generateToken(String subject, String role, String email, Long entityId) {
        return generateToken(subject, Set.of(role), email, entityId);
    }

    public String generateToken(String subject, Set<String> groups, String email, Long entityId) {
        return Jwt.issuer("moussaillon")
                .subject(subject)
                .groups(groups)
                .claim("email", email != null ? email : "")
                .claim("entityId", entityId != null ? entityId : 0L)
                .expiresIn(Duration.ofHours(24))
                .sign();
    }

}
