package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;

@Entity
@EntityListeners(FormatNomListener.class)
public class TaskEntity extends PanacheEntity {

    @FormatNom
    public String nom;

    public String description;

    public boolean done;

}
