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
import java.util.Collections;
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
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/ai/chat")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AiChatResource {
    private static final Logger LOG = Logger.getLogger(AiChatResource.class);
    private static final String AI_SYSTEM_PROMPT = "Tu es moussAIllon, un assistant de gestion de chantier naval. Réponds en français, clairement et brièvement.";
    private static final int MAX_MCP_TOOL_ROUNDS = 6;

    @ConfigProperty(name = "ai.openai.api-key", defaultValue = "")
    String openAiApiKey;

    @ConfigProperty(name = "ai.anthropic.api-key", defaultValue = "")
    String anthropicApiKey;

    @ConfigProperty(name = "ai.openai.model", defaultValue = "gpt-4o-mini")
    String openAiModel;

    @ConfigProperty(name = "ai.anthropic.model", defaultValue = "claude-haiku-4-5-20251001")
    String anthropicModel;

    @ConfigProperty(name = "ai.anthropic.mcp.enabled", defaultValue = "true")
    boolean anthropicMcpEnabled;

    @ConfigProperty(name = "quarkus.http.port", defaultValue = "8080")
    int backendPort;

    private final Jsonb jsonb = JsonbBuilder.create();

    @POST
    public Response chat(Map<String, Object> request, @Context HttpHeaders httpHeaders) {
        String authorization = httpHeaders == null ? null : httpHeaders.getHeaderString(HttpHeaders.AUTHORIZATION);
        String provider = asString(request.get("provider"));
        String message = asString(request.get("message"));

        if (provider == null || provider.trim().isEmpty()) {
            return errorResponse(400, "INVALID_REQUEST", "Le champ 'provider' est requis", null);
        }
        if (message == null || message.trim().isEmpty()) {
            return errorResponse(400, "INVALID_REQUEST", "Le champ 'message' est requis", provider);
        }

        try {
            String normalizedProvider = provider.trim().toLowerCase();
            if ("openai".equals(normalizedProvider)) {
                return Response.ok(callOpenAi(message)).build();
            }
            if ("anthropic".equals(normalizedProvider)) {
                return Response.ok(callAnthropic(message, authorization)).build();
            }
            return errorResponse(400, "INVALID_PROVIDER",
                    "Provider inconnu: " + provider + ". Utilisez 'openai' ou 'anthropic'.", provider);
        } catch (WebApplicationException e) {
            int status = e.getResponse() != null ? e.getResponse().getStatus() : 500;
            String detail = extractExceptionMessage(e);
            LOG.errorf("AI chat error status=%d provider=%s detail=%s", Integer.valueOf(status), provider, detail);
            return errorResponse(status, "AI_PROVIDER_ERROR", detail, provider);
        } catch (Exception e) {
            String traceId = UUID.randomUUID().toString();
            LOG.errorf(e, "AI chat unexpected error traceId=%s provider=%s", traceId, provider);
            return errorResponse(500, "AI_INTERNAL_ERROR",
                    "Erreur interne IA [traceId=" + traceId + ", detail=" + sanitizeBodyForMessage(e.getMessage()) + "]",
                    provider);
        }
    }

    private Map<String, Object> callOpenAi(String userMessage) {
        if (openAiApiKey == null || openAiApiKey.trim().isEmpty()) {
            throw new WebApplicationException("La clé OpenAI est absente (ai.openai.api-key)", 500);
        }

        Map<String, Object> system = new LinkedHashMap<String, Object>();
        system.put("role", "system");
        system.put("content", AI_SYSTEM_PROMPT);

        Map<String, Object> user = new LinkedHashMap<String, Object>();
        user.put("role", "user");
        user.put("content", userMessage);

        List<Map<String, Object>> messages = new ArrayList<Map<String, Object>>();
        messages.add(system);
        messages.add(user);

        Map<String, Object> payload = new LinkedHashMap<String, Object>();
        payload.put("model", openAiModel);
        payload.put("temperature", Double.valueOf(0.2));
        payload.put("messages", messages);

        String responseBody = callJsonApi(
                "https://api.openai.com/v1/chat/completions",
                "POST",
                payload,
                buildHeaders("Authorization", "Bearer " + openAiApiKey));

        Map<String, Object> parsed = fromJsonMap(responseBody);
        String answer = extractOpenAiAnswer(parsed);

        Map<String, Object> response = new LinkedHashMap<String, Object>();
        response.put("provider", "openai");
        response.put("model", openAiModel);
        response.put("answer", answer);
        return response;
    }

    private Map<String, Object> callAnthropic(String userMessage, String authorization) {
        if (anthropicApiKey == null || anthropicApiKey.trim().isEmpty()) {
            throw new WebApplicationException("La clé Anthropic est absente (ai.anthropic.api-key)", 500);
        }

        List<Map<String, Object>> tools = anthropicMcpEnabled ? fetchAnthropicToolsFromMcp(authorization) : Collections.emptyList();

        List<Map<String, Object>> messages = new ArrayList<Map<String, Object>>();
        messages.add(buildAnthropicTextMessage("user", userMessage));

        Map<String, Object> parsed = new LinkedHashMap<String, Object>();
        for (int round = 0; round <= MAX_MCP_TOOL_ROUNDS; round++) {
            Map<String, Object> payload = new LinkedHashMap<String, Object>();
            payload.put("model", anthropicModel);
            payload.put("max_tokens", Integer.valueOf(700));
            payload.put("system", AI_SYSTEM_PROMPT);
            payload.put("messages", messages);
            if (!tools.isEmpty()) {
                payload.put("tools", tools);
            }

            String responseBody = callJsonApi(
                    "https://api.anthropic.com/v1/messages",
                    "POST",
                    payload,
                    buildHeaders(
                            "x-api-key", anthropicApiKey,
                            "anthropic-version", "2023-06-01"));

            parsed = fromJsonMap(responseBody);
            List<Map<String, Object>> toolUses = extractAnthropicToolUses(parsed);
            if (toolUses.isEmpty()) {
                String answer = extractAnthropicAnswer(parsed);

                Map<String, Object> response = new LinkedHashMap<String, Object>();
                response.put("provider", "anthropic");
                response.put("model", anthropicModel);
                response.put("answer", answer);
                return response;
            }

            List<Map<String, Object>> assistantBlocks = asListOfMaps(parsed.get("content"));
            if (!assistantBlocks.isEmpty()) {
                messages.add(buildAnthropicBlocksMessage("assistant", assistantBlocks));
            }

            List<Map<String, Object>> toolResultBlocks = new ArrayList<Map<String, Object>>();
            for (Map<String, Object> toolUse : toolUses) {
                toolResultBlocks.add(invokeMcpToolAndBuildResultBlock(toolUse, authorization));
            }
            messages.add(buildAnthropicBlocksMessage("user", toolResultBlocks));
        }

        throw new WebApplicationException(
                "Limite de tours outils MCP atteinte sans réponse finale (MAX_MCP_TOOL_ROUNDS=" + MAX_MCP_TOOL_ROUNDS + ")",
                502);
    }

    private Map<String, Object> buildAnthropicTextMessage(String role, String content) {
        Map<String, Object> message = new LinkedHashMap<String, Object>();
        message.put("role", role);
        message.put("content", content);
        return message;
    }

    private Map<String, Object> buildAnthropicBlocksMessage(String role, List<Map<String, Object>> blocks) {
        Map<String, Object> message = new LinkedHashMap<String, Object>();
        message.put("role", role);
        message.put("content", blocks);
        return message;
    }

    private List<Map<String, Object>> fetchAnthropicToolsFromMcp(String authorization) {
        Map<String, Object> request = new LinkedHashMap<String, Object>();
        request.put("jsonrpc", "2.0");
        request.put("id", UUID.randomUUID().toString());
        request.put("method", "tools/list");
        request.put("params", Collections.emptyMap());

        String responseBody = callJsonApi(resolveMcpEndpoint(), "POST", request, buildMcpHeaders(authorization));
        Map<String, Object> response = fromJsonMap(responseBody);
        ensureMcpNoError(response);

        Map<String, Object> result = asMapOrEmpty(response.get("result"));
        List<Map<String, Object>> mcpTools = asListOfMaps(result.get("tools"));
        if (mcpTools.isEmpty()) {
            return Collections.emptyList();
        }

        List<Map<String, Object>> anthropicTools = new ArrayList<Map<String, Object>>();
        for (Map<String, Object> mcpTool : mcpTools) {
            String name = asString(mcpTool.get("name"));
            if (name == null || name.trim().isEmpty()) {
                continue;
            }

            Map<String, Object> tool = new LinkedHashMap<String, Object>();
            tool.put("name", name);
            tool.put("description", asString(mcpTool.get("description")));

            Map<String, Object> inputSchema = asMapOrEmpty(mcpTool.get("inputSchema"));
            if (inputSchema.isEmpty()) {
                inputSchema = new LinkedHashMap<String, Object>();
                inputSchema.put("type", "object");
                inputSchema.put("additionalProperties", Boolean.TRUE);
            }
            tool.put("input_schema", inputSchema);
            anthropicTools.add(tool);
        }
        return anthropicTools;
    }

    private Map<String, Object> invokeMcpToolAndBuildResultBlock(Map<String, Object> toolUse, String authorization) {
        String toolUseId = asString(toolUse.get("id"));
        String toolName = asString(toolUse.get("name"));
        Map<String, Object> toolInput = asMapOrEmpty(toolUse.get("input"));

        Map<String, Object> block = new LinkedHashMap<String, Object>();
        block.put("type", "tool_result");
        block.put("tool_use_id", toolUseId == null ? "" : toolUseId);

        try {
            Map<String, Object> mcpResult = callMcpTool(toolName, toolInput, authorization);
            block.put("content", jsonb.toJson(mcpResult));
            if (Boolean.TRUE.equals(mcpResult.get("isError"))) {
                block.put("is_error", Boolean.TRUE);
            }
            return block;
        } catch (Exception e) {
            Map<String, Object> error = new LinkedHashMap<String, Object>();
            error.put("isError", Boolean.TRUE);
            error.put("message", "Erreur invocation MCP: " + sanitizeBodyForMessage(e.getMessage()));
            block.put("is_error", Boolean.TRUE);
            block.put("content", jsonb.toJson(error));
            return block;
        }
    }

    private Map<String, Object> callMcpTool(String toolName, Map<String, Object> arguments, String authorization) {
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("name", toolName);
        params.put("arguments", arguments == null ? Collections.emptyMap() : arguments);

        Map<String, Object> request = new LinkedHashMap<String, Object>();
        request.put("jsonrpc", "2.0");
        request.put("id", UUID.randomUUID().toString());
        request.put("method", "tools/call");
        request.put("params", params);

        String responseBody = callJsonApi(resolveMcpEndpoint(), "POST", request, buildMcpHeaders(authorization));
        Map<String, Object> response = fromJsonMap(responseBody);
        ensureMcpNoError(response);

        Map<String, Object> result = asMapOrEmpty(response.get("result"));
        if (result.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<String, Object>();
            empty.put("isError", Boolean.TRUE);
            empty.put("message", "Réponse MCP invalide: result absent");
            return empty;
        }
        return result;
    }

    private void ensureMcpNoError(Map<String, Object> mcpResponse) {
        Map<String, Object> error = asMapOrEmpty(mcpResponse.get("error"));
        if (error.isEmpty()) {
            return;
        }
        String message = asString(error.get("message"));
        String code = asString(error.get("code"));
        throw new IllegalStateException("Erreur MCP [code=" + code + ", message=" + message + "]");
    }

    private Map<String, String> buildMcpHeaders(String authorization) {
        if (authorization == null || authorization.trim().isEmpty()) {
            return Collections.emptyMap();
        }
        return buildHeaders(HttpHeaders.AUTHORIZATION, authorization);
    }

    private String resolveMcpEndpoint() {
        String envEndpoint = System.getenv("AI_MCP_ENDPOINT");
        if (envEndpoint != null && !envEndpoint.trim().isEmpty()) {
            return envEndpoint.trim();
        }
        return "http://127.0.0.1:" + backendPort + "/mcp";
    }

    private String callJsonApi(String endpoint, String method, Map<String, Object> payload, Map<String, String> headers) {
        HttpURLConnection connection = null;
        String traceId = UUID.randomUUID().toString();
        String endpointSummary = summarizeEndpoint(endpoint);
        try {
            connection = (HttpURLConnection) new URL(endpoint).openConnection();
            connection.setRequestMethod(method);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            for (Map.Entry<String, String> header : headers.entrySet()) {
                connection.setRequestProperty(header.getKey(), header.getValue());
            }

            byte[] payloadBytes = jsonb.toJson(payload).getBytes(StandardCharsets.UTF_8);
            OutputStream outputStream = connection.getOutputStream();
            try {
                outputStream.write(payloadBytes);
                outputStream.flush();
            } finally {
                outputStream.close();
            }

            int status = connection.getResponseCode();
            String body = readResponseBody(connection, status);
            if (status >= 400) {
                String message = "Erreur fournisseur IA [traceId=" + traceId
                        + ", endpoint=" + endpointSummary
                        + ", upstreamStatus=" + status
                        + ", response=" + sanitizeBodyForMessage(body) + "]";
                throw new WebApplicationException(message, 502);
            }
            return body;
        } catch (IOException e) {
            String message = "Erreur d'appel fournisseur IA [traceId=" + traceId
                    + ", endpoint=" + endpointSummary
                    + ", exception=" + e.getClass().getSimpleName()
                    + ", detail=" + sanitizeBodyForMessage(e.getMessage()) + "]";
            throw new WebApplicationException(message, 502);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private String summarizeEndpoint(String endpoint) {
        try {
            URL parsed = new URL(endpoint);
            String protocol = parsed.getProtocol() == null ? "?" : parsed.getProtocol();
            String host = parsed.getHost() == null ? "?" : parsed.getHost();
            String path = parsed.getPath() == null ? "" : parsed.getPath();
            return protocol + "://" + host + path;
        } catch (Exception e) {
            return endpoint == null ? "unknown" : endpoint;
        }
    }

    private String sanitizeBodyForMessage(String body) {
        if (body == null) {
            return "";
        }
        String compact = body.replace("\r", " ").replace("\n", " ").trim();
        int max = 700;
        if (compact.length() <= max) {
            return compact;
        }
        return compact.substring(0, max) + "...(truncated)";
    }

    private Response errorResponse(int status, String code, String message, String provider) {
        Map<String, Object> payload = new LinkedHashMap<String, Object>();
        payload.put("error", code);
        payload.put("message", message == null ? "" : message);
        if (provider != null && !provider.trim().isEmpty()) {
            payload.put("provider", provider);
        }
        payload.put("status", Integer.valueOf(status));
        return Response.status(status).entity(payload).type(MediaType.APPLICATION_JSON).build();
    }

    private String extractExceptionMessage(WebApplicationException e) {
        if (e == null) {
            return "Erreur IA inconnue";
        }
        String message = e.getMessage();
        if (message != null && !message.trim().isEmpty()) {
            return sanitizeBodyForMessage(message);
        }
        if (e.getResponse() != null && e.getResponse().getEntity() != null) {
            return sanitizeBodyForMessage(String.valueOf(e.getResponse().getEntity()));
        }
        return "Erreur IA sans détails";
    }

    private String readResponseBody(HttpURLConnection connection, int status) throws IOException {
        InputStream inputStream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (inputStream == null) {
            return "";
        }

        BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8));
        try {
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                body.append(line);
            }
            return body.toString();
        } finally {
            reader.close();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJsonMap(String content) {
        Object parsed = jsonb.fromJson(content, Object.class);
        if (!(parsed instanceof Map<?, ?>)) {
            return new LinkedHashMap<String, Object>();
        }
        return (Map<String, Object>) parsed;
    }

    private String extractOpenAiAnswer(Map<String, Object> response) {
        Object choicesObj = response.get("choices");
        if (!(choicesObj instanceof List<?>)) {
            return "Aucune réponse renvoyée par OpenAI.";
        }
        List<?> choices = (List<?>) choicesObj;
        if (choices.isEmpty()) {
            return "Aucune réponse renvoyée par OpenAI.";
        }
        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?>)) {
            return "Aucune réponse renvoyée par OpenAI.";
        }
        Object messageObj = ((Map<?, ?>) firstChoice).get("message");
        if (!(messageObj instanceof Map<?, ?>)) {
            return "Aucune réponse renvoyée par OpenAI.";
        }
        Object contentObj = ((Map<?, ?>) messageObj).get("content");
        return contentObj == null ? "Aucune réponse renvoyée par OpenAI." : contentObj.toString();
    }

    private String extractAnthropicAnswer(Map<String, Object> response) {
        Object contentObj = response.get("content");
        if (!(contentObj instanceof List<?>)) {
            return "Aucune réponse renvoyée par Anthropic.";
        }
        List<?> blocks = (List<?>) contentObj;
        if (blocks.isEmpty()) {
            return "Aucune réponse renvoyée par Anthropic.";
        }

        StringBuilder answer = new StringBuilder();
        for (Object block : blocks) {
            if (!(block instanceof Map<?, ?>)) {
                continue;
            }
            Object type = ((Map<?, ?>) block).get("type");
            if (type == null || !"text".equals(type.toString())) {
                continue;
            }
            Object text = ((Map<?, ?>) block).get("text");
            if (text != null) {
                if (answer.length() > 0) {
                    answer.append("\n");
                }
                answer.append(text.toString());
            }
        }

        if (answer.length() == 0) {
            return "Aucune réponse renvoyée par Anthropic.";
        }
        return answer.toString();
    }

    private List<Map<String, Object>> extractAnthropicToolUses(Map<String, Object> response) {
        List<Map<String, Object>> blocks = asListOfMaps(response.get("content"));
        if (blocks.isEmpty()) {
            return Collections.emptyList();
        }

        List<Map<String, Object>> toolUses = new ArrayList<Map<String, Object>>();
        for (Map<String, Object> block : blocks) {
            String type = asString(block.get("type"));
            if ("tool_use".equals(type)) {
                toolUses.add(block);
            }
        }
        return toolUses;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asListOfMaps(Object value) {
        if (!(value instanceof List<?>)) {
            return Collections.emptyList();
        }

        List<?> source = (List<?>) value;
        List<Map<String, Object>> out = new ArrayList<Map<String, Object>>();
        for (Object item : source) {
            if (item instanceof Map<?, ?>) {
                out.add((Map<String, Object>) item);
            }
        }
        return out;
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMapOrEmpty(Object value) {
        if (value instanceof Map<?, ?>) {
            return (Map<String, Object>) value;
        }
        return Collections.emptyMap();
    }

    private Map<String, String> buildHeaders(String... items) {
        Map<String, String> headers = new LinkedHashMap<String, String>();
        for (int i = 0; i + 1 < items.length; i += 2) {
            headers.put(items[i], items[i + 1]);
        }
        return headers;
    }
}
