package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.bind.annotation.JsonbTypeAdapter;
import jakarta.persistence.EntityManager;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.TimestampJsonbAdapter;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.persistence.VentePaiementEntity;

@Path("/reglements")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ReglementResource {

    @Inject
    EntityManager em;

    public static class Reglement {
        public Long id;
        public Long venteId;
        public String numeroFacture;
        public Long clientId;
        public String clientNom;
        public String mode;
        public double montant;
        @JsonbTypeAdapter(TimestampJsonbAdapter.class)
        public Timestamp date;
        public String notes;
        public boolean rapproche;
        @JsonbTypeAdapter(TimestampJsonbAdapter.class)
        public Timestamp dateRapprochement;
        public String sourceRapprochement;
    }

    public static class RapprochementRequest {
        public boolean rapproche;
    }

    public static class BanqueTransaction {
        public String date;
        public String libelle;
        public double montant;
    }

    public static class RapprochementAutoRequest {
        public List<BanqueTransaction> transactions;
    }

    private static Reglement toReglement(VenteEntity v, VentePaiementEntity p) {
        Reglement r = new Reglement();
        r.id = p.id;
        r.venteId = v.id;
        r.numeroFacture = v.numeroFacture;
        r.clientId = v.client != null ? v.client.id : null;
        r.clientNom = v.client != null ? v.client.nom : null;
        r.mode = p.mode != null ? p.mode.name() : null;
        r.montant = p.montant;
        r.date = p.date;
        r.notes = p.notes;
        r.rapproche = p.rapproche;
        r.dateRapprochement = p.dateRapprochement;
        r.sourceRapprochement = p.sourceRapprochement;
        return r;
    }

    @GET
    public List<Reglement> list() {
        List<Object[]> rows = em.createQuery(
                "select v, p from VenteEntity v join v.paiements p order by p.date desc, p.id desc", Object[].class)
                .getResultList();
        List<Reglement> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(toReglement((VenteEntity) row[0], (VentePaiementEntity) row[1]));
        }
        return result;
    }

    @PUT
    @Path("{id}/rapprochement")
    @Transactional
    public Reglement setRapprochement(@PathParam("id") long id, RapprochementRequest request) {
        VentePaiementEntity p = VentePaiementEntity.findById(id);
        if (p == null) {
            throw new WebApplicationException("Le règlement (" + id + ") n'est pas trouvé", 404);
        }
        applyRapprochement(p, request != null && request.rapproche, "MANUEL");
        return toReglement(venteOf(p), p);
    }

    private VenteEntity venteOf(VentePaiementEntity p) {
        return em.createQuery("select v from VenteEntity v join v.paiements p where p.id = :id", VenteEntity.class)
                .setParameter("id", p.id).getSingleResult();
    }

    static void applyRapprochement(VentePaiementEntity p, boolean rapproche, String source) {
        p.rapproche = rapproche;
        p.dateRapprochement = rapproche ? new Timestamp(System.currentTimeMillis()) : null;
        p.sourceRapprochement = rapproche ? source : null;
    }

    /**
     * Rapproche automatiquement les règlements non pointés avec les écritures d'un relevé bancaire :
     * même montant, date à moins de 7 jours ; le numéro de facture dans le libellé départage les candidats.
     */
    @Transactional
    public Map<String, Object> rapprocherAuto(List<BanqueTransaction> transactions, String source) {
        List<Object[]> rows = em.createQuery(
                "select v, p from VenteEntity v join v.paiements p where p.rapproche = false", Object[].class)
                .getResultList();
        List<Object[]> candidats = new ArrayList<>();
        for (Object[] row : rows) {
            VentePaiementEntity p = (VentePaiementEntity) row[1];
            if (p.mode == VentePaiementEntity.Mode.ESPÈCES || p.mode == VentePaiementEntity.Mode.AVOIR) {
                continue;
            }
            candidats.add(row);
        }

        List<Map<String, Object>> rapproches = new ArrayList<>();
        int nonRapproches = 0;
        for (BanqueTransaction tx : transactions) {
            LocalDate txDate;
            try {
                txDate = LocalDate.parse(tx.date);
            } catch (Exception e) {
                nonRapproches++;
                continue;
            }
            Object[] best = null;
            long bestScore = Long.MAX_VALUE;
            for (Object[] c : candidats) {
                VenteEntity v = (VenteEntity) c[0];
                VentePaiementEntity p = (VentePaiementEntity) c[1];
                if (Math.abs(p.montant - tx.montant) >= 0.005 || p.date == null) {
                    continue;
                }
                LocalDate pDate = p.date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                long ecart = Math.abs(ChronoUnit.DAYS.between(pDate, txDate));
                if (ecart > 7) {
                    continue;
                }
                boolean facture = v.numeroFacture != null && !v.numeroFacture.isBlank() && tx.libelle != null
                        && tx.libelle.toLowerCase().contains(v.numeroFacture.toLowerCase());
                long score = ecart - (facture ? 100 : 0);
                if (score < bestScore) {
                    bestScore = score;
                    best = c;
                }
            }
            if (best == null) {
                nonRapproches++;
                continue;
            }
            candidats.remove(best);
            VentePaiementEntity p = (VentePaiementEntity) best[1];
            applyRapprochement(p, true, source);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("reglementId", p.id);
            m.put("numeroFacture", ((VenteEntity) best[0]).numeroFacture);
            m.put("montant", p.montant);
            m.put("libelle", tx.libelle);
            rapproches.add(m);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rapproches", rapproches);
        result.put("nonRapproches", nonRapproches);
        return result;
    }
}
