package net.nanthrax.moussaillon.services;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import jakarta.ws.rs.WebApplicationException;
import net.nanthrax.moussaillon.persistence.BanqueConnecteurEntity;

/** Client minimal de l'API Powens (agrégateur DSP2) : https://{domain}.biapi.pro/2.0 */
@ApplicationScoped
public class PowensClient {

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Jsonb jsonb = JsonbBuilder.create();

    @SuppressWarnings("unchecked")
    private Map<String, Object> send(BanqueConnecteurEntity c, String path, String method, Object body, String token) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("https://" + c.powensDomain + ".biapi.pro/2.0" + path))
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/json");
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        if (body != null) {
            b.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(jsonb.toJson(body)));
        } else {
            b.method(method, HttpRequest.BodyPublishers.noBody());
        }
        try {
            HttpResponse<String> response = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new WebApplicationException("Powens a refusé la requête (" + response.statusCode() + ")", 502);
            }
            return jsonb.fromJson(response.body(), Map.class);
        } catch (WebApplicationException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new WebApplicationException("Appel Powens interrompu", 502);
        } catch (Exception e) {
            throw new WebApplicationException("Powens injoignable : " + e.getMessage(), 502);
        }
    }

    public Map<String, Object> get(BanqueConnecteurEntity c, String path, String token) {
        return send(c, path, "GET", null, token);
    }

    public Map<String, Object> post(BanqueConnecteurEntity c, String path, Object body, String token) {
        return send(c, path, "POST", body, token);
    }
}
