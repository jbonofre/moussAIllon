package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.Embeddable;

// Numéro de série d'un moteur physique d'un bateau client, rattaché à son modèle catalogue
@Embeddable
public class MoteurSerie {

    public Long moteurId;

    public String numeroSerie;

}
