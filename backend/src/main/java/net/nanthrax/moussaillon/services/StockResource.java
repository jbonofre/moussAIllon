package net.nanthrax.moussaillon.services;

import io.quarkus.arc.Arc;
import io.quarkus.hibernate.orm.panache.PanacheEntity;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.CommandeFournisseurEntity;
import net.nanthrax.moussaillon.persistence.CommandeFournisseurLigneEntity;
import net.nanthrax.moussaillon.persistence.FournisseurBateauEntity;
import net.nanthrax.moussaillon.persistence.FournisseurEntity;
import net.nanthrax.moussaillon.persistence.FournisseurMoteurEntity;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.FournisseurRemorqueEntity;
import net.nanthrax.moussaillon.persistence.InventaireEntity;
import net.nanthrax.moussaillon.persistence.InventaireLigneEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitMouvementEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.TimestampJsonbAdapter;
import net.nanthrax.moussaillon.persistence.VenteBateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteMoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteRemorqueCatalogueEntity;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Gestion du stock des articles du catalogue suivis en stock : produits (quantités à virgule), bateaux, moteurs et
 * remorques (à l'unité). Les hélices ne sont pas gérées en stock.
 * <ul>
 *   <li>état du stock : réservé par les devis/OR signés, disponible, en commande, valeur au coût d'achat ;</li>
 *   <li>ajustements manuels avec leur motif ;</li>
 *   <li>réapprovisionnement des articles sous leur seuil d'alerte, en commandes fournisseur ;</li>
 *   <li>inventaires physiques.</li>
 * </ul>
 */
@Path("/stock")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class StockResource {

    static final String PRODUIT = "produit";
    static final String BATEAU = "bateau";
    static final String MOTEUR = "moteur";
    static final String REMORQUE = "remorque";

    // Commandes passées ou à passer dont les articles ne sont pas encore entrés en stock
    private static final List<CommandeFournisseurEntity.Status> COMMANDES_EN_COURS = List.of(
            CommandeFournisseurEntity.Status.BROUILLON, CommandeFournisseurEntity.Status.EN_ATTENTE,
            CommandeFournisseurEntity.Status.CONFIRMEE, CommandeFournisseurEntity.Status.EXPEDIEE);

    public enum Statut {
        // Rien de disponible : tout le stock est réservé, ou il n'y en a pas
        RUPTURE,
        // Disponible au seuil d'alerte ou en dessous
        SOUS_SEUIL,
        OK
    }

    @Inject
    SecurityIdentity identity;

    // --- État du stock ---

    public static class ArticleStock {
        // Type et identifiant de l'article, par exemple « produit-12 »
        public String cle;
        public String type;
        public Long id;
        public String designation;
        public String ref;
        // Catégorie d'un produit, type d'un bateau ou d'un moteur
        public String categorie;
        public String emplacement;
        public String emplacementMagasin;
        public double stock;
        public double seuil;
        // Réservé par les devis/OR signés et les ventes en cours dont le stock n'est pas encore sorti
        public double reserve;
        public double disponible;
        // Commandé aux fournisseurs, pas encore reçu
        public double enCommande;
        public double coutUnitaireHT;
        public double valeur;
        public double prixVenteHT;
        public boolean occasion;
        // Article géré en stock : en stock, avec un seuil d'alerte, réservé ou en commande
        public boolean suivi;
        public Statut statut;
    }

    @GET
    public List<ArticleStock> etat() {
        return articles();
    }

    /** État du stock de tous les articles suivis en stock, par type puis par désignation. */
    static List<ArticleStock> articles() {
        CoutAchat couts = CoutAchat.charge();
        Map<String, Double> reserve = quantitesReservees();
        Map<String, Double> enCommande = quantitesEnCommande();
        List<ArticleStock> articles = new ArrayList<>();
        for (ProduitCatalogueEntity p : ProduitCatalogueEntity.<ProduitCatalogueEntity>listAll()) {
            ArticleStock a = article(PRODUIT, p.id, p.designation, p.ref, p.categorie, p.stock, p.stockMini, couts.produit(p), reserve, enCommande);
            a.emplacement = p.emplacement;
            a.emplacementMagasin = p.emplacementMagasin;
            a.prixVenteHT = p.prixVenteHT;
            a.occasion = p.occasion;
            articles.add(a);
        }
        for (BateauCatalogueEntity b : BateauCatalogueEntity.<BateauCatalogueEntity>listAll()) {
            ArticleStock a = article(BATEAU, b.id, b.designation, b.ref, b.type, b.stock, b.stockAlerte, couts.bateau(b), reserve, enCommande);
            a.emplacement = b.emplacement;
            a.prixVenteHT = b.prixVenteHT;
            a.occasion = b.occasion;
            articles.add(a);
        }
        for (MoteurCatalogueEntity m : MoteurCatalogueEntity.<MoteurCatalogueEntity>listAll()) {
            ArticleStock a = article(MOTEUR, m.id, m.designation, m.ref, m.type, m.stock, m.stockAlerte, couts.moteur(m), reserve, enCommande);
            a.emplacement = m.emplacement;
            a.prixVenteHT = m.prixVenteHT;
            a.occasion = m.occasion;
            articles.add(a);
        }
        for (RemorqueCatalogueEntity r : RemorqueCatalogueEntity.<RemorqueCatalogueEntity>listAll()) {
            ArticleStock a = article(REMORQUE, r.id, r.designation, r.ref, null, r.stock, r.stockAlerte, couts.remorque(r), reserve, enCommande);
            a.emplacement = r.emplacement;
            a.prixVenteHT = r.prixVenteHT;
            a.occasion = r.occasion;
            articles.add(a);
        }
        articles.sort(Comparator.comparing((ArticleStock a) -> a.designation != null ? a.designation.toLowerCase(Locale.ROOT) : ""));
        return articles;
    }

    private static ArticleStock article(String type, Long id, String designation, String ref, String categorie,
                                        double stock, double seuil, double cout,
                                        Map<String, Double> reserve, Map<String, Double> enCommande) {
        ArticleStock a = new ArticleStock();
        a.cle = cle(type, id);
        a.type = type;
        a.id = id;
        a.designation = designation;
        a.ref = ref;
        a.categorie = categorie;
        a.stock = stock;
        a.seuil = seuil;
        a.reserve = reserve.getOrDefault(a.cle, 0.0);
        a.enCommande = enCommande.getOrDefault(a.cle, 0.0);
        a.disponible = stock - a.reserve;
        a.coutUnitaireHT = cout;
        a.valeur = stock > 0 ? arrondi(stock * cout) : 0;
        a.suivi = stock != 0 || seuil > 0 || a.reserve > 0 || a.enCommande > 0;
        a.statut = a.disponible <= 0 ? Statut.RUPTURE : a.disponible <= seuil ? Statut.SOUS_SEUIL : Statut.OK;
        return a;
    }

    static String cle(String type, Long id) {
        return type + "-" + id;
    }

    /**
     * Quantités réservées, par article : celles des devis/OR signés et des ventes en cours (facture en attente) dont le
     * stock n'est pas encore sorti, hors devis refusés. Les produits des forfaits sont comptés comme à leur sortie.
     */
    static Map<String, Double> quantitesReservees() {
        Map<String, Double> reserve = new HashMap<>();
        List<VenteEntity> ventes = VenteEntity.list(
                "stockDecremented = false and dateRefus is null and ((status = ?1 and bonPourAccord = true) or status = ?2)",
                VenteEntity.Status.DEVIS, VenteEntity.Status.FACTURE_EN_ATTENTE);
        for (VenteEntity vente : ventes) {
            VenteResource.quantitesProduits(vente).forEach((id, quantite) -> reserve.merge(cle(PRODUIT, id), quantite, Double::sum));
            if (vente.venteBateauxCatalogue != null) {
                for (VenteBateauCatalogueEntity vb : vente.venteBateauxCatalogue) {
                    if (vb.bateau != null && vb.bateau.id != null) {
                        reserve.merge(cle(BATEAU, vb.bateau.id), (double) Quantite.unites(vb.quantite), Double::sum);
                    }
                }
            }
            if (vente.venteMoteursCatalogue != null) {
                for (VenteMoteurCatalogueEntity vm : vente.venteMoteursCatalogue) {
                    if (vm.moteur != null && vm.moteur.id != null) {
                        reserve.merge(cle(MOTEUR, vm.moteur.id), (double) Quantite.unites(vm.quantite), Double::sum);
                    }
                }
            }
            if (vente.venteRemorquesCatalogue != null) {
                for (VenteRemorqueCatalogueEntity vr : vente.venteRemorquesCatalogue) {
                    if (vr.remorque != null && vr.remorque.id != null) {
                        reserve.merge(cle(REMORQUE, vr.remorque.id), (double) Quantite.unites(vr.quantite), Double::sum);
                    }
                }
            }
        }
        return reserve;
    }

    /** Quantités commandées aux fournisseurs et pas encore reçues, par article (à l'unité supérieure, comme à leur réception). */
    static Map<String, Double> quantitesEnCommande() {
        Map<String, Double> enCommande = new HashMap<>();
        List<CommandeFournisseurEntity> commandes = CommandeFournisseurEntity.list(
                "stockIncremented = false and (status is null or status in ?1)", COMMANDES_EN_COURS);
        for (CommandeFournisseurEntity commande : commandes) {
            for (CommandeFournisseurLigneEntity ligne : commande.lignes) {
                if (ligne.quantite <= 0) {
                    continue;
                }
                if (ligne.produit != null) {
                    enCommande.merge(cle(PRODUIT, ligne.produit.id), ligne.quantite, Double::sum);
                }
                double unites = Math.ceil(ligne.quantite);
                if (ligne.bateau != null) {
                    enCommande.merge(cle(BATEAU, ligne.bateau.id), unites, Double::sum);
                }
                if (ligne.moteur != null) {
                    enCommande.merge(cle(MOTEUR, ligne.moteur.id), unites, Double::sum);
                }
                if (ligne.remorque != null) {
                    enCommande.merge(cle(REMORQUE, ligne.remorque.id), unites, Double::sum);
                }
            }
        }
        return enCommande;
    }

    // --- Ajustement manuel et historique ---

    public static class AjustementRequest {
        public String type;
        public Long id;
        // Nouveau stock ; sans lui, variation (signée) du stock
        public Double nouveauStock;
        public Double variation;
        public ProduitMouvementEntity.Motif motif;
        public String commentaire;
    }

    /** Ajuste le stock d'un article, avec son motif : le mouvement est inscrit à son historique. */
    @POST
    @Path("/ajustement")
    @Transactional
    public ProduitMouvementEntity ajuster(AjustementRequest request) {
        if (request == null || request.motif == null) {
            throw erreur(400, "Le motif de l'ajustement est requis");
        }
        Article article = Article.charger(request.type, request.id);
        double avant = article.stock();
        double apres;
        if (request.nouveauStock != null) {
            apres = request.nouveauStock;
        } else if (request.variation != null) {
            apres = avant + request.variation;
        } else {
            throw erreur(400, "Le nouveau stock ou la variation est requis");
        }
        article.verifierQuantite(apres);
        if (apres == avant) {
            throw erreur(400, "Le stock est inchangé");
        }
        article.stock(apres);
        ProduitMouvementEntity mouvement = ProduitMouvementEntity.nouveau(
                ProduitMouvementEntity.Type.AJUSTEMENT_MANUEL, apres - avant, apres, null, null);
        article.rattacher(mouvement);
        mouvement.motif = request.motif;
        mouvement.commentaire = request.commentaire != null && !request.commentaire.isBlank() ? request.commentaire.trim() : null;
        mouvement.utilisateur = utilisateur();
        mouvement.persist();
        return mouvement;
    }

    @GET
    @Path("/{type}/{id}/mouvements")
    public List<ProduitMouvementEntity> mouvements(@PathParam("type") String type, @PathParam("id") long id) {
        Article article = Article.charger(type, id);
        return ProduitMouvementEntity.list(article.type() + ".id = ?1 order by date desc, id desc", id);
    }

    // --- Réapprovisionnement ---

    public static class FournisseurPropose {
        public Long fournisseurId;
        public String fournisseurNom;
        public String referenceFournisseur;
        public double prixAchatHT;
        public double tva;
        public int nombreMinACommander;
    }

    public static class ArticleAReapprovisionner {
        public String cle;
        public String type;
        public Long id;
        public String designation;
        public String ref;
        public String categorie;
        public double stock;
        public double seuil;
        public double reserve;
        public double disponible;
        public double enCommande;
        public double quantiteSuggeree;
        // Fournisseur proposé : le moins cher de l'article (prix renseigné), sinon le premier
        public Long fournisseurId;
        public List<FournisseurPropose> fournisseurs = new ArrayList<>();
    }

    /**
     * Articles à commander : ceux dont le stock disponible, augmenté de ce qui est déjà en commande, est au seuil d'alerte
     * ou en dessous, ou ne couvre pas les réservations.
     */
    @GET
    @Path("/reapprovisionnement")
    public List<ArticleAReapprovisionner> reapprovisionnement() {
        List<ArticleAReapprovisionner> aCommander = new ArrayList<>();
        for (ArticleStock a : articles()) {
            double projete = a.disponible + a.enCommande;
            if (projete >= 0 && (a.seuil <= 0 || projete > a.seuil)) {
                continue;
            }
            ArticleAReapprovisionner r = new ArticleAReapprovisionner();
            r.cle = a.cle;
            r.type = a.type;
            r.id = a.id;
            r.designation = a.designation;
            r.ref = a.ref;
            r.categorie = a.categorie;
            r.stock = a.stock;
            r.seuil = a.seuil;
            r.reserve = a.reserve;
            r.disponible = a.disponible;
            r.enCommande = a.enCommande;
            r.fournisseurs = fournisseurs(a.type, a.id);
            FournisseurPropose propose = r.fournisseurs.stream()
                    .filter(f -> f.prixAchatHT > 0)
                    .min(Comparator.comparingDouble(f -> f.prixAchatHT))
                    .orElse(r.fournisseurs.isEmpty() ? null : r.fournisseurs.get(0));
            r.fournisseurId = propose != null ? propose.fournisseurId : null;
            r.quantiteSuggeree = quantiteSuggeree(a.seuil, projete, propose != null ? propose.nombreMinACommander : 0);
            aCommander.add(r);
        }
        return aCommander;
    }

    /**
     * Quantité à commander pour revenir à deux fois le seuil d'alerte (au moins au-dessus du seuil), en unités entières,
     * et au moins le minimum de commande du fournisseur.
     */
    static double quantiteSuggeree(double seuil, double projete, int minimumCommande) {
        double cible = Math.max(2 * seuil, seuil + 1);
        return Math.max(Math.ceil(cible - projete), Math.max(minimumCommande, 1));
    }

    private static List<FournisseurPropose> fournisseurs(String type, Long id) {
        List<FournisseurPropose> fournisseurs = new ArrayList<>();
        switch (type) {
            case PRODUIT -> FournisseurProduitEntity.<FournisseurProduitEntity>list("produit.id", id).forEach(f ->
                    fournisseurs.add(fournisseur(f.fournisseur, f.reference, f.prixAchatHT, f.tva, f.nombreMinACommander)));
            case BATEAU -> FournisseurBateauEntity.<FournisseurBateauEntity>list("bateau.id", id).forEach(f ->
                    fournisseurs.add(fournisseur(f.fournisseur, f.reference, f.prixAchatHT, f.tva, f.nombreMinACommander)));
            case MOTEUR -> FournisseurMoteurEntity.<FournisseurMoteurEntity>list("moteur.id", id).forEach(f ->
                    fournisseurs.add(fournisseur(f.fournisseur, f.reference, f.prixAchatHT, f.tva, f.nombreMinACommander)));
            case REMORQUE -> FournisseurRemorqueEntity.<FournisseurRemorqueEntity>list("remorque.id", id).forEach(f ->
                    fournisseurs.add(fournisseur(f.fournisseur, f.reference, f.prixAchatHT, f.tva, f.nombreMinACommander)));
            default -> { }
        }
        fournisseurs.removeIf(f -> f.fournisseurId == null);
        return fournisseurs;
    }

    private static FournisseurPropose fournisseur(FournisseurEntity fournisseur, String reference, double prixAchatHT,
                                                  double tva, int nombreMinACommander) {
        FournisseurPropose f = new FournisseurPropose();
        f.fournisseurId = fournisseur != null ? fournisseur.id : null;
        f.fournisseurNom = fournisseur != null ? fournisseur.nom : null;
        f.referenceFournisseur = reference;
        f.prixAchatHT = prixAchatHT;
        f.tva = tva;
        f.nombreMinACommander = nombreMinACommander;
        return f;
    }

    public static class LigneReapprovisionnement {
        public String type;
        public Long id;
        public Long fournisseurId;
        public double quantite;
        // Prix d'achat et TVA : sans eux, ceux de l'article chez le fournisseur
        public Double prixUnitaireHT;
        public Double tva;
    }

    public static class ReapprovisionnementRequest {
        public List<LigneReapprovisionnement> lignes = new ArrayList<>();
    }

    public static class CommandeCreee {
        public Long id;
        public String reference;
        public String fournisseurNom;
        public int nombreLignes;
        public double montantHT;
    }

    /** Commande les articles choisis : une commande fournisseur en brouillon par fournisseur. */
    @POST
    @Path("/reapprovisionnement")
    @Transactional
    public List<CommandeCreee> commander(ReapprovisionnementRequest request) {
        List<LigneReapprovisionnement> lignes = request != null && request.lignes != null
                ? request.lignes.stream().filter(l -> l.quantite > 0).toList() : List.of();
        if (lignes.isEmpty()) {
            throw erreur(400, "Aucun article à commander");
        }
        Map<Long, List<CommandeFournisseurResource.CreateCommandeLigneRequest>> parFournisseur = new LinkedHashMap<>();
        for (LigneReapprovisionnement ligne : lignes) {
            Article article = Article.charger(ligne.type, ligne.id);
            if (ligne.fournisseurId == null) {
                throw erreur(400, "Choisissez le fournisseur de « " + article.designation() + " »");
            }
            FournisseurPropose tarif = fournisseurs(article.type(), ligne.id).stream()
                    .filter(f -> f.fournisseurId.equals(ligne.fournisseurId)).findFirst().orElse(null);
            CommandeFournisseurResource.CreateCommandeLigneRequest l = new CommandeFournisseurResource.CreateCommandeLigneRequest();
            l.type = article.type();
            l.id = ligne.id;
            l.quantite = ligne.quantite;
            l.prixUnitaireHT = ligne.prixUnitaireHT != null ? ligne.prixUnitaireHT : tarif != null ? tarif.prixAchatHT : 0;
            l.tva = ligne.tva != null ? ligne.tva : tarif != null ? tarif.tva : 20.0;
            parFournisseur.computeIfAbsent(ligne.fournisseurId, f -> new ArrayList<>()).add(l);
        }
        List<CommandeCreee> creees = new ArrayList<>();
        for (Map.Entry<Long, List<CommandeFournisseurResource.CreateCommandeLigneRequest>> entree : parFournisseur.entrySet()) {
            FournisseurEntity fournisseur = FournisseurEntity.findById(entree.getKey());
            if (fournisseur == null) {
                throw erreur(400, "Le fournisseur (" + entree.getKey() + ") n'est pas trouvé");
            }
            CommandeFournisseurEntity commande = CommandeFournisseurResource.nouvelleCommande(fournisseur, null, null, entree.getValue());
            commande.status = CommandeFournisseurEntity.Status.BROUILLON;
            commande.notes = "Réapprovisionnement du stock";
            commande.persist();
            CommandeCreee creee = new CommandeCreee();
            creee.id = commande.id;
            creee.reference = commande.reference;
            creee.fournisseurNom = fournisseur.nom;
            creee.nombreLignes = commande.lignes.size();
            creee.montantHT = commande.montantHT;
            creees.add(creee);
        }
        return creees;
    }

    // --- Inventaires ---

    public static class InventaireRequest {
        public String libelle;
        // Périmètre : type d'article, catégorie et emplacement (atelier ou magasin), sans filtre s'ils sont vides
        public String typeArticle;
        public String categorie;
        public String emplacement;
        // Inclut les articles qui ne sont pas gérés en stock (sans stock ni seuil d'alerte)
        public boolean toutLeCatalogue;
    }

    public static class InventaireResume {
        public Long id;
        public String reference;
        public String libelle;
        public String typeArticle;
        public String categorie;
        public String emplacement;
        public InventaireEntity.Statut statut;
        @JsonbTypeAdapter(TimestampJsonbAdapter.class)
        public Timestamp dateCreation;
        @JsonbTypeAdapter(TimestampJsonbAdapter.class)
        public Timestamp dateValidation;
        public String creePar;
        public String validePar;
        public int nombreLignes;
        public int nombreComptees;
        public int nombreEcarts;
        public double valeurEcarts;
    }

    public static class Comptage {
        public Long ligneId;
        // Null : l'article n'est plus compté
        public Double stockCompte;
    }

    @GET
    @Path("/inventaires")
    public List<InventaireResume> inventaires() {
        return InventaireEntity.<InventaireEntity>list("order by dateCreation desc, id desc").stream()
                .map(StockResource::resume).toList();
    }

    /**
     * Lance un inventaire : le stock théorique des articles du périmètre est figé. Un article déjà compté dans un autre
     * inventaire en cours en est exclu, pour que son écart ne soit pas appliqué deux fois.
     */
    @POST
    @Path("/inventaires")
    @Transactional
    public InventaireEntity lancer(InventaireRequest request) {
        InventaireRequest perimetre = request != null ? request : new InventaireRequest();
        Set<String> dejaEnCours = new HashSet<>();
        for (InventaireEntity enCours : InventaireEntity.<InventaireEntity>list("statut", InventaireEntity.Statut.EN_COURS)) {
            enCours.lignes.forEach(l -> dejaEnCours.add(cle(l.typeArticle, l.articleId)));
        }
        String type = vide(perimetre.typeArticle) ? null : perimetre.typeArticle.trim();
        if (type != null) {
            Article.verifierType(type);
        }
        String categorie = vide(perimetre.categorie) ? null : perimetre.categorie.trim();
        String emplacement = vide(perimetre.emplacement) ? null : perimetre.emplacement.trim();

        InventaireEntity inventaire = new InventaireEntity();
        Timestamp maintenant = new Timestamp(System.currentTimeMillis());
        for (ArticleStock a : articles()) {
            if ((!a.suivi && !perimetre.toutLeCatalogue) || dejaEnCours.contains(a.cle)
                    || (type != null && !type.equals(a.type))
                    || (categorie != null && !categorie.equalsIgnoreCase(a.categorie != null ? a.categorie.trim() : null))
                    || (emplacement != null && !emplacement.equalsIgnoreCase(a.emplacement != null ? a.emplacement.trim() : null)
                        && !emplacement.equalsIgnoreCase(a.emplacementMagasin != null ? a.emplacementMagasin.trim() : null))) {
                continue;
            }
            InventaireLigneEntity ligne = new InventaireLigneEntity();
            ligne.typeArticle = a.type;
            ligne.articleId = a.id;
            ligne.designation = a.designation;
            ligne.ref = a.ref;
            ligne.categorie = a.categorie;
            ligne.emplacement = a.emplacementMagasin != null && !a.emplacementMagasin.isBlank()
                    ? (a.emplacement != null && !a.emplacement.isBlank() ? a.emplacement + " / " + a.emplacementMagasin : a.emplacementMagasin)
                    : a.emplacement;
            ligne.stockTheorique = a.stock;
            ligne.coutUnitaireHT = a.coutUnitaireHT;
            inventaire.lignes.add(ligne);
        }
        if (inventaire.lignes.isEmpty()) {
            throw erreur(400, "Aucun article à inventorier dans ce périmètre (les articles d'un inventaire en cours en sont exclus)");
        }
        inventaire.reference = String.format("INV-%d-%04d", LocalDate.now().getYear(), InventaireEntity.count() + 1);
        inventaire.libelle = vide(perimetre.libelle)
                ? "Inventaire du " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : perimetre.libelle.trim();
        inventaire.typeArticle = type;
        inventaire.categorie = categorie;
        inventaire.emplacement = emplacement;
        inventaire.dateCreation = maintenant;
        inventaire.creePar = utilisateur();
        inventaire.persist();
        return inventaire;
    }

    @GET
    @Path("/inventaires/{id}")
    public InventaireEntity inventaire(@PathParam("id") long id) {
        return trouverInventaire(id);
    }

    /** Enregistre les quantités comptées, au fil du comptage. */
    @PUT
    @Path("/inventaires/{id}/comptage")
    @Transactional
    public InventaireEntity compter(@PathParam("id") long id, List<Comptage> comptages) {
        InventaireEntity inventaire = inventaireEnCours(id);
        Map<Long, InventaireLigneEntity> lignes = new HashMap<>();
        inventaire.lignes.forEach(l -> lignes.put(l.id, l));
        for (Comptage comptage : comptages != null ? comptages : List.<Comptage>of()) {
            InventaireLigneEntity ligne = lignes.get(comptage.ligneId);
            if (ligne == null) {
                throw erreur(400, "La ligne (" + comptage.ligneId + ") n'appartient pas à l'inventaire");
            }
            if (comptage.stockCompte != null) {
                verifierQuantite(ligne.typeArticle, comptage.stockCompte, ligne.designation);
            }
            ligne.stockCompte = comptage.stockCompte;
        }
        return inventaire;
    }

    /**
     * Valide l'inventaire : l'écart de chaque article compté (compté moins théorique figé au lancement) est appliqué à son
     * stock courant, pour tenir compte des mouvements survenus pendant le comptage. Les articles non comptés sont laissés
     * tels quels.
     */
    @POST
    @Path("/inventaires/{id}/valider")
    @Transactional
    public InventaireEntity valider(@PathParam("id") long id) {
        InventaireEntity inventaire = inventaireEnCours(id);
        String utilisateur = utilisateur();
        Timestamp maintenant = new Timestamp(System.currentTimeMillis());
        for (InventaireLigneEntity ligne : inventaire.lignes) {
            Double ecart = ligne.getEcart();
            if (ecart == null || ecart == 0) {
                continue;
            }
            Article article = Article.trouver(ligne.typeArticle, ligne.articleId);
            if (article == null) {
                continue;
            }
            double avant = article.stock();
            double apres = Math.max(0, avant + ecart);
            if (apres == avant) {
                continue;
            }
            article.stock(apres);
            ProduitMouvementEntity mouvement = ProduitMouvementEntity.nouveau(ProduitMouvementEntity.Type.INVENTAIRE,
                    apres - avant, apres, ligne.coutUnitaireHT > 0 ? ligne.coutUnitaireHT : null, maintenant);
            article.rattacher(mouvement);
            mouvement.inventaire = inventaire;
            mouvement.utilisateur = utilisateur;
            mouvement.persist();
        }
        inventaire.statut = InventaireEntity.Statut.VALIDE;
        inventaire.dateValidation = maintenant;
        inventaire.validePar = utilisateur;
        return inventaire;
    }

    /** Abandonne un inventaire en cours : rien n'est appliqué au stock. */
    @DELETE
    @Path("/inventaires/{id}")
    @Transactional
    public Response abandonner(@PathParam("id") long id) {
        inventaireEnCours(id).delete();
        return Response.status(204).build();
    }

    private static InventaireEntity trouverInventaire(long id) {
        InventaireEntity inventaire = InventaireEntity.findById(id);
        if (inventaire == null) {
            throw erreur(404, "L'inventaire (" + id + ") n'est pas trouvé");
        }
        return inventaire;
    }

    private static InventaireEntity inventaireEnCours(long id) {
        InventaireEntity inventaire = trouverInventaire(id);
        if (inventaire.statut != InventaireEntity.Statut.EN_COURS) {
            throw erreur(400, "L'inventaire " + inventaire.reference + " est validé : il n'est plus modifiable");
        }
        return inventaire;
    }

    private static InventaireResume resume(InventaireEntity inventaire) {
        InventaireResume r = new InventaireResume();
        r.id = inventaire.id;
        r.reference = inventaire.reference;
        r.libelle = inventaire.libelle;
        r.typeArticle = inventaire.typeArticle;
        r.categorie = inventaire.categorie;
        r.emplacement = inventaire.emplacement;
        r.statut = inventaire.statut;
        r.dateCreation = inventaire.dateCreation;
        r.dateValidation = inventaire.dateValidation;
        r.creePar = inventaire.creePar;
        r.validePar = inventaire.validePar;
        r.nombreLignes = inventaire.lignes.size();
        double valeurEcarts = 0;
        for (InventaireLigneEntity ligne : inventaire.lignes) {
            if (ligne.stockCompte != null) {
                r.nombreComptees++;
                if (ligne.getEcart() != 0) {
                    r.nombreEcarts++;
                    valeurEcarts += ligne.getValeurEcart();
                }
            }
        }
        r.valeurEcarts = arrondi(valeurEcarts);
        return r;
    }

    // --- Outils ---

    // Une quantité en stock est positive ; elle est entière pour un bateau, un moteur ou une remorque
    private static void verifierQuantite(String type, double quantite, String designation) {
        if (quantite < 0) {
            throw erreur(400, "Le stock de « " + designation + " » ne peut pas être négatif");
        }
        if (!PRODUIT.equals(type) && quantite != Math.rint(quantite)) {
            throw erreur(400, "Le stock de « " + designation + " » est un nombre entier d'unités");
        }
    }

    // Erreur dont le message est renvoyé au chantier, pour l'afficher
    private static WebApplicationException erreur(int statut, String message) {
        return new WebApplicationException(message, Response.status(statut).entity(message).type(MediaType.TEXT_PLAIN).build());
    }

    private String utilisateur() {
        if (!Arc.container().requestContext().isActive() || identity.isAnonymous()) {
            return null;
        }
        return identity.getPrincipal().getName();
    }

    private static boolean vide(String valeur) {
        return valeur == null || valeur.isBlank();
    }

    private static double arrondi(double valeur) {
        return Math.round(valeur * 100.0) / 100.0;
    }

    /** Article suivi en stock, quel que soit son type : produit (stock à virgule), bateau, moteur ou remorque (à l'unité). */
    private record Article(String type, PanacheEntity entite) {

        static void verifierType(String type) {
            if (!List.of(PRODUIT, BATEAU, MOTEUR, REMORQUE).contains(type)) {
                throw erreur(400, "Type d'article non géré en stock : " + type);
            }
        }

        static Article trouver(String type, Long id) {
            if (id == null) {
                return null;
            }
            PanacheEntity entite = switch (type) {
                case PRODUIT -> ProduitCatalogueEntity.findById(id);
                case BATEAU -> BateauCatalogueEntity.findById(id);
                case MOTEUR -> MoteurCatalogueEntity.findById(id);
                case REMORQUE -> RemorqueCatalogueEntity.findById(id);
                default -> null;
            };
            return entite != null ? new Article(type, entite) : null;
        }

        static Article charger(String type, Long id) {
            verifierType(type);
            Article article = trouver(type, id);
            if (article == null) {
                throw erreur(404, "L'article (" + type + " " + id + ") n'est pas trouvé");
            }
            return article;
        }

        String designation() {
            return switch (entite) {
                case ProduitCatalogueEntity p -> p.designation;
                case BateauCatalogueEntity b -> b.designation;
                case MoteurCatalogueEntity m -> m.designation;
                case RemorqueCatalogueEntity r -> r.designation;
                default -> null;
            };
        }

        double stock() {
            return switch (entite) {
                case ProduitCatalogueEntity p -> p.stock;
                case BateauCatalogueEntity b -> b.stock;
                case MoteurCatalogueEntity m -> m.stock;
                case RemorqueCatalogueEntity r -> r.stock;
                default -> 0;
            };
        }

        void stock(double valeur) {
            switch (entite) {
                case ProduitCatalogueEntity p -> p.stock = valeur;
                case BateauCatalogueEntity b -> b.stock = Math.round(valeur);
                case MoteurCatalogueEntity m -> m.stock = Math.round(valeur);
                case RemorqueCatalogueEntity r -> r.stock = Math.round(valeur);
                default -> { }
            }
        }

        void verifierQuantite(double quantite) {
            StockResource.verifierQuantite(type, quantite, designation());
        }

        void rattacher(ProduitMouvementEntity mouvement) {
            switch (entite) {
                case ProduitCatalogueEntity p -> mouvement.produit = p;
                case BateauCatalogueEntity b -> mouvement.bateau = b;
                case MoteurCatalogueEntity m -> mouvement.moteur = m;
                case RemorqueCatalogueEntity r -> mouvement.remorque = r;
                default -> { }
            }
        }
    }

}
