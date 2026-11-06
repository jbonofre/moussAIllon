package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;

@Entity
@EntityListeners(FormatNomListener.class)
public class MainOeuvreEntity extends PanacheEntityChantier {

    public String reference;

    @FormatNom
    public String nom;

    public String description;

    public double prixHT;

    public double tva;

    public double montantTVA;

    public double prixTTC;

    // Main d'oeuvre au forfait (déplacement, manutention...) : sa quantité n'est pas un nombre d'heures (KPIs atelier)
    @jakarta.persistence.Column(columnDefinition = "boolean default false")
    public boolean forfaitaire;

}
