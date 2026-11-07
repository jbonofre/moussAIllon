package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;

import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;

@Entity
public class RappelHistoriqueEntity extends PanacheEntityChantier {

    @ManyToOne
    public VenteEntity vente;

    public int numeroRappel;

    public String destinataire;

    public String sujet;

    // Corps HTML de l'email, bien au-delà des 255 caractères par défaut
    @Column(length = EmailTemplateEntity.LONGUEUR_CONTENU)
    public String contenu;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateEnvoi;

    // Relance écartée du journal sans être envoyée : la suivante reste prévue. dateEnvoi est alors la date de la décision.
    @Column(columnDefinition = "boolean default false")
    public boolean ignoree;

    public String motif;

    // Relance par courrier (mise en demeure) : préparée à dateEnvoi, à imprimer tant que dateImpression est vide.
    // Le destinataire est alors l'adresse postale du client.
    @Column(columnDefinition = "boolean default false")
    public boolean courrier;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateImpression;
}
