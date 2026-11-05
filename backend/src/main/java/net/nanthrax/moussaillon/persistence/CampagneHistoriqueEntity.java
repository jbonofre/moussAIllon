package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;

import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class CampagneHistoriqueEntity extends PanacheEntityChantier {

    @ManyToOne
    public CampagneEntity campagne;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateEnvoi;

    public int nombreDestinataires;

    public String statut;

    @Column(length = 2000)
    public String erreur;

}
