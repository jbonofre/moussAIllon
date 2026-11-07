package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"chantier", "type"}))
public class EmailTemplateEntity extends PanacheEntityChantier {

    public enum Type {
        // Relance de paiement 1 (RAPPEL, nom historique), 2 et 3
        RAPPEL,
        INCIDENT,
        FACTURE,
        AVOIR,
        PRET_A_RECUPERER,
        // Relance de devis/OR 1, 2 et 3
        RELANCE_DEVIS,
        RELANCE_2,
        RELANCE_3,
        RELANCE_DEVIS_2,
        RELANCE_DEVIS_3
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public Type type;

    @Column(nullable = false)
    public String sujet;

    /** Longueur maximale (caractères) du HTML d'un email enregistré : modèles, séquences, campagnes et historiques. */
    public static final int LONGUEUR_CONTENU = 100000;

    @Column(nullable = false, length = LONGUEUR_CONTENU)
    public String contenu;

    public String description;

    public static EmailTemplateEntity findByType(Type type) {
        return find("type", type).firstResult();
    }

}
