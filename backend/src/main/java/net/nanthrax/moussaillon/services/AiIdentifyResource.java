package net.nanthrax.moussaillon.services;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/ai/identify")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AiIdentifyResource {

    private static final Logger LOG = Logger.getLogger(AiIdentifyResource.class);

    @ConfigProperty(name = "ai.anthropic.api-key", defaultValue = "")
    String anthropicApiKey;

    @ConfigProperty(name = "ai.anthropic.model", defaultValue = "claude-haiku-4-5-20251001")
    String anthropicModel;

    private final Jsonb jsonb = JsonbBuilder.create();

    @POST
    public Response identify(Map<String, Object> request) {
        List<String> images = asStringList(request.get("images"));
        String type = asString(request.get("type"));

        if (images.isEmpty()) {
            return errorResponse(400, "INVALID_REQUEST", "Aucune image fournie");
        }
        if (anthropicApiKey == null || anthropicApiKey.trim().isEmpty()) {
            return errorResponse(500, "CONFIG_ERROR", "La clé Anthropic est absente (ai.anthropic.api-key)");
        }

        try {
            List<Map<String, Object>> contentBlocks = new ArrayList<>();
            for (String image : images) {
                contentBlocks.add(buildImageBlock(image));
            }
            Map<String, Object> textBlock = new LinkedHashMap<>();
            textBlock.put("type", "text");
            textBlock.put("text", buildPrompt(type));
            contentBlocks.add(textBlock);

            Map<String, Object> userMessage = new LinkedHashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", contentBlocks);

            List<Map<String, Object>> messages = new ArrayList<>();
            messages.add(userMessage);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", anthropicModel);
            payload.put("max_tokens", Integer.valueOf(512));
            payload.put("system", "Tu es un expert en produits nautiques. Réponds uniquement en JSON valide, sans markdown ni explication supplémentaire.");
            payload.put("messages", messages);

            String responseBody = callAnthropicApi(payload);
            Map<String, Object> parsed = fromJsonMap(responseBody);
            String answer = extractAnswer(parsed);

            // Strip markdown code fences if present
            String cleaned = answer.trim();
            if (cleaned.startsWith("```")) {
                int firstNewline = cleaned.indexOf('\n');
                int lastFence = cleaned.lastIndexOf("```");
                if (firstNewline >= 0 && lastFence > firstNewline) {
                    cleaned = cleaned.substring(firstNewline + 1, lastFence).trim();
                }
            }

            try {
                Map<String, Object> result = fromJsonMap(cleaned);
                return Response.ok(result).build();
            } catch (Exception e) {
                Map<String, Object> fallback = new LinkedHashMap<>();
                fallback.put("description", answer);
                fallback.put("confidence", "faible");
                return Response.ok(fallback).build();
            }
        } catch (WebApplicationException e) {
            int status = e.getResponse() != null ? e.getResponse().getStatus() : 500;
            LOG.errorf("AI identify error status=%d", Integer.valueOf(status));
            return errorResponse(status, "AI_ERROR", e.getMessage());
        } catch (Exception e) {
            String traceId = UUID.randomUUID().toString();
            LOG.errorf(e, "AI identify unexpected error traceId=%s", traceId);
            return errorResponse(500, "AI_INTERNAL_ERROR", "Erreur interne [traceId=" + traceId + "]");
        }
    }

    private Map<String, Object> buildImageBlock(String imageData) {
        String mediaType = "image/jpeg";
        String rawBase64 = imageData;

        if (imageData.startsWith("data:")) {
            int comma = imageData.indexOf(',');
            if (comma > 0) {
                String header = imageData.substring(5, comma);
                int semi = header.indexOf(';');
                if (semi > 0) {
                    mediaType = header.substring(0, semi);
                }
                rawBase64 = imageData.substring(comma + 1);
            }
        }

        Map<String, Object> source = new LinkedHashMap<>();
        source.put("type", "base64");
        source.put("media_type", mediaType);
        source.put("data", rawBase64);

        Map<String, Object> block = new LinkedHashMap<>();
        block.put("type", "image");
        block.put("source", source);
        return block;
    }

    private String buildPrompt(String type) {
        String entityLabel = "produit nautique";
        String fields;

        if ("bateau".equals(type)) {
            entityLabel = "bateau";
            fields = "\"marque\", \"modele\", \"type\" (type de bateau, ex: Open, Semi-rigide, Voilier), \"anneeDebut\" (entier ou null), \"description\", \"confidence\" (haute/moyenne/faible)";
        } else if ("moteur".equals(type)) {
            entityLabel = "moteur hors-bord ou inboard";
            fields = "\"marque\", \"modele\", \"type\" (Hors-bord/Inboard/In-Out), \"anneeDebut\" (entier ou null), \"puissanceCv\" (entier ou null), \"description\", \"confidence\" (haute/moyenne/faible)";
        } else if ("remorque".equals(type)) {
            entityLabel = "remorque nautique";
            fields = "\"marque\", \"modele\", \"type\", \"anneeDebut\" (entier ou null), \"description\", \"confidence\" (haute/moyenne/faible)";
        } else if ("helice".equals(type)) {
            entityLabel = "hélice de bateau";
            fields = "\"marque\", \"modele\", \"materiau\", \"pas\" (ex: 19), \"diametre\" (en pouces, ex: 14.5), \"description\", \"confidence\" (haute/moyenne/faible)";
        } else {
            fields = "\"marque\", \"modele\", \"type\", \"anneeDebut\" (entier ou null), \"description\", \"confidence\" (haute/moyenne/faible)";
        }

        return "À partir de cette/ces photo(s), identifie ce " + entityLabel + ". "
                + "Réponds en JSON avec les champs : " + fields + ". "
                + "Si un champ est inconnu, utilise null. "
                + "Réponds uniquement avec le JSON brut, sans markdown.";
    }

    private String callAnthropicApi(Map<String, Object> payload) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL("https://api.anthropic.com/v1/messages").openConnection();
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("x-api-key", anthropicApiKey);
            connection.setRequestProperty("anthropic-version", "2023-06-01");

            byte[] body = jsonb.toJson(payload).getBytes(StandardCharsets.UTF_8);
            OutputStream out = connection.getOutputStream();
            try {
                out.write(body);
                out.flush();
            } finally {
                out.close();
            }

            int status = connection.getResponseCode();
            String responseBody = readBody(connection, status);
            if (status >= 400) {
                throw new WebApplicationException("Erreur Anthropic [status=" + status + ", body=" + truncate(responseBody) + "]", 502);
            }
            return responseBody;
        } catch (IOException e) {
            throw new WebApplicationException("Erreur d'appel Anthropic: " + e.getMessage(), 502);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
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
    private Map<String, Object> fromJsonMap(String content) {
        Object parsed = jsonb.fromJson(content, Object.class);
        if (!(parsed instanceof Map<?, ?>)) return new LinkedHashMap<>();
        return (Map<String, Object>) parsed;
    }

    @SuppressWarnings("unchecked")
    private List<String> asStringList(Object value) {
        List<String> result = new ArrayList<>();
        if (!(value instanceof List<?>)) return result;
        for (Object item : (List<?>) value) {
            if (item != null) result.add(item.toString());
        }
        return result;
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private String truncate(String s) {
        if (s == null) return "";
        return s.length() <= 500 ? s : s.substring(0, 500) + "...";
    }

    private Response errorResponse(int status, String code, String message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("error", code);
        payload.put("message", message == null ? "" : message);
        payload.put("status", Integer.valueOf(status));
        return Response.status(status).entity(payload).type(MediaType.APPLICATION_JSON).build();
    }
}
