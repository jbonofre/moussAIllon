package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

import java.util.ArrayList;
import java.util.List;

@Entity
public class SocieteEntity extends PanacheEntity {

    @Column(nullable = false)
    public String nom;

    @Column(nullable = false)
    public String siren;

    public String siret;

    public String ape;

    public String rcs;

    public String forme;

    public int capital;

    public String numerotva;

    @Column(nullable = false)
    public String adresse;

    public String telephone;

    public String email;

    public String bancaire;

    public List<String> images = new ArrayList<>();

}
