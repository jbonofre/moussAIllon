package net.nanthrax.moussaillon.services;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;

/**
 * Reconnaît, à partir de sa désignation, si une ligne importée est un bateau, un moteur, une hélice
 * ou une remorque plutôt qu'un produit.
 *
 * La détection passe par l'API Anthropic quand elle est configurée, avec repli sur des règles par
 * mots-clés (clé absente, détection désactivée, lot en erreur ou hors délai).
 */
@ApplicationScoped
public class CatalogueTypeDetector {

    private static final Logger LOG = Logger.getLogger(CatalogueTypeDetector.class);

    public enum Type { PRODUIT, BATEAU, MOTEUR, HELICE, REMORQUE }

    public enum Mode {
        /** IA non configurée ou désactivée : règles par mots-clés. */
        REGLES,
        /** Toutes les désignations ont été classées par l'IA. */
        IA,
        /** Une partie des lots a échoué : ces lignes sont classées par les règles. */
        IA_PARTIELLE,
        /** Tous les appels à l'IA ont échoué : règles par mots-clés. */
        IA_ECHEC
    }

    public static class Detection {
        public final Type type;
        /** Type de bateau ou de moteur proposé parmi les valeurs de référence, null si inconnu. */
        public final String sousType;

        Detection(Type type, String sousType) {
            this.type = type;
            this.sousType = sousType;
        }
    }

    public static class Resultat {
        /** Une détection par désignation, dans l'ordre reçu. */
        public final List<Detection> detections;
        public final Mode mode;

        Resultat(List<Detection> detections, Mode mode) {
            this.detections = detections;
            this.mode = mode;
        }
    }

    static final int TAILLE_LOT = 100;
    private static final int LOTS_EN_PARALLELE = 4;
    // Au-delà, les lots restants sont classés par les règles : l'import ne doit pas dépasser le délai du proxy HTTP
    static final int DELAI_MAX_SECONDES = 45;
    private static final int TENTATIVES = 3;
    private static final int ATTENTE_MAX_SECONDES = 15;

    @ConfigProperty(name = "ai.anthropic.api-key", defaultValue = "")
    String anthropicApiKey;

    @ConfigProperty(name = "ai.anthropic.model", defaultValue = "claude-haiku-4-5-20251001")
    String anthropicModel;

    @ConfigProperty(name = "ai.anthropic.base-url", defaultValue = "https://api.anthropic.com")
    String anthropicBaseUrl;

    @ConfigProperty(name = "ai.anthropic.import-detection.enabled", defaultValue = "true")
    boolean iaActivee;

    private final Jsonb jsonb = JsonbBuilder.create();

    public Resultat detecter(List<String> designations, List<String> typesBateau, List<String> typesMoteur) {
        List<Detection> detections = new ArrayList<>();
        for (String designation : designations) {
            detections.add(new Detection(detecterParRegles(designation), null));
        }
        if (designations.isEmpty() || !iaDisponible()) {
            return new Resultat(detections, Mode.REGLES);
        }

        List<Callable<List<Detection>>> lots = new ArrayList<>();
        for (int debut = 0; debut < designations.size(); debut += TAILLE_LOT) {
            List<String> lot = designations.subList(debut, Math.min(debut + TAILLE_LOT, designations.size()));
            lots.add(() -> classerLot(lot, typesBateau, typesMoteur));
        }

        int echecs = 0;
        ExecutorService executor = Executors.newFixedThreadPool(Math.min(lots.size(), LOTS_EN_PARALLELE));
        try {
            List<Future<List<Detection>>> futures = executor.invokeAll(lots, DELAI_MAX_SECONDES, TimeUnit.SECONDS);
            for (int lot = 0; lot < futures.size(); lot++) {
                try {
                    List<Detection> classees = futures.get(lot).get();
                    for (int i = 0; i < classees.size(); i++) {
                        detections.set(lot * TAILLE_LOT + i, classees.get(i));
                    }
                } catch (CancellationException | ExecutionException e) {
                    echecs++;
                    Throwable cause = e.getCause() != null ? e.getCause() : e;
                    LOG.warnf("Détection IA du lot %d en échec, repli sur les règles : %s", Integer.valueOf(lot), cause.toString());
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            echecs = lots.size();
        } finally {
            executor.shutdownNow();
        }

        Mode mode = echecs == 0 ? Mode.IA : echecs == lots.size() ? Mode.IA_ECHEC : Mode.IA_PARTIELLE;
        return new Resultat(detections, mode);
    }

    private boolean iaDisponible() {
        String key = anthropicApiKey == null ? "" : anthropicApiKey.trim();
        return iaActivee && !key.isEmpty() && !"not-set".equals(key);
    }

    // --- Règles par mots-clés ---

    // Pièces, accessoires et consommables : jamais un bateau, un moteur, une hélice ou une remorque complets
    private static final Pattern PIECE = Pattern.compile("\\b(huile|graisse|filtre|kit|anode|pompe|joint|bougie|cable|housse|bache|taud"
            + "|courroie|turbine|thermostat|piece|vis|ecrou|clavette|moyeu|roue|pneu|feu|treuil|sangle|antifouling|peinture|colle"
            + "|batterie|chargeur|support|capot|carter|embase|durite|collier|reservoir|nourrice|commande|faisceau|adaptateur|cle"
            + "|rondelle|goupille|axe|roulement|timon|attelage|antivol)\\b");
    private static final Pattern MARQUE_MOTEUR = Pattern.compile("\\b(mercury|mariner|yamaha|suzuki|honda|tohatsu|evinrude|johnson|selva"
            + "|mercruiser|yanmar|nanni|torqeedo|epropulsion|volvo penta)\\b");
    private static final Pattern PUISSANCE = Pattern.compile("\\b\\d{1,3}([.,]\\d)?\\s?(cv|ch|hp)\\b");
    // F115, DF140A, BF50, MFS20...
    private static final Pattern MODELE_MOTEUR = Pattern.compile("\\b(f|df|bf|mfs|ft|fl)\\d{1,3}[a-z]{0,5}\\b");
    private static final Pattern MOT_MOTEUR = Pattern.compile("^moteur\\b|\\bhors[- ]bord\\b|\\bin[- ]?bord\\b|\\binboard\\b");
    private static final Pattern MARQUE_BATEAU = Pattern.compile("\\b(quicksilver|jeanneau|beneteau|zodiac|bombard|bayliner|sea ray"
            + "|pacific craft|b2 marine|ocqueteau|rhea|capelli|highfield|3d tender|bwa|lomac|ranieri|karnic|salpa|sessa|white shark"
            + "|guymarine|rigiflex|fun yak|nuova jolly|joker boat)\\b");
    // Longueur ou numéro de modèle : 605, 6.5...
    private static final Pattern MODELE_BATEAU = Pattern.compile("\\b\\d{3,4}\\b|\\b\\d{1,2}[.,]\\d{1,2}\\b");
    private static final Pattern MOT_BATEAU = Pattern.compile("^(bateau|semi[- ]rigide|voilier)\\b");

    static Type detecterParRegles(String designation) {
        if (designation == null) {
            return Type.PRODUIT;
        }
        String d = Normalizer.normalize(designation, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
        if (PIECE.matcher(d).find()) {
            return Type.PRODUIT;
        }
        if (d.startsWith("remorque")) {
            return Type.REMORQUE;
        }
        if (d.startsWith("helice")) {
            return Type.HELICE;
        }
        boolean marqueMoteur = MARQUE_MOTEUR.matcher(d).find();
        boolean puissance = PUISSANCE.matcher(d).find();
        if ((marqueMoteur && (puissance || MODELE_MOTEUR.matcher(d).find()))
                || (MOT_MOTEUR.matcher(d).find() && (marqueMoteur || puissance))) {
            return Type.MOTEUR;
        }
        if (MOT_BATEAU.matcher(d).find() || (MARQUE_BATEAU.matcher(d).find() && MODELE_BATEAU.matcher(d).find())) {
            return Type.BATEAU;
        }
        return Type.PRODUIT;
    }

    // --- Classement par l'IA ---

    private List<Detection> classerLot(List<String> designations, List<String> typesBateau, List<String> typesMoteur)
            throws IOException, InterruptedException {
        Map<String, Object> userMessage = new LinkedHashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", buildPrompt(designations, typesBateau, typesMoteur));

        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(userMessage);

        Map<String, Object> format = new LinkedHashMap<>();
        format.put("type", "json_schema");
        format.put("schema", buildSchema());
        Map<String, Object> outputConfig = new LinkedHashMap<>();
        outputConfig.put("format", format);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", anthropicModel);
        payload.put("max_tokens", Integer.valueOf(16000));
        payload.put("system", "Tu es un expert en produits nautiques. Tu classes les articles du catalogue d'un chantier naval.");
        payload.put("messages", messages);
        payload.put("output_config", outputConfig);

        Map<String, Object> response = fromJsonMap(callAnthropicApi(payload));
        Object stopReason = response.get("stop_reason");
        if ("refusal".equals(stopReason) || "max_tokens".equals(stopReason)) {
            throw new IOException("Réponse Anthropic inexploitable [stop_reason=" + stopReason + "]");
        }
        return lireReponse(fromJsonMap(extractAnswer(response)), designations.size(), typesBateau, typesMoteur);
    }

    private String buildPrompt(List<String> designations, List<String> typesBateau, List<String> typesMoteur) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Voici des désignations d'articles exportées du logiciel de gestion d'un chantier naval, numérotées à partir de 0.\n")
                .append("Repère celles qui désignent :\n")
                .append("- \"bateau\" : un bateau complet, vendu comme modèle (ex. \"Quicksilver Open Activ 605\", \"Jeanneau Cap Camarat 6.5 WA\")\n")
                .append("- \"moteur\" : un moteur de bateau complet, hors-bord ou in-bord (ex. \"Mercury F115 EFI\")\n")
                .append("- \"helice\" : une hélice de moteur de bateau\n")
                .append("- \"remorque\" : une remorque porte-bateau complète\n")
                .append("Tout le reste est un article courant : pièce détachée, accessoire, consommable, équipement ou prestation, ")
                .append("y compris quand il est destiné à un bateau, un moteur, une hélice ou une remorque. ")
                .append("Dans le doute, considère qu'il s'agit d'un article courant.\n\n")
                .append("Réponds avec la liste \"elements\" des seules désignations qui ne sont pas des articles courants : ")
                .append("\"i\" est le numéro de la désignation et \"type\" sa famille. ")
                .append("Pour un bateau, \"sousType\" est l'une de ces valeurs : ").append(jsonb.toJson(typesBateau)).append(". ")
                .append("Pour un moteur, l'une de celles-ci : ").append(jsonb.toJson(typesMoteur)).append(". ")
                .append("Mets null si aucune ne convient, et pour les hélices et les remorques.\n\n")
                .append("Désignations :\n");
        for (int i = 0; i < designations.size(); i++) {
            prompt.append(i).append(". ").append(designations.get(i)).append('\n');
        }
        return prompt.toString();
    }

    private Map<String, Object> buildSchema() {
        Map<String, Object> index = new LinkedHashMap<>();
        index.put("type", "integer");

        Map<String, Object> type = new LinkedHashMap<>();
        type.put("type", "string");
        type.put("enum", List.of("bateau", "moteur", "helice", "remorque"));

        Map<String, Object> sousType = new LinkedHashMap<>();
        sousType.put("anyOf", List.of(Map.of("type", "string"), Map.of("type", "null")));

        Map<String, Object> elementProperties = new LinkedHashMap<>();
        elementProperties.put("i", index);
        elementProperties.put("type", type);
        elementProperties.put("sousType", sousType);

        Map<String, Object> element = new LinkedHashMap<>();
        element.put("type", "object");
        element.put("properties", elementProperties);
        element.put("required", List.of("i", "type", "sousType"));
        element.put("additionalProperties", Boolean.FALSE);

        Map<String, Object> elements = new LinkedHashMap<>();
        elements.put("type", "array");
        elements.put("items", element);

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", Map.of("elements", elements));
        schema.put("required", List.of("elements"));
        schema.put("additionalProperties", Boolean.FALSE);
        return schema;
    }

    /** Les désignations absentes de la réponse sont des produits. */
    static List<Detection> lireReponse(Map<String, Object> reponse, int taille, List<String> typesBateau, List<String> typesMoteur)
            throws IOException {
        Object elements = reponse.get("elements");
        if (!(elements instanceof List<?>)) {
            throw new IOException("Réponse Anthropic inattendue : liste \"elements\" absente");
        }
        List<Detection> detections = new ArrayList<>();
        for (int i = 0; i < taille; i++) {
            detections.add(new Detection(Type.PRODUIT, null));
        }
        for (Object element : (List<?>) elements) {
            if (!(element instanceof Map<?, ?>)) {
                continue;
            }
            Map<?, ?> map = (Map<?, ?>) element;
            Object index = map.get("i");
            Type type = toType(map.get("type"));
            if (!(index instanceof Number) || type == null) {
                continue;
            }
            int i = ((Number) index).intValue();
            if (i < 0 || i >= taille) {
                continue;
            }
            String sousType = null;
            if (type == Type.BATEAU) {
                sousType = valeurConnue(map.get("sousType"), typesBateau);
            } else if (type == Type.MOTEUR) {
                sousType = valeurConnue(map.get("sousType"), typesMoteur);
            }
            detections.set(i, new Detection(type, sousType));
        }
        return detections;
    }

    private static Type toType(Object value) {
        if (value == null) {
            return null;
        }
        switch (value.toString()) {
            case "bateau": return Type.BATEAU;
            case "moteur": return Type.MOTEUR;
            case "helice": return Type.HELICE;
            case "remorque": return Type.REMORQUE;
            default: return null;
        }
    }

    private static String valeurConnue(Object value, List<String> valeurs) {
        if (value == null) {
            return null;
        }
        for (String valeur : valeurs) {
            if (valeur.equalsIgnoreCase(value.toString().trim())) {
                return valeur;
            }
        }
        return null;
    }

    private String callAnthropicApi(Map<String, Object> payload) throws IOException, InterruptedException {
        byte[] body = jsonb.toJson(payload).getBytes(StandardCharsets.UTF_8);
        for (int tentative = 1; ; tentative++) {
            HttpURLConnection connection = (HttpURLConnection) new URL(anthropicBaseUrl + "/v1/messages").openConnection();
            try {
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(DELAI_MAX_SECONDES * 1000);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("x-api-key", anthropicApiKey);
                connection.setRequestProperty("anthropic-version", "2023-06-01");

                OutputStream out = connection.getOutputStream();
                try {
                    out.write(body);
                    out.flush();
                } finally {
                    out.close();
                }

                int status = connection.getResponseCode();
                String responseBody = readBody(connection, status);
                if (status < 400) {
                    return responseBody;
                }
                // 429 (limite de débit) et erreurs serveur sont transitoires, le reste ne se corrige pas en réessayant
                boolean transitoire = status == 429 || status >= 500;
                if (!transitoire || tentative >= TENTATIVES) {
                    throw new IOException("Erreur Anthropic [status=" + status + ", body=" + truncate(responseBody) + "]");
                }
                Thread.sleep(attenteAvantNouvelEssai(connection.getHeaderField("retry-after"), tentative) * 1000L);
            } finally {
                connection.disconnect();
            }
        }
    }

    private static long attenteAvantNouvelEssai(String retryAfter, int tentative) {
        long secondes = 2L * tentative;
        if (retryAfter != null) {
            try {
                secondes = Long.parseLong(retryAfter.trim());
            } catch (NumberFormatException e) {
                // en-tête au format date : on garde l'attente par défaut
            }
        }
        return Math.max(0, Math.min(secondes, ATTENTE_MAX_SECONDES));
    }

    private String readBody(HttpURLConnection conn, int status) throws IOException {
        InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
        if (is == null) return "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        try {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            return sb.toString();
        } finally {
            reader.close();
        }
    }

    private String extractAnswer(Map<String, Object> response) {
        Object contentObj = response.get("content");
        if (!(contentObj instanceof List<?>)) return "";
        for (Object block : (List<?>) contentObj) {
            if (!(block instanceof Map<?, ?>)) continue;
            Object type = ((Map<?, ?>) block).get("type");
            if ("text".equals(type)) {
                Object text = ((Map<?, ?>) block).get("text");
                if (text != null) return text.toString();
            }
        }
        return "";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJsonMap(String content) throws IOException {
        try {
            Object parsed = jsonb.fromJson(content, Object.class);
            if (parsed instanceof Map<?, ?>) {
                return (Map<String, Object>) parsed;
            }
        } catch (RuntimeException e) {
            // JSON invalide : traité comme une réponse inexploitable ci-dessous
        }
        throw new IOException("Réponse Anthropic illisible : " + truncate(content));
    }

    private String truncate(String s) {
        if (s == null) return "";
        return s.length() <= 500 ? s : s.substring(0, 500) + "...";
    }
}
