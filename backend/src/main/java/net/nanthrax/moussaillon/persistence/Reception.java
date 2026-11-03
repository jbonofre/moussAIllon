package net.nanthrax.moussaillon.persistence;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

// Informations relevées à la réception du bateau, du moteur ou de la remorque du client :
// imprimées sur le devis/OR et reprises sur le bon pour accord à signer.
// Les booléens restent null tant que l'information n'est pas renseignée.
@Embeddable
public class Reception {

    public Integer nombreCles;

    // Saisie libre : fraction du réservoir (1/2, 3/4...) ou volume (40 L)
    public String volumeCarburant;

    public Boolean nableCoque;

    public Integer nombreCoupeCircuits;

    public Boolean nourriceCarburant;

    public Boolean rampeFeuxRemorque;

    public Boolean manivelleRemorque;

    public Integer nombreSanglesArrimage;

    @Column(columnDefinition = "TEXT")
    public String informations;

    public List<String> photos = new ArrayList<>();

}
