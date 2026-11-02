package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;

@Entity
@EntityListeners(FormatNomListener.class)
public class TaskEntity extends PanacheEntity {

    @FormatNom
    public String nom;

    public String description;

    // Rang (0-based) de la ligne de main d'oeuvre du service à laquelle la tâche est rattachée ; null = non rattachée
    public Integer mainOeuvreIndex;

    public boolean done;

    // Point volontairement non fait par le technicien (≠ oubli) : le motif est alors obligatoire
    @Column(columnDefinition = "boolean default false")
    public boolean nonFait;

    public String motif;

}
