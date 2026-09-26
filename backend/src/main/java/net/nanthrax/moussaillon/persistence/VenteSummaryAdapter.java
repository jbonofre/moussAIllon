package net.nanthrax.moussaillon.persistence;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.bind.adapter.JsonbAdapter;

public class VenteSummaryAdapter implements JsonbAdapter<VenteEntity, JsonObject> {

    @Override
    public JsonObject adaptToJson(VenteEntity value) {
        if (value == null) {
            return null;
        }
        JsonObjectBuilder builder = Json.createObjectBuilder();
        if (value.id != null) {
            builder.add("id", value.id);
        }
        if (value.numeroFacture != null) {
            builder.add("numeroFacture", value.numeroFacture);
        }
        builder.add("comptoir", value.comptoir);
        if (value.client != null && value.client.nom != null) {
            builder.add("clientNom", value.client.nom);
        }
        return builder.build();
    }

    @Override
    public VenteEntity adaptFromJson(JsonObject value) {
        if (value == null) {
            return null;
        }
        VenteEntity vente = new VenteEntity();
        if (value.containsKey("id") && !value.isNull("id")) {
            vente.id = value.getJsonNumber("id").longValue();
        }
        if (value.containsKey("numeroFacture") && !value.isNull("numeroFacture")) {
            vente.numeroFacture = value.getString("numeroFacture");
        }
        if (value.containsKey("comptoir") && !value.isNull("comptoir")) {
            vente.comptoir = value.getBoolean("comptoir");
        }
        return vente;
    }
}
