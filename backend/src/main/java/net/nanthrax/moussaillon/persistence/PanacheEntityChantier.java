package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.TenantId;

/**
 * Donnée propre à un chantier : Hibernate renseigne le chantier courant à l'enregistrement et ne lit que
 * les données de ce chantier (requêtes, chargement par identifiant, mises à jour et suppressions en masse).
 * Le chantier n'est jamais lu ni écrit en JSON : il vient du jeton de l'appelant.
 */
@MappedSuperclass
public abstract class PanacheEntityChantier extends PanacheEntity {

    // Valeur par défaut en base des lignes qui n'ont pas de chantier : celles des tables remplies avant le passage
    // multi-chantier (la mise à jour du schéma ajoute la colonne, non nulle, avec cette valeur), que DataInitializer
    // affecte au chantier initial. Ce n'est pas un code de chantier valide : ces lignes ne sont visibles de personne.
    public static final String A_AFFECTER = "_a_affecter";

    @TenantId
    @JsonbTransient
    @Column(name = "chantier", length = ChantierEntity.LONGUEUR_CODE)
    @ColumnDefault("'" + A_AFFECTER + "'")
    public String chantier;

}
