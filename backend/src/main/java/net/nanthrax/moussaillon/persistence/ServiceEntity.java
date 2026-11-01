package net.nanthrax.moussaillon.persistence;

import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;

@Entity
@EntityListeners(FormatNomListener.class)
public class ServiceEntity extends PanacheEntity {

    @FormatNom
    public String nom;

    public String description;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "service_id")
    public List<ServiceMainOeuvreEntity> mainOeuvres = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "service_id")
    public List<ServiceProduitEntity> produits = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "service_id")
    public List<TaskEntity> taches = new ArrayList<>();

    public double dureeEstimee;

    public double prixHT;

    public double tva;

    public double montantTVA;

    public double prixTTC;

}
