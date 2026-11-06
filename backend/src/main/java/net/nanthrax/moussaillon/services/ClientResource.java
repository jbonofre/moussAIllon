package net.nanthrax.moussaillon.services;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import io.quarkus.narayana.jta.runtime.TransactionConfiguration;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.BateauClientEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.FormatNomListener;
import net.nanthrax.moussaillon.persistence.InteractionClientEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Path("/clients")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ClientResource {

    @Inject
    Mailer mailer;

    @GET
    public List<ClientEntity> list() {
        List<ClientEntity> clients = ClientEntity.listAll();
        completer(clients, null);
        return clients;
    }

    @GET
    @Path("/search")
    public List<ClientEntity> search(@QueryParam("q") String q) {
        List<ClientEntity> clients;
        if (q == null || q.trim().isEmpty()) {
            clients = ClientEntity.listAll();
        } else {
            String likePattern = "%" + q.toLowerCase() + "%";
            clients = ClientEntity.list(
                "LOWER(nom) LIKE ?1 OR LOWER(type) LIKE ?1 OR LOWER(email) LIKE ?1 OR LOWER(telephone) LIKE ?1 OR LOWER(adresse) LIKE ?1",
                likePattern
            );
        }
        completer(clients, null);
        return clients;
    }

    @POST
    @Transactional
    public ClientEntity create(ClientEntity client) {
        if (client.motDePasse != null && !client.motDePasse.isBlank()) {
            client.motDePasse = PasswordUtil.hash(client.motDePasse);
        }
        if (client.dateCreation == null) {
            client.dateCreation = new Timestamp(System.currentTimeMillis());
        }
        client.persist();
        client.flush();
        ClientEntity.getEntityManager().detach(client);
        client.motDePasse = null;
        client.soldeDu = 0.0;
        return client;
    }

    @POST
    @Path("/import")
    @Transactional
    @TransactionConfiguration(timeout = 300)
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public ImportResult importCsv(@RestForm("file") FileUpload file) throws IOException {
        ImportResult result = new ImportResult();
        if (file == null) {
            throw new WebApplicationException("Aucun fichier reçu", 400);
        }

        List<String> lines = Files.readAllLines(file.uploadedFile(), StandardCharsets.ISO_8859_1);
        if (lines.isEmpty()) {
            return result;
        }

        Map<String, Integer> headers = CsvUtils.indexHeaders(CsvUtils.parseLine(lines.get(0), ';'));
        if (!headers.containsKey("Nom")) {
            throw new WebApplicationException("Fichier CSV invalide : colonne 'Nom' manquante", 400);
        }

        for (int i = 1; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line.isBlank()) {
                continue;
            }
            result.total++;
            try {
                String[] cols = CsvUtils.parseLine(line, ';');
                String nom = CsvUtils.get(cols, headers, "Nom");
                if (nom == null) {
                    throw new IllegalArgumentException("Nom manquant");
                }
                // Le fichier exporte le nom au format "Nom Prénom", en majuscules : on reformate
                // seulement la casse et on garde l'ordre. Sans séparateur entre nom et prénom,
                // les inverser se trompe sur les noms ou prénoms composés ("Hamon Jean Luc",
                // "Le Gall Jean") et sur les sociétés.
                nom = FormatNomListener.formater(nom);
                String codeTiers = CsvUtils.get(cols, headers, "Code (tiers)");

                ClientEntity entity = null;
                if (codeTiers != null) {
                    entity = ClientEntity.find("codeTiers = ?1", codeTiers).firstResult();
                }
                boolean isNew = entity == null;
                if (isNew) {
                    entity = new ClientEntity();
                    entity.type = "PARTICULIER";
                    entity.dateCreation = new Timestamp(System.currentTimeMillis());
                    entity.codeTiers = codeTiers;
                }
                entity.nom = nom;

                String email = CsvUtils.get(cols, headers, "E-mail (facturation)");
                if (email != null) {
                    entity.email = email;
                }

                String adresse1 = FormatNomListener.formater(CsvUtils.get(cols, headers, "Adresse 1 (facturation)"));
                String codePostal = CsvUtils.get(cols, headers, "Code postal (facturation)");
                String ville = FormatNomListener.formater(CsvUtils.get(cols, headers, "Ville (facturation)"));
                StringBuilder adresse = new StringBuilder();
                if (adresse1 != null) {
                    adresse.append(adresse1);
                }
                String codePostalVille = ((codePostal != null ? codePostal : "") + " " + (ville != null ? ville : "")).trim();
                if (!codePostalVille.isEmpty()) {
                    if (adresse.length() > 0) {
                        adresse.append("\n");
                    }
                    adresse.append(codePostalVille);
                }
                if (adresse.length() > 0) {
                    entity.adresse = adresse.toString();
                }

                String telephoneFixe = CsvUtils.get(cols, headers, "Téléphone fixe (facturation)");
                String telephonePortable = CsvUtils.get(cols, headers, "Téléphone portable (facturation)");
                if (telephoneFixe != null) {
                    entity.telephone = telephoneFixe;
                } else if (telephonePortable != null) {
                    entity.telephone = telephonePortable;
                }

                if (isNew) {
                    entity.persist();
                    result.created++;
                } else {
                    result.updated++;
                }
            } catch (Exception e) {
                result.errors++;
                result.errorDetails.add("Ligne " + (i + 1) + " : " + e.getMessage());
            }
        }

        return result;
    }

    @GET
    @Path("{id}")
    public ClientEntity get(long id) {
        ClientEntity entity = ClientEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le client (" + id + ") n'est pas trouvé", 404);
        }
        completer(List.of(entity), id);
        return entity;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(long id) {
        ClientEntity entity = ClientEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le client (" + id + ") n'est pas trouvé", 404);
        }
        // Son suivi commercial disparaît avec lui
        InteractionClientEntity.delete("client.id", id);
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public ClientEntity update(long id, ClientEntity client) {
        ClientEntity entity = ClientEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le client (" + id + ") n'est pas trouvé", 404);
        }

        entity.nom = client.nom;
        entity.type = client.type;
        if (client.statut != null) {
            changerStatut(entity, client.statut);
        }
        entity.email = client.email;
        entity.telephone = client.telephone;
        entity.adresse = client.adresse;
        entity.consentement = client.consentement;
        entity.relancesSuspendues = client.relancesSuspendues;
        entity.motifSuspensionRelances = client.relancesSuspendues ? client.motifSuspensionRelances : null;
        entity.date = client.date;
        entity.evaluation = client.evaluation;
        entity.notes = client.notes;
        entity.remise = client.remise;
        entity.siren = client.siren;
        entity.siret = client.siret;
        entity.tva = client.tva;
        entity.naf = client.naf;
        entity.canalAcquisition = client.canalAcquisition;
        entity.documents = client.documents != null ? client.documents : new java.util.ArrayList<>();
        if (client.motDePasse != null && !client.motDePasse.isBlank()) {
            entity.motDePasse = PasswordUtil.hash(client.motDePasse);
        }

        entity.flush();
        ClientEntity.getEntityManager().detach(entity);
        completer(List.of(entity), id);
        return entity;
    }

    public static class ConsentementRequest {
        public List<Long> ids;
        public boolean consentement;
    }

    /**
     * Donne ou retire le consentement (campagnes, rappels) à plusieurs clients en une fois.
     * Retourne le nombre de clients modifiés.
     */
    @PUT
    @Path("consentement")
    @Transactional
    public Map<String, Long> updateConsentement(ConsentementRequest request) {
        if (request == null || request.ids == null || request.ids.isEmpty()) {
            throw new WebApplicationException("Aucun client sélectionné", 400);
        }
        long modifies = ClientEntity.update("consentement = ?1 where id in ?2", request.consentement, request.ids);
        return Map.of("modifies", modifies);
    }

    /**
     * Un prospect, ou un client inactif, devient client dès qu'une de ses ventes est acceptée : bon pour accord
     * signé, ou vente facturée (vente comptoir, prestation lancée...). Un devis en attente ne change rien.
     */
    static void convertirEnClient(VenteEntity vente) {
        if (vente == null || vente.client == null || vente.client.id == null) {
            return;
        }
        if (!vente.bonPourAccord && (vente.status == null || vente.status == VenteEntity.Status.DEVIS)) {
            return;
        }
        ClientEntity client = ClientEntity.findById(vente.client.id);
        if (client != null && client.statut != ClientEntity.Statut.CLIENT) {
            changerStatut(client, ClientEntity.Statut.CLIENT);
        }
    }

    /**
     * Le passage de prospect à client est daté pour les KPIs commerciaux (un client inactif qui revient n'est pas une
     * conversion) ; un retour en prospect efface cette date.
     */
    static void changerStatut(ClientEntity client, ClientEntity.Statut statut) {
        if (statut == ClientEntity.Statut.CLIENT && client.statut == ClientEntity.Statut.PROSPECT) {
            client.dateConversion = new Timestamp(System.currentTimeMillis());
        } else if (statut == ClientEntity.Statut.PROSPECT) {
            client.dateConversion = null;
        }
        client.statut = statut;
    }

    /** Suivi commercial des clients : date du dernier échange et échéance de la prochaine action à faire. */
    private static void renseignerSuiviCommercial(List<ClientEntity> clients) {
        Map<Long, Timestamp> derniersEchanges = datesParClient(
            "SELECT i.client.id, MAX(COALESCE(i.dateRealisation, i.date)) FROM InteractionClientEntity i WHERE i.statut = :statut GROUP BY i.client.id",
            InteractionClientEntity.Statut.FAITE);
        Map<Long, Timestamp> prochainesActions = datesParClient(
            "SELECT i.client.id, MIN(i.date) FROM InteractionClientEntity i WHERE i.statut = :statut GROUP BY i.client.id",
            InteractionClientEntity.Statut.A_FAIRE);
        for (ClientEntity client : clients) {
            client.derniereInteraction = derniersEchanges.get(client.id);
            client.prochaineAction = prochainesActions.get(client.id);
        }
    }

    private static Map<Long, Timestamp> datesParClient(String requete, InteractionClientEntity.Statut statut) {
        Map<Long, Timestamp> dates = new HashMap<>();
        InteractionClientEntity.getEntityManager().createQuery(requete, Object[].class)
            .setParameter("statut", statut)
            .getResultList()
            .forEach(r -> dates.put((Long) r[0], (Timestamp) r[1]));
        return dates;
    }

    /**
     * Champs calculés des clients : solde dû, bateaux, délai de paiement moyen et suivi commercial. Quelques requêtes
     * pour toute la liste, et non plusieurs par client (la liste de tous les clients en faisait des milliers) ; pour
     * un seul client (seul), elles se limitent à lui.
     */
    private static void completer(List<ClientEntity> clients, Long seul) {
        if (clients.isEmpty()) {
            return;
        }
        Map<Long, Double> soldes = soldesDus(seul);
        Map<Long, List<Map<String, Object>>> bateaux = bateauxParClient(seul);
        Map<Long, Double> delais = delaisPaiementMoyens(seul);
        for (ClientEntity client : clients) {
            client.motDePasse = null;
            client.soldeDu = soldes.getOrDefault(client.id, 0.0);
            client.bateaux = bateaux.getOrDefault(client.id, new java.util.ArrayList<>());
            client.nombreBateaux = (long) client.bateaux.size();
            client.delaiPaiementMoyenJours = delais.get(client.id);
        }
        renseignerSuiviCommercial(clients);
    }

    /** Solde dû par client : total TTC de ses factures en attente ou prêtes. */
    private static Map<Long, Double> soldesDus(Long seul) {
        Map<Long, Double> soldes = new HashMap<>();
        TypedQuery<Object[]> requete = VenteEntity.getEntityManager()
            .createQuery("SELECT v.client.id, SUM(v.prixVenteTTC) FROM VenteEntity v WHERE v.status IN (:statuts)"
                + (seul != null ? " AND v.client.id = :client" : "") + " GROUP BY v.client.id", Object[].class)
            .setParameter("statuts", List.of(VenteEntity.Status.FACTURE_EN_ATTENTE, VenteEntity.Status.FACTURE_PRETE));
        pourLeClient(requete, seul).getResultList()
            .forEach(r -> soldes.put((Long) r[0], ((Number) r[1]).doubleValue()));
        return soldes;
    }

    /** Bateaux de chaque client (identifiant et nom), par nom. */
    private static Map<Long, List<Map<String, Object>>> bateauxParClient(Long seul) {
        Map<Long, List<Map<String, Object>>> bateaux = new HashMap<>();
        TypedQuery<Object[]> requete = BateauClientEntity.getEntityManager()
            .createQuery("SELECT p.id, b.id, b.name FROM BateauClientEntity b JOIN b.proprietaires p"
                + (seul != null ? " WHERE p.id = :client" : "") + " ORDER BY b.name", Object[].class);
        pourLeClient(requete, seul).getResultList()
            .forEach(r -> {
                Map<String, Object> bateau = new java.util.LinkedHashMap<>();
                bateau.put("id", r[1]);
                bateau.put("name", r[2]);
                bateaux.computeIfAbsent((Long) r[0], c -> new java.util.ArrayList<>()).add(bateau);
            });
        return bateaux;
    }

    /**
     * Délai moyen, en jours, entre l'émission d'une facture (dateFacturePrete) et son paiement (dateFacturePayee),
     * sur les factures payées de chaque client ayant ces deux dates (absent pour un client sans telle facture).
     */
    private static Map<Long, Double> delaisPaiementMoyens(Long seul) {
        Map<Long, double[]> cumuls = new HashMap<>();
        TypedQuery<Object[]> requete = VenteEntity.getEntityManager()
            .createQuery("SELECT v.client.id, v.dateFacturePrete, v.dateFacturePayee FROM VenteEntity v WHERE v.status = :payee"
                + " AND v.dateFacturePrete IS NOT NULL AND v.dateFacturePayee IS NOT NULL"
                + (seul != null ? " AND v.client.id = :client" : ""), Object[].class)
            .setParameter("payee", VenteEntity.Status.FACTURE_PAYEE);
        pourLeClient(requete, seul).getResultList()
            .forEach(r -> {
                double[] cumul = cumuls.computeIfAbsent((Long) r[0], c -> new double[2]);
                cumul[0] += (((Timestamp) r[2]).getTime() - ((Timestamp) r[1]).getTime()) / 86400000.0;
                cumul[1]++;
            });
        Map<Long, Double> delais = new HashMap<>();
        cumuls.forEach((client, cumul) -> delais.put(client, cumul[0] / cumul[1]));
        return delais;
    }

    /** Restreint la requête au client (paramètre client), s'il y en a un. */
    private static TypedQuery<Object[]> pourLeClient(TypedQuery<Object[]> requete, Long seul) {
        return seul == null ? requete : requete.setParameter("client", seul);
    }

    static Double averageDelaiPaiementJours(List<VenteEntity> ventesPayees) {
        if (ventesPayees.isEmpty()) {
            return null;
        }
        double totalJours = ventesPayees.stream()
            .mapToDouble(v -> (v.dateFacturePayee.getTime() - v.dateFacturePrete.getTime()) / 86400000.0)
            .sum();
        return totalJours / ventesPayees.size();
    }

    @POST
    @Path("{id}/send-password")
    @Transactional
    public Response sendPassword(@PathParam("id") long id, PasswordRequest request) {
        ClientEntity client = ClientEntity.findById(id);
        if (client == null) {
            throw new WebApplicationException("Le client (" + id + ") n'est pas trouvé", 404);
        }
        if (client.email == null || client.email.isBlank()) {
            throw new WebApplicationException("Le client n'a pas d'adresse email", 400);
        }
        if (request.password == null || request.password.isBlank()) {
            throw new WebApplicationException("Le mot de passe est requis", 400);
        }

        client.motDePasse = PasswordUtil.hash(request.password);

        SocieteEntity societe = SocieteEntity.courante();
        String societeNom = societe != null ? societe.nom : "moussAIllon";

        String subject = "Votre mot de passe - Espace Client " + societeNom;
        String body = "Bonjour " + client.nom + ",\n\n"
                + "Votre mot de passe pour accéder à l'Espace Client " + societeNom + " :\n\n"
                + "    " + request.password + "\n\n"
                + "Connectez-vous avec votre email : " + client.email + "\n\n"
                + "Cordialement,\n"
                + societeNom;

        mailer.send(Mail.withText(client.email, subject, body));

        return Response.ok().build();
    }

}
