package net.nanthrax.moussaillon.services;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.StringReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/marees")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class MareeResource {

    private static final String SHOM_BASE = "https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm/spm";
    private static final String SHOM_REFERER = "https://maree.shom.fr/";
    private static final String BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    @GET
    public Response getMarees(@QueryParam("port") String port, @QueryParam("date") String date) {
        if (port == null || port.isBlank() || date == null || date.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"Paramètres port et date requis\"}")
                    .build();
        }

        try {
            int utcOffset = getParisUtcOffset(date);

            String wlResponse = callShom("/wl", port, date, utcOffset, "nbWaterLevels=1440");
            JsonArray wlArray = Json.createReader(new StringReader(wlResponse))
                    .readObject()
                    .getJsonArray(date);

            JsonObjectBuilder result = Json.createObjectBuilder().add("wl", wlArray);

            // Essai HLT (données exactes PM/BM) — peut être bloqué par le WAF SHOM
            try {
                String hltResponse = callShom("/hlt", port, date, utcOffset, "correlation=1");
                JsonArray hltDay = Json.createReader(new StringReader(hltResponse))
                        .readObject()
                        .getJsonArray(date);
                result.add("hlt", hltDay);
            } catch (Exception hltEx) {
                // HLT indisponible — le frontend dérivera les extrêmes depuis WL
            }

            // Coefficients
            try {
                String coeffResponse = callShom("/coeff", port, date, utcOffset, "correlation=1");
                JsonArray coeffRoot = Json.createReader(new StringReader(coeffResponse)).readArray();
                result.add("coefficients", coeffRoot.getJsonArray(0).getJsonArray(0));
            } catch (Exception coeffEx) {
                result.add("coefficients", Json.createArrayBuilder().build());
            }

            return Response.ok(result.build().toString()).build();

        } catch (Exception e) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity("{\"error\":\"Erreur lors de la récupération des données SHOM: " + e.getMessage() + "\"}")
                    .build();
        }
    }

    private String callShom(String endpoint, String port, String date, int utcOffset, String extraParam) throws Exception {
        String urlStr = SHOM_BASE + endpoint
                + "?harborName=" + port
                + "&duration=1"
                + "&date=" + date
                + "&utc=" + utcOffset
                + "&" + extraParam;

        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Referer", SHOM_REFERER);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("User-Agent", BROWSER_UA);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);

        int status = conn.getResponseCode();
        if (status != 200) {
            throw new RuntimeException("SHOM API a retourné HTTP " + status + " pour " + endpoint);
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString();
        }
    }

    private int getParisUtcOffset(String date) {
        try {
            ZoneId paris = ZoneId.of("Europe/Paris");
            ZonedDateTime zdt = LocalDate.parse(date).atStartOfDay(paris);
            return zdt.getOffset().getTotalSeconds() / 3600;
        } catch (Exception e) {
            return 1;
        }
    }
}
