package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.TenantId;

import java.util.HashSet;
import java.util.Set;

/**
 * Utilisateur d'un chantier, désigné par son nom (unique dans son chantier). La table UserEntity, dont le nom
 * était la clé primaire, est remplacée par UtilisateurEntity : DataInitializer y recopie les utilisateurs.
 */
@Entity
@Table(name = "UtilisateurEntity", uniqueConstraints = @UniqueConstraint(columnNames = {"chantier", "name"}))
public class UserEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue
    @JsonbTransient
    public Long id;

    @TenantId
    @JsonbTransient
    @Column(name = "chantier", length = ChantierEntity.LONGUEUR_CODE)
    @ColumnDefault("'" + PanacheEntityChantier.A_AFFECTER + "'")
    public String chantier;

    @Column(nullable = false)
    public String name;

    // Modules de l'application auxquels l'utilisateur a accès (parmi ceux souscrits par la société).
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "UtilisateurEntity_modules", joinColumns = @JoinColumn(name = "UtilisateurEntity_id"))
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

    /** Utilisateur du chantier courant portant ce nom, ou null. */
    public static UserEntity findByName(String name) {
        return name == null ? null : find("name", name).firstResult();
    }

}
