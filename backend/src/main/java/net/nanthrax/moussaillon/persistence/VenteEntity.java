package net.nanthrax.moussaillon.persistence;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.FetchType;

@Entity
public class VenteEntity extends PanacheEntityChantier {

    // Mention légale portée sur les factures d'un client exonéré de TVA
    public static final String MENTION_EXONERATION_TVA = "Exonération de TVA, article 262 II du Code général des impôts";

    public enum Status {
        DEVIS,
        FACTURE_EN_ATTENTE,
        FACTURE_PRETE,
        FACTURE_PAYEE
    }

    public Status status;

    public boolean bonPourAccord;

    public boolean ordreDeReparation;

    public boolean comptoir;

    @jakarta.persistence.Column(columnDefinition = "TEXT")
    public String signatureBonPourAccord;

    @ManyToOne
    public ClientEntity client;

    @ManyToOne
    public BateauClientEntity bateau;

    @ManyToOne
    public MoteurClientEntity moteur;

    @ManyToOne
    public RemorqueClientEntity remorque;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    @OrderBy("id")
    public List<VenteForfaitEntity> venteForfaits = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    @OrderBy("id")
    public List<VenteServiceEntity> venteServices = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    @OrderBy("id")
    public List<VenteProduitEntity> venteProduits = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    @OrderBy("id")
    public List<VenteBateauCatalogueEntity> venteBateauxCatalogue = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    @OrderBy("id")
    public List<VenteMoteurCatalogueEntity> venteMoteursCatalogue = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    @OrderBy("id")
    public List<VenteHeliceCatalogueEntity> venteHelicesCatalogue = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = jakarta.persistence.FetchType.EAGER)
    @JoinColumn(name = "vente_id")
    @OrderBy("id")
    public List<VenteRemorqueCatalogueEntity> venteRemorquesCatalogue = new ArrayList<>();

    // Legacy @ManyToMany lists kept temporarily for data migration on startup.
    // New code should use the venteXxxCatalogue lists above (with quantite and remise per line).
    @ManyToMany
    public List<ProduitCatalogueEntity> produits;

    @ManyToMany
    public List<BateauCatalogueEntity> bateauxCatalogue = new ArrayList<>();

    @ManyToMany
    public List<MoteurCatalogueEntity> moteursCatalogue = new ArrayList<>();

    @ManyToMany
    public List<HeliceCatalogueEntity> helicesCatalogue = new ArrayList<>();

    @ManyToMany
    public List<RemorqueCatalogueEntity> remorquesCatalogue = new ArrayList<>();

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp date;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateDevis;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateBonPourAccord;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateFactureEnAttente;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateFacturePrete;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateFacturePayee;

    // Devis/OR refusé par le client : il reste au statut devis, hors pipeline commercial et sans relance.
    // Effacé quand le devis est repris ou accepté.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateRefus;

    public String motifRefus;

    // Renseignée quand toutes les prestations sont terminées : le client peut venir récupérer son matériel.
    // Remise à null par l'utilisateur lorsque le client est venu le récupérer.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp datePretRecuperation;

    // Vrai une fois le signal « prêt à récupérer » émis (évite de le réémettre après annulation)
    @jakarta.persistence.Column(columnDefinition = "boolean default false")
    public boolean pretRecuperationNotifie;

    public String numeroFacture;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateEcheance;

    public String conditionsPaiement;

    public String penalitesRetard;

    @jakarta.persistence.Column(columnDefinition = "double default 40.0")
    public double indemniteForfaitaire = 40.0;

    public double montantHT;

    public double remise;

    public double montantTTC;

    public double tva;

    public double montantTVA;

    public double prixVenteTTC;

    public enum ModePaiement {
        CHEQUE,
        VIREMENT,
        CARTE,
        ESPÈCES,
    }

    public ModePaiement modePaiement;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "vente_paiement_vente_id")
    public List<VentePaiementEntity> paiements = new ArrayList<>();

    public List<String> images = new ArrayList<>();

    public List<String> documents = new ArrayList<>();

    public boolean stockDecremented;

    // Dernière relance de paiement automatique envoyée (0 = aucune, 1 à 3).
    // Les délais de relance sont paramétrés globalement sur la société.
    @jakarta.persistence.Column(columnDefinition = "integer default 0")
    public int niveauRelance;

    // Dernière relance automatique du devis/OR en attente de signature (0 = aucune, 1 à 3).
    @jakarta.persistence.Column(columnDefinition = "integer default 0")
    public int niveauRelanceDevis;

    // Relances (paiement ou devis) suspendues sur cette vente, par exemple après un accord particulier avec le client :
    // jusqu'à la date de fin incluse si elle est renseignée, sinon jusqu'à leur reprise.
    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp dateSuspensionRelances;

    @JsonbTypeAdapter(TimestampJsonbAdapter.class)
    public Timestamp finSuspensionRelances;

    public String motifSuspensionRelances;

    @jakarta.persistence.Column(columnDefinition = "TEXT")
    public String note;

    @jakarta.persistence.Embedded
    public Reception reception;

    // Vente à un client exonéré de TVA (professionnel de la mer) : au taux de 0 %, au prix HT des articles
    public boolean exonereTva() {
        return client != null && client.exonereTva();
    }

    // Prix unitaire d'un article sur la vente : son prix TTC, ou son prix HT pour un client exonéré de TVA
    // (déduit du TTC et du taux de l'article s'il n'est pas renseigné)
    public double prixLigne(double prixTTC, double prixHT, double tva) {
        if (!exonereTva()) {
            return prixTTC;
        }
        return prixHT > 0 ? prixHT : Math.round(prixTTC / (1 + tva / 100.0) * 100.0) / 100.0;
    }

    // Remise de la fiche client (en % du montant TTC), 0 si le client n'en a pas
    public double tauxRemiseClient() {
        return client != null ? Math.min(Math.max(client.remise, 0.0), 100.0) : 0.0;
    }

    // La vente porte la remise de son client si sa remise vaut le taux du client appliqué à son montant TTC,
    // au centime près (les arrondis peuvent différer d'un centime) : elle suit alors le montant de la vente
    public boolean appliqueRemiseClient() {
        double taux = tauxRemiseClient();
        return taux > 0 && Math.abs(Math.round(remise * 100.0) - Math.round(montantTTC * taux)) <= 1;
    }

}
