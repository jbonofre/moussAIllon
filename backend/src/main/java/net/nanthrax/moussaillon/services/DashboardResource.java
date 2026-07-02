package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

@Path("/dashboard")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class DashboardResource {

    @GET
    public DashboardData get() {
        DashboardData data = new DashboardData();

        LocalDate now = LocalDate.now();
        LocalDate startOfMonth = now.withDayOfMonth(1);
        Timestamp monthStart = Timestamp.valueOf(startOfMonth.atStartOfDay());
        Timestamp monthStartTimestamp = Timestamp.valueOf(startOfMonth.atStartOfDay());

        // CA du mois: sum of prixVenteTTC for PAYEE ventes this month
        List<VenteEntity> ventesDuMois = VenteEntity.list("status = ?1 and date >= ?2", VenteEntity.Status.FACTURE_PAYEE, monthStart);
        data.caDuMois = ventesDuMois.stream().mapToDouble(v -> v.prixVenteTTC).sum();

        // Interventions ouvertes (forfaits + services EN_ATTENTE or EN_COURS)
        long forfaitsOuverts = VenteForfaitEntity.count("status in (?1, ?2)",
                VenteForfaitEntity.Status.EN_ATTENTE, VenteForfaitEntity.Status.EN_COURS);
        long servicesOuverts = VenteServiceEntity.count("status in (?1, ?2)",
                VenteServiceEntity.Status.EN_ATTENTE, VenteServiceEntity.Status.EN_COURS);
        data.interventionsOuvertes = (int) (forfaitsOuverts + servicesOuverts);

        // Retards > 48h
        Timestamp twoDaysAgo = Timestamp.valueOf(now.minusDays(2).atStartOfDay());
        long forfaitsRetard = VenteForfaitEntity.count("status = ?1 and dateDebut < ?2",
                VenteForfaitEntity.Status.EN_COURS, twoDaysAgo);
        long servicesRetard = VenteServiceEntity.count("status = ?1 and dateDebut < ?2",
                VenteServiceEntity.Status.EN_COURS, twoDaysAgo);
        data.retards48h = (int) (forfaitsRetard + servicesRetard);

        // Alertes stock
        List<ProduitCatalogueEntity> produitsEnAlerte = ProduitCatalogueEntity.list("stock <= stockMini");
        data.alertesStock = produitsEnAlerte.size();

        // Interventions du jour (started today OR planned/scheduled for today)
        Timestamp todayStart = Timestamp.valueOf(now.atStartOfDay());
        Timestamp tomorrowStart = Timestamp.valueOf(now.plusDays(1).atStartOfDay());
        data.interventions = new ArrayList<>();
        List<VenteEntity> ventesAvecForfaits = VenteEntity.list(
                "select distinct v from VenteEntity v join v.venteForfaits vf where "
                + "(vf.dateDebut >= ?1 and vf.dateDebut < ?2) or "
                + "(vf.statusDate >= ?1 and vf.statusDate < ?2) or "
                + "(vf.datePlanification >= ?1 and vf.datePlanification < ?2)",
                todayStart, tomorrowStart);
        java.util.Set<Long> addedForfaitIds = new java.util.HashSet<>();
        for (VenteEntity vente : ventesAvecForfaits) {
            for (VenteForfaitEntity vf : vente.venteForfaits) {
                boolean matchesToday = (vf.dateDebut != null && !vf.dateDebut.before(todayStart) && vf.dateDebut.before(tomorrowStart))
                        || (vf.statusDate != null && !vf.statusDate.before(todayStart) && vf.statusDate.before(tomorrowStart))
                        || (vf.datePlanification != null && !vf.datePlanification.before(todayStart) && vf.datePlanification.before(tomorrowStart));
                if (matchesToday && addedForfaitIds.add(vf.id)) {
                    InterventionRow row = new InterventionRow();
                    row.key = "f-" + vf.id;
                    row.client = vente.client != null
                            ? (vente.client.prenom != null ? vente.client.prenom + " " : "") + vente.client.nom
                            : "";
                    row.unite = vente.bateau != null ? vente.bateau.name : (vente.moteur != null ? "Moteur" : "");
                    row.type = vf.forfait != null ? vf.forfait.nom : "";
                    row.technicien = vf.techniciens != null && !vf.techniciens.isEmpty()
                            ? vf.techniciens.stream().map(t -> (t.prenom != null ? t.prenom.substring(0, 1) + ". " : "") + t.nom).collect(java.util.stream.Collectors.joining(", "))
                            : "";
                    row.statut = mapStatut(vf.status != null ? vf.status.name() : null);
                    data.interventions.add(row);
                }
            }
        }
        List<VenteEntity> ventesAvecServices = VenteEntity.list(
                "select distinct v from VenteEntity v join v.venteServices vs where "
                + "(vs.dateDebut >= ?1 and vs.dateDebut < ?2) or "
                + "(vs.statusDate >= ?1 and vs.statusDate < ?2) or "
                + "(vs.datePlanification >= ?1 and vs.datePlanification < ?2)",
                todayStart, tomorrowStart);
        java.util.Set<Long> addedServiceIds = new java.util.HashSet<>();
        for (VenteEntity vente : ventesAvecServices) {
            for (VenteServiceEntity vs : vente.venteServices) {
                boolean matchesToday = (vs.dateDebut != null && !vs.dateDebut.before(todayStart) && vs.dateDebut.before(tomorrowStart))
                        || (vs.statusDate != null && !vs.statusDate.before(todayStart) && vs.statusDate.before(tomorrowStart))
                        || (vs.datePlanification != null && !vs.datePlanification.before(todayStart) && vs.datePlanification.before(tomorrowStart));
                if (matchesToday && addedServiceIds.add(vs.id)) {
                    InterventionRow row = new InterventionRow();
                    row.key = "s-" + vs.id;
                    row.client = vente.client != null
                            ? (vente.client.prenom != null ? vente.client.prenom + " " : "") + vente.client.nom
                            : "";
                    row.unite = vente.bateau != null ? vente.bateau.name : (vente.moteur != null ? "Moteur" : "");
                    row.type = vs.service != null ? vs.service.nom : "";
                    row.technicien = vs.techniciens != null && !vs.techniciens.isEmpty()
                            ? vs.techniciens.stream().map(t -> (t.prenom != null ? t.prenom.substring(0, 1) + ". " : "") + t.nom).collect(java.util.stream.Collectors.joining(", "))
                            : "";
                    row.statut = mapStatut(vs.status != null ? vs.status.name() : null);
                    data.interventions.add(row);
                }
            }
        }

        // Bateaux dans le chantier
        LocalDate startOfWeek = now.with(java.time.DayOfWeek.MONDAY);
        Timestamp weekStart = Timestamp.valueOf(startOfWeek.atStartOfDay());
        List<VenteEntity> ventesActives = VenteEntity.list("status in (?1, ?2, ?3)",
                VenteEntity.Status.DEVIS, VenteEntity.Status.FACTURE_EN_ATTENTE, VenteEntity.Status.FACTURE_PRETE);
        java.util.Set<Long> bateauxIds = new java.util.HashSet<>();
        java.util.Set<Long> bateauxSemaine = new java.util.HashSet<>();
        java.util.Set<Long> bateauxEnAttente = new java.util.HashSet<>();
        for (VenteEntity v : ventesActives) {
            if (v.bateau != null) {
                bateauxIds.add(v.bateau.id);
                if (v.date != null && !v.date.before(weekStart)) {
                    bateauxSemaine.add(v.bateau.id);
                }
                boolean hasEnAttente = v.venteForfaits.stream().anyMatch(vf -> vf.status == VenteForfaitEntity.Status.EN_ATTENTE)
                        || v.venteServices.stream().anyMatch(vs -> vs.status == VenteServiceEntity.Status.EN_ATTENTE);
                if (hasEnAttente) {
                    bateauxEnAttente.add(v.bateau.id);
                }
            }
        }
        data.bateauxDansLeChantier = bateauxIds.size();
        data.bateauxEntreesSemaine = bateauxSemaine.size();
        data.bateauxEnAttenteIntervention = bateauxEnAttente.size();

        // Stock a surveiller
        data.stockAlerts = new ArrayList<>();
        for (ProduitCatalogueEntity produit : produitsEnAlerte) {
            StockAlert alert = new StockAlert();
            alert.produit = produit.nom;
            alert.niveau = produit.stock == 0 ? "Critique" : "Bas";
            alert.color = produit.stock == 0 ? "red" : "orange";
            data.stockAlerts.add(alert);
        }

        // Objectifs mensuels
        List<VenteForfaitEntity> forfaitsDuMois = VenteForfaitEntity.list("dateDebut >= ?1", monthStartTimestamp);
        List<VenteServiceEntity> servicesDuMois = VenteServiceEntity.list("dateDebut >= ?1", monthStartTimestamp);
        double totalReelle = forfaitsDuMois.stream()
                .filter(vf -> vf.status == VenteForfaitEntity.Status.TERMINEE).mapToDouble(vf -> vf.dureeReelle).sum()
                + servicesDuMois.stream()
                .filter(vs -> vs.status == VenteServiceEntity.Status.TERMINEE).mapToDouble(vs -> vs.dureeReelle).sum();
        data.heuresAtelierPct = totalReelle > 0 ? (int) Math.min(100, Math.round(totalReelle)) : 0;

        // Ventes payees
        long ventesTotal = VenteEntity.count("date >= ?1", monthStart);
        long ventesPayees = VenteEntity.count("status = ?1 and date >= ?2", VenteEntity.Status.FACTURE_PAYEE, monthStart);
        data.ventesComptoirPct = ventesTotal > 0 ? (int) Math.round((double) ventesPayees / ventesTotal * 100) : 0;

        // Contrats de maintenance
        long itemsTotal = forfaitsDuMois.size() + servicesDuMois.size();
        long itemsTermines = forfaitsDuMois.stream().filter(vf -> vf.status == VenteForfaitEntity.Status.TERMINEE).count()
                + servicesDuMois.stream().filter(vs -> vs.status == VenteServiceEntity.Status.TERMINEE).count();
        data.contratsMaintenancePct = itemsTotal > 0 ? (int) Math.round((double) itemsTermines / itemsTotal * 100) : 0;

        return data;
    }

    private String mapStatut(String status) {
        if (status == null) return "A faire";
        return switch (status) {
            case "PLANIFIEE" -> "Planifiee";
            case "EN_COURS" -> "En cours";
            case "TERMINEE" -> "Terminee";
            default -> "A faire";
        };
    }

    public static class DashboardData {
        public double caDuMois;
        public int interventionsOuvertes;
        public int retards48h;
        public int alertesStock;
        public List<InterventionRow> interventions;
        public List<StockAlert> stockAlerts;
        public int heuresAtelierPct;
        public int ventesComptoirPct;
        public int contratsMaintenancePct;
        public int bateauxDansLeChantier;
        public int bateauxEntreesSemaine;
        public int bateauxEnAttenteIntervention;
    }

    public static class InterventionRow {
        public String key;
        public String client;
        public String unite;
        public String type;
        public String technicien;
        public String statut;
    }

    public static class StockAlert {
        public String produit;
        public String niveau;
        public String color;
    }
}
