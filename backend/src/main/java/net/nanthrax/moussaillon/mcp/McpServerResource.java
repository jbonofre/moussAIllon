package net.nanthrax.moussaillon.mcp;

import java.io.UnsupportedEncodingException;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/mcp")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class McpServerResource {

    private static final List<String> SERVICE_ROOT_PATHS = Collections.unmodifiableList(Arrays.asList(
            "/bateaux",
            "/catalogue/bateaux",
            "/catalogue/fournisseurs",
            "/catalogue/helices",
            "/catalogue/moteurs",
            "/catalogue/packages",
            "/catalogue/produits",
            "/catalogue/remorques",
            "/clients",
            "/forfaits",
            "/fournisseur-bateau",
            "/fournisseur-helice",
            "/fournisseur-moteur",
            "/fournisseur-produit",
            "/fournisseur-remorque",
            "/moteurs",
            "/remorques",
            "/services",
            "/societe",
            "/techniciens",
            "/transactions",
            "/users",
            "/ventes"));

    private static final Set<String> SUPPORTED_HTTP_METHODS = Collections.unmodifiableSet(
            new LinkedHashSet<String>(Arrays.asList("GET", "POST", "PUT", "DELETE")));

    private static final List<String> SUPPORTED_HTTP_METHODS_FOR_SCHEMA = Collections.unmodifiableList(
            Arrays.asList("GET", "POST", "PUT", "DELETE"));

    private final Jsonb jsonb = JsonbBuilder.create();

    @ConfigProperty(name = "quarkus.http.port", defaultValue = "8080")
    int backendPort;

    @POST
    public Response handle(Map<String, Object> request) {
        Object id = request.get("id");
        try {
            String method = asString(request.get("method"));
            if (method == null || method.trim().isEmpty()) {
                return Response.ok(jsonRpcError(id, -32600, "Invalid Request: missing 'method'", null)).build();
            }

            Map<String, Object> params = asMapOrEmpty(request.get("params"));

            if ("initialize".equals(method)) {
                return Response.ok(jsonRpcResult(id, initializeResult())).build();
            }
            if ("notifications/initialized".equals(method)) {
                return Response.noContent().build();
            }
            if ("tools/list".equals(method)) {
                return Response.ok(jsonRpcResult(id, toolsListResult())).build();
            }
            if ("tools/call".equals(method)) {
                return Response.ok(jsonRpcResult(id, toolsCallResult(params))).build();
            }
            return Response.ok(jsonRpcError(id, -32601, "Method not found: " + method, null)).build();
        } catch (IllegalArgumentException ex) {
            return Response.ok(jsonRpcError(id, -32602, ex.getMessage(), null)).build();
        } catch (Exception ex) {
            return Response.ok(jsonRpcError(id, -32603, "Internal error", ex.getMessage())).build();
        }
    }

    private Map<String, Object> initializeResult() {
        Map<String, Object> serverInfo = new LinkedHashMap<String, Object>();
        serverInfo.put("name", "moussaillon-quarkus-mcp");
        serverInfo.put("version", "0.1.0");

        Map<String, Object> capabilities = new LinkedHashMap<String, Object>();
        capabilities.put("tools", Collections.emptyMap());

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("protocolVersion", "2024-11-05");
        result.put("serverInfo", serverInfo);
        result.put("capabilities", capabilities);
        return result;
    }

    private Map<String, Object> toolsListResult() {
        List<Map<String, Object>> tools = new ArrayList<Map<String, Object>>();
        tools.add(buildListResourcesToolSchema());
        tools.add(buildCallApiToolSchema());

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("tools", tools);
        return result;
    }

    private Map<String, Object> buildListResourcesToolSchema() {
        Map<String, Object> inputSchema = new LinkedHashMap<String, Object>();
        inputSchema.put("type", "object");
        inputSchema.put("additionalProperties", Boolean.FALSE);
        inputSchema.put("properties", Collections.emptyMap());

        Map<String, Object> tool = new LinkedHashMap<String, Object>();
        tool.put("name", "moussaillon_list_api_resources");
        tool.put("description", "List moussAIllon REST API root resources exposed from net.nanthrax.moussaillon.services.");
        tool.put("inputSchema", inputSchema);
        return tool;
    }

    private Map<String, Object> buildCallApiToolSchema() {
        Map<String, Object> methodSchema = new LinkedHashMap<String, Object>();
        methodSchema.put("type", "string");
        methodSchema.put("enum", SUPPORTED_HTTP_METHODS_FOR_SCHEMA);

        Map<String, Object> pathSchema = new LinkedHashMap<String, Object>();
        pathSchema.put("type", "string");
        pathSchema.put("description", "Absolute API path, e.g. /clients, /ventes/search, /forfaits/1");

        Map<String, Object> querySchema = new LinkedHashMap<String, Object>();
        querySchema.put("type", "object");
        querySchema.put("description", "Optional query-string key/value map.");

        Map<String, Object> bodySchema = new LinkedHashMap<String, Object>();
        bodySchema.put("type", "object");
        bodySchema.put("description", "Optional JSON body for POST/PUT.");

        Map<String, Object> properties = new LinkedHashMap<String, Object>();
        properties.put("method", methodSchema);
        properties.put("path", pathSchema);
        properties.put("query", querySchema);
        properties.put("body", bodySchema);

        Map<String, Object> inputSchema = new LinkedHashMap<String, Object>();
        inputSchema.put("type", "object");
        inputSchema.put("additionalProperties", Boolean.FALSE);
        inputSchema.put("required", Arrays.asList("method", "path"));
        inputSchema.put("properties", properties);

        Map<String, Object> tool = new LinkedHashMap<String, Object>();
        tool.put("name", "moussaillon_call_api_resource");
        tool.put("description", "Call an moussAIllon REST API endpoint backed by Quarkus service resources.");
        tool.put("inputSchema", inputSchema);
        return tool;
    }

    private Map<String, Object> toolsCallResult(Map<String, Object> params) {
        String toolName = asString(params.get("name"));
        Map<String, Object> arguments = asMapOrEmpty(params.get("arguments"));

        if ("moussaillon_list_api_resources".equals(toolName)) {
            Map<String, Object> resourcePayload = new LinkedHashMap<String, Object>();
            resourcePayload.put("resources", SERVICE_ROOT_PATHS);
            return toolTextResult(jsonb.toJson(resourcePayload));
        }
        if ("moussaillon_call_api_resource".equals(toolName)) {
            return callApiResource(arguments);
        }
        throw new IllegalArgumentException("Unknown tool: " + toolName);
    }

    private Map<String, Object> callApiResource(Map<String, Object> arguments) {
        String rawMethod = asString(arguments.get("method"));
        if (rawMethod == null || rawMethod.trim().isEmpty()) {
            throw new IllegalArgumentException("Field 'method' is required");
        }

        String method = rawMethod.trim().toUpperCase();
        String path = asString(arguments.get("path"));
        if (path == null || path.trim().isEmpty()) {
            throw new IllegalArgumentException("Field 'path' is required");
        }

        if (!SUPPORTED_HTTP_METHODS.contains(method)) {
            throw new IllegalArgumentException("Unsupported method: " + method);
        }
        if (!path.startsWith("/")) {
            throw new IllegalArgumentException("Field 'path' must start with '/'");
        }
        if (!isWhitelistedPath(path)) {
            throw new IllegalArgumentException("Path not allowed by MCP API whitelist: " + path);
        }

        String url = "http://127.0.0.1:" + backendPort + path + buildQueryString(arguments.get("query"));
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod(method);
            connection.setRequestProperty("Accept", "application/json");

            if ("POST".equals(method) || "PUT".equals(method)) {
                String body = arguments.containsKey("body") ? jsonb.toJson(arguments.get("body")) : "{}";
                byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));
                OutputStream outputStream = connection.getOutputStream();
                try {
                    outputStream.write(bodyBytes);
                    outputStream.flush();
                } finally {
                    outputStream.close();
                }
            }

            int status = connection.getResponseCode();
            String responseBody = readResponseBody(connection, status);
            Object parsedBody = parseJsonOrText(responseBody);

            Map<String, Object> payload = new LinkedHashMap<String, Object>();
            payload.put("status", Integer.valueOf(status));
            payload.put("path", path);
            payload.put("method", method);
            payload.put("body", parsedBody);

            Map<String, Object> result = new LinkedHashMap<String, Object>();
            List<Map<String, Object>> content = new ArrayList<Map<String, Object>>();
            Map<String, Object> text = new LinkedHashMap<String, Object>();
            text.put("type", "text");
            text.put("text", jsonb.toJson(payload));
            content.add(text);
            result.put("content", content);
            result.put("structuredContent", payload);
            result.put("isError", Boolean.valueOf(status >= 400));
            return result;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to call backend API: " + e.getMessage(), e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
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

    private boolean isWhitelistedPath(String path) {
        for (String root : SERVICE_ROOT_PATHS) {
            if (path.equals(root) || path.startsWith(root + "/")) {
                return true;
            }
        }
        return false;
    }

    private String buildQueryString(Object queryObject) {
        if (!(queryObject instanceof Map<?, ?>)) {
            return "";
        }

        Map<?, ?> queryMap = (Map<?, ?>) queryObject;
        if (queryMap.isEmpty()) {
            return "";
        }

        List<String> pairs = new ArrayList<String>();
        for (Map.Entry<?, ?> entry : queryMap.entrySet()) {
            Object key = entry.getKey();
            Object value = entry.getValue();
            if (key == null || value == null) {
                continue;
            }
            pairs.add(encode(key.toString()) + "=" + encode(value.toString()));
        }

        String query = pairs.stream().collect(Collectors.joining("&"));

        if (query.isEmpty()) {
            return "";
        }
        return "?" + query;
    }

    private String encode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException("UTF-8 is not supported", e);
        }
    }

    private Object parseJsonOrText(String body) {
        if (body == null || body.trim().isEmpty()) {
            return "";
        }
        try {
            return jsonb.fromJson(body, Object.class);
        } catch (Exception ignored) {
            return body;
        }
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

    private Map<String, Object> toolTextResult(String text) {
        Map<String, Object> textNode = new LinkedHashMap<String, Object>();
        textNode.put("type", "text");
        textNode.put("text", text);

        List<Map<String, Object>> content = new ArrayList<Map<String, Object>>();
        content.add(textNode);

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("content", content);
        return result;
    }

    private Map<String, Object> jsonRpcResult(Object id, Object result) {
        Map<String, Object> response = new LinkedHashMap<String, Object>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("result", result);
        return response;
    }

    private Map<String, Object> jsonRpcError(Object id, int code, String message, Object data) {
        Map<String, Object> error = new LinkedHashMap<String, Object>();
        error.put("code", Integer.valueOf(code));
        error.put("message", message);
        if (data != null) {
            error.put("data", data);
        }

        Map<String, Object> response = new LinkedHashMap<String, Object>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("error", error);
        return response;
    }
}
