package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTransient;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Transient;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

// Plateforme d'annonces alimentée par un flux XML qu'elle vient lire (Leboncoin, Boat24, YouBoat...)
@Entity
public class PlateformeAnnonceEntity extends PanacheEntity {

    // Même code que dans les publications de l'annonce (LEBONCOIN, BOAT24, YOUBOAT)
    @Column(unique = true, nullable = false)
    public String code;

    public boolean actif;

    // Format du flux attendu par la plateforme
    public String format = "NAUTIX";

    // Jeton secret transmis à la plateforme dans l'URL du flux : jamais renvoyé seul au client
    @JsonbTransient
    public String jeton;

    public String notes;

    // Dernière lecture du flux par la plateforme : confirme que la diffusion est effective
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp derniereLecture;

    @Transient
    public String urlFlux;

    @Transient
    public int nombreAnnonces;

    @Transient
    public List<String> avertissements = new ArrayList<>();

    // Annonces actives cochées pour cette plateforme : le contenu du flux
    public static List<AnnonceEntity> annoncesDiffusees(String code) {
        return AnnonceEntity.<AnnonceEntity>list("status", AnnonceEntity.Status.ACTIVE).stream()
                .filter(a -> a.publications != null && a.publications.contains(code))
                .toList();
    }

}
