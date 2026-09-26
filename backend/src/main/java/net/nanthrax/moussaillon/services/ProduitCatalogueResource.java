package net.nanthrax.moussaillon.services;

import io.quarkus.narayana.jta.runtime.TransactionConfiguration;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitMouvementEntity;
import net.nanthrax.moussaillon.persistence.ReferenceValeurEntity;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Path("/catalogue/produits")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProduitCatalogueResource {

    private static final String CATEGORIE_IMPORT_DEFAUT = "Non classé";

    @GET
    public List<ProduitCatalogueEntity> list() {
        return ProduitCatalogueEntity.listAll();
    }

    @GET
    @Path("/search")
    public List<ProduitCatalogueEntity> search(@QueryParam("q") String q) {
        if (q == null || q.trim().isEmpty()) {
            return ProduitCatalogueEntity.listAll();
        }
        String likePattern = "%" + q.toLowerCase() + "%";
        // Search in 'designation', 'categorie', 'ref', 'description', 'emplacement', 'emplacementMagasin'
        return ProduitCatalogueEntity.list(
            "LOWER(designation) LIKE ?1 OR LOWER(categorie) LIKE ?1 OR LOWER(ref) LIKE ?1 OR LOWER(description) LIKE ?1 OR LOWER(emplacement) LIKE ?1 OR LOWER(emplacementMagasin) LIKE ?1",
            likePattern
        );
    }

    @GET
    @Path("/fournisseurs")
    public List<FournisseurProduitEntity> listProduitsFournisseurs() {
        return FournisseurProduitEntity.listAll();
    }

    @GET
    @Path("/{id}/fournisseurs")
    public List<FournisseurProduitEntity> listFournisseurs(long id) {
        return FournisseurProduitEntity.list("produit.id = ?1", id);
    }

    @POST
    @Transactional
    public ProduitCatalogueEntity create(ProduitCatalogueEntity produit) {
        produit.persist();
        return produit;
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

        Map<String, Integer> headers = CsvUtils.indexHeaders(CsvUtils.parseLine(lines.get(0), ','));
        if (!headers.containsKey("Code article") || !headers.containsKey("Libellé")) {
            throw new WebApplicationException("Fichier CSV invalide : colonnes 'Code article'/'Libellé' manquantes", 400);
        }

        if (ReferenceValeurEntity.count("type = ?1 and valeur = ?2", "CATEGORIE_PRODUIT", CATEGORIE_IMPORT_DEFAUT) == 0) {
            ReferenceValeurEntity categorie = new ReferenceValeurEntity();
            categorie.type = "CATEGORIE_PRODUIT";
            categorie.valeur = CATEGORIE_IMPORT_DEFAUT;
            categorie.ordre = 999;
            categorie.persist();
        }

        // Evite les collisions avec la contrainte d'unicité sur 'designation' (EBP autorise les libellés
        // en double, ex. "VIS" x14) en désambiguïsant avec le code article, garanti unique.
        Set<String> designationsUtiliseesDansImport = new HashSet<>();

        for (int i = 1; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line.isBlank()) {
                continue;
            }
            result.total++;
            try {
                String[] cols = CsvUtils.parseLine(line, ',');
                String ref = CsvUtils.get(cols, headers, "Code article");
                String libelle = CsvUtils.get(cols, headers, "Libellé");
                if (ref == null || libelle == null) {
                    throw new IllegalArgumentException("Code article ou Libellé manquant");
                }
                // Le fichier exporte le libellé en majuscules (ex. EBP) : reformate en casse "Titre".
                libelle = CsvUtils.formatIfFullUpperCase(libelle);

                String statut = CsvUtils.get(cols, headers, "Statut");
                if (statut != null && !"Actif".equalsIgnoreCase(statut)) {
                    result.skipped++;
                    continue;
                }

                ProduitCatalogueEntity entity = ProduitCatalogueEntity.find("ref = ?1", ref).firstResult();
                boolean isNew = entity == null;
                if (isNew) {
                    entity = new ProduitCatalogueEntity();
                    entity.ref = ref;
                    entity.categorie = CATEGORIE_IMPORT_DEFAUT;
                }

                String designation = libelle;
                boolean conflit = designationsUtiliseesDansImport.contains(designation)
                        || ProduitCatalogueEntity.count("designation = ?1 and ref != ?2", designation, ref) > 0;
                if (conflit) {
                    designation = libelle + " (" + ref + ")";
                }
                designationsUtiliseesDansImport.add(designation);
                entity.designation = designation;

                double prixVenteHT = CsvUtils.parseFrenchDecimal(CsvUtils.get(cols, headers, "PV HT"));
                double prixVenteTTC = CsvUtils.parseFrenchDecimal(CsvUtils.get(cols, headers, "PV TTC"));
                entity.prixVenteHT = prixVenteHT;
                entity.prixVenteTTC = prixVenteTTC;
                if (prixVenteHT > 0) {
                    entity.montantTVA = Math.round((prixVenteTTC - prixVenteHT) * 100) / 100.0;
                    entity.tva = Math.round((prixVenteTTC / prixVenteHT - 1) * 100 * 100) / 100.0;
                } else {
                    entity.montantTVA = 0;
                    if (isNew) {
                        entity.tva = 20;
                    }
                }

                String stockReel = CsvUtils.get(cols, headers, "Stock réel");
                if (stockReel != null) {
                    entity.stock = (int) Math.round(CsvUtils.parseFrenchDecimal(stockReel));
                }

                String codeBarre = CsvUtils.get(cols, headers, "Code barre");
                if (codeBarre != null) {
                    if (entity.refs == null) {
                        entity.refs = new ArrayList<>();
                    }
                    if (!entity.refs.contains(codeBarre)) {
                        entity.refs.add(codeBarre);
                    }
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
    public ProduitCatalogueEntity get(long id) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }
        return entity;
    }

    @GET
    @Path("{id}/mouvements")
    public List<ProduitMouvementEntity> mouvements(@PathParam("id") long id) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }
        return ProduitMouvementEntity.list("produit.id = ?1 ORDER BY date DESC", id);
    }

    public static class StatistiquesProduit {
        public int quantiteVendue30j;
        public int quantiteVendue90j;
        public int quantiteVendueTotal;
        public double chiffreAffaires30j;
        public double chiffreAffaires90j;
        public double chiffreAffairesTotal;
    }

    @GET
    @Path("{id}/statistiques")
    public StatistiquesProduit statistiques(@PathParam("id") long id) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }

        List<ProduitMouvementEntity> ventes = ProduitMouvementEntity.list(
            "produit.id = ?1 AND type = ?2", id, ProduitMouvementEntity.Type.VENTE);

        long maintenant = System.currentTimeMillis();
        long jour = 24L * 60 * 60 * 1000;

        StatistiquesProduit stats = new StatistiquesProduit();
        for (ProduitMouvementEntity mouvement : ventes) {
            long age = mouvement.date != null ? maintenant - mouvement.date.getTime() : Long.MAX_VALUE;
            double montant = mouvement.quantite * entity.prixVenteTTC;

            stats.quantiteVendueTotal += mouvement.quantite;
            stats.chiffreAffairesTotal += montant;
            if (age <= 90 * jour) {
                stats.quantiteVendue90j += mouvement.quantite;
                stats.chiffreAffaires90j += montant;
            }
            if (age <= 30 * jour) {
                stats.quantiteVendue30j += mouvement.quantite;
                stats.chiffreAffaires30j += montant;
            }
        }
        return stats;
    }

    @DELETE
    @Path("{id}")
    @Transactional
    public Response delete(long id) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }
        entity.delete();
        return Response.status(204).build();
    }

    @PUT
    @Path("{id}")
    @Transactional
    public ProduitCatalogueEntity update(long id, ProduitCatalogueEntity produit) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.findById(id);
        if (entity == null) {
            throw new WebApplicationException("Le produit (" + id + ") n'est pas trouvé", 404);
        }

        entity.designation = produit.designation;
        entity.categorie = produit.categorie;
        entity.ref = produit.ref;
        entity.refs = produit.refs;
        entity.images = produit.images;
        entity.documents = produit.documents;
        entity.description = produit.description;
        entity.anneeDebut = produit.anneeDebut;
        entity.anneeFin = produit.anneeFin;
        entity.evaluation = produit.evaluation;
        if (produit.stock != entity.stock) {
            ProduitMouvementEntity mouvement = new ProduitMouvementEntity();
            mouvement.produit = entity;
            mouvement.type = ProduitMouvementEntity.Type.AJUSTEMENT_MANUEL;
            mouvement.quantite = produit.stock - entity.stock;
            mouvement.stockApres = produit.stock;
            mouvement.date = new Timestamp(System.currentTimeMillis());
            mouvement.persist();
        }
        entity.stock = produit.stock;
        entity.stockMini = produit.stockMini;
        entity.emplacement = produit.emplacement;
        entity.emplacementMagasin = produit.emplacementMagasin;
        entity.prixVenteHT = produit.prixVenteHT;
        entity.tva = produit.tva;
        entity.montantTVA = produit.montantTVA;
        entity.prixVenteTTC = produit.prixVenteTTC;

        return entity;
    }

}
