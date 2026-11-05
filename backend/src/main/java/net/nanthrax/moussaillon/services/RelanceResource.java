package net.nanthrax.moussaillon.services;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import net.nanthrax.moussaillon.services.RappelScheduler.RelanceDue;

/**
 * Journal des relances (issue #758) : chaque matin, les relances de paiement et de devis dues sont listées pour être
 * validées avant l'envoi. Une relance peut aussi être ignorée (la suivante reste prévue), ou les relances suspendues
 * sur la vente (jusqu'à une date ou jusqu'à leur reprise) ou sur le client (accord particulier).
 */
@Path("/relances")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RelanceResource {

    @Inject
    RappelScheduler rappelScheduler;

    @GET
    public Journal journal() {
        SocieteEntity societe = societe();
        LocalDate today = LocalDate.now();
        Journal journal = new Journal();
        journal.relancesAutomatiques = societe.relancesAutomatiques;
        for (RelanceDue relance : RappelScheduler.relancesDues(societe, today)) {
            journal.relances.add(relance(relance, today));
        }
        // Les plus anciennes d'abord
        journal.relances.sort(Comparator.comparing((Relance r) -> r.dateDepart).thenComparing(r -> r.venteId));

        List<VenteEntity> suspendues = VenteEntity.list("dateSuspensionRelances is not null order by dateSuspensionRelances");
        for (VenteEntity vente : suspendues) {
            if (enAttente(vente) && RappelScheduler.relancesSuspendues(vente, today)) {
                journal.ventesSuspendues.add(venteSuspendue(vente));
            }
        }
        List<ClientEntity> clients = ClientEntity.list("relancesSuspendues = true order by nom");
        for (ClientEntity client : clients) {
            ClientSuspendu suspendu = new ClientSuspendu();
            suspendu.clientId = client.id;
            suspendu.client = client.nom;
            suspendu.motif = client.motifSuspensionRelances;
            journal.clientsSuspendus.add(suspendu);
        }
        return journal;
    }

    /** Envoie les relances sélectionnées dans le journal, si elles sont toujours dues. */
    @POST
    @Path("envoyer")
    @Transactional
    public EnvoiResultat envoyer(EnvoiRequest request) {
        if (request == null || request.ventes == null || request.ventes.isEmpty()) {
            throw new WebApplicationException("Aucune relance sélectionnée", 400);
        }
        Set<Long> ventes = new HashSet<>(request.ventes);
        EnvoiResultat resultat = new EnvoiResultat();
        for (RelanceDue relance : RappelScheduler.relancesDues(societe(), LocalDate.now())) {
            if (!ventes.contains(relance.vente().id)) {
                continue;
            }
            try {
                rappelScheduler.envoyer(relance);
                resultat.envoyees++;
            } catch (RuntimeException e) {
                resultat.erreurs.add(numero(relance.vente()) + " : " + e.getMessage());
            }
        }
        return resultat;
    }

    /** Écarte la relance due sans l'envoyer : la relance suivante reste prévue. */
    @POST
    @Path("{venteId}/ignorer")
    @Transactional
    public Response ignorer(@PathParam("venteId") long venteId, MotifRequest request) {
        RelanceDue relance = RappelScheduler.relancesDues(societe(), LocalDate.now()).stream()
                .filter(r -> r.vente().id == venteId)
                .findFirst()
                .orElseThrow(() -> new WebApplicationException("Aucune relance n'est due pour cette vente", 400));
        rappelScheduler.ignorer(relance, motif(request != null ? request.motif : null));
        return Response.noContent().build();
    }

    /** Suspend les relances de la vente, jusqu'à la date de fin incluse si elle est renseignée. */
    @POST
    @Path("ventes/{id}/suspension")
    @Transactional
    public Response suspendreVente(@PathParam("id") long id, SuspensionRequest request) {
        VenteEntity vente = vente(id);
        LocalDate jusquau = request != null ? request.jusquau : null;
        if (jusquau != null && jusquau.isBefore(LocalDate.now())) {
            throw new WebApplicationException("La date de fin de la suspension est déjà passée", 400);
        }
        vente.dateSuspensionRelances = new Timestamp(System.currentTimeMillis());
        vente.finSuspensionRelances = jusquau != null ? Timestamp.valueOf(jusquau.atStartOfDay()) : null;
        vente.motifSuspensionRelances = motif(request != null ? request.motif : null);
        return Response.noContent().build();
    }

    @DELETE
    @Path("ventes/{id}/suspension")
    @Transactional
    public Response reprendreVente(@PathParam("id") long id) {
        VenteEntity vente = vente(id);
        vente.dateSuspensionRelances = null;
        vente.finSuspensionRelances = null;
        vente.motifSuspensionRelances = null;
        return Response.noContent().build();
    }

    /** Suspend les relances de toutes les ventes du client (accord particulier). */
    @POST
    @Path("clients/{id}/suspension")
    @Transactional
    public Response suspendreClient(@PathParam("id") long id, MotifRequest request) {
        ClientEntity client = client(id);
        client.relancesSuspendues = true;
        client.motifSuspensionRelances = motif(request != null ? request.motif : null);
        return Response.noContent().build();
    }

    @DELETE
    @Path("clients/{id}/suspension")
    @Transactional
    public Response reprendreClient(@PathParam("id") long id) {
        ClientEntity client = client(id);
        client.relancesSuspendues = false;
        client.motifSuspensionRelances = null;
        return Response.noContent().build();
    }

    private static SocieteEntity societe() {
        SocieteEntity societe = SocieteEntity.findById(1L);
        if (societe == null) {
            throw new WebApplicationException("La société n'est pas paramétrée", 404);
        }
        return societe;
    }

    private static VenteEntity vente(long id) {
        VenteEntity vente = VenteEntity.findById(id);
        if (vente == null) {
            throw new WebApplicationException("La vente (" + id + ") n'est pas trouvee", 404);
        }
        return vente;
    }

    private static ClientEntity client(long id) {
        ClientEntity client = ClientEntity.findById(id);
        if (client == null) {
            throw new WebApplicationException("Le client (" + id + ") n'est pas trouvé", 404);
        }
        return client;
    }

    private static String motif(String motif) {
        return motif == null || motif.isBlank() ? null : motif.trim();
    }

    private static String numero(VenteEntity vente) {
        return vente.numeroFacture != null ? vente.numeroFacture : String.valueOf(vente.id);
    }

    /** Facture émise non soldée ou devis/OR en attente de signature : une vente dont les relances ont un sens. */
    private static boolean enAttente(VenteEntity vente) {
        if (vente.status == VenteEntity.Status.FACTURE_PRETE) {
            return VenteResource.soldeDu(vente) > 0.005;
        }
        return vente.status == VenteEntity.Status.DEVIS && !vente.bonPourAccord && vente.dateRefus == null && !vente.comptoir;
    }

    private static Relance relance(RelanceDue due, LocalDate today) {
        VenteEntity vente = due.vente();
        Relance relance = new Relance();
        relance.venteId = vente.id;
        relance.devis = due.devis();
        relance.ordreDeReparation = vente.ordreDeReparation;
        relance.numero = numero(vente);
        relance.clientId = vente.client.id;
        relance.client = vente.client.nom;
        relance.email = vente.client.email;
        relance.dateDepart = due.depart();
        relance.joursEcoules = ChronoUnit.DAYS.between(due.depart(), today);
        relance.niveau = due.niveau();
        relance.montant = due.devis() ? vente.prixVenteTTC : VenteResource.soldeDu(vente);
        return relance;
    }

    private static VenteSuspendue venteSuspendue(VenteEntity vente) {
        VenteSuspendue suspendue = new VenteSuspendue();
        suspendue.venteId = vente.id;
        suspendue.devis = vente.status == VenteEntity.Status.DEVIS;
        suspendue.ordreDeReparation = vente.ordreDeReparation;
        suspendue.numero = numero(vente);
        suspendue.client = vente.client != null ? vente.client.nom : null;
        suspendue.depuis = RappelScheduler.toLocalDate(vente.dateSuspensionRelances);
        suspendue.jusquau = RappelScheduler.toLocalDate(vente.finSuspensionRelances);
        suspendue.motif = vente.motifSuspensionRelances;
        return suspendue;
    }

    public static class Journal {
        // Les relances dues sont envoyées automatiquement chaque matin : le journal sert alors à en écarter.
        public boolean relancesAutomatiques;
        public List<Relance> relances = new ArrayList<>();
        public List<VenteSuspendue> ventesSuspendues = new ArrayList<>();
        public List<ClientSuspendu> clientsSuspendus = new ArrayList<>();
    }

    public static class Relance {
        public Long venteId;
        // Relance d'un devis/OR en attente de signature, sinon relance de paiement d'une facture
        public boolean devis;
        public boolean ordreDeReparation;
        public String numero;
        public Long clientId;
        public String client;
        public String email;
        // Échéance de la facture (ou sa date d'émission à défaut), ou date du devis
        public LocalDate dateDepart;
        public long joursEcoules;
        // Numéro de la relance à envoyer (1 à 3)
        public int niveau;
        // Solde dû de la facture, ou montant TTC du devis
        public double montant;
    }

    public static class VenteSuspendue {
        public Long venteId;
        public boolean devis;
        public boolean ordreDeReparation;
        public String numero;
        public String client;
        public LocalDate depuis;
        // Dernier jour de la suspension, ou null jusqu'à la reprise des relances
        public LocalDate jusquau;
        public String motif;
    }

    public static class ClientSuspendu {
        public Long clientId;
        public String client;
        public String motif;
    }

    public static class EnvoiRequest {
        public List<Long> ventes;
    }

    public static class EnvoiResultat {
        public int envoyees;
        public List<String> erreurs = new ArrayList<>();
    }

    public static class MotifRequest {
        public String motif;
    }

    public static class SuspensionRequest {
        public LocalDate jusquau;
        public String motif;
    }
}
