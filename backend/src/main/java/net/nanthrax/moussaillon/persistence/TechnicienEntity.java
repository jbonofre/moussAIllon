package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;

@Entity
@EntityListeners(FormatNomListener.class)
public class TechnicienEntity extends PanacheEntity {

    @FormatNom
    public String nom;

    @FormatNom
    public String prenom;

    public String motDePasse;

    public String email;

    public String telephone;

    public String couleur;

    // Objectifs mensuels fixes par le manager
    public Integer cibleInterventions;

    public Double cibleHeures;

}
