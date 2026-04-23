package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;


@Entity
public class ClientEntity extends PanacheEntity {

    public String prenom;

    @Column(nullable = false)
    public String nom;

    @Column(nullable = false)
    public String type;

    public String email;

    public String motDePasse;

    public String telephone;

    public String adresse;

    public boolean consentement;

    public double evaluation;

    public String date;

    public String notes;

    public double remise;

    public String siren;

    public String siret;

    public String tva;

    public String naf;

    public String canalAcquisition;

    public List<String> documents = new ArrayList<>();

    public Timestamp dateCreation;

    @jakarta.persistence.Transient
    public Double soldeDu;

}
