package net.nanthrax.moussaillon.persistence;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.bind.adapter.JsonbAdapter;

/**
 * Résumé d'un forfait référencé ailleurs (ligne de package) : son identifiant, son nom, sa référence et son prix,
 * sans ses tâches, produits ni associations, chargés à la demande et inaccessibles une fois la transaction terminée.
 */
public class ForfaitSummaryAdapter implements JsonbAdapter<ForfaitEntity, JsonObject> {

    @Override
    public JsonObject adaptToJson(ForfaitEntity value) {
        if (value == null) {
            return null;
        }
        JsonObjectBuilder builder = Json.createObjectBuilder();
        if (value.id != null) {
            builder.add("id", value.id);
        }
        if (value.nom != null) {
            builder.add("nom", value.nom);
        }
        if (value.reference != null) {
            builder.add("reference", value.reference);
        }
        builder.add("prixTTC", value.prixTTC);
        return builder.build();
    }

    @Override
    public ForfaitEntity adaptFromJson(JsonObject value) {
        if (value == null) {
            return null;
        }
        ForfaitEntity forfait = new ForfaitEntity();
        if (value.containsKey("id") && !value.isNull("id")) {
            forfait.id = value.getJsonNumber("id").longValue();
        }
        return forfait;
    }
}
