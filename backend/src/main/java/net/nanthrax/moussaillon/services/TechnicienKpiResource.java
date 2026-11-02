package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.ForfaitMainOeuvreEntity;
import net.nanthrax.moussaillon.persistence.ServiceMainOeuvreEntity;
import net.nanthrax.moussaillon.persistence.TechnicienEntity;
import net.nanthrax.moussaillon.persistence.VenteForfaitEntity;
import net.nanthrax.moussaillon.persistence.VenteServiceEntity;

@Path("/techniciens/{id}/kpi")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class TechnicienKpiResource {

    @GET
    public TechnicienKpi get(@PathParam("id") long id) {
        TechnicienEntity technicien = TechnicienEntity.findById(id);
        if (technicien == null) {
            throw new WebApplicationException("Le technicien (" + id + ") n'est pas trouvé", 404);
        }

        List<VenteForfaitEntity> allForfaits = VenteForfaitEntity.list("SELECT vf FROM VenteForfaitEntity vf JOIN vf.techniciens t WHERE t.id = ?1", id);
        List<VenteServiceEntity> allServices = VenteServiceEntity.list("SELECT vs FROM VenteServiceEntity vs JOIN vs.techniciens t WHERE t.id = ?1", id);

        // Combine into a unified list of status/dates/dureeReelle
        List<PlanningItem> allItems = new ArrayList<>();
        for (VenteForfaitEntity vf : allForfaits) {
            allItems.add(new PlanningItem(
                    vf.status != null ? vf.status.name() : null,
                    vf.dateDebut, vf.statusDate, vf.dureeReelle,
                    vf.forfait != null ? vf.forfait.dureeEstimee : 0));
        }
        for (VenteServiceEntity vs : allServices) {
            allItems.add(new PlanningItem(
                    vs.status != null ? vs.status.name() : null,
                    vs.dateDebut, vs.statusDate, vs.dureeReelle,
                    vs.service != null ? vs.service.dureeEstimee : 0));
        }

        LocalDate now = LocalDate.now();
        LocalDate startOfMonth = now.withDayOfMonth(1);
        Timestamp monthStart = Timestamp.valueOf(startOfMonth.atStartOfDay());

        TechnicienKpi kpi = new TechnicienKpi();

        kpi.totalTaches = allItems.size();
        kpi.tachesTerminees = (int) allItems.stream().filter(i -> "TERMINEE".equals(i.status)).count();
        kpi.tachesEnCours = (int) allItems.stream().filter(i -> "EN_COURS".equals(i.status)).count();
        kpi.tachesEnAttente = (int) allItems.stream().filter(i -> "EN_ATTENTE".equals(i.status) || "PLANIFIEE".equals(i.status)).count();
        kpi.tachesIncident = (int) allItems.stream().filter(i -> "INCIDENT".equals(i.status)).count();
        kpi.tachesAnnulees = (int) allItems.stream().filter(i -> "ANNULEE".equals(i.status)).count();

        kpi.tauxCompletion = kpi.totalTaches > 0 ? Math.round((double) kpi.tachesTerminees / kpi.totalTaches * 100.0 * 10) / 10.0 : 0;
        kpi.tauxIncident = kpi.totalTaches > 0 ? Math.round((double) kpi.tachesIncident / kpi.totalTaches * 100.0 * 10) / 10.0 : 0;

        kpi.heuresReelles = allItems.stream().filter(i -> "TERMINEE".equals(i.status)).mapToDouble(i -> i.dureeReelle).sum();

        // KPIs du mois
        List<PlanningItem> itemsDuMois = allItems.stream()
                .filter(i -> i.dateDebut != null && !i.dateDebut.before(monthStart))
                .toList();
        kpi.tachesMois = itemsDuMois.size();
        kpi.tachesTermineesMois = (int) itemsDuMois.stream().filter(i -> "TERMINEE".equals(i.status)).count();
        kpi.heuresReellesMois = itemsDuMois.stream().filter(i -> "TERMINEE".equals(i.status)).mapToDouble(i -> i.dureeReelle).sum();

        // Retards > 48h
        Timestamp twoDaysAgo = Timestamp.valueOf(now.minusDays(2).atStartOfDay());
        kpi.retards48h = (int) allItems.stream()
                .filter(i -> "EN_COURS".equals(i.status) && i.dateDebut != null && i.dateDebut.before(twoDaysAgo))
                .count();

        // Chiffre d'affaire main d'oeuvre (global)
        double caMainOeuvre = 0;
        for (VenteForfaitEntity vf : allForfaits) {
            if (vf.forfait != null && vf.forfait.mainOeuvres != null) {
                for (ForfaitMainOeuvreEntity fmo : vf.forfait.mainOeuvres) {
                    if (fmo.mainOeuvre != null) {
                        caMainOeuvre += fmo.mainOeuvre.prixTTC * fmo.quantite * vf.quantite;
                    }
                }
            }
        }
        for (VenteServiceEntity vs : allServices) {
            if (vs.service != null && vs.service.mainOeuvres != null) {
                for (ServiceMainOeuvreEntity smo : vs.service.mainOeuvres) {
                    if (smo.mainOeuvre != null) {
                        caMainOeuvre += smo.mainOeuvre.prixTTC * smo.quantite * vs.quantite;
                    }
                }
            }
        }
        kpi.chiffreAffaireMainOeuvre = caMainOeuvre;

        // Chiffre d'affaire main d'oeuvre (mois en cours)
        double caMainOeuvreMois = 0;
        for (VenteForfaitEntity vf : allForfaits) {
            if (vf.dateDebut != null && !vf.dateDebut.before(monthStart) && vf.forfait != null && vf.forfait.mainOeuvres != null) {
                for (ForfaitMainOeuvreEntity fmo : vf.forfait.mainOeuvres) {
                    if (fmo.mainOeuvre != null) {
                        caMainOeuvreMois += fmo.mainOeuvre.prixTTC * fmo.quantite * vf.quantite;
                    }
                }
            }
        }
        for (VenteServiceEntity vs : allServices) {
            if (vs.dateDebut != null && !vs.dateDebut.before(monthStart) && vs.service != null && vs.service.mainOeuvres != null) {
                for (ServiceMainOeuvreEntity smo : vs.service.mainOeuvres) {
                    if (smo.mainOeuvre != null) {
                        caMainOeuvreMois += smo.mainOeuvre.prixTTC * smo.quantite * vs.quantite;
                    }
                }
            }
        }
        kpi.chiffreAffaireMainOeuvreMois = caMainOeuvreMois;

        // Marge sur la main d'oeuvre : (durée estimée - durée réelle) x tarif horaire HT, des tâches terminées
        double marge = 0;
        double margeMois = 0;
        for (VenteForfaitEntity vf : allForfaits) {
            if (vf.forfait == null || vf.status != VenteForfaitEntity.Status.TERMINEE || vf.dureeReelle <= 0) {
                continue;
            }
            double gain = (vf.forfait.dureeEstimee * vf.quantite - vf.dureeReelle)
                    * tarifHoraire(vf.forfait.mainOeuvres == null ? List.of()
                            : vf.forfait.mainOeuvres.stream().map(m -> new double[] { m.mainOeuvre != null ? m.mainOeuvre.prixHT : 0, m.quantite }).toList());
            marge += gain;
            if (vf.dateDebut != null && !vf.dateDebut.before(monthStart)) {
                margeMois += gain;
            }
        }
        for (VenteServiceEntity vs : allServices) {
            if (vs.service == null || vs.status != VenteServiceEntity.Status.TERMINEE || vs.dureeReelle <= 0) {
                continue;
            }
            double gain = (vs.service.dureeEstimee * vs.quantite - vs.dureeReelle)
                    * tarifHoraire(vs.service.mainOeuvres == null ? List.of()
                            : vs.service.mainOeuvres.stream().map(m -> new double[] { m.mainOeuvre != null ? m.mainOeuvre.prixHT : 0, m.quantite }).toList());
            marge += gain;
            if (vs.dateDebut != null && !vs.dateDebut.before(monthStart)) {
                margeMois += gain;
            }
        }
        kpi.margeMainOeuvre = Math.round(marge * 100.0) / 100.0;
        kpi.margeMainOeuvreMois = Math.round(margeMois * 100.0) / 100.0;

        // Tâches en retard (date de planification dépassée)
        Timestamp nowTs = Timestamp.valueOf(now.atStartOfDay());
        kpi.tachesEnRetard = (int) allItems.stream()
                .filter(i -> ("PLANIFIEE".equals(i.status) || "EN_COURS".equals(i.status))
                        && i.statusDate != null && i.statusDate.before(nowTs))
                .count();

        // Tâches avec dépassement de durée (durée réelle > durée estimée)
        kpi.tachesDepassement = (int) allItems.stream()
                .filter(i -> i.dureeEstimee > 0 && i.dureeReelle > i.dureeEstimee)
                .count();

        return kpi;
    }

    // Tarif horaire HT moyen pondéré d'une prestation : chaque unité de main d'oeuvre vaut 1 h (prixHT, quantité)
    private static double tarifHoraire(List<double[]> mainOeuvres) {
        double heures = mainOeuvres.stream().mapToDouble(m -> m[1]).sum();
        double cout = mainOeuvres.stream().mapToDouble(m -> m[0] * m[1]).sum();
        return heures > 0 ? cout / heures : 0;
    }

    private record PlanningItem(String status, Timestamp dateDebut, Timestamp statusDate, double dureeReelle, double dureeEstimee) {}

    public static class TechnicienKpi {
        public int totalTaches;
        public int tachesTerminees;
        public int tachesEnCours;
        public int tachesEnAttente;
        public int tachesIncident;
        public int tachesAnnulees;
        public double tauxCompletion;
        public double tauxIncident;
        public double heuresReelles;
        public int tachesMois;
        public int tachesTermineesMois;
        public double heuresReellesMois;
        public int retards48h;
        public int tachesEnRetard;
        public int tachesDepassement;
        public double chiffreAffaireMainOeuvre;
        public double chiffreAffaireMainOeuvreMois;
        public double margeMainOeuvre;
        public double margeMainOeuvreMois;
    }

}
