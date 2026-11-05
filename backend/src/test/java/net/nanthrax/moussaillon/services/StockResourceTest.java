package net.nanthrax.moussaillon.services;

import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.CommandeFournisseurEntity;
import net.nanthrax.moussaillon.persistence.CommandeFournisseurLigneEntity;
import net.nanthrax.moussaillon.persistence.ForfaitEntity;
import net.nanthrax.moussaillon.persistence.ForfaitProduitEntity;
import net.nanthrax.moussaillon.persistence.FournisseurEntity;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.InventaireEntity;
import net.nanthrax.moussaillon.persistence.InventaireLigneEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitMouvementEntity;
import net.nanthrax.moussaillon.persistence.VenteBateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteProduitEntity;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.*;

/** Gestion du stock : chaque test est annulé en fin d'exécution (@TestTransaction). */
@QuarkusTest
public class StockResourceTest {

    @Inject
    StockResource stockResource;

    private static ProduitCatalogueEntity produit(String designation, double stock, double stockMini, double pmp) {
        ProduitCatalogueEntity p = new ProduitCatalogueEntity();
        p.designation = designation;
        p.categorie = "Entretien";
        p.stock = stock;
        p.stockMini = stockMini;
        p.prixAchatMoyenHT = pmp;
        p.emplacement = "Allée B";
        p.persist();
        return p;
    }

    private static BateauCatalogueEntity bateau(String designation, long stock, long stockAlerte) {
        BateauCatalogueEntity b = new BateauCatalogueEntity();
        b.designation = designation;
        b.type = "Open";
        b.stock = stock;
        b.stockAlerte = stockAlerte;
        b.persist();
        return b;
    }

    private static VenteEntity vente(VenteEntity.Status status, boolean bonPourAccord) {
        VenteEntity vente = new VenteEntity();
        vente.status = status;
        vente.bonPourAccord = bonPourAccord;
        vente.date = new Timestamp(System.currentTimeMillis());
        return vente;
    }

    private static VenteProduitEntity ligne(ProduitCatalogueEntity p, double quantite) {
        VenteProduitEntity l = new VenteProduitEntity();
        l.produit = p;
        l.quantite = quantite;
        return l;
    }

    private static CommandeFournisseurEntity commande(CommandeFournisseurEntity.Status status, ProduitCatalogueEntity p, double quantite) {
        CommandeFournisseurEntity commande = new CommandeFournisseurEntity();
        commande.status = status;
        commande.reference = "CF-STOCK-" + status;
        CommandeFournisseurLigneEntity ligne = new CommandeFournisseurLigneEntity();
        ligne.produit = p;
        ligne.quantite = quantite;
        commande.lignes.add(ligne);
        commande.persist();
        return commande;
    }

    private static StockResource.ArticleStock article(List<StockResource.ArticleStock> etat, String type, Long id) {
        return etat.stream().filter(a -> a.cle.equals(type + "-" + id)).findFirst().orElse(null);
    }

    private static StockResource.AjustementRequest ajustement(String type, Long id, Double nouveauStock, Double variation,
                                                               ProduitMouvementEntity.Motif motif) {
        StockResource.AjustementRequest request = new StockResource.AjustementRequest();
        request.type = type;
        request.id = id;
        request.nouveauStock = nouveauStock;
        request.variation = variation;
        request.motif = motif;
        return request;
    }

    private static StockResource.Comptage comptage(InventaireLigneEntity ligne, Double stockCompte) {
        StockResource.Comptage comptage = new StockResource.Comptage();
        comptage.ligneId = ligne.id;
        comptage.stockCompte = stockCompte;
        return comptage;
    }

    private static InventaireLigneEntity ligneInventaire(InventaireEntity inventaire, Long articleId) {
        return inventaire.lignes.stream().filter(l -> l.articleId.equals(articleId)).findFirst().orElseThrow();
    }

    @Test
    @TestTransaction
    void testEtatDuStockReserveDisponibleEtEnCommande() {
        ProduitCatalogueEntity huile = produit("Huile stock test", 10, 3, 4.0);
        BateauCatalogueEntity open = bateau("Open stock test", 1, 1);

        // Devis signé : 4 bidons et, par le forfait, 2 bidons par forfait commandé
        ForfaitEntity forfait = new ForfaitEntity();
        forfait.nom = "Vidange stock test";
        ForfaitProduitEntity fp = new ForfaitProduitEntity();
        fp.produit = huile;
        fp.quantite = 2;
        forfait.produits.add(fp);
        forfait.persist();
        VenteEntity signe = vente(VenteEntity.Status.DEVIS, true);
        signe.venteProduits.add(ligne(huile, 4));
        VenteForfaitEntity vf = new VenteForfaitEntity();
        vf.forfait = forfait;
        vf.quantite = 1;
        signe.venteForfaits.add(vf);
        signe.persist();
        // OR en cours (facture en attente) : le bateau est réservé
        VenteEntity enCours = vente(VenteEntity.Status.FACTURE_EN_ATTENTE, true);
        VenteBateauCatalogueEntity vb = new VenteBateauCatalogueEntity();
        vb.bateau = open;
        vb.quantite = 1;
        enCours.venteBateauxCatalogue.add(vb);
        enCours.persist();
        // Ne réservent rien : devis non signé, devis refusé, vente dont le stock est déjà sorti, facture payée
        VenteEntity nonSigne = vente(VenteEntity.Status.DEVIS, false);
        nonSigne.venteProduits.add(ligne(huile, 1));
        nonSigne.persist();
        VenteEntity refuse = vente(VenteEntity.Status.DEVIS, true);
        refuse.dateRefus = new Timestamp(System.currentTimeMillis());
        refuse.venteProduits.add(ligne(huile, 1));
        refuse.persist();
        VenteEntity sortie = vente(VenteEntity.Status.FACTURE_EN_ATTENTE, true);
        sortie.stockDecremented = true;
        sortie.venteProduits.add(ligne(huile, 1));
        sortie.persist();
        VenteEntity payee = vente(VenteEntity.Status.FACTURE_PAYEE, true);
        payee.venteProduits.add(ligne(huile, 1));
        payee.persist();
        // En commande : 5 non reçus ; une commande reçue ou annulée ne compte pas
        commande(CommandeFournisseurEntity.Status.EN_ATTENTE, huile, 5);
        commande(CommandeFournisseurEntity.Status.RECUE, huile, 7);
        commande(CommandeFournisseurEntity.Status.ANNULEE, huile, 9);

        List<StockResource.ArticleStock> etat = stockResource.etat();

        StockResource.ArticleStock a = article(etat, "produit", huile.id);
        assertNotNull(a);
        assertEquals(10, a.stock, 0.001);
        assertEquals(3, a.seuil, 0.001);
        assertEquals(6, a.reserve, 0.001, "4 en ligne + 2 par le forfait du devis signé");
        assertEquals(4, a.disponible, 0.001);
        assertEquals(5, a.enCommande, 0.001);
        assertEquals(4.0, a.coutUnitaireHT, 0.001);
        assertEquals(40.0, a.valeur, 0.001, "Stock valorisé au PMP");
        assertEquals("Allée B", a.emplacement);
        assertEquals("Entretien", a.categorie);
        assertTrue(a.suivi);
        assertEquals(StockResource.Statut.OK, a.statut);

        StockResource.ArticleStock b = article(etat, "bateau", open.id);
        assertEquals(1, b.reserve, 0.001);
        assertEquals(0, b.disponible, 0.001);
        assertEquals(StockResource.Statut.RUPTURE, b.statut);
        assertEquals("Open", b.categorie);

        // Article jamais stocké ni réservé, sans seuil : non suivi
        ProduitCatalogueEntity nonSuivi = produit("Non suivi stock test", 0, 0, 0);
        assertFalse(article(stockResource.etat(), "produit", nonSuivi.id).suivi);
    }

    @Test
    @TestTransaction
    void testStatutSousLeSeuil() {
        ProduitCatalogueEntity filtre = produit("Filtre stock test", 3, 3, 0);

        StockResource.ArticleStock a = article(stockResource.etat(), "produit", filtre.id);

        assertEquals(StockResource.Statut.SOUS_SEUIL, a.statut, "Disponible au seuil d'alerte");
        assertEquals(0, a.valeur, 0.001, "Sans coût d'achat connu, le stock n'est pas valorisé");
    }

    @Test
    @TestTransaction
    void testAjustementAvecMotif() {
        ProduitCatalogueEntity huile = produit("Huile ajustement test", 10, 2, 0);

        ProduitMouvementEntity casse = stockResource.ajuster(ajustement("produit", huile.id, null, -2.5, ProduitMouvementEntity.Motif.CASSE));
        assertEquals(7.5, ProduitCatalogueEntity.<ProduitCatalogueEntity>findById(huile.id).stock, 0.001);
        assertEquals(ProduitMouvementEntity.Type.AJUSTEMENT_MANUEL, casse.type);
        assertEquals(-2.5, casse.quantite, 0.001);
        assertEquals(7.5, casse.stockApres, 0.001);
        assertEquals(ProduitMouvementEntity.Motif.CASSE, casse.motif);

        StockResource.AjustementRequest correction = ajustement("produit", huile.id, 12.0, null, ProduitMouvementEntity.Motif.CORRECTION);
        correction.commentaire = "  Recompte de l'allée B ";
        ProduitMouvementEntity mouvement = stockResource.ajuster(correction);
        assertEquals(4.5, mouvement.quantite, 0.001);
        assertEquals("Recompte de l'allée B", mouvement.commentaire);

        List<ProduitMouvementEntity> historique = stockResource.mouvements("produit", huile.id);
        assertEquals(2, historique.size());
        assertEquals(ProduitMouvementEntity.Motif.CORRECTION, historique.get(0).motif, "Plus récent en premier");
    }

    @Test
    @TestTransaction
    void testAjustementRefuse() {
        ProduitCatalogueEntity huile = produit("Huile refus test", 2, 0, 0);
        BateauCatalogueEntity open = bateau("Open refus test", 2, 0);

        WebApplicationException sansMotif = assertThrows(WebApplicationException.class,
                () -> stockResource.ajuster(ajustement("produit", huile.id, 5.0, null, null)));
        assertEquals(400, sansMotif.getResponse().getStatus());
        assertThrows(WebApplicationException.class,
                () -> stockResource.ajuster(ajustement("produit", huile.id, null, -3.0, ProduitMouvementEntity.Motif.PERTE)),
                "Stock négatif");
        assertThrows(WebApplicationException.class,
                () -> stockResource.ajuster(ajustement("bateau", open.id, 1.5, null, ProduitMouvementEntity.Motif.CORRECTION)),
                "Un bateau se compte à l'unité");
        assertThrows(WebApplicationException.class,
                () -> stockResource.ajuster(ajustement("helice", 100L, 1.0, null, ProduitMouvementEntity.Motif.CORRECTION)),
                "Les hélices ne sont pas gérées en stock");
        WebApplicationException inconnu = assertThrows(WebApplicationException.class,
                () -> stockResource.ajuster(ajustement("produit", 999999L, 1.0, null, ProduitMouvementEntity.Motif.CORRECTION)));
        assertEquals(404, inconnu.getResponse().getStatus());

        ProduitMouvementEntity entree = stockResource.ajuster(ajustement("bateau", open.id, null, 1.0, ProduitMouvementEntity.Motif.RETOUR_FOURNISSEUR));
        assertEquals(3, BateauCatalogueEntity.<BateauCatalogueEntity>findById(open.id).stock);
        assertEquals(open.id, entree.getBateauId());
    }

    @Test
    @TestTransaction
    void testReapprovisionnement() {
        FournisseurEntity cher = new FournisseurEntity();
        cher.nom = "Fournisseur cher stock test";
        cher.persist();
        FournisseurEntity moinsCher = new FournisseurEntity();
        moinsCher.nom = "Fournisseur moins cher stock test";
        moinsCher.persist();
        ProduitCatalogueEntity filtre = produit("Filtre réappro test", 1, 4, 0);
        for (Object[] tarif : new Object[][] { { cher, 9.0, 1 }, { moinsCher, 6.0, 12 } }) {
            FournisseurProduitEntity fp = new FournisseurProduitEntity();
            fp.fournisseur = (FournisseurEntity) tarif[0];
            fp.produit = filtre;
            fp.prixAchatHT = (double) tarif[1];
            fp.tva = 20.0;
            fp.nombreMinACommander = (int) tarif[2];
            fp.persist();
        }
        // Déjà en commande : 2, soit 3 projetés pour un seuil de 4
        commande(CommandeFournisseurEntity.Status.CONFIRMEE, filtre, 2);
        ProduitCatalogueEntity couvert = produit("Couvert réappro test", 1, 4, 0);
        commande(CommandeFournisseurEntity.Status.EXPEDIEE, couvert, 10);
        ProduitCatalogueEntity sansSeuil = produit("Sans seuil réappro test", 0, 0, 0);

        List<StockResource.ArticleAReapprovisionner> aCommander = stockResource.reapprovisionnement();

        StockResource.ArticleAReapprovisionner r = aCommander.stream()
                .filter(a -> a.id.equals(filtre.id) && a.type.equals("produit")).findFirst().orElse(null);
        assertNotNull(r);
        assertEquals(2, r.enCommande, 0.001);
        assertEquals(moinsCher.id, r.fournisseurId, "Le moins cher est proposé");
        assertEquals(2, r.fournisseurs.size());
        assertEquals(12, r.quantiteSuggeree, 0.001, "Minimum de commande du fournisseur proposé");
        assertTrue(aCommander.stream().noneMatch(a -> a.id.equals(couvert.id) && a.type.equals("produit")),
                "Couvert par la commande en cours");
        assertTrue(aCommander.stream().noneMatch(a -> a.id.equals(sansSeuil.id) && a.type.equals("produit")),
                "Sans seuil ni réservation : rien à commander");

        assertEquals(5, StockResource.quantiteSuggeree(4, 3, 1), 0.001, "Revenir à deux fois le seuil");
        assertEquals(2, StockResource.quantiteSuggeree(0, -1, 0), 0.001, "Sans seuil : couvrir les réservations, plus un");

        StockResource.LigneReapprovisionnement l1 = new StockResource.LigneReapprovisionnement();
        l1.type = "produit";
        l1.id = filtre.id;
        l1.fournisseurId = moinsCher.id;
        l1.quantite = 12;
        StockResource.LigneReapprovisionnement l2 = new StockResource.LigneReapprovisionnement();
        l2.type = "produit";
        l2.id = couvert.id;
        l2.fournisseurId = cher.id;
        l2.quantite = 3;
        l2.prixUnitaireHT = 2.5;
        l2.tva = 20.0;
        StockResource.ReapprovisionnementRequest request = new StockResource.ReapprovisionnementRequest();
        request.lignes = List.of(l1, l2);

        List<StockResource.CommandeCreee> creees = stockResource.commander(request);

        assertEquals(2, creees.size(), "Une commande par fournisseur");
        CommandeFournisseurEntity commande = CommandeFournisseurEntity.findById(creees.get(0).id);
        assertEquals(CommandeFournisseurEntity.Status.BROUILLON, commande.status);
        assertEquals(moinsCher.id, commande.fournisseur.id);
        assertEquals(1, commande.lignes.size());
        assertEquals(6.0, commande.lignes.get(0).prixUnitaireHT, 0.001, "Prix d'achat chez le fournisseur");
        assertEquals(72.0, commande.montantHT, 0.001);
        assertNotNull(commande.reference);
        CommandeFournisseurEntity autre = CommandeFournisseurEntity.findById(creees.get(1).id);
        assertEquals(7.5, autre.montantHT, 0.001);
        assertNotEquals(commande.reference, autre.reference);
        // Les articles commandés sont désormais en commande
        assertTrue(stockResource.reapprovisionnement().stream().noneMatch(a -> a.id.equals(filtre.id) && a.type.equals("produit")));
    }

    @Test
    @TestTransaction
    void testReapprovisionnementSansFournisseurRefuse() {
        ProduitCatalogueEntity filtre = produit("Sans fournisseur réappro test", 0, 2, 0);
        StockResource.LigneReapprovisionnement ligne = new StockResource.LigneReapprovisionnement();
        ligne.type = "produit";
        ligne.id = filtre.id;
        ligne.quantite = 4;
        StockResource.ReapprovisionnementRequest request = new StockResource.ReapprovisionnementRequest();
        request.lignes = List.of(ligne);

        WebApplicationException e = assertThrows(WebApplicationException.class, () -> stockResource.commander(request));
        assertEquals(400, e.getResponse().getStatus());
        assertThrows(WebApplicationException.class, () -> stockResource.commander(new StockResource.ReapprovisionnementRequest()));
    }

    @Test
    @TestTransaction
    void testInventaireLanceCompteEtValide() {
        ProduitCatalogueEntity huile = produit("Huile inventaire test", 10, 2, 4.0);
        ProduitCatalogueEntity filtre = produit("Filtre inventaire test", 5, 1, 3.0);
        ProduitCatalogueEntity bougie = produit("Bougie inventaire test", 8, 0, 1.0);
        huile.categorie = "Inventaire test";
        filtre.categorie = "Inventaire test";
        bougie.categorie = "Inventaire test";

        StockResource.InventaireRequest request = new StockResource.InventaireRequest();
        request.categorie = "Inventaire test";
        InventaireEntity inventaire = stockResource.lancer(request);

        assertEquals(InventaireEntity.Statut.EN_COURS, inventaire.statut);
        assertTrue(inventaire.reference.startsWith("INV-"));
        assertTrue(inventaire.libelle.startsWith("Inventaire du "));
        assertEquals(3, inventaire.lignes.size());
        assertEquals(10, ligneInventaire(inventaire, huile.id).stockTheorique, 0.001);

        // Comptage enregistré au fil de l'eau ; la bougie n'est pas comptée
        stockResource.compter(inventaire.id, List.of(
                comptage(ligneInventaire(inventaire, huile.id), 7.5),
                comptage(ligneInventaire(inventaire, filtre.id), 5.0)));
        assertEquals(-2.5, ligneInventaire(inventaire, huile.id).getEcart(), 0.001);
        assertEquals(-10.0, ligneInventaire(inventaire, huile.id).getValeurEcart(), 0.001);
        StockResource.InventaireResume resume = stockResource.inventaires().stream()
                .filter(i -> i.id.equals(inventaire.id)).findFirst().orElseThrow();
        assertEquals(3, resume.nombreLignes);
        assertEquals(2, resume.nombreComptees);
        assertEquals(1, resume.nombreEcarts);
        assertEquals(-10.0, resume.valeurEcarts, 0.001);

        // Un article d'un inventaire en cours n'entre pas dans un autre
        WebApplicationException doublon = assertThrows(WebApplicationException.class, () -> stockResource.lancer(request));
        assertEquals(400, doublon.getResponse().getStatus());

        // Vente pendant le comptage : l'écart s'applique au stock courant
        VenteResource.mouvementStock(huile, 1, null);
        assertEquals(9, huile.stock, 0.001);

        stockResource.valider(inventaire.id);

        assertEquals(InventaireEntity.Statut.VALIDE, inventaire.statut);
        assertNotNull(inventaire.dateValidation);
        assertEquals(6.5, ProduitCatalogueEntity.<ProduitCatalogueEntity>findById(huile.id).stock, 0.001, "9 − 2,5");
        assertEquals(5, ProduitCatalogueEntity.<ProduitCatalogueEntity>findById(filtre.id).stock, 0.001);
        assertEquals(8, ProduitCatalogueEntity.<ProduitCatalogueEntity>findById(bougie.id).stock, 0.001, "Non compté : inchangé");
        List<ProduitMouvementEntity> mouvements = ProduitMouvementEntity.list("produit.id = ?1 and type = ?2",
                huile.id, ProduitMouvementEntity.Type.INVENTAIRE);
        assertEquals(1, mouvements.size());
        assertEquals(-2.5, mouvements.get(0).quantite, 0.001);
        assertEquals(6.5, mouvements.get(0).stockApres, 0.001);
        assertEquals(inventaire.id, mouvements.get(0).getInventaireId());
        assertEquals(0, ProduitMouvementEntity.count("produit.id = ?1 and type = ?2", filtre.id, ProduitMouvementEntity.Type.INVENTAIRE),
                "Sans écart, pas de mouvement");

        // Validé : plus modifiable ni supprimable
        assertThrows(WebApplicationException.class, () -> stockResource.compter(inventaire.id, List.of()));
        assertThrows(WebApplicationException.class, () -> stockResource.valider(inventaire.id));
        assertThrows(WebApplicationException.class, () -> stockResource.abandonner(inventaire.id));
    }

    @Test
    @TestTransaction
    void testInventairePerimetreEtAbandon() {
        ProduitCatalogueEntity huile = produit("Huile périmètre test", 4, 0, 0);
        huile.emplacementMagasin = "Vitrine périmètre";
        ProduitCatalogueEntity nonSuivi = produit("Non suivi périmètre test", 0, 0, 0);
        nonSuivi.emplacementMagasin = "Vitrine périmètre";
        BateauCatalogueEntity open = bateau("Open périmètre test", 2, 0);
        open.emplacement = "Vitrine périmètre";

        StockResource.InventaireRequest request = new StockResource.InventaireRequest();
        request.libelle = "Vitrine";
        request.emplacement = "vitrine périmètre";
        request.typeArticle = "produit";
        InventaireEntity inventaire = stockResource.lancer(request);

        assertEquals("Vitrine", inventaire.libelle);
        assertEquals(1, inventaire.lignes.size(), "Produits suivis de l'emplacement (atelier ou magasin) seulement");
        assertEquals(huile.id, inventaire.lignes.get(0).articleId);
        assertEquals("Allée B / Vitrine périmètre", inventaire.lignes.get(0).emplacement);

        // Un bateau se compte à l'unité
        stockResource.abandonner(inventaire.id);
        assertNull(InventaireEntity.findById(inventaire.id));
        request.typeArticle = "bateau";
        InventaireEntity bateaux = stockResource.lancer(request);
        assertThrows(WebApplicationException.class,
                () -> stockResource.compter(bateaux.id, List.of(comptage(bateaux.lignes.get(0), 1.5))));
        assertThrows(WebApplicationException.class,
                () -> stockResource.compter(bateaux.id, List.of(comptage(bateaux.lignes.get(0), -1.0))));

        request.toutLeCatalogue = true;
        request.typeArticle = "produit";
        assertEquals(2, stockResource.lancer(request).lignes.size(), "Tout le catalogue : avec les articles non suivis");
    }

    @Test
    void testApiEtatEtInventaireInconnu() {
        given().when().get("/stock")
                .then().statusCode(200)
                .body("cle", hasItem("produit-100"));
        given().when().get("/stock/inventaires/999999").then().statusCode(404);
        given().contentType(ContentType.JSON).body(Map.of("type", "produit", "id", 100, "nouveauStock", 1))
                .when().post("/stock/ajustement").then().statusCode(400);
        given().when().get("/stock/produit/100/mouvements").then().statusCode(200);
    }

}
