package net.nanthrax.moussaillon.services;

import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import net.nanthrax.moussaillon.persistence.BateauClientEntity;
import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.MoteurClientEntity;
import net.nanthrax.moussaillon.persistence.ProduitCatalogueEntity;
import net.nanthrax.moussaillon.persistence.RemorqueClientEntity;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Import en masse (issue #433) : un classeur Excel (.xlsx) avec un onglet par type
 * ("Clients", "Produits", "Bateaux", "Moteurs", "Remorques"), ou un fichier CSV
 * contenant un seul type (précisé via le champ "type" du formulaire).
 *
 * Les bateaux/moteurs/remorques sont rattachés à un client via une colonne
 * "clientEmail", résolue sur les clients déjà en base ou fraîchement importés
 * dans le même fichier (l'onglet Clients est toujours traité en premier).
 */
@Path("/import")
public class ImportResource {

    private enum ImportType {
        CLIENTS, PRODUITS, BATEAUX, MOTEURS, REMORQUES
    }

    public static class RowError {
        public int ligne;
        public String message;

        public RowError(int ligne, String message) {
            this.ligne = ligne;
            this.message = message;
        }
    }

    public static class SheetReport {
        public String type;
        public int crees;
        public int misAJour;
        public List<RowError> erreurs = new ArrayList<>();

        public SheetReport(String type) {
            this.type = type;
        }
    }

    public static class ImportReport {
        public List<SheetReport> onglets = new ArrayList<>();
    }

    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    @Transactional
    public ImportReport importFile(@RestForm("file") FileUpload file, @RestForm("type") String typeParam) throws IOException {
        if (file == null) {
            throw new BadRequestException("Aucun fichier fourni");
        }

        String filename = file.fileName() != null ? file.fileName().toLowerCase(Locale.ROOT) : "";
        Map<ImportType, List<Map<String, String>>> rowsByType = new LinkedHashMap<>();

        if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
            try (Workbook workbook = WorkbookFactory.create(Files.newInputStream(file.uploadedFile()))) {
                for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                    Sheet sheet = workbook.getSheetAt(i);
                    ImportType type = resolveType(sheet.getSheetName());
                    if (type == null) {
                        continue;
                    }
                    rowsByType.put(type, readSheet(sheet));
                }
            }
        } else if (filename.endsWith(".csv")) {
            ImportType type = resolveType(typeParam);
            if (type == null) {
                throw new BadRequestException("Le type de données (clients, produits, bateaux, moteurs, remorques) est requis pour un import CSV");
            }
            try (Reader reader = new InputStreamReader(Files.newInputStream(file.uploadedFile()), StandardCharsets.UTF_8)) {
                rowsByType.put(type, readCsv(reader));
            }
        } else {
            throw new BadRequestException("Format de fichier non supporté (attendu : .xlsx ou .csv)");
        }

        // Les clients et les produits doivent être résolus avant les équipements qui les référencent.
        Map<String, ClientEntity> clientsByEmail = loadExistingClientsByEmail();
        Map<String, ProduitCatalogueEntity> produitsByNom = loadExistingProduitsByNom();

        ImportReport report = new ImportReport();
        List<ImportType> ordre = List.of(ImportType.CLIENTS, ImportType.PRODUITS, ImportType.BATEAUX, ImportType.MOTEURS, ImportType.REMORQUES);
        for (ImportType type : ordre) {
            List<Map<String, String>> rows = rowsByType.get(type);
            if (rows == null) {
                continue;
            }
            report.onglets.add(switch (type) {
                case CLIENTS -> importClients(rows, clientsByEmail);
                case PRODUITS -> importProduits(rows, produitsByNom);
                case BATEAUX -> importBateaux(rows, clientsByEmail);
                case MOTEURS -> importMoteurs(rows, clientsByEmail);
                case REMORQUES -> importRemorques(rows, clientsByEmail);
            });
        }

        return report;
    }

    // ---------------------------------------------------------------------
    // Import par type
    // ---------------------------------------------------------------------

    private SheetReport importClients(List<Map<String, String>> rows, Map<String, ClientEntity> clientsByEmail) {
        SheetReport sheetReport = new SheetReport("Clients");
        int ligne = 1;
        for (Map<String, String> row : rows) {
            ligne++;
            String nom = value(row, "nom");
            if (isBlank(nom)) {
                sheetReport.erreurs.add(new RowError(ligne, "Le nom est requis"));
                continue;
            }
            String email = value(row, "email");
            String emailKey = normalizeKey(email);

            ClientEntity client = emailKey != null ? clientsByEmail.get(emailKey) : null;
            boolean isNew = client == null;
            if (isNew) {
                client = new ClientEntity();
            }

            client.nom = nom;
            client.prenom = orKeepExisting(value(row, "prenom"), isNew ? null : client.prenom);
            client.type = resolveClientType(value(row, "type"), isNew ? "PARTICULIER" : client.type);
            if (!isBlank(email)) {
                client.email = email;
            }
            client.telephone = orKeepExisting(value(row, "telephone"), isNew ? null : client.telephone);
            client.adresse = orKeepExisting(value(row, "adresse"), isNew ? null : client.adresse);
            client.canalAcquisition = orKeepExisting(resolveCanalAcquisition(value(row, "canalAcquisition")), isNew ? null : client.canalAcquisition);
            client.notes = orKeepExisting(value(row, "notes"), isNew ? null : client.notes);
            String consentement = value(row, "consentement");
            if (!isBlank(consentement)) {
                client.consentement = parseBoolean(consentement);
            }

            if (isNew) {
                client.dateCreation = new Timestamp(System.currentTimeMillis());
                client.persist();
                sheetReport.crees++;
            } else {
                sheetReport.misAJour++;
            }
            if (emailKey != null) {
                clientsByEmail.put(emailKey, client);
            }
        }
        return sheetReport;
    }

    private SheetReport importProduits(List<Map<String, String>> rows, Map<String, ProduitCatalogueEntity> produitsByNom) {
        SheetReport sheetReport = new SheetReport("Produits");
        int ligne = 1;
        for (Map<String, String> row : rows) {
            ligne++;
            String nom = value(row, "nom");
            String categorie = value(row, "categorie");
            if (isBlank(nom) || isBlank(categorie)) {
                sheetReport.erreurs.add(new RowError(ligne, "Le nom et la catégorie sont requis"));
                continue;
            }

            String key = normalizeKey(nom);
            ProduitCatalogueEntity produit = produitsByNom.get(key);
            boolean isNew = produit == null;
            if (isNew) {
                produit = new ProduitCatalogueEntity();
                produit.nom = nom;
            }

            produit.marque = orKeepExisting(value(row, "marque"), isNew ? null : produit.marque);
            produit.categorie = categorie;
            produit.ref = orKeepExisting(value(row, "ref"), isNew ? null : produit.ref);
            produit.description = orKeepExisting(value(row, "description"), isNew ? null : produit.description);
            produit.emplacement = orKeepExisting(value(row, "emplacement"), isNew ? null : produit.emplacement);

            Integer stock = parseInt(value(row, "stock"));
            if (stock != null) {
                produit.stock = stock;
            }
            Integer stockMini = parseInt(value(row, "stockMini"));
            if (stockMini != null) {
                produit.stockMini = stockMini;
            }

            Double prixVenteHT = parseDouble(value(row, "prixVenteHT"));
            Double tva = parseDouble(value(row, "tva"));
            if (prixVenteHT != null) {
                produit.prixVenteHT = prixVenteHT;
            }
            if (tva != null) {
                produit.tva = tva;
            }
            if (prixVenteHT != null || tva != null) {
                produit.montantTVA = round2(produit.prixVenteHT * (produit.tva / 100));
                produit.prixVenteTTC = round2(produit.prixVenteHT + produit.montantTVA);
            }

            if (isNew) {
                produit.persist();
                sheetReport.crees++;
            } else {
                sheetReport.misAJour++;
            }
            produitsByNom.put(key, produit);
        }
        return sheetReport;
    }

    private SheetReport importBateaux(List<Map<String, String>> rows, Map<String, ClientEntity> clientsByEmail) {
        SheetReport sheetReport = new SheetReport("Bateaux");
        int ligne = 1;
        for (Map<String, String> row : rows) {
            ligne++;
            String name = value(row, "name");
            if (isBlank(name)) {
                sheetReport.erreurs.add(new RowError(ligne, "Le nom du bateau est requis"));
                continue;
            }
            ClientEntity proprietaire = resolveClient(row, clientsByEmail);
            if (proprietaire == null) {
                sheetReport.erreurs.add(new RowError(ligne, "Client introuvable pour l'email '" + value(row, "clientEmail") + "'"));
                continue;
            }

            BateauClientEntity bateau = new BateauClientEntity();
            bateau.name = name;
            bateau.immatriculation = value(row, "immatriculation");
            bateau.numeroSerie = value(row, "numeroSerie");
            bateau.numeroClef = value(row, "numeroClef");
            bateau.dateMeS = value(row, "dateMeS");
            bateau.dateAchat = value(row, "dateAchat");
            bateau.localisation = value(row, "localisation");
            bateau.proprietaires.add(proprietaire);
            bateau.dateCreation = new Timestamp(System.currentTimeMillis());
            bateau.persist();
            sheetReport.crees++;
        }
        return sheetReport;
    }

    private SheetReport importMoteurs(List<Map<String, String>> rows, Map<String, ClientEntity> clientsByEmail) {
        SheetReport sheetReport = new SheetReport("Moteurs");
        int ligne = 1;
        for (Map<String, String> row : rows) {
            ligne++;
            ClientEntity proprietaire = resolveClient(row, clientsByEmail);
            if (proprietaire == null) {
                sheetReport.erreurs.add(new RowError(ligne, "Client introuvable pour l'email '" + value(row, "clientEmail") + "'"));
                continue;
            }

            MoteurClientEntity moteur = new MoteurClientEntity();
            moteur.numeroSerie = value(row, "numeroSerie");
            moteur.numeroClef = value(row, "numeroClef");
            moteur.dateMeS = value(row, "dateMeS");
            moteur.dateAchat = value(row, "dateAchat");
            moteur.proprietaire = proprietaire;
            moteur.dateCreation = new Timestamp(System.currentTimeMillis());
            moteur.persist();
            sheetReport.crees++;
        }
        return sheetReport;
    }

    private SheetReport importRemorques(List<Map<String, String>> rows, Map<String, ClientEntity> clientsByEmail) {
        SheetReport sheetReport = new SheetReport("Remorques");
        int ligne = 1;
        for (Map<String, String> row : rows) {
            ligne++;
            ClientEntity proprietaire = resolveClient(row, clientsByEmail);
            if (proprietaire == null) {
                sheetReport.erreurs.add(new RowError(ligne, "Client introuvable pour l'email '" + value(row, "clientEmail") + "'"));
                continue;
            }

            RemorqueClientEntity remorque = new RemorqueClientEntity();
            remorque.immatriculation = value(row, "immatriculation");
            remorque.dateMeS = value(row, "dateMeS");
            remorque.dateAchat = value(row, "dateAchat");
            remorque.proprietaire = proprietaire;
            remorque.dateCreation = new Timestamp(System.currentTimeMillis());
            remorque.persist();
            sheetReport.crees++;
        }
        return sheetReport;
    }

    private ClientEntity resolveClient(Map<String, String> row, Map<String, ClientEntity> clientsByEmail) {
        String key = normalizeKey(value(row, "clientEmail"));
        return key != null ? clientsByEmail.get(key) : null;
    }

    // ---------------------------------------------------------------------
    // Chargement de l'état existant pour la déduplication
    // ---------------------------------------------------------------------

    private Map<String, ClientEntity> loadExistingClientsByEmail() {
        Map<String, ClientEntity> byEmail = new HashMap<>();
        for (ClientEntity client : ClientEntity.<ClientEntity>list("email is not null and email <> ''")) {
            byEmail.put(normalizeKey(client.email), client);
        }
        return byEmail;
    }

    private Map<String, ProduitCatalogueEntity> loadExistingProduitsByNom() {
        Map<String, ProduitCatalogueEntity> byNom = new HashMap<>();
        for (ProduitCatalogueEntity produit : ProduitCatalogueEntity.<ProduitCatalogueEntity>listAll()) {
            byNom.put(normalizeKey(produit.nom), produit);
        }
        return byNom;
    }

    // ---------------------------------------------------------------------
    // Lecture des fichiers
    // ---------------------------------------------------------------------

    private List<Map<String, String>> readSheet(Sheet sheet) {
        List<Map<String, String>> rows = new ArrayList<>();
        Row headerRow = sheet.getRow(sheet.getFirstRowNum());
        if (headerRow == null) {
            return rows;
        }
        Map<Integer, String> headers = new LinkedHashMap<>();
        for (Cell cell : headerRow) {
            String header = normalizeHeader(cellValueAsString(cell));
            if (!header.isEmpty()) {
                headers.put(cell.getColumnIndex(), header);
            }
        }

        for (int r = sheet.getFirstRowNum() + 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) {
                continue;
            }
            Map<String, String> values = new HashMap<>();
            boolean hasContent = false;
            for (Map.Entry<Integer, String> entry : headers.entrySet()) {
                Cell cell = row.getCell(entry.getKey());
                String cellValue = cellValueAsString(cell);
                if (!isBlank(cellValue)) {
                    hasContent = true;
                }
                values.put(entry.getValue(), cellValue);
            }
            if (hasContent) {
                rows.add(values);
            }
        }
        return rows;
    }

    private List<Map<String, String>> readCsv(Reader reader) throws IOException {
        List<Map<String, String>> rows = new ArrayList<>();
        CSVFormat format = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).build();
        try (CSVParser parser = format.parse(reader)) {
            Map<String, Integer> headerMap = parser.getHeaderMap();
            Map<Integer, String> normalizedHeaders = new LinkedHashMap<>();
            for (Map.Entry<String, Integer> entry : headerMap.entrySet()) {
                normalizedHeaders.put(entry.getValue(), normalizeHeader(entry.getKey()));
            }
            for (CSVRecord record : parser) {
                Map<String, String> values = new HashMap<>();
                boolean hasContent = false;
                for (Map.Entry<Integer, String> entry : normalizedHeaders.entrySet()) {
                    String cellValue = entry.getKey() < record.size() ? record.get(entry.getKey()) : "";
                    if (!isBlank(cellValue)) {
                        hasContent = true;
                    }
                    values.put(entry.getValue(), cellValue);
                }
                if (hasContent) {
                    rows.add(values);
                }
            }
        }
        return rows;
    }

    private String cellValueAsString(Cell cell) {
        if (cell == null) {
            return "";
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case NUMERIC -> {
                double num = cell.getNumericCellValue();
                yield num == Math.floor(num) && !Double.isInfinite(num) ? String.valueOf((long) num) : String.valueOf(num);
            }
            case FORMULA -> cellValueAsFormulaResult(cell);
            case BLANK -> "";
            default -> "";
        };
    }

    private String cellValueAsFormulaResult(Cell cell) {
        try {
            return switch (cell.getCachedFormulaResultType()) {
                case STRING -> cell.getStringCellValue().trim();
                case NUMERIC -> String.valueOf(cell.getNumericCellValue());
                case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
                default -> "";
            };
        } catch (Exception e) {
            return "";
        }
    }

    // ---------------------------------------------------------------------
    // Utilitaires
    // ---------------------------------------------------------------------

    private static final Map<String, ImportType> TYPE_ALIASES = new HashMap<>();
    static {
        for (String alias : Set.of("clients", "client")) TYPE_ALIASES.put(alias, ImportType.CLIENTS);
        for (String alias : Set.of("produits", "produit", "products", "product")) TYPE_ALIASES.put(alias, ImportType.PRODUITS);
        for (String alias : Set.of("bateaux", "bateau", "boats", "boat")) TYPE_ALIASES.put(alias, ImportType.BATEAUX);
        for (String alias : Set.of("moteurs", "moteur", "engines", "engine")) TYPE_ALIASES.put(alias, ImportType.MOTEURS);
        for (String alias : Set.of("remorques", "remorque", "trailers", "trailer")) TYPE_ALIASES.put(alias, ImportType.REMORQUES);
    }

    private ImportType resolveType(String label) {
        if (isBlank(label)) {
            return null;
        }
        return TYPE_ALIASES.get(normalizeHeader(label));
    }

    private static final Map<String, Set<String>> HEADER_ALIASES = new HashMap<>();
    static {
        HEADER_ALIASES.put("prenom", normalizedAliases("prenom", "prénom", "firstname"));
        HEADER_ALIASES.put("nom", normalizedAliases("nom", "lastname", "name"));
        HEADER_ALIASES.put("name", normalizedAliases("nom", "name"));
        HEADER_ALIASES.put("type", normalizedAliases("type"));
        HEADER_ALIASES.put("email", normalizedAliases("email", "mail", "courriel"));
        HEADER_ALIASES.put("telephone", normalizedAliases("telephone", "téléphone", "tel", "phone"));
        HEADER_ALIASES.put("adresse", normalizedAliases("adresse", "address", "ville"));
        HEADER_ALIASES.put("consentement", normalizedAliases("consentement", "consent", "rgpd"));
        HEADER_ALIASES.put("canalAcquisition", normalizedAliases("canal acquisition", "canal d'acquisition", "canal", "source"));
        HEADER_ALIASES.put("notes", normalizedAliases("notes", "note", "commentaire", "commentaires"));
        HEADER_ALIASES.put("marque", normalizedAliases("marque", "brand"));
        HEADER_ALIASES.put("categorie", normalizedAliases("categorie", "catégorie", "category"));
        HEADER_ALIASES.put("ref", normalizedAliases("ref", "référence", "reference", "sku"));
        HEADER_ALIASES.put("description", normalizedAliases("description", "desc"));
        HEADER_ALIASES.put("stock", normalizedAliases("stock", "quantite", "quantité", "qty"));
        HEADER_ALIASES.put("stockMini", normalizedAliases("stock mini", "stock minimum", "stockmin"));
        HEADER_ALIASES.put("emplacement", normalizedAliases("emplacement", "location"));
        HEADER_ALIASES.put("prixVenteHT", normalizedAliases("prix vente ht", "prix ht", "prix vente", "prix", "pu ht"));
        HEADER_ALIASES.put("tva", normalizedAliases("tva", "vat"));
        HEADER_ALIASES.put("immatriculation", normalizedAliases("immatriculation", "immat"));
        HEADER_ALIASES.put("numeroSerie", normalizedAliases("numero serie", "numéro de série", "num serie", "serial number"));
        HEADER_ALIASES.put("numeroClef", normalizedAliases("numero clef", "numéro de clef", "clef", "clé", "cle"));
        HEADER_ALIASES.put("dateMeS", normalizedAliases("date mes", "date de mise en service", "mes"));
        HEADER_ALIASES.put("dateAchat", normalizedAliases("date achat", "date d'achat", "achat"));
        HEADER_ALIASES.put("localisation", normalizedAliases("localisation", "location"));
        HEADER_ALIASES.put("clientEmail", normalizedAliases("client email", "email client", "email", "proprietaire email"));
    }

    private static Set<String> normalizedAliases(String... raw) {
        Set<String> normalized = new java.util.HashSet<>();
        for (String r : raw) {
            normalized.add(normalizeHeader(r));
        }
        return normalized;
    }

    /**
     * L'en-tête brute est normalisée à la lecture du fichier ; ce qu'on stocke dans
     * chaque ligne est donc déjà la forme normalisée. On construit ici l'inverse
     * (alias normalisé -> nom de champ canonique) pour retrouver une valeur.
     */
    private String value(Map<String, String> row, String canonicalField) {
        Set<String> aliases = HEADER_ALIASES.get(canonicalField);
        if (aliases == null) {
            return row.get(normalizeHeader(canonicalField));
        }
        for (String alias : aliases) {
            String v = row.get(alias);
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    private static String normalizeHeader(String header) {
        if (header == null) {
            return "";
        }
        return Normalizer.normalize(header.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-z0-9]", "");
    }

    private String normalizeKey(String s) {
        if (isBlank(s)) {
            return null;
        }
        return s.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String orKeepExisting(String newValue, String existing) {
        return isBlank(newValue) ? existing : newValue;
    }

    private String resolveClientType(String value, String fallback) {
        if (isBlank(value)) {
            return fallback;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        return switch (normalized) {
            case "PARTICULIER", "PROFESSIONNEL", "PROFESSIONNEL_MER" -> normalized;
            default -> fallback;
        };
    }

    /**
     * La vue Clients (chantier-ui) n'affiche que les codes canaux connus
     * (BOUCHE_A_OREILLE, FACEBOOK, ...). On accepte en entrée aussi bien le
     * code que le libellé français affiché dans le sélecteur.
     */
    private static final Map<String, String> CANAL_ACQUISITION_ALIASES = new HashMap<>();
    static {
        CANAL_ACQUISITION_ALIASES.put(normalizeHeader("Bouche à oreille"), "BOUCHE_A_OREILLE");
        CANAL_ACQUISITION_ALIASES.put(normalizeHeader("Facebook"), "FACEBOOK");
        CANAL_ACQUISITION_ALIASES.put(normalizeHeader("Instagram"), "INSTAGRAM");
        CANAL_ACQUISITION_ALIASES.put(normalizeHeader("LinkedIn"), "LINKEDIN");
        CANAL_ACQUISITION_ALIASES.put(normalizeHeader("Passage"), "PASSAGE");
        CANAL_ACQUISITION_ALIASES.put(normalizeHeader("Site Internet"), "SITE_INTERNET");
        CANAL_ACQUISITION_ALIASES.put(normalizeHeader("Pages Jaunes"), "PAGES_JAUNES");
    }

    private String resolveCanalAcquisition(String value) {
        if (isBlank(value)) {
            return null;
        }
        String code = CANAL_ACQUISITION_ALIASES.get(normalizeHeader(value));
        return code != null ? code : value.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private boolean parseBoolean(String value) {
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("true") || normalized.equals("1") || normalized.equals("oui") || normalized.equals("yes");
    }

    private Integer parseInt(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return (int) Double.parseDouble(value.trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Double parseDouble(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return Double.parseDouble(value.trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private double round2(double value) {
        return Math.round((value + 1e-9) * 100) / 100.0;
    }
}
