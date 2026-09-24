package net.nanthrax.moussaillon.services;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Parsing minimaliste de CSV (RFC4180 : champs entre guillemets, guillemets doublés pour
 * échapper) sans dépendance externe, utilisé pour les imports (clients, produits).
 */
public final class CsvUtils {

    private CsvUtils() {
    }

    public static String[] parseLine(String line, char delimiter) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        current.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == delimiter) {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields.toArray(new String[0]);
    }

    public static Map<String, Integer> indexHeaders(String[] headers) {
        Map<String, Integer> index = new LinkedHashMap<>();
        for (int i = 0; i < headers.length; i++) {
            index.put(headers[i].trim(), i);
        }
        return index;
    }

    public static String get(String[] cols, Map<String, Integer> index, String header) {
        Integer i = index.get(header);
        if (i == null || i >= cols.length) {
            return null;
        }
        String value = cols[i];
        if (value == null) {
            return null;
        }
        value = value.trim();
        return value.isEmpty() ? null : value;
    }

    /**
     * Parse un nombre au format français exporté par EBP (ex. "1 234,56", virgule décimale,
     * espace insécable comme séparateur de milliers). Retourne 0 si la valeur est vide/invalide.
     */
    public static double parseFrenchDecimal(String raw) {
        if (raw == null) {
            return 0;
        }
        String cleaned = raw.replace(" ", "").replace(" ", "").replace(",", ".").trim();
        if (cleaned.isEmpty()) {
            return 0;
        }
        try {
            return Double.parseDouble(cleaned);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * Indique si la valeur est entièrement en majuscules (au moins une lettre, aucune minuscule).
     */
    public static boolean isFullUpperCase(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        return value.equals(value.toUpperCase(Locale.FRENCH)) && !value.equals(value.toLowerCase(Locale.FRENCH));
    }

    /**
     * Reformate une chaîne en casse "Titre" (première lettre de chaque mot en majuscule, le reste
     * en minuscule), les mots étant délimités par espace, tiret, apostrophe ou retour à la ligne.
     */
    public static String toTitleCase(String value) {
        if (value == null) {
            return null;
        }
        StringBuilder result = new StringBuilder(value.length());
        boolean capitalizeNext = true;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isLetter(c)) {
                result.append(capitalizeNext ? Character.toUpperCase(c) : Character.toLowerCase(c));
                capitalizeNext = false;
            } else {
                result.append(c);
                capitalizeNext = c == ' ' || c == '-' || c == '\'' || c == '\n';
            }
        }
        return result.toString();
    }

    /**
     * Reformate une valeur importée entièrement en majuscules (ex. exports EBP) en casse "Titre" ;
     * la laisse inchangée sinon, pour ne pas altérer une casse déjà correcte (ex. "McDonald").
     */
    public static String formatIfFullUpperCase(String value) {
        return isFullUpperCase(value) ? toTitleCase(value) : value;
    }

    /**
     * Convertit un nom exporté au format EBP "Nom Prénom" en "Prénom Nom" : le dernier mot est
     * pris comme prénom, les mots précédents (nom composé éventuel) forment le nom de famille.
     */
    public static String swapNomPrenom(String nomPrenom) {
        if (nomPrenom == null) {
            return null;
        }
        String trimmed = nomPrenom.trim();
        String[] parts = trimmed.split("\\s+");
        if (parts.length < 2) {
            return trimmed;
        }
        String prenom = parts[parts.length - 1];
        StringBuilder nom = new StringBuilder();
        for (int i = 0; i < parts.length - 1; i++) {
            if (i > 0) {
                nom.append(' ');
            }
            nom.append(parts[i]);
        }
        return prenom + " " + nom;
    }
}
