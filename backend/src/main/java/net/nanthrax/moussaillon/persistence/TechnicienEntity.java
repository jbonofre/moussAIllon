package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;

@Entity
@EntityListeners(FormatNomListener.class)
public class TechnicienEntity extends PanacheEntityChantier {

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

    // Coût horaire chargé (salaire et charges), en € HT : coût de la main d'oeuvre pour la marge brute des prestations
    public Double coutHoraire;

    // Capacité de travail : durée hebdomadaire (heures) répartie sur les jours travaillés, numéros ISO séparés
    // par des virgules (1 = lundi ... 7 = dimanche), du lundi au vendredi s'ils ne sont pas renseignés
    public Double heuresHebdomadaires;

    public String joursTravailles;

}
