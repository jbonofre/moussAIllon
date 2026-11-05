package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.AbsenceTechnicienEntity;
import net.nanthrax.moussaillon.persistence.ForfaitEntity;
import net.nanthrax.moussaillon.persistence.ForfaitMainOeuvreEntity;
import net.nanthrax.moussaillon.persistence.ForfaitProduitEntity;
import net.nanthrax.moussaillon.persistence.MainOeuvreEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ServiceEntity;
import net.nanthrax.moussaillon.persistence.ServiceMainOeuvreEntity;
import net.nanthrax.moussaillon.persistence.ServiceProduitEntity;
import net.nanthrax.moussaillon.persistence.TechnicienEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteProduitEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

import static net.nanthrax.moussaillon.services.KpiFinancierResource.arrondi;
import static net.nanthrax.moussaillon.services.KpiFinancierResource.taux;

/**
 * KPIs atelier sur 12 mois glissants, comparés aux 12 mois précédents (N-1), au total, par technicien et par
 * forfait / service :
 * <ul>
 *   <li>heures disponibles : durée hebdomadaire de chaque technicien sur ses jours travaillés, jusqu'à aujourd'hui,
 *   moins les jours fériés et ses absences ;</li>
 *   <li>heures prévues (durée estimée du forfait ou du service) et réalisées (durée réelle) des prestations
 *   terminées, à leur date de fin ; le temps des prestations SAV / garantie est aussi compté à part ;</li>
 *   <li>heures facturées : heures de main d'oeuvre des prestations des factures émises, à leur date d'émission
 *   (à défaut de main d'oeuvre horaire, la durée estimée de la prestation), hors prestations SAV ou annulées ;</li>
 *   <li>CA HT main d'oeuvre et pièces des prestations facturées : le CA de la facture réparti sur ses lignes comme
 *   dans les KPIs financiers, puis celui d'une prestation entre sa main d'oeuvre et ses pièces au prorata de leur
 *   prix catalogue. Les pièces vendues sur la même facture vont aux techniciens de ses prestations ;</li>
 *   <li>taux de productivité (réalisées / disponibles), d'efficience (facturées / réalisées) et de valorisation
 *   (facturées / disponibles).</li>
 * </ul>
 * Une prestation confiée à plusieurs techniciens est partagée entre eux à parts égales (sa durée réelle est celle de
 * la prestation, pas celle de chacun).
 */
@Path("/kpis-atelier")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class KpiAtelierResource {

    static final String NON_AFFECTE = "Non affecté";

    @GET
    public KpisAtelier get(@QueryParam("fin") String fin) {
        YearMonth moisFin = KpiFinancierResource.moisFin(fin);
        YearMonth debutN = moisFin.minusMonths(11);
        YearMonth debutN1 = debutN.minusMonths(12);
        Timestamp debut = Timestamp.valueOf(debutN1.atDay(1).atStartOfDay());
        Timestamp finExclue = Timestamp.valueOf(moisFin.plusMonths(1).atDay(1).atStartOfDay());
        LocalDate aujourdhui = LocalDate.now();
        LocalDate dernierJour = moisFin.atEndOfMonth().isAfter(aujourdhui) ? aujourdhui : moisFin.atEndOfMonth();

        Calcul calcul = new Calcul(debutN);
        calcul.capacite(debutN1.atDay(1), dernierJour);
        calcul.realiser(debut, finExclue);
        calcul.facturer(debut, finExclue);
        return calcul.kpis(moisFin);
    }

    /** Heures et CA cumulés par mois (24 mois des périodes N et N-1), au total, par technicien et par prestation. */
    private static final class Calcul {
        final YearMonth debutN;
        final Map<Long, TechnicienEntity> techniciens = new HashMap<>();
        final Map<YearMonth, Cumul> parMois = new HashMap<>();
        // Technicien (null : prestations sans technicien) vers ses cumuls mensuels
        final Map<Long, Map<YearMonth, Cumul>> parTechnicien = new HashMap<>();
        // Forfait (F + id) ou service (S + id) vers ses cumuls mensuels
        final Map<String, Map<YearMonth, Cumul>> parPrestation = new HashMap<>();
        final Map<String, Prestation> prestations = new HashMap<>();
        // Prestations terminées de la période N sans durée réelle saisie
        int prestationsSansDureeReelle;

        Calcul(YearMonth debutN) {
            this.debutN = debutN;
        }

        Cumul total(YearMonth mois) {
            return parMois.computeIfAbsent(mois, m -> new Cumul());
        }

        Cumul technicien(Long id, YearMonth mois) {
            return parTechnicien.computeIfAbsent(id, t -> new HashMap<>()).computeIfAbsent(mois, m -> new Cumul());
        }

        Cumul prestation(Prestation prestation, YearMonth mois) {
            prestations.putIfAbsent(prestation.cle(), prestation);
            return parPrestation.computeIfAbsent(prestation.cle(), p -> new HashMap<>()).computeIfAbsent(mois, m -> new Cumul());
        }

        // Ajoute au total du mois, puis à chaque technicien sa part (à défaut, aux prestations sans technicien)
        void repartir(List<TechnicienEntity> intervenants, YearMonth mois, BiConsumer<Cumul, Double> ajout) {
            ajout.accept(total(mois), 1.0);
            List<TechnicienEntity> affectes = affectes(intervenants);
            if (affectes.isEmpty()) {
                ajout.accept(technicien(null, mois), 1.0);
                return;
            }
            for (TechnicienEntity t : affectes) {
                techniciens.putIfAbsent(t.id, t);
                ajout.accept(technicien(t.id, mois), 1.0 / affectes.size());
            }
        }

        /** Heures disponibles de chaque technicien, par mois, du premier au dernier jour inclus. */
        void capacite(LocalDate debut, LocalDate fin) {
            Map<Long, List<CapaciteAtelier.Absence>> absences = AbsenceTechnicienEntity.<AbsenceTechnicienEntity>list(
                            "dateFin >= ?1 and dateDebut <= ?2", debut, fin).stream()
                    .collect(Collectors.groupingBy(a -> a.technicien.id,
                            Collectors.mapping(a -> new CapaciteAtelier.Absence(a.dateDebut, a.dateFin), Collectors.toList())));
            for (TechnicienEntity t : TechnicienEntity.<TechnicienEntity>listAll()) {
                techniciens.put(t.id, t);
                double hebdomadaires = t.heuresHebdomadaires != null ? t.heuresHebdomadaires : 0;
                CapaciteAtelier.parMois(hebdomadaires, jours(t), absences.getOrDefault(t.id, List.of()), debut, fin)
                        .forEach((mois, heures) -> {
                            for (Cumul cumul : List.of(total(mois), technicien(t.id, mois))) {
                                cumul.contrat += heures.contrat;
                                cumul.feries += heures.feries;
                                cumul.absences += heures.absences;
                                cumul.joursAbsence += heures.joursAbsence;
                                cumul.disponibles += heures.disponibles();
                            }
                        });
            }
        }

        /** Heures prévues et réalisées des prestations terminées, au mois de leur fin. */
        void realiser(Timestamp debut, Timestamp finExclue) {
            String fin = "coalesce(dateFin, statusDate, dateDebut)";
            List<VenteForfaitEntity> forfaits = VenteForfaitEntity.list("status = ?1 and " + fin + " >= ?2 and " + fin + " < ?3",
                    VenteForfaitEntity.Status.TERMINEE, debut, finExclue);
            List<VenteServiceEntity> services = VenteServiceEntity.list("status = ?1 and " + fin + " >= ?2 and " + fin + " < ?3",
                    VenteServiceEntity.Status.TERMINEE, debut, finExclue);
            for (VenteForfaitEntity vf : forfaits) {
                if (vf.forfait != null) {
                    realiser(Prestation.de(vf), dateFin(vf.dateFin, vf.statusDate, vf.dateDebut));
                }
            }
            for (VenteServiceEntity vs : services) {
                if (vs.service != null) {
                    realiser(Prestation.de(vs), dateFin(vs.dateFin, vs.statusDate, vs.dateDebut));
                }
            }
        }

        private void realiser(Prestation p, Timestamp fin) {
            YearMonth mois = YearMonth.from(KpiFinancierResource.date(fin));
            if (p.dureeReelle() <= 0 && !mois.isBefore(debutN)) {
                prestationsSansDureeReelle++;
            }
            BiConsumer<Cumul, Double> ajout = (cumul, part) -> {
                cumul.interventions++;
                cumul.prevues += p.heuresPrevues() * part;
                cumul.realisees += p.dureeReelle() * part;
                if (p.sav()) {
                    cumul.interventionsSav++;
                    cumul.sav += p.dureeReelle() * part;
                }
            };
            repartir(p.techniciens(), mois, ajout);
            ajout.accept(prestation(p, mois), 1.0);
        }

        /** Heures facturées et CA HT des prestations (et des pièces vendues avec) des factures émises, au mois d'émission. */
        void facturer(Timestamp debut, Timestamp finExclue) {
            List<VenteEntity> factures = VenteEntity.list(
                    "status in ?1 and coalesce(dateFacturePrete, dateFacturePayee, date) >= ?2"
                            + " and coalesce(dateFacturePrete, dateFacturePayee, date) < ?3",
                    List.of(VenteEntity.Status.FACTURE_PRETE, VenteEntity.Status.FACTURE_PAYEE), debut, finExclue);
            for (VenteEntity vente : factures) {
                // Ligne de la vente (clé de son montant HT) vers sa prestation
                Map<Object, Prestation> lignes = new LinkedHashMap<>();
                vente.venteForfaits.stream().filter(vf -> vf.forfait != null).forEach(vf -> lignes.put(vf, Prestation.de(vf)));
                vente.venteServices.stream().filter(vs -> vs.service != null).forEach(vs -> lignes.put(vs, Prestation.de(vs)));
                if (lignes.isEmpty()) {
                    // Vente sans prestation : pas d'activité atelier
                    continue;
                }
                YearMonth mois = YearMonth.from(KpiFinancierResource.date(KpiFinancierResource.dateFacture(vente)));
                Map<Object, Double> poids = KpiFinancierResource.poidsLignes(vente);
                double totalPoids = poids.values().stream().mapToDouble(Double::doubleValue).sum();
                double ca = KpiFinancierResource.caHT(vente);

                for (Map.Entry<Object, Prestation> ligne : lignes.entrySet()) {
                    Prestation p = ligne.getValue();
                    double caLigne = totalPoids > 0 ? ca * poids.get(ligne.getKey()) / totalPoids : 0;
                    double heures = p.sav() || p.annulee() ? 0 : p.heuresFacturables();
                    BiConsumer<Cumul, Double> ajout = (cumul, part) -> {
                        cumul.facturees += heures * part;
                        cumul.caMainOeuvre += caLigne * p.partMainOeuvre() * part;
                        cumul.caPieces += caLigne * (1 - p.partMainOeuvre()) * part;
                    };
                    repartir(p.techniciens(), mois, ajout);
                    ajout.accept(prestation(p, mois), 1.0);
                }

                double caPieces = 0;
                for (VenteProduitEntity vp : vente.venteProduits) {
                    if (vp.produit != null && !KpiFinancierResource.hivernageOuGardiennage(vp.produit) && totalPoids > 0) {
                        caPieces += ca * poids.get(vp) / totalPoids;
                    }
                }
                if (caPieces != 0) {
                    repartirPieces(lignes.values(), mois, caPieces);
                }
            }
        }

        /**
         * Pièces vendues sur la facture, hors prestation : aux techniciens de ses prestations, au prorata de leur temps
         * (durée réelle, à défaut prévue) ; à parts égales sans temps, aux prestations sans technicien s'il n'y en a pas.
         */
        private void repartirPieces(Collection<Prestation> lignes, YearMonth mois, double caPieces) {
            total(mois).caPieces += caPieces;
            Map<Long, Double> temps = new LinkedHashMap<>();
            for (Prestation p : lignes) {
                if (p.annulee()) continue;
                List<TechnicienEntity> affectes = affectes(p.techniciens());
                double duree = p.dureeReelle() > 0 ? p.dureeReelle() : p.heuresPrevues();
                for (TechnicienEntity t : affectes) {
                    techniciens.putIfAbsent(t.id, t);
                    temps.merge(t.id, duree / affectes.size(), Double::sum);
                }
            }
            if (temps.isEmpty()) {
                technicien(null, mois).caPieces += caPieces;
                return;
            }
            double totalTemps = temps.values().stream().mapToDouble(Double::doubleValue).sum();
            temps.forEach((id, duree) -> technicien(id, mois).caPieces +=
                    caPieces * (totalTemps > 0 ? duree / totalTemps : 1.0 / temps.size()));
        }

        Cumul somme(Map<YearMonth, Cumul> cumuls, YearMonth debut) {
            Cumul somme = new Cumul();
            for (int i = 0; i < 12; i++) {
                Cumul mois = cumuls.get(debut.plusMonths(i));
                if (mois != null) {
                    somme.ajouter(mois);
                }
            }
            return somme;
        }

        KpisAtelier kpis(YearMonth moisFin) {
            YearMonth debutN1 = debutN.minusMonths(12);
            KpisAtelier kpis = new KpisAtelier();
            kpis.debut = debutN.toString();
            kpis.fin = moisFin.toString();
            kpis.n = somme(parMois, debutN).indicateurs();
            kpis.n1 = somme(parMois, debutN1).indicateurs();
            for (int i = 0; i < 12; i++) {
                YearMonth mois = debutN.plusMonths(i);
                MoisKpi kpi = new MoisKpi();
                kpi.mois = mois.toString();
                kpi.n = parMois.getOrDefault(mois, new Cumul()).indicateurs();
                kpi.n1 = parMois.getOrDefault(mois.minusMonths(12), new Cumul()).indicateurs();
                kpis.mois.add(kpi);
            }

            parTechnicien.forEach((id, cumuls) -> {
                Cumul n = somme(cumuls, debutN);
                if (n.vide()) {
                    return;
                }
                TechnicienEntity t = id != null ? techniciens.get(id) : null;
                TechnicienKpi kpi = new TechnicienKpi();
                kpi.technicienId = id;
                kpi.nom = t != null ? nom(t) : NON_AFFECTE;
                kpi.heuresHebdomadaires = t != null ? t.heuresHebdomadaires : null;
                kpi.heuresContrat = arrondi(n.contrat);
                kpi.heuresFeries = arrondi(n.feries);
                kpi.heuresAbsence = arrondi(n.absences);
                kpi.joursAbsence = n.joursAbsence;
                kpi.n = n.indicateurs();
                kpi.tauxValorisationN1 = somme(cumuls, debutN1).indicateurs().tauxValorisation;
                kpis.techniciens.add(kpi);
                if (t != null && (t.heuresHebdomadaires == null || t.heuresHebdomadaires <= 0)) {
                    kpis.techniciensSansHoraire.add(kpi.nom);
                }
            });
            // Techniciens par nom, les prestations sans technicien en dernier
            kpis.techniciens.sort(Comparator.comparing((TechnicienKpi t) -> t.technicienId == null)
                    .thenComparing(t -> t.nom, String.CASE_INSENSITIVE_ORDER));
            kpis.techniciensSansHoraire.sort(String.CASE_INSENSITIVE_ORDER);

            parPrestation.forEach((cle, cumuls) -> {
                Cumul n = somme(cumuls, debutN);
                if (n.vide()) {
                    return;
                }
                Prestation p = prestations.get(cle);
                PrestationKpi kpi = new PrestationKpi();
                kpi.cle = cle;
                kpi.type = p.type();
                kpi.nom = p.nom();
                kpi.n = n.indicateurs();
                kpis.prestations.add(kpi);
            });
            kpis.prestations.sort(Comparator.comparingDouble((PrestationKpi p) -> p.n.heuresRealisees).reversed()
                    .thenComparing(p -> p.n.caMainOeuvreHT + p.n.caPiecesHT, Comparator.reverseOrder()));
            kpis.prestationsSansDureeReelle = prestationsSansDureeReelle;
            return kpis;
        }
    }

    private static List<TechnicienEntity> affectes(List<TechnicienEntity> intervenants) {
        return intervenants == null ? List.of() : intervenants.stream().filter(t -> t != null && t.id != null).toList();
    }

    private static String nom(TechnicienEntity t) {
        String nom = ((t.prenom != null ? t.prenom : "") + " " + (t.nom != null ? t.nom : "")).trim();
        return nom.isEmpty() ? "Technicien " + t.id : nom;
    }

    private static Set<DayOfWeek> jours(TechnicienEntity t) {
        try {
            return CapaciteAtelier.joursTravailles(t.joursTravailles);
        } catch (IllegalArgumentException e) {
            return CapaciteAtelier.SEMAINE_DEFAUT;
        }
    }

    private static Timestamp dateFin(Timestamp... dates) {
        for (Timestamp date : dates) {
            if (date != null) return date;
        }
        return null;
    }

    /**
     * Prestation d'une vente (forfait ou service) : heures prévues (durée estimée), réalisées, facturables (main
     * d'oeuvre horaire, à défaut durée estimée) et part de la main d'oeuvre dans son prix catalogue (le reste : pièces).
     */
    private record Prestation(String cle, String type, String nom, List<TechnicienEntity> techniciens, boolean sav, boolean annulee,
                              double heuresPrevues, double dureeReelle, double heuresFacturables, double partMainOeuvre) {

        static Prestation de(VenteForfaitEntity vf) {
            ForfaitEntity f = vf.forfait;
            List<double[]> mainOeuvres = new ArrayList<>();
            for (ForfaitMainOeuvreEntity fmo : f.mainOeuvres) {
                mainOeuvres.add(mainOeuvre(fmo.mainOeuvre, fmo.quantite));
            }
            List<double[]> pieces = new ArrayList<>();
            for (ForfaitProduitEntity fp : f.produits) {
                pieces.add(new double[] { prixHT(fp.produit) * fp.quantite });
            }
            return creer("F" + f.id, "Forfait", f.nom, vf.techniciens, vf.sav, vf.status == VenteForfaitEntity.Status.ANNULEE,
                    f.dureeEstimee, vf.quantite, vf.dureeReelle, mainOeuvres, pieces);
        }

        static Prestation de(VenteServiceEntity vs) {
            ServiceEntity s = vs.service;
            List<double[]> mainOeuvres = new ArrayList<>();
            for (ServiceMainOeuvreEntity smo : s.mainOeuvres) {
                mainOeuvres.add(mainOeuvre(smo.mainOeuvre, smo.quantite));
            }
            List<double[]> pieces = new ArrayList<>();
            for (ServiceProduitEntity sp : s.produits) {
                pieces.add(new double[] { prixHT(sp.produit) * sp.quantite });
            }
            return creer("S" + s.id, "Service", s.nom, vs.techniciens, vs.sav, vs.status == VenteServiceEntity.Status.ANNULEE,
                    s.dureeEstimee, vs.quantite, vs.dureeReelle, mainOeuvres, pieces);
        }

        // Main d'oeuvre d'une prestation : {heures (0 si forfaitaire), montant HT catalogue}
        private static double[] mainOeuvre(MainOeuvreEntity mo, double quantite) {
            if (mo == null) {
                return new double[] { 0, 0 };
            }
            return new double[] { mo.forfaitaire ? 0 : quantite, mo.prixHT * quantite };
        }

        private static double prixHT(ProduitCatalogueEntity p) {
            if (p == null) return 0;
            return p.prixVenteHT > 0 ? p.prixVenteHT : p.prixVenteTTC / (1 + (p.occasion ? 0 : p.tva) / 100.0);
        }

        private static Prestation creer(String cle, String type, String nom, List<TechnicienEntity> techniciens, boolean sav,
                                        boolean annulee, double dureeEstimee, double quantiteLigne, double dureeReelle,
                                        List<double[]> mainOeuvres, List<double[]> pieces) {
            double quantite = Quantite.ouUn(quantiteLigne);
            double heuresMainOeuvre = mainOeuvres.stream().mapToDouble(m -> m[0]).sum() * quantite;
            double montantMainOeuvre = mainOeuvres.stream().mapToDouble(m -> m[1]).sum();
            double montantPieces = pieces.stream().mapToDouble(p -> p[0]).sum();
            double partMainOeuvre = montantMainOeuvre + montantPieces > 0 ? montantMainOeuvre / (montantMainOeuvre + montantPieces) : 1;
            double heuresPrevues = dureeEstimee * quantite;
            return new Prestation(cle, type, nom, techniciens, sav, annulee, heuresPrevues, dureeReelle,
                    heuresMainOeuvre > 0 ? heuresMainOeuvre : heuresPrevues, partMainOeuvre);
        }
    }

    private static final class Cumul {
        double contrat;
        double feries;
        double absences;
        int joursAbsence;
        double disponibles;
        double prevues;
        double realisees;
        double facturees;
        double sav;
        double caMainOeuvre;
        double caPieces;
        int interventions;
        int interventionsSav;

        void ajouter(Cumul autre) {
            contrat += autre.contrat;
            feries += autre.feries;
            absences += autre.absences;
            joursAbsence += autre.joursAbsence;
            disponibles += autre.disponibles;
            prevues += autre.prevues;
            realisees += autre.realisees;
            facturees += autre.facturees;
            sav += autre.sav;
            caMainOeuvre += autre.caMainOeuvre;
            caPieces += autre.caPieces;
            interventions += autre.interventions;
            interventionsSav += autre.interventionsSav;
        }

        boolean vide() {
            return interventions == 0 && Math.abs(disponibles) < 0.005 && Math.abs(facturees) < 0.005
                    && Math.abs(caMainOeuvre) < 0.005 && Math.abs(caPieces) < 0.005;
        }

        Indicateurs indicateurs() {
            Indicateurs i = new Indicateurs();
            i.heuresDisponibles = arrondi(disponibles);
            i.heuresPrevues = arrondi(prevues);
            i.heuresRealisees = arrondi(realisees);
            i.heuresFacturees = arrondi(facturees);
            i.heuresSav = arrondi(sav);
            i.caMainOeuvreHT = arrondi(caMainOeuvre);
            i.caPiecesHT = arrondi(caPieces);
            i.interventions = interventions;
            i.interventionsSav = interventionsSav;
            i.tauxProductivite = taux(realisees, disponibles);
            i.tauxEfficience = taux(facturees, realisees);
            i.tauxValorisation = taux(facturees, disponibles);
            i.tauxSav = taux(sav, realisees);
            return i;
        }
    }

    public static class Indicateurs {
        public double heuresDisponibles;
        public double heuresPrevues;
        public double heuresRealisees;
        public double heuresFacturees;
        public double heuresSav;
        public double caMainOeuvreHT;
        public double caPiecesHT;
        public int interventions;
        public int interventionsSav;
        // Taux en %, null sans base
        public Double tauxProductivite;
        public Double tauxEfficience;
        public Double tauxValorisation;
        public Double tauxSav;
    }

    public static class KpisAtelier {
        // Premier et dernier mois de la période N (AAAA-MM)
        public String debut;
        public String fin;
        public Indicateurs n;
        public Indicateurs n1;
        public List<MoisKpi> mois = new ArrayList<>();
        public List<TechnicienKpi> techniciens = new ArrayList<>();
        public List<PrestationKpi> prestations = new ArrayList<>();
        // Techniciens actifs sur la période N sans durée hebdomadaire : leurs heures disponibles ne sont pas connues
        public List<String> techniciensSansHoraire = new ArrayList<>();
        public int prestationsSansDureeReelle;
    }

    public static class MoisKpi {
        public String mois;
        public Indicateurs n;
        public Indicateurs n1;
    }

    public static class TechnicienKpi {
        // null : prestations sans technicien
        public Long technicienId;
        public String nom;
        public Double heuresHebdomadaires;
        public double heuresContrat;
        public double heuresFeries;
        public double heuresAbsence;
        public int joursAbsence;
        public Indicateurs n;
        public Double tauxValorisationN1;
    }

    public static class PrestationKpi {
        // F + identifiant du forfait, S + identifiant du service
        public String cle;
        public String type;
        public String nom;
        public Indicateurs n;
    }

}
