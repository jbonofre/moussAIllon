package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.RappelHistoriqueEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;

import static net.nanthrax.moussaillon.services.KpiFinancierResource.arrondi;
import static net.nanthrax.moussaillon.services.KpiFinancierResource.date;
import static net.nanthrax.moussaillon.services.KpiFinancierResource.taux;

/**
 * KPIs commerciaux sur 12 mois glissants, comparés aux 12 mois précédents (N-1). Un lead est un devis/OR : toute
 * transaction/prestation hors vente comptoir (immédiate), datée de son devis.
 * <ul>
 *   <li>leads par mois et par origine (canal d'acquisition du client), montant HT ;</li>
 *   <li>conversion des leads de chaque mois : acceptés (bon pour accord signé ou prestation lancée), refusés
 *   (et leurs motifs), encore en attente ;</li>
 *   <li>pipeline à ce jour : devis/OR en attente de signature par ancienneté, et ceux à relancer.</li>
 * </ul>
 */
@Path("/kpis-commerciaux")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class KpiCommercialResource {

    // Sans relance automatique des devis paramétrée, un devis sans nouvelle depuis ce délai est à relancer
    static final int JOURS_A_RELANCER_DEFAUT = 15;
    static final String CANAL_NON_RENSEIGNE = "NON_RENSEIGNE";
    static final String MOTIF_NON_PRECISE = "Non précisé";

    enum Decision { ACCEPTE, REFUSE, EN_ATTENTE }

    @GET
    public KpisCommerciaux get(@QueryParam("fin") String fin) {
        YearMonth moisFin = KpiFinancierResource.moisFin(fin);
        YearMonth debutN = moisFin.minusMonths(11);
        YearMonth debutN1 = debutN.minusMonths(12);
        Timestamp debut = Timestamp.valueOf(debutN1.atDay(1).atStartOfDay());
        Timestamp finExclue = Timestamp.valueOf(moisFin.plusMonths(1).atDay(1).atStartOfDay());

        Map<YearMonth, Cumul> parMois = new HashMap<>();
        Map<String, Cumul> canauxN = new HashMap<>();
        Map<String, Cumul> canauxN1 = new HashMap<>();
        Map<String, MotifRefus> motifs = new HashMap<>();
        Map<YearMonth, Map<String, Integer>> canauxParMois = new HashMap<>();
        long joursAcceptation = 0;
        int acceptationsDatees = 0;

        List<VenteEntity> leads = VenteEntity.list(
                "comptoir = false and coalesce(dateDevis, date) >= ?1 and coalesce(dateDevis, date) < ?2", debut, finExclue);
        for (VenteEntity lead : leads) {
            YearMonth mois = YearMonth.from(date(RappelScheduler.dateDevis(lead)));
            boolean periodeN = !mois.isBefore(debutN);
            String canal = canal(lead);
            Decision decision = decision(lead);
            double montantHT = KpiFinancierResource.caHT(lead);

            parMois.computeIfAbsent(mois, m -> new Cumul()).ajouter(decision, montantHT);
            (periodeN ? canauxN : canauxN1).computeIfAbsent(canal, c -> new Cumul()).ajouter(decision, montantHT);
            if (!periodeN) {
                continue;
            }
            canauxParMois.computeIfAbsent(mois, m -> new LinkedHashMap<>()).merge(canal, 1, Integer::sum);
            if (decision == Decision.REFUSE) {
                String motif = lead.motifRefus != null && !lead.motifRefus.isBlank() ? lead.motifRefus.trim() : MOTIF_NON_PRECISE;
                MotifRefus refus = motifs.computeIfAbsent(motif, m -> {
                    MotifRefus nouveau = new MotifRefus();
                    nouveau.motif = m;
                    return nouveau;
                });
                refus.nombre++;
                refus.montantHT += montantHT;
            }
            if (decision == Decision.ACCEPTE && lead.dateBonPourAccord != null) {
                long jours = ChronoUnit.DAYS.between(date(RappelScheduler.dateDevis(lead)), date(lead.dateBonPourAccord));
                if (jours >= 0) {
                    joursAcceptation += jours;
                    acceptationsDatees++;
                }
            }
        }

        KpisCommerciaux kpis = new KpisCommerciaux();
        kpis.debut = debutN.toString();
        kpis.fin = moisFin.toString();
        Cumul totalN = new Cumul();
        Cumul totalN1 = new Cumul();
        for (int i = 0; i < 12; i++) {
            YearMonth mois = debutN.plusMonths(i);
            Cumul n = parMois.getOrDefault(mois, new Cumul());
            Cumul n1 = parMois.getOrDefault(mois.minusMonths(12), new Cumul());
            totalN.ajouter(n);
            totalN1.ajouter(n1);

            MoisKpi kpi = new MoisKpi();
            kpi.mois = mois.toString();
            kpi.leads = n.leads;
            kpi.leadsN1 = n1.leads;
            kpi.acceptes = n.acceptes;
            kpi.acceptesN1 = n1.acceptes;
            kpi.refuses = n.refuses;
            kpi.enAttente = n.enAttente;
            kpi.montantLeadsHT = arrondi(n.montantHT);
            kpi.montantAccepteHT = arrondi(n.montantAccepteHT);
            kpi.tauxConversion = taux(n.acceptes, n.leads);
            kpi.tauxConversionN1 = taux(n1.acceptes, n1.leads);
            kpi.leadsParCanal = canauxParMois.getOrDefault(mois, Map.of());
            kpis.mois.add(kpi);
        }
        kpis.leads = totalN.leads;
        kpis.leadsN1 = totalN1.leads;
        kpis.acceptes = totalN.acceptes;
        kpis.acceptesN1 = totalN1.acceptes;
        kpis.refuses = totalN.refuses;
        kpis.refusesN1 = totalN1.refuses;
        kpis.enAttente = totalN.enAttente;
        kpis.montantLeadsHT = arrondi(totalN.montantHT);
        kpis.montantLeadsHTN1 = arrondi(totalN1.montantHT);
        kpis.montantAccepteHT = arrondi(totalN.montantAccepteHT);
        kpis.montantAccepteHTN1 = arrondi(totalN1.montantAccepteHT);
        kpis.tauxConversion = taux(totalN.acceptes, totalN.leads);
        kpis.tauxConversionN1 = taux(totalN1.acceptes, totalN1.leads);
        kpis.delaiMoyenAcceptationJours = acceptationsDatees > 0
                ? Math.round((double) joursAcceptation / acceptationsDatees * 10.0) / 10.0 : null;

        canauxN.forEach((code, n) -> kpis.canaux.add(canalKpi(code, n, canauxN1.get(code))));
        canauxN1.forEach((code, n1) -> {
            if (!canauxN.containsKey(code)) {
                kpis.canaux.add(canalKpi(code, new Cumul(), n1));
            }
        });
        kpis.canaux.sort(Comparator.comparingInt((CanalKpi c) -> c.leads).thenComparingInt(c -> c.leadsN1).reversed());

        for (MotifRefus motif : motifs.values()) {
            motif.montantHT = arrondi(motif.montantHT);
            kpis.motifsRefus.add(motif);
        }
        kpis.motifsRefus.sort(Comparator.comparingInt((MotifRefus m) -> m.nombre).reversed());

        kpis.pipeline = pipeline(LocalDate.now());
        return kpis;
    }

    /** Accepté : bon pour accord signé ou prestation lancée. Refusé : devis non signé marqué refusé. */
    static Decision decision(VenteEntity vente) {
        if (vente.bonPourAccord || vente.status != VenteEntity.Status.DEVIS) {
            return Decision.ACCEPTE;
        }
        return vente.dateRefus != null ? Decision.REFUSE : Decision.EN_ATTENTE;
    }

    private static String canal(VenteEntity vente) {
        String canal = vente.client != null ? vente.client.canalAcquisition : null;
        return canal != null && !canal.isBlank() ? canal : CANAL_NON_RENSEIGNE;
    }

    private static CanalKpi canalKpi(String code, Cumul n, Cumul n1) {
        CanalKpi kpi = new CanalKpi();
        kpi.code = code;
        kpi.leads = n.leads;
        kpi.leadsN1 = n1 != null ? n1.leads : 0;
        kpi.acceptes = n.acceptes;
        kpi.refuses = n.refuses;
        kpi.enAttente = n.enAttente;
        kpi.montantLeadsHT = arrondi(n.montantHT);
        kpi.montantAccepteHT = arrondi(n.montantAccepteHT);
        kpi.tauxConversion = taux(n.acceptes, n.leads);
        return kpi;
    }

    /**
     * Devis/OR en attente de signature à ce jour, quelle que soit leur date. Un devis est à relancer quand il est sans
     * nouvelle (depuis sa date ou sa dernière relance) depuis le délai de la première relance automatique des devis,
     * à défaut depuis {@link #JOURS_A_RELANCER_DEFAUT} jours.
     */
    private static Pipeline pipeline(LocalDate aujourdhui) {
        SocieteEntity societe = SocieteEntity.findById(1L);
        Integer premiereRelance = societe != null ? societe.relanceDevis1Jours : null;

        Pipeline pipeline = new Pipeline();
        pipeline.seuilRelanceJours = premiereRelance != null ? premiereRelance : JOURS_A_RELANCER_DEFAUT;
        pipeline.relanceAutomatique = premiereRelance != null;

        List<VenteEntity> enAttente = VenteEntity.list(VenteResource.DEVIS_EN_ATTENTE, VenteEntity.Status.DEVIS);
        Map<Long, Timestamp> dernieresRelances = dernieresRelances(enAttente);
        for (VenteEntity vente : enAttente) {
            Timestamp dateDevis = RappelScheduler.dateDevis(vente);
            LocalDate depuis = dateDevis != null ? date(dateDevis) : aujourdhui;
            long jours = Math.max(0, ChronoUnit.DAYS.between(depuis, aujourdhui));
            double montantHT = KpiFinancierResource.caHT(vente);

            pipeline.nombreDevis++;
            pipeline.montantHT += montantHT;
            pipeline.montantTTC += vente.prixVenteTTC;
            if (jours <= 15) pipeline.montant0a15HT += montantHT;
            else if (jours <= 30) pipeline.montant16a30HT += montantHT;
            else if (jours <= 60) pipeline.montant31a60HT += montantHT;
            else pipeline.montantPlus60HT += montantHT;

            DevisEnAttente devis = new DevisEnAttente();
            devis.venteId = vente.id;
            devis.numero = vente.numeroFacture;
            devis.ordreDeReparation = vente.ordreDeReparation;
            devis.client = vente.client != null ? vente.client.nom : null;
            devis.canal = canal(vente);
            devis.dateDevis = dateDevis != null ? depuis : null;
            devis.joursAttente = jours;
            devis.montantHT = arrondi(montantHT);
            devis.montantTTC = arrondi(vente.prixVenteTTC);
            devis.niveauRelance = vente.niveauRelanceDevis;
            Timestamp derniereRelance = dernieresRelances.get(vente.id);
            devis.derniereRelance = derniereRelance != null ? date(derniereRelance) : null;
            devis.emailClient = vente.client != null && vente.client.email != null && !vente.client.email.isBlank();
            // Les mêmes conditions que la relance automatique (RappelScheduler.envoyerRelancesDevis)
            devis.relanceAutomatique = pipeline.relanceAutomatique && devis.emailClient && vente.client.consentement
                    && vente.dateFactureEnAttente == null;
            LocalDate derniereNouvelle = devis.derniereRelance != null && devis.derniereRelance.isAfter(depuis)
                    ? devis.derniereRelance : depuis;
            devis.aRelancer = ChronoUnit.DAYS.between(derniereNouvelle, aujourdhui) >= pipeline.seuilRelanceJours;
            if (devis.aRelancer) {
                pipeline.nombreARelancer++;
                pipeline.montantARelancerHT += montantHT;
            }
            pipeline.devis.add(devis);
        }
        pipeline.devis.sort(Comparator.comparingLong((DevisEnAttente d) -> d.joursAttente).reversed());
        pipeline.montantHT = arrondi(pipeline.montantHT);
        pipeline.montantTTC = arrondi(pipeline.montantTTC);
        pipeline.montant0a15HT = arrondi(pipeline.montant0a15HT);
        pipeline.montant16a30HT = arrondi(pipeline.montant16a30HT);
        pipeline.montant31a60HT = arrondi(pipeline.montant31a60HT);
        pipeline.montantPlus60HT = arrondi(pipeline.montantPlus60HT);
        pipeline.montantARelancerHT = arrondi(pipeline.montantARelancerHT);
        return pipeline;
    }

    // Date de la dernière relance (automatique ou manuelle) envoyée pour chaque vente
    private static Map<Long, Timestamp> dernieresRelances(List<VenteEntity> ventes) {
        Map<Long, Timestamp> dernieres = new HashMap<>();
        if (ventes.isEmpty()) {
            return dernieres;
        }
        List<Object[]> lignes = RappelHistoriqueEntity.getEntityManager().createQuery(
                "select r.vente.id, max(r.dateEnvoi) from RappelHistoriqueEntity r where r.vente.id in ?1 group by r.vente.id",
                Object[].class)
                .setParameter(1, ventes.stream().map(v -> v.id).toList())
                .getResultList();
        for (Object[] ligne : lignes) {
            if (ligne[1] != null) {
                dernieres.put((Long) ligne[0], (Timestamp) ligne[1]);
            }
        }
        return dernieres;
    }

    private static final class Cumul {
        int leads;
        int acceptes;
        int refuses;
        int enAttente;
        double montantHT;
        double montantAccepteHT;

        void ajouter(Decision decision, double montant) {
            leads++;
            montantHT += montant;
            switch (decision) {
                case ACCEPTE -> {
                    acceptes++;
                    montantAccepteHT += montant;
                }
                case REFUSE -> refuses++;
                case EN_ATTENTE -> enAttente++;
            }
        }

        void ajouter(Cumul autre) {
            leads += autre.leads;
            acceptes += autre.acceptes;
            refuses += autre.refuses;
            enAttente += autre.enAttente;
            montantHT += autre.montantHT;
            montantAccepteHT += autre.montantAccepteHT;
        }
    }

    public static class KpisCommerciaux {
        // Premier et dernier mois de la période N (AAAA-MM)
        public String debut;
        public String fin;
        public int leads;
        public int leadsN1;
        public int acceptes;
        public int acceptesN1;
        public int refuses;
        public int refusesN1;
        // Leads de la période encore en attente de décision
        public int enAttente;
        public double montantLeadsHT;
        public double montantLeadsHTN1;
        public double montantAccepteHT;
        public double montantAccepteHTN1;
        // Leads acceptés sur leads émis, en %
        public Double tauxConversion;
        public Double tauxConversionN1;
        // Entre la date du devis et celle du bon pour accord
        public Double delaiMoyenAcceptationJours;
        public List<MoisKpi> mois = new ArrayList<>();
        public List<CanalKpi> canaux = new ArrayList<>();
        public List<MotifRefus> motifsRefus = new ArrayList<>();
        public Pipeline pipeline;
    }

    public static class MoisKpi {
        public String mois;
        public int leads;
        public int leadsN1;
        public int acceptes;
        public int acceptesN1;
        public int refuses;
        public int enAttente;
        public double montantLeadsHT;
        public double montantAccepteHT;
        public Double tauxConversion;
        public Double tauxConversionN1;
        // Nombre de leads du mois par canal d'acquisition
        public Map<String, Integer> leadsParCanal = new LinkedHashMap<>();
    }

    public static class CanalKpi {
        // Canal d'acquisition du client (NON_RENSEIGNE s'il est vide)
        public String code;
        public int leads;
        public int leadsN1;
        public int acceptes;
        public int refuses;
        public int enAttente;
        public double montantLeadsHT;
        public double montantAccepteHT;
        public Double tauxConversion;
    }

    public static class MotifRefus {
        public String motif;
        public int nombre;
        public double montantHT;
    }

    public static class Pipeline {
        public int nombreDevis;
        public double montantHT;
        public double montantTTC;
        public double montant0a15HT;
        public double montant16a30HT;
        public double montant31a60HT;
        public double montantPlus60HT;
        public int nombreARelancer;
        public double montantARelancerHT;
        public int seuilRelanceJours;
        // Relance automatique des devis paramétrée sur la société
        public boolean relanceAutomatique;
        public List<DevisEnAttente> devis = new ArrayList<>();
    }

    public static class DevisEnAttente {
        public Long venteId;
        public String numero;
        public boolean ordreDeReparation;
        public String client;
        public String canal;
        public LocalDate dateDevis;
        public long joursAttente;
        public double montantHT;
        public double montantTTC;
        // Dernière relance automatique envoyée (0 à 3)
        public int niveauRelance;
        // Dernière relance envoyée, automatique ou manuelle
        public LocalDate derniereRelance;
        public boolean emailClient;
        // Le devis sera relancé automatiquement (paramétrage, email et consentement du client)
        public boolean relanceAutomatique;
        public boolean aRelancer;
    }
}
