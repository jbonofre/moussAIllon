package net.nanthrax.moussaillon.persistence;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;


@Entity
@EntityListeners(FormatNomListener.class)
public class ClientEntity extends PanacheEntity {

    // Un professionnel de la mer est exonéré de TVA (article 262 II du CGI)
    public static final String TYPE_PROFESSIONNEL_MER = "PROFESSIONNEL_MER";

    // Un prospect, ou un client inactif, devient client dès qu'une de ses ventes est acceptée
    // (voir ClientResource.convertirEnClient) ; un client ne devient inactif que sur décision du chantier.
    public enum Statut {
        PROSPECT,
        CLIENT,
        INACTIF
    }

    @Column(nullable = false)
    @FormatNom
    public String nom;

    // Code tiers dans le logiciel source (ex. EBP), utilisé pour retrouver le client lors d'un ré-import.
    public String codeTiers;

    @Column(nullable = false)
    public String type;

    // VARCHAR plutôt qu'ENUM natif H2 ; les clients existants sont des clients
    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "varchar(32) default 'CLIENT'")
    public Statut statut;

    public String email;

    public String motDePasse;

    public String telephone;

    @FormatNom
    public String adresse;

    public boolean consentement;

    // Accord particulier avec le client : aucune de ses ventes n'est relancée (paiement ou devis).
    @Column(columnDefinition = "boolean default false")
    public boolean relancesSuspendues;

    public String motifSuspensionRelances;

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

    @jakarta.persistence.Transient
    public Long nombreBateaux;

    // Bateaux du client (id et nom), pour affichage et navigation depuis la liste des clients.
    @jakarta.persistence.Transient
    public List<java.util.Map<String, Object>> bateaux;

    // Délai moyen (en jours) entre la date d'émission de la facture (dateFacturePrete)
    // et sa date de paiement (dateFacturePayee), sur les factures payées de ce client.
    @jakarta.persistence.Transient
    public Double delaiPaiementMoyenJours;

    // Suivi commercial : date du dernier échange et échéance de la prochaine action à faire.
    @jakarta.persistence.Transient
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp derniereInteraction;

    @jakarta.persistence.Transient
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp prochaineAction;

    // Sans statut (formulaire, import, vente comptoir...), un nouveau contact est un client
    @PrePersist
    void statutParDefaut() {
        if (statut == null) {
            statut = Statut.CLIENT;
        }
    }

    public boolean exonereTva() {
        return TYPE_PROFESSIONNEL_MER.equals(type);
    }

}
