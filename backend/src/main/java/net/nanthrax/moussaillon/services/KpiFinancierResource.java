package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.AvoirEntity;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ForfaitProduitEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitMouvementEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ServiceProduitEntity;
import net.nanthrax.moussaillon.persistence.TechnicienEntity;
import net.nanthrax.moussaillon.persistence.VenteBateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteHeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteMoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VentePaiementEntity;
import net.nanthrax.moussaillon.persistence.VenteProduitEntity;
import net.nanthrax.moussaillon.persistence.VenteRemorqueCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

/**
 * KPIs financiers sur 12 mois glissants, comparés aux 12 mois précédents (N-1) :
 * <ul>
 *   <li>chiffre d'affaires HT à la facturation (date d'émission de la facture), avoirs déduits, ventilé par activité ;</li>
 *   <li>marge brute HT par activité : CA HT moins le coût d'achat des articles (figé à leur sortie de stock, sinon
 *   leur coût actuel) et, pour les prestations, le coût de la main d'oeuvre (heures x coût horaire des techniciens) ;</li>
 *   <li>encaissements TTC à la date des règlements (hors avoirs utilisés en règlement), remboursements d'avoirs déduits ;</li>
 *   <li>créances clients à ce jour, par ancienneté de retard ;</li>
 *   <li>valeur et ancienneté du stock à ce jour : chaque article au coût d'achat, son stock étant composé des
 *   entrées les plus récentes (premier entré, premier sorti).</li>
 * </ul>
 */
@Path("/kpis-financiers")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class KpiFinancierResource {

    // Au-delà, un article en stock est dormant
    static final int JOURS_DORMANT = 180;
    static final int ARTICLES_DORMANTS_MAX = 50;
    private static final double TVA_DEFAUT = 20.0;

    public enum Activite {
        PRESTATIONS("Prestations atelier", "Prestations"),
        HIVERNAGE_GARDIENNAGE("Hivernage / gardiennage", "Hivernage / gardiennage"),
        PIECES("Pièces et accessoires", "Transactions"),
        BATEAUX_NEUFS("Bateaux neufs", "Transactions"),
        BATEAUX_OCCASION("Bateaux d'occasion", "Transactions"),
        MOTEURS_NEUFS("Moteurs neufs", "Transactions"),
        MOTEURS_OCCASION("Moteurs d'occasion", "Transactions"),
        HELICES("Hélices", "Transactions"),
        REMORQUES("Remorques", "Transactions"),
        // Vente sans ligne valorisée (montant saisi directement)
        NON_VENTILE("Non ventilé", "Autres"),
        AVOIRS("Avoirs", "Autres");

        public final String libelle;
        public final String groupe;

        Activite(String libelle, String groupe) {
            this.libelle = libelle;
            this.groupe = groupe;
        }
    }

    @GET
    public KpisFinanciers get(@QueryParam("fin") String fin) {
        YearMonth moisFin = moisFin(fin);
        YearMonth debutN = moisFin.minusMonths(11);
        YearMonth debutN1 = debutN.minusMonths(12);
        Timestamp debut = Timestamp.valueOf(debutN1.atDay(1).atStartOfDay());
        Timestamp finExclue = Timestamp.valueOf(moisFin.plusMonths(1).atDay(1).atStartOfDay());

        Calcul calcul = new Calcul(debutN);
        calcul.ventiler(debut, finExclue);
        calcul.deduireAvoirs(debut, finExclue);
        calcul.encaisser(debut, finExclue);

        KpisFinanciers kpis = new KpisFinanciers();
        kpis.debut = debutN.toString();
        kpis.fin = moisFin.toString();
        for (int i = 0; i < 12; i++) {
            YearMonth mois = debutN.plusMonths(i);
            YearMonth moisN1 = mois.minusMonths(12);
            MoisKpi kpi = new MoisKpi();
            kpi.mois = mois.toString();
            kpi.caHT = arrondi(calcul.total(mois, false));
            kpi.caHTN1 = arrondi(calcul.total(moisN1, false));
            kpi.margeBruteHT = arrondi(calcul.total(mois, true));
            kpi.margeBruteHTN1 = arrondi(calcul.total(moisN1, true));
            kpi.encaissementsTTC = arrondi(calcul.encaissements.getOrDefault(mois, 0.0));
            kpi.encaissementsTTCN1 = arrondi(calcul.encaissements.getOrDefault(moisN1, 0.0));
            calcul.cumuls(mois).forEach((activite, cumul) -> {
                if (Math.abs(cumul.ca) >= 0.005) {
                    kpi.caHTParActivite.put(activite.name(), arrondi(cumul.ca));
                }
            });
            kpis.mois.add(kpi);

            kpis.caHT += kpi.caHT;
            kpis.caHTN1 += kpi.caHTN1;
            kpis.margeBruteHT += kpi.margeBruteHT;
            kpis.margeBruteHTN1 += kpi.margeBruteHTN1;
            kpis.encaissementsTTC += kpi.encaissementsTTC;
            kpis.encaissementsTTCN1 += kpi.encaissementsTTCN1;
        }
        kpis.caHT = arrondi(kpis.caHT);
        kpis.caHTN1 = arrondi(kpis.caHTN1);
        kpis.margeBruteHT = arrondi(kpis.margeBruteHT);
        kpis.margeBruteHTN1 = arrondi(kpis.margeBruteHTN1);
        kpis.encaissementsTTC = arrondi(kpis.encaissementsTTC);
        kpis.encaissementsTTCN1 = arrondi(kpis.encaissementsTTCN1);
        kpis.tauxMargeBrute = taux(kpis.margeBruteHT, kpis.caHT);

        for (Activite activite : Activite.values()) {
            Cumul n = new Cumul();
            Cumul n1 = new Cumul();
            for (int i = 0; i < 12; i++) {
                n.ajouter(calcul.cumuls(debutN.plusMonths(i)).get(activite));
                n1.ajouter(calcul.cumuls(debutN1.plusMonths(i)).get(activite));
            }
            if (n.vide() && n1.vide()) {
                continue;
            }
            ActiviteKpi kpi = new ActiviteKpi();
            kpi.code = activite.name();
            kpi.libelle = activite.libelle;
            kpi.groupe = activite.groupe;
            kpi.caHT = arrondi(n.ca);
            kpi.caHTN1 = arrondi(n1.ca);
            kpi.coutHT = arrondi(n.cout);
            kpi.margeBruteHT = arrondi(n.ca - n.cout);
            kpi.margeBruteHTN1 = arrondi(n1.ca - n1.cout);
            kpi.tauxMarge = taux(kpi.margeBruteHT, kpi.caHT);
            kpis.activites.add(kpi);
        }
        kpis.heuresSansCoutHoraire = Math.round(calcul.heuresSansCoutHoraire * 10.0) / 10.0;

        LocalDate aujourdhui = LocalDate.now();
        kpis.creances = creances(aujourdhui);
        kpis.stock = stock(aujourdhui, calcul.couts);
        return kpis;
    }

    private static YearMonth moisFin(String fin) {
        if (fin == null || fin.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(fin.trim());
        } catch (DateTimeParseException e) {
            throw new WebApplicationException("Mois de fin invalide (attendu AAAA-MM) : " + fin, 400);
        }
    }

    /** CA HT, coût et encaissements cumulés par mois, sur les 24 mois des périodes N et N-1. */
    private static final class Calcul {
        final YearMonth debutN;
        final CoutAchat couts = CoutAchat.charge();
        final Map<YearMonth, Map<Activite, Cumul>> ventilation = new HashMap<>();
        final Map<YearMonth, Double> encaissements = new HashMap<>();
        // Heures de prestation (période N) dont aucun technicien n'a de coût horaire : leur main d'oeuvre n'est pas comptée
        double heuresSansCoutHoraire;

        Calcul(YearMonth debutN) {
            this.debutN = debutN;
        }

        Map<Activite, Cumul> cumuls(YearMonth mois) {
            return ventilation.computeIfAbsent(mois, m -> new EnumMap<>(Activite.class));
        }

        Cumul cumul(YearMonth mois, Activite activite) {
            return cumuls(mois).computeIfAbsent(activite, a -> new Cumul());
        }

        // CA HT du mois, ou sa marge brute
        double total(YearMonth mois, boolean marge) {
            return cumuls(mois).values().stream().mapToDouble(c -> marge ? c.ca - c.cout : c.ca).sum();
        }

        /** Ventile le CA HT net de chaque facture émise sur ses lignes, au prorata de leur montant HT, avec leur coût. */
        void ventiler(Timestamp debut, Timestamp finExclue) {
            List<VenteEntity> factures = VenteEntity.list(
                    "status in ?1 and coalesce(dateFacturePrete, dateFacturePayee, date) >= ?2"
                            + " and coalesce(dateFacturePrete, dateFacturePayee, date) < ?3",
                    List.of(VenteEntity.Status.FACTURE_PRETE, VenteEntity.Status.FACTURE_PAYEE), debut, finExclue);
            Map<Long, Map<String, double[]>> coutsFiges = coutsFiges(factures);
            for (VenteEntity vente : factures) {
                YearMonth mois = YearMonth.from(date(dateFacture(vente)));
                boolean periodeN = !mois.isBefore(debutN);
                Map<String, double[]> figes = coutsFiges.getOrDefault(vente.id, Map.of());
                List<Ligne> lignes = lignes(vente, figes, periodeN);

                double ca = caHT(vente);
                double poids = lignes.stream().mapToDouble(Ligne::poidsHT).sum();
                for (Ligne ligne : lignes) {
                    Cumul cumul = cumul(mois, ligne.activite());
                    cumul.cout += ligne.coutHT();
                    if (poids > 0) {
                        cumul.ca += ca * ligne.poidsHT() / poids;
                    }
                }
                if (poids <= 0) {
                    cumul(mois, Activite.NON_VENTILE).ca += ca;
                }
            }
        }

        private List<Ligne> lignes(VenteEntity vente, Map<String, double[]> figes, boolean periodeN) {
            boolean exonere = vente.exonereTva();
            double tauxVente = vente.tva > 0 ? vente.tva : TVA_DEFAUT;
            List<Ligne> lignes = new ArrayList<>();
            for (VenteForfaitEntity vf : vente.venteForfaits) {
                if (vf.forfait == null) continue;
                double quantite = Quantite.ouUn(vf.quantite);
                double cout = 0;
                if (vf.status != VenteForfaitEntity.Status.ANNULEE) {
                    double heures = vf.dureeReelle > 0 ? vf.dureeReelle : vf.forfait.dureeEstimee * quantite;
                    cout = coutMainOeuvre(heures, vf.techniciens, periodeN);
                    for (ForfaitProduitEntity fp : vf.forfait.produits) {
                        cout += fp.quantite * quantite * coutProduit(fp.produit, figes);
                    }
                }
                lignes.add(new Ligne(Activite.PRESTATIONS, poidsHT(vf.forfait.prixTTC, vf.forfait.prixHT, vf.forfait.tva, false,
                        vf.quantite, vf.remise, exonere, tauxVente), cout));
            }
            for (VenteServiceEntity vs : vente.venteServices) {
                if (vs.service == null) continue;
                double quantite = Quantite.ouUn(vs.quantite);
                double cout = 0;
                if (vs.status != VenteServiceEntity.Status.ANNULEE) {
                    double heures = vs.dureeReelle > 0 ? vs.dureeReelle : vs.service.dureeEstimee * quantite;
                    cout = coutMainOeuvre(heures, vs.techniciens, periodeN);
                    for (ServiceProduitEntity sp : vs.service.produits) {
                        cout += sp.quantite * quantite * coutProduit(sp.produit, figes);
                    }
                }
                lignes.add(new Ligne(Activite.PRESTATIONS, poidsHT(vs.service.prixTTC, vs.service.prixHT, vs.service.tva, false,
                        vs.quantite, vs.remise, exonere, tauxVente), cout));
            }
            for (VenteProduitEntity vp : vente.venteProduits) {
                ProduitCatalogueEntity p = vp.produit;
                if (p == null) continue;
                Activite activite = hivernageOuGardiennage(p) ? Activite.HIVERNAGE_GARDIENNAGE : Activite.PIECES;
                lignes.add(new Ligne(activite, poidsHT(p.prixVenteTTC, p.prixVenteHT, p.tva, p.occasion, vp.quantite, vp.remise, exonere, tauxVente),
                        Quantite.ouUn(vp.quantite) * coutProduit(p, figes)));
            }
            for (VenteBateauCatalogueEntity vb : vente.venteBateauxCatalogue) {
                BateauCatalogueEntity b = vb.bateau;
                if (b == null) continue;
                lignes.add(new Ligne(b.occasion ? Activite.BATEAUX_OCCASION : Activite.BATEAUX_NEUFS,
                        poidsHT(b.prixVenteTTC, b.prixVenteHT, b.tva, b.occasion, vb.quantite, vb.remise, exonere, tauxVente),
                        Quantite.ouUn(vb.quantite) * coutFige(figes, "B" + b.id, couts.bateau(b))));
            }
            for (VenteMoteurCatalogueEntity vm : vente.venteMoteursCatalogue) {
                MoteurCatalogueEntity m = vm.moteur;
                if (m == null) continue;
                lignes.add(new Ligne(m.occasion ? Activite.MOTEURS_OCCASION : Activite.MOTEURS_NEUFS,
                        poidsHT(m.prixVenteTTC, m.prixVenteHT, m.tva, m.occasion, vm.quantite, vm.remise, exonere, tauxVente),
                        Quantite.ouUn(vm.quantite) * coutFige(figes, "M" + m.id, couts.moteur(m))));
            }
            for (VenteHeliceCatalogueEntity vh : vente.venteHelicesCatalogue) {
                if (vh.helice == null) continue;
                lignes.add(new Ligne(Activite.HELICES,
                        poidsHT(vh.helice.prixVenteTTC, vh.helice.prixVenteHT, vh.helice.tva, vh.helice.occasion, vh.quantite, vh.remise, exonere, tauxVente),
                        Quantite.ouUn(vh.quantite) * couts.helice(vh.helice)));
            }
            for (VenteRemorqueCatalogueEntity vr : vente.venteRemorquesCatalogue) {
                RemorqueCatalogueEntity r = vr.remorque;
                if (r == null) continue;
                lignes.add(new Ligne(Activite.REMORQUES,
                        poidsHT(r.prixVenteTTC, r.prixVenteHT, r.tva, r.occasion, vr.quantite, vr.remise, exonere, tauxVente),
                        Quantite.ouUn(vr.quantite) * coutFige(figes, "R" + r.id, couts.remorque(r))));
            }
            return lignes;
        }

        private double coutProduit(ProduitCatalogueEntity p, Map<String, double[]> figes) {
            return p == null ? 0 : coutFige(figes, "P" + p.id, couts.produit(p));
        }

        // Main d'oeuvre d'une prestation : ses heures au coût horaire moyen de ses techniciens
        private double coutMainOeuvre(double heures, List<TechnicienEntity> techniciens, boolean periodeN) {
            double coutHoraire = techniciens == null ? 0 : techniciens.stream()
                    .map(t -> t.coutHoraire).filter(c -> c != null && c > 0)
                    .mapToDouble(Double::doubleValue).average().orElse(0);
            if (coutHoraire <= 0 && periodeN) {
                heuresSansCoutHoraire += heures;
            }
            return heures * coutHoraire;
        }

        void deduireAvoirs(Timestamp debut, Timestamp finExclue) {
            List<AvoirEntity> avoirs = AvoirEntity.list(
                    "status in ?1 and coalesce(dateEmission, dateCreation) >= ?2 and coalesce(dateEmission, dateCreation) < ?3",
                    List.of(AvoirEntity.Status.EMIS, AvoirEntity.Status.REMBOURSE), debut, finExclue);
            for (AvoirEntity avoir : avoirs) {
                Timestamp date = avoir.dateEmission != null ? avoir.dateEmission : avoir.dateCreation;
                double montantHT = avoir.montantHT > 0 ? avoir.montantHT : avoir.montantTTC / (1 + avoir.tva / 100.0);
                cumul(YearMonth.from(date(date)), Activite.AVOIRS).ca -= montantHT;
            }
        }

        /**
         * Encaissements TTC : règlements des ventes à leur date (un avoir utilisé en règlement n'est pas un encaissement),
         * ventes payées sans règlement saisi à leur date de paiement, remboursements d'avoirs déduits.
         */
        void encaisser(Timestamp debut, Timestamp finExclue) {
            String datePaiement = "coalesce(p.date, v.dateFacturePayee, v.date)";
            List<Object[]> reglements = VenteEntity.getEntityManager().createQuery(
                    "select p.montant, " + datePaiement + " from VenteEntity v join v.paiements p"
                            + " where (p.mode is null or p.mode <> ?1) and " + datePaiement + " >= ?2 and " + datePaiement + " < ?3",
                    Object[].class)
                    .setParameter(1, VentePaiementEntity.Mode.AVOIR).setParameter(2, debut).setParameter(3, finExclue)
                    .getResultList();
            List<Object[]> payeesSansReglement = VenteEntity.getEntityManager().createQuery(
                    "select v.prixVenteTTC, coalesce(v.dateFacturePayee, v.date) from VenteEntity v"
                            + " where v.status = ?1 and v.paiements is empty"
                            + " and coalesce(v.dateFacturePayee, v.date) >= ?2 and coalesce(v.dateFacturePayee, v.date) < ?3",
                    Object[].class)
                    .setParameter(1, VenteEntity.Status.FACTURE_PAYEE).setParameter(2, debut).setParameter(3, finExclue)
                    .getResultList();
            List<Object[]> remboursements = AvoirEntity.getEntityManager().createQuery(
                    "select a.montantTTC, coalesce(a.dateRemboursement, a.dateEmission, a.dateCreation) from AvoirEntity a"
                            + " where a.status = ?1 and coalesce(a.dateRemboursement, a.dateEmission, a.dateCreation) >= ?2"
                            + " and coalesce(a.dateRemboursement, a.dateEmission, a.dateCreation) < ?3",
                    Object[].class)
                    .setParameter(1, AvoirEntity.Status.REMBOURSE).setParameter(2, debut).setParameter(3, finExclue)
                    .getResultList();
            reglements.forEach(r -> encaisser(r, 1));
            payeesSansReglement.forEach(r -> encaisser(r, 1));
            remboursements.forEach(r -> encaisser(r, -1));
        }

        private void encaisser(Object[] montantEtDate, int signe) {
            double montant = ((Number) montantEtDate[0]).doubleValue();
            encaissements.merge(YearMonth.from(date((Timestamp) montantEtDate[1])), signe * montant, Double::sum);
        }
    }

    /**
     * Coût d'achat figé à la sortie de stock des articles de chaque vente : article (P, B, M ou R suivi de son
     * identifiant) vers {somme des quantités x coût, somme des quantités}.
     */
    private static Map<Long, Map<String, double[]>> coutsFiges(List<VenteEntity> ventes) {
        Map<Long, Map<String, double[]>> figes = new HashMap<>();
        if (ventes.isEmpty()) {
            return figes;
        }
        List<ProduitMouvementEntity> sorties = ProduitMouvementEntity.list(
                "type = ?1 and prixUnitaireHT is not null and vente.id in ?2",
                ProduitMouvementEntity.Type.VENTE, ventes.stream().map(v -> v.id).toList());
        for (ProduitMouvementEntity sortie : sorties) {
            String article = cleArticle(sortie);
            if (article == null) continue;
            double[] cumul = figes.computeIfAbsent(sortie.getVenteId(), id -> new HashMap<>())
                    .computeIfAbsent(article, a -> new double[2]);
            cumul[0] += sortie.quantite * sortie.prixUnitaireHT;
            cumul[1] += sortie.quantite;
        }
        return figes;
    }

    // Coût unitaire figé de l'article dans la vente, à défaut son coût actuel
    private static double coutFige(Map<String, double[]> figes, String article, double coutActuel) {
        double[] cumul = figes.get(article);
        return cumul != null && cumul[1] > 0 ? cumul[0] / cumul[1] : coutActuel;
    }

    private static String cleArticle(ProduitMouvementEntity mouvement) {
        if (mouvement.produit != null) return "P" + mouvement.produit.id;
        if (mouvement.bateau != null) return "B" + mouvement.bateau.id;
        if (mouvement.moteur != null) return "M" + mouvement.moteur.id;
        if (mouvement.remorque != null) return "R" + mouvement.remorque.id;
        return null;
    }

    // Date d'émission de la facture (une vente comptoir peut être payée sans passer par la facture émise)
    static Timestamp dateFacture(VenteEntity vente) {
        if (vente.dateFacturePrete != null) return vente.dateFacturePrete;
        return vente.dateFacturePayee != null ? vente.dateFacturePayee : vente.date;
    }

    /**
     * CA HT net d'une vente : son montant HT, diminué de la remise globale (saisie TTC, elle réduit le HT dans la même
     * proportion). Une vente sans montant HT (saisie directe du TTC) est ramenée au HT par son taux de TVA.
     */
    static double caHT(VenteEntity vente) {
        if (vente.montantHT <= 0) {
            double taux = vente.exonereTva() ? 0 : (vente.tva > 0 ? vente.tva : TVA_DEFAUT);
            return Math.max(0, vente.prixVenteTTC) / (1 + taux / 100.0);
        }
        if (vente.montantTTC > 0) {
            return vente.montantHT * vente.prixVenteTTC / vente.montantTTC;
        }
        return vente.montantHT;
    }

    /**
     * Montant HT d'une ligne, remise de ligne déduite, comme le calcule la vente : au prix TTC de l'article (au prix HT
     * pour un client exonéré de TVA), ramené au HT par son taux (nul pour un article d'occasion).
     */
    static double poidsHT(double prixTTC, double prixHT, double tva, boolean occasion, double quantite, double remise,
                          boolean exonere, double tauxVente) {
        double taux = occasion ? 0 : (tva > 0 ? tva : tauxVente);
        double prixUnitaire = exonere ? (prixHT > 0 ? prixHT : prixTTC / (1 + taux / 100.0)) : prixTTC;
        double net = Math.max(0, prixUnitaire * Quantite.ouUn(quantite) - remise);
        return exonere ? net : net / (1 + taux / 100.0);
    }

    // L'hivernage et le gardiennage sont vendus comme des produits, classés dans une catégorie qui les nomme
    static boolean hivernageOuGardiennage(ProduitCatalogueEntity produit) {
        String categorie = normaliser(produit.categorie);
        return categorie.contains("hivernage") || categorie.contains("gardiennage");
    }

    private static String normaliser(String texte) {
        if (texte == null) return "";
        return Normalizer.normalize(texte, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    /** Factures émises restant à encaisser, par ancienneté de retard sur leur échéance. */
    private static Creances creances(LocalDate aujourdhui) {
        Creances creances = new Creances();
        List<VenteEntity> emises = VenteEntity.list("status", VenteEntity.Status.FACTURE_PRETE);
        for (VenteEntity vente : emises) {
            double paye = vente.paiements.stream().mapToDouble(p -> p.montant).sum();
            double solde = vente.prixVenteTTC - paye;
            if (solde < 0.005) {
                continue;
            }
            Timestamp emission = dateFacture(vente);
            LocalDate echeance = vente.dateEcheance != null ? date(vente.dateEcheance) : emission != null ? date(emission) : aujourdhui;
            long retard = ChronoUnit.DAYS.between(echeance, aujourdhui);

            creances.totalTTC += solde;
            creances.nombreFactures++;
            if (retard <= 0) {
                creances.nonEchuTTC += solde;
                continue;
            }
            creances.echuTTC += solde;
            creances.nombreFacturesEchues++;
            if (retard <= 30) creances.retard1a30TTC += solde;
            else if (retard <= 60) creances.retard31a60TTC += solde;
            else if (retard <= 90) creances.retard61a90TTC += solde;
            else creances.retardPlus90TTC += solde;

            FactureEnRetard facture = new FactureEnRetard();
            facture.venteId = vente.id;
            facture.numeroFacture = vente.numeroFacture;
            facture.client = vente.client != null ? vente.client.nom : null;
            facture.dateFacture = emission != null ? date(emission) : null;
            facture.dateEcheance = echeance;
            facture.montantTTC = arrondi(vente.prixVenteTTC);
            facture.soldeTTC = arrondi(solde);
            facture.joursRetard = retard;
            facture.niveauRelance = vente.niveauRelance;
            creances.facturesEnRetard.add(facture);
        }
        creances.facturesEnRetard.sort(Comparator.comparingLong((FactureEnRetard f) -> f.joursRetard).reversed());
        creances.totalTTC = arrondi(creances.totalTTC);
        creances.nonEchuTTC = arrondi(creances.nonEchuTTC);
        creances.echuTTC = arrondi(creances.echuTTC);
        creances.retard1a30TTC = arrondi(creances.retard1a30TTC);
        creances.retard31a60TTC = arrondi(creances.retard31a60TTC);
        creances.retard61a90TTC = arrondi(creances.retard61a90TTC);
        creances.retardPlus90TTC = arrondi(creances.retardPlus90TTC);
        return creances;
    }

    /**
     * Valeur du stock au coût d'achat, par catégorie et par ancienneté. Le stock d'un article est composé de ses entrées
     * (réceptions, stock initial et ajustements positifs) les plus récentes ; ce qu'elles ne couvrent pas est non daté.
     */
    private static Stock stock(LocalDate aujourdhui, CoutAchat couts) {
        Map<String, List<ProduitMouvementEntity>> entrees = new HashMap<>();
        List<ProduitMouvementEntity> mouvements = ProduitMouvementEntity.list(
                "(type = ?1 or (type = ?2 and quantite > 0)) and date is not null order by date desc",
                ProduitMouvementEntity.Type.RECEPTION, ProduitMouvementEntity.Type.AJUSTEMENT_MANUEL);
        for (ProduitMouvementEntity mouvement : mouvements) {
            String article = cleArticle(mouvement);
            if (article != null) {
                entrees.computeIfAbsent(article, a -> new ArrayList<>()).add(mouvement);
            }
        }

        Stock stock = new Stock();
        Map<String, StockCategorie> categories = new LinkedHashMap<>();
        List<ArticleDormant> dormants = new ArrayList<>();
        for (ProduitCatalogueEntity p : ProduitCatalogueEntity.<ProduitCatalogueEntity>list("stock > 0")) {
            String categorie = p.categorie != null && !p.categorie.isBlank() ? p.categorie.trim() : "Sans catégorie";
            valoriser(stock, categories, dormants, entrees.get("P" + p.id), aujourdhui,
                    "Produit", p.id, p.designation, categorie, p.stock, couts.produit(p));
        }
        for (BateauCatalogueEntity b : BateauCatalogueEntity.<BateauCatalogueEntity>list("stock > 0")) {
            valoriser(stock, categories, dormants, entrees.get("B" + b.id), aujourdhui,
                    "Bateau", b.id, b.designation, b.occasion ? "Bateaux d'occasion" : "Bateaux neufs", b.stock, couts.bateau(b));
        }
        for (MoteurCatalogueEntity m : MoteurCatalogueEntity.<MoteurCatalogueEntity>list("stock > 0")) {
            valoriser(stock, categories, dormants, entrees.get("M" + m.id), aujourdhui,
                    "Moteur", m.id, m.designation, m.occasion ? "Moteurs d'occasion" : "Moteurs neufs", m.stock, couts.moteur(m));
        }
        for (RemorqueCatalogueEntity r : RemorqueCatalogueEntity.<RemorqueCatalogueEntity>list("stock > 0")) {
            valoriser(stock, categories, dormants, entrees.get("R" + r.id), aujourdhui,
                    "Remorque", r.id, r.designation, "Remorques", r.stock, couts.remorque(r));
        }

        for (StockCategorie categorie : categories.values()) {
            categorie.valeurHT = arrondi(categorie.valeurHT);
            categorie.valeur0a90 = arrondi(categorie.valeur0a90);
            categorie.valeur91a180 = arrondi(categorie.valeur91a180);
            categorie.valeur181a365 = arrondi(categorie.valeur181a365);
            categorie.valeurPlus365 = arrondi(categorie.valeurPlus365);
            categorie.valeurNonDatee = arrondi(categorie.valeurNonDatee);
            stock.categories.add(categorie);
        }
        stock.categories.sort(Comparator.comparingDouble((StockCategorie c) -> c.valeurHT).reversed());
        dormants.sort(Comparator.comparingDouble((ArticleDormant a) -> a.valeurDormanteHT).reversed());
        stock.articlesDormants = dormants.size() > ARTICLES_DORMANTS_MAX ? dormants.subList(0, ARTICLES_DORMANTS_MAX) : dormants;
        stock.nombreArticlesDormants = dormants.size();
        stock.valeurHT = arrondi(stock.valeurHT);
        stock.valeurDormanteHT = arrondi(stock.valeurDormanteHT);
        stock.valeurNonDateeHT = arrondi(stock.valeurNonDateeHT);
        return stock;
    }

    private static void valoriser(Stock stock, Map<String, StockCategorie> categories, List<ArticleDormant> dormants,
                                  List<ProduitMouvementEntity> entrees, LocalDate aujourdhui,
                                  String type, Long id, String designation, String libelleCategorie, double quantite, double cout) {
        StockCategorie categorie = categories.computeIfAbsent(libelleCategorie, c -> {
            StockCategorie nouvelle = new StockCategorie();
            nouvelle.categorie = c;
            return nouvelle;
        });
        categorie.quantite += quantite;
        if (cout <= 0) {
            stock.articlesSansCout++;
        }

        double restant = quantite;
        double dormant = 0;
        LocalDate plusAncienneEntree = null;
        for (ProduitMouvementEntity entree : entrees != null ? entrees : List.<ProduitMouvementEntity>of()) {
            if (restant <= 0) break;
            double part = Math.min(restant, entree.quantite);
            restant -= part;
            plusAncienneEntree = date(entree.date);
            long age = ChronoUnit.DAYS.between(plusAncienneEntree, aujourdhui);
            double valeur = part * cout;
            if (age <= 90) categorie.valeur0a90 += valeur;
            else if (age <= JOURS_DORMANT) categorie.valeur91a180 += valeur;
            else if (age <= 365) categorie.valeur181a365 += valeur;
            else categorie.valeurPlus365 += valeur;
            if (age > JOURS_DORMANT) dormant += valeur;
        }
        double nonDatee = Math.max(0, restant) * cout;
        categorie.valeurNonDatee += nonDatee;
        categorie.valeurHT += quantite * cout;
        stock.valeurHT += quantite * cout;
        stock.valeurDormanteHT += dormant;
        stock.valeurNonDateeHT += nonDatee;

        if (dormant > 0) {
            ArticleDormant article = new ArticleDormant();
            article.type = type;
            article.id = id;
            article.designation = designation;
            article.categorie = libelleCategorie;
            article.stock = quantite;
            article.coutUnitaireHT = arrondi(cout);
            article.valeurHT = arrondi(quantite * cout);
            article.valeurDormanteHT = arrondi(dormant);
            article.dateEntree = plusAncienneEntree;
            article.joursEnStock = ChronoUnit.DAYS.between(plusAncienneEntree, aujourdhui);
            dormants.add(article);
        }
    }

    private static LocalDate date(Timestamp timestamp) {
        return timestamp.toLocalDateTime().toLocalDate();
    }

    private static double arrondi(double montant) {
        return Math.round(montant * 100.0) / 100.0;
    }

    // Taux en %, à une décimale ; null sans base
    private static Double taux(double part, double base) {
        return Math.abs(base) >= 0.005 ? Math.round(part / base * 1000.0) / 10.0 : null;
    }

    private record Ligne(Activite activite, double poidsHT, double coutHT) {}

    private static final class Cumul {
        double ca;
        double cout;

        void ajouter(Cumul autre) {
            if (autre != null) {
                ca += autre.ca;
                cout += autre.cout;
            }
        }

        boolean vide() {
            return Math.abs(ca) < 0.005 && Math.abs(cout) < 0.005;
        }
    }

    public static class KpisFinanciers {
        // Premier et dernier mois de la période N (AAAA-MM)
        public String debut;
        public String fin;
        public double caHT;
        public double caHTN1;
        public double margeBruteHT;
        public double margeBruteHTN1;
        public Double tauxMargeBrute;
        public double encaissementsTTC;
        public double encaissementsTTCN1;
        public double heuresSansCoutHoraire;
        public List<MoisKpi> mois = new ArrayList<>();
        public List<ActiviteKpi> activites = new ArrayList<>();
        public Creances creances;
        public Stock stock;
    }

    public static class MoisKpi {
        public String mois;
        public double caHT;
        public double caHTN1;
        public double margeBruteHT;
        public double margeBruteHTN1;
        public double encaissementsTTC;
        public double encaissementsTTCN1;
        // CA HT du mois par code d'activité
        public Map<String, Double> caHTParActivite = new LinkedHashMap<>();
    }

    public static class ActiviteKpi {
        public String code;
        public String libelle;
        public String groupe;
        public double caHT;
        public double caHTN1;
        public double coutHT;
        public double margeBruteHT;
        public double margeBruteHTN1;
        public Double tauxMarge;
    }

    public static class Creances {
        public double totalTTC;
        public int nombreFactures;
        public double nonEchuTTC;
        public double echuTTC;
        public int nombreFacturesEchues;
        public double retard1a30TTC;
        public double retard31a60TTC;
        public double retard61a90TTC;
        public double retardPlus90TTC;
        public List<FactureEnRetard> facturesEnRetard = new ArrayList<>();
    }

    public static class FactureEnRetard {
        public Long venteId;
        public String numeroFacture;
        public String client;
        public LocalDate dateFacture;
        public LocalDate dateEcheance;
        public double montantTTC;
        public double soldeTTC;
        public long joursRetard;
        public int niveauRelance;
    }

    public static class Stock {
        public double valeurHT;
        // Valeur des entrées de plus de JOURS_DORMANT jours encore en stock
        public double valeurDormanteHT;
        public double valeurNonDateeHT;
        // Articles en stock sans coût d'achat connu (ni prix moyen pondéré, ni prix fournisseur) : valorisés à 0
        public int articlesSansCout;
        public int nombreArticlesDormants;
        public List<StockCategorie> categories = new ArrayList<>();
        public List<ArticleDormant> articlesDormants = new ArrayList<>();
    }

    public static class StockCategorie {
        public String categorie;
        public double quantite;
        public double valeurHT;
        public double valeur0a90;
        public double valeur91a180;
        public double valeur181a365;
        public double valeurPlus365;
        public double valeurNonDatee;
    }

    public static class ArticleDormant {
        public String type;
        public Long id;
        public String designation;
        public String categorie;
        public double stock;
        public double coutUnitaireHT;
        public double valeurHT;
        public double valeurDormanteHT;
        // Plus ancienne entrée encore en stock
        public LocalDate dateEntree;
        public long joursEnStock;
    }
}
