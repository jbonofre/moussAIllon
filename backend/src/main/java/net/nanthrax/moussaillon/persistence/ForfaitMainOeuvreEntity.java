package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class ForfaitMainOeuvreEntity extends PanacheEntityChantier {

    @ManyToOne
    public MainOeuvreEntity mainOeuvre;

    public double quantite;
}
