package net.nanthrax.moussaillon.services;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import io.quarkus.narayana.jta.runtime.TransactionConfiguration;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.BateauClientEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;
import net.nanthrax.moussaillon.persistence.VenteEntity;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Timestamp;
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
        clients.forEach(c -> {
            c.motDePasse = null;
            c.soldeDu = computeSoldeDu(c.id);
            c.nombreBateaux = computeNombreBateaux(c.id);
            c.delaiPaiementMoyenJours = computeDelaiPaiementMoyenJours(c.id);
        });
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
                "LOWER(nom) LIKE ?1 OR LOWER(prenom) LIKE ?1 OR LOWER(type) LIKE ?1 OR LOWER(email) LIKE ?1 OR LOWER(telephone) LIKE ?1 OR LOWER(adresse) LIKE ?1",
                likePattern
            );
        }
        clients.forEach(c -> {
            c.motDePasse = null;
            c.soldeDu = computeSoldeDu(c.id);
            c.nombreBateaux = computeNombreBateaux(c.id);
            c.delaiPaiementMoyenJours = computeDelaiPaiementMoyenJours(c.id);
        });
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

                String adresse1 = CsvUtils.get(cols, headers, "Adresse 1 (facturation)");
                String codePostal = CsvUtils.get(cols, headers, "Code postal (facturation)");
                String ville = CsvUtils.get(cols, headers, "Ville (facturation)");
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
        entity.motDePasse = null;
        entity.soldeDu = computeSoldeDu(id);
        entity.nombreBateaux = computeNombreBateaux(id);
        entity.delaiPaiementMoyenJours = computeDelaiPaiementMoyenJours(id);
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

        entity.prenom = client.prenom;
        entity.nom = client.nom;
        entity.type = client.type;
        entity.email = client.email;
        entity.telephone = client.telephone;
        entity.adresse = client.adresse;
        entity.consentement = client.consentement;
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
        entity.motDePasse = null;
        entity.soldeDu = computeSoldeDu(id);
        entity.nombreBateaux = computeNombreBateaux(id);
        entity.delaiPaiementMoyenJours = computeDelaiPaiementMoyenJours(id);
        return entity;
    }

    private double computeSoldeDu(long clientId) {
        List<VenteEntity> unpaid = VenteEntity.list(
            "client.id = ?1 and (status = ?2 or status = ?3)",
            clientId, VenteEntity.Status.FACTURE_EN_ATTENTE, VenteEntity.Status.FACTURE_PRETE
        );
        return unpaid.stream().mapToDouble(v -> v.prixVenteTTC).sum();
    }

    private long computeNombreBateaux(long clientId) {
        return BateauClientEntity.getEntityManager()
            .createQuery("SELECT COUNT(b) FROM BateauClientEntity b JOIN b.proprietaires p WHERE p.id = :clientId", Long.class)
            .setParameter("clientId", clientId)
            .getSingleResult();
    }

    /**
     * Délai moyen, en jours, entre l'émission d'une facture (dateFacturePrete) et son
     * paiement (dateFacturePayee), sur les factures payées de ce client. Retourne null
     * si le client n'a aucune facture payée avec ces deux dates renseignées.
     */
    private Double computeDelaiPaiementMoyenJours(long clientId) {
        List<VenteEntity> payees = VenteEntity.list(
            "client.id = ?1 and status = ?2 and dateFacturePrete is not null and dateFacturePayee is not null",
            clientId, VenteEntity.Status.FACTURE_PAYEE
        );
        return averageDelaiPaiementJours(payees);
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

        SocieteEntity societe = SocieteEntity.findById(1L);
        String societeNom = societe != null ? societe.nom : "moussAIllon";

        String subject = "Votre mot de passe - Espace Client " + societeNom;
        String body = "Bonjour " + (client.prenom != null ? client.prenom : client.nom) + ",\n\n"
                + "Votre mot de passe pour accéder à l'Espace Client " + societeNom + " :\n\n"
                + "    " + request.password + "\n\n"
                + "Connectez-vous avec votre email : " + client.email + "\n\n"
                + "Cordialement,\n"
                + societeNom;

        mailer.send(Mail.withText(client.email, subject, body));

        return Response.ok().build();
    }

}
