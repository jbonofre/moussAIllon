package net.nanthrax.moussaillon.services;

import io.quarkus.hibernate.orm.panache.Panache;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.FournisseurProduitEntity;
import net.nanthrax.moussaillon.persistence.HeliceCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.PackageLigneEntity;
import net.nanthrax.moussaillon.persistence.ProduitMouvementEntity;
import net.nanthrax.moussaillon.persistence.ReferenceValeurEntity;
import net.nanthrax.moussaillon.persistence.RemorqueCatalogueEntity;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Path("/catalogue/produits")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProduitCatalogueResource {

    private static final String CATEGORIE_IMPORT_DEFAUT = "Non classé";
    private static final String TYPE_IMPORT_DEFAUT = "Non classé";

    @Inject
    CatalogueTypeDetector typeDetector;

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
        if (ReferenceInterne.absente(produit.ref)) {
            produit.ref = ReferenceInterne.generer("PRD", produit.id);
        }
        return produit;
    }

    @POST
    @Path("/import")
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

        // Le classement par IA peut prendre du temps : il est fait avant d'ouvrir la transaction.
        Map<String, CatalogueTypeDetector.Type> typesConnus = typesParRef();
        Map<String, CatalogueTypeDetector.Detection> detections = detecterTypes(lines, headers, typesConnus, result);

        return QuarkusTransaction.requiringNew().timeout(300)
                .call(() -> importerLignes(lines, headers, typesConnus, detections, result));
    }

    private static class LigneImport {
        String ref;
        String designation;
        double prixVenteHT;
        double prixVenteTTC;
        double montantTVA;
        // null quand le fichier ne permet pas de le calculer (prix HT à zéro)
        Double tva;
        Long stock;
        String codeBarre;
    }

    // Code article -> référentiel dans lequel il est déjà enregistré
    private Map<String, CatalogueTypeDetector.Type> typesParRef() {
        Map<String, CatalogueTypeDetector.Type> types = new HashMap<>();
        ajouterRefs(types, "BateauCatalogueEntity", CatalogueTypeDetector.Type.BATEAU);
        ajouterRefs(types, "MoteurCatalogueEntity", CatalogueTypeDetector.Type.MOTEUR);
        ajouterRefs(types, "HeliceCatalogueEntity", CatalogueTypeDetector.Type.HELICE);
        ajouterRefs(types, "RemorqueCatalogueEntity", CatalogueTypeDetector.Type.REMORQUE);
        // en dernier : un code article déjà enregistré comme produit reste un produit
        ajouterRefs(types, "ProduitCatalogueEntity", CatalogueTypeDetector.Type.PRODUIT);
        return types;
    }

    private void ajouterRefs(Map<String, CatalogueTypeDetector.Type> types, String entity, CatalogueTypeDetector.Type type) {
        List<String> refs = Panache.getEntityManager()
                .createQuery("select e.ref from " + entity + " e where e.ref is not null", String.class)
                .getResultList();
        for (String ref : refs) {
            types.put(ref, type);
        }
    }

    // Seuls les codes article encore inconnus sont classés : une fiche existante garde son référentiel.
    private Map<String, CatalogueTypeDetector.Detection> detecterTypes(List<String> lines, Map<String, Integer> headers,
            Map<String, CatalogueTypeDetector.Type> typesConnus, ImportResult result) {
        Map<String, String> nouveaux = new LinkedHashMap<>();
        for (int i = 1; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line.isBlank()) {
                continue;
            }
            try {
                String[] cols = CsvUtils.parseLine(line, ',');
                String ref = CsvUtils.get(cols, headers, "Code article");
                String libelle = CsvUtils.get(cols, headers, "Libellé");
                String statut = CsvUtils.get(cols, headers, "Statut");
                if (ref == null || libelle == null || typesConnus.containsKey(ref)
                        || (statut != null && !"Actif".equalsIgnoreCase(statut))) {
                    continue;
                }
                nouveaux.putIfAbsent(ref, CsvUtils.formatIfFullUpperCase(libelle));
            } catch (Exception e) {
                // ligne illisible : signalée lors de l'import
            }
        }

        Map<String, CatalogueTypeDetector.Detection> detections = new HashMap<>();
        if (nouveaux.isEmpty()) {
            return detections;
        }
        CatalogueTypeDetector.Resultat resultat = typeDetector.detecter(
                new ArrayList<>(nouveaux.values()), valeursReference("TYPE_BATEAU"), valeursReference("TYPE_MOTEUR"));
        int index = 0;
        for (String ref : nouveaux.keySet()) {
            detections.put(ref, resultat.detections.get(index++));
        }
        result.detection = resultat.mode.name();
        return detections;
    }

    private List<String> valeursReference(String type) {
        List<ReferenceValeurEntity> references = ReferenceValeurEntity.list("type = ?1 order by ordre", type);
        List<String> valeurs = new ArrayList<>();
        for (ReferenceValeurEntity reference : references) {
            valeurs.add(reference.valeur);
        }
        return valeurs;
    }

    private void assurerValeurReference(String type, String valeur) {
        if (ReferenceValeurEntity.count("type = ?1 and valeur = ?2", type, valeur) == 0) {
            ReferenceValeurEntity reference = new ReferenceValeurEntity();
            reference.type = type;
            reference.valeur = valeur;
            reference.ordre = 999;
            reference.persist();
        }
    }

    private ImportResult importerLignes(List<String> lines, Map<String, Integer> headers,
            Map<String, CatalogueTypeDetector.Type> typesConnus, Map<String, CatalogueTypeDetector.Detection> detections,
            ImportResult result) {
        assurerValeurReference("CATEGORIE_PRODUIT", CATEGORIE_IMPORT_DEFAUT);

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

                String statut = CsvUtils.get(cols, headers, "Statut");
                if (statut != null && !"Actif".equalsIgnoreCase(statut)) {
                    result.skipped++;
                    continue;
                }

                LigneImport ligne = new LigneImport();
                ligne.ref = ref;
                // Le fichier exporte le libellé en majuscules (ex. EBP) : reformate en casse "Titre".
                ligne.designation = CsvUtils.formatIfFullUpperCase(libelle);
                ligne.prixVenteHT = CsvUtils.parseFrenchDecimal(CsvUtils.get(cols, headers, "PV HT"));
                ligne.prixVenteTTC = CsvUtils.parseFrenchDecimal(CsvUtils.get(cols, headers, "PV TTC"));
                if (ligne.prixVenteHT > 0) {
                    ligne.montantTVA = Math.round((ligne.prixVenteTTC - ligne.prixVenteHT) * 100) / 100.0;
                    ligne.tva = Math.round((ligne.prixVenteTTC / ligne.prixVenteHT - 1) * 100 * 100) / 100.0;
                }
                String stockReel = CsvUtils.get(cols, headers, "Stock réel");
                if (stockReel != null) {
                    ligne.stock = Math.round(CsvUtils.parseFrenchDecimal(stockReel));
                }
                ligne.codeBarre = CsvUtils.get(cols, headers, "Code barre");

                CatalogueTypeDetector.Detection detection = detections.get(ref);
                CatalogueTypeDetector.Type type = typesConnus.containsKey(ref) ? typesConnus.get(ref)
                        : detection != null ? detection.type : CatalogueTypeDetector.Type.PRODUIT;

                boolean isNew;
                switch (type) {
                    case BATEAU:
                        isNew = importerBateau(ligne, detection);
                        result.bateaux++;
                        break;
                    case MOTEUR:
                        isNew = importerMoteur(ligne, detection);
                        result.moteurs++;
                        break;
                    case HELICE:
                        isNew = importerHelice(ligne);
                        result.helices++;
                        break;
                    case REMORQUE:
                        isNew = importerRemorque(ligne);
                        result.remorques++;
                        break;
                    default:
                        isNew = importerProduit(ligne, designationsUtiliseesDansImport);
                }
                if (isNew) {
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

    private boolean importerProduit(LigneImport ligne, Set<String> designationsUtiliseesDansImport) {
        ProduitCatalogueEntity entity = ProduitCatalogueEntity.find("ref = ?1", ligne.ref).firstResult();
        boolean isNew = entity == null;
        if (isNew) {
            entity = new ProduitCatalogueEntity();
            entity.ref = ligne.ref;
            entity.categorie = CATEGORIE_IMPORT_DEFAUT;
        }

        String designation = ligne.designation;
        boolean conflit = designationsUtiliseesDansImport.contains(designation)
                || ProduitCatalogueEntity.count("designation = ?1 and ref != ?2", designation, ligne.ref) > 0;
        if (conflit) {
            designation = ligne.designation + " (" + ligne.ref + ")";
        }
        designationsUtiliseesDansImport.add(designation);
        entity.designation = designation;

        entity.prixVenteHT = ligne.prixVenteHT;
        entity.prixVenteTTC = ligne.prixVenteTTC;
        entity.montantTVA = ligne.montantTVA;
        if (ligne.tva != null) {
            entity.tva = ligne.tva;
        } else if (isNew) {
            entity.tva = 20;
        }
        if (ligne.stock != null) {
            entity.stock = ligne.stock.intValue();
        }
        if (ligne.codeBarre != null) {
            if (entity.refs == null) {
                entity.refs = new ArrayList<>();
            }
            if (!entity.refs.contains(ligne.codeBarre)) {
                entity.refs.add(ligne.codeBarre);
            }
        }

        if (isNew) {
            entity.persist();
        }
        return isNew;
    }

    // Type de bateau ou de moteur d'une fiche créée par l'import : celui proposé par la détection, sinon "Non classé"
    private String typeImport(String typeReference, CatalogueTypeDetector.Detection detection) {
        if (detection != null && detection.sousType != null) {
            return detection.sousType;
        }
        assurerValeurReference(typeReference, TYPE_IMPORT_DEFAUT);
        return TYPE_IMPORT_DEFAUT;
    }

    private boolean importerBateau(LigneImport ligne, CatalogueTypeDetector.Detection detection) {
        BateauCatalogueEntity entity = BateauCatalogueEntity.find("ref = ?1", ligne.ref).firstResult();
        boolean isNew = entity == null;
        if (isNew) {
            entity = new BateauCatalogueEntity();
            entity.ref = ligne.ref;
            entity.type = typeImport("TYPE_BATEAU", detection);
        }
        entity.designation = ligne.designation;
        entity.prixVenteHT = ligne.prixVenteHT;
        entity.prixVenteTTC = ligne.prixVenteTTC;
        entity.montantTVA = ligne.montantTVA;
        if (ligne.tva != null) {
            entity.tva = ligne.tva;
        } else if (isNew) {
            entity.tva = 20;
        }
        if (ligne.stock != null) {
            entity.stock = ligne.stock;
        }
        if (isNew) {
            entity.persist();
        }
        return isNew;
    }

    private boolean importerMoteur(LigneImport ligne, CatalogueTypeDetector.Detection detection) {
        MoteurCatalogueEntity entity = MoteurCatalogueEntity.find("ref = ?1", ligne.ref).firstResult();
        boolean isNew = entity == null;
        if (isNew) {
            entity = new MoteurCatalogueEntity();
            entity.ref = ligne.ref;
            entity.type = typeImport("TYPE_MOTEUR", detection);
        }
        entity.designation = ligne.designation;
        entity.prixVenteHT = ligne.prixVenteHT;
        entity.prixVenteTTC = ligne.prixVenteTTC;
        entity.montantTVA = ligne.montantTVA;
        if (ligne.tva != null) {
            entity.tva = ligne.tva;
        } else if (isNew) {
            entity.tva = 20;
        }
        if (ligne.stock != null) {
            entity.stock = ligne.stock;
        }
        if (isNew) {
            entity.persist();
        }
        return isNew;
    }

    // Les hélices ne sont pas gérées en stock
    private boolean importerHelice(LigneImport ligne) {
        HeliceCatalogueEntity entity = HeliceCatalogueEntity.find("ref = ?1", ligne.ref).firstResult();
        boolean isNew = entity == null;
        if (isNew) {
            entity = new HeliceCatalogueEntity();
            entity.ref = ligne.ref;
        }
        entity.designation = ligne.designation;
        entity.prixVenteHT = ligne.prixVenteHT;
        entity.prixVenteTTC = ligne.prixVenteTTC;
        entity.montantTVA = ligne.montantTVA;
        if (ligne.tva != null) {
            entity.tva = ligne.tva;
        } else if (isNew) {
            entity.tva = 20;
        }
        if (isNew) {
            entity.persist();
        }
        return isNew;
    }

    private boolean importerRemorque(LigneImport ligne) {
        RemorqueCatalogueEntity entity = RemorqueCatalogueEntity.find("ref = ?1", ligne.ref).firstResult();
        boolean isNew = entity == null;
        if (isNew) {
            entity = new RemorqueCatalogueEntity();
            entity.ref = ligne.ref;
        }
        entity.designation = ligne.designation;
        entity.prixVenteHT = ligne.prixVenteHT;
        entity.prixVenteTTC = ligne.prixVenteTTC;
        entity.montantTVA = ligne.montantTVA;
        if (ligne.tva != null) {
            entity.tva = ligne.tva;
        } else if (isNew) {
            entity.tva = 20;
        }
        if (ligne.stock != null) {
            entity.stock = ligne.stock;
        }
        if (isNew) {
            entity.persist();
        }
        return isNew;
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
        // Un package ne peut pas proposer un article retiré du catalogue : on retire les lignes concernées
        PackageLigneEntity.delete("produit.id = ?1", id);
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
