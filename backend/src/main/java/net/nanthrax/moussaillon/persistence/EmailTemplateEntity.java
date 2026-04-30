package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

@Entity
public class EmailTemplateEntity extends PanacheEntity {

    public enum Type {
        RAPPEL,
        INCIDENT,
        FACTURE,
        AVOIR
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, unique = true)
    public Type type;

    @Column(nullable = false)
    public String sujet;

    @Column(nullable = false, length = 10000)
    public String contenu;

    public String description;

    public static EmailTemplateEntity findByType(Type type) {
        return find("type", type).firstResult();
    }

}
