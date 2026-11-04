package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;

import java.util.HashSet;
import java.util.Set;

@Entity
public class UserEntity extends PanacheEntityBase {

    @Id
    public String name;

    // Modules de l'application auxquels l'utilisateur a accès (parmi ceux souscrits par la société).
    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    public Set<ModuleApplication> modules = new HashSet<>();

    public String password;

    @Column(nullable = false)
    public String email;

    public enum Theme {
        LIGHT,
        DARK
    }

    public Theme theme;

}
