package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"chantier", "type", "valeur"}))
public class ReferenceValeurEntity extends PanacheEntityChantier {

    @Column(nullable = false)
    public String type;

    @Column(nullable = false)
    public String valeur;

    public int ordre;

}
