package net.nanthrax.moussaillon.services;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Motifs de numéros de série moteur d'un forfait, séparés par des virgules, des points-virgules ou des retours à la
 * ligne. Chaque motif est :
 * <ul>
 *   <li>un numéro exact, ou un motif avec jokers : {@code *} pour une suite de caractères, {@code ?} pour un seul
 *   caractère (ex. {@code 6EK-10*}) ;</li>
 *   <li>une plage {@code debut..fin}, bornes incluses, l'une des bornes pouvant être omise
 *   (ex. {@code 1B000000..1B099999}, {@code 1B050000..}). Les parties numériques sont comparées par valeur.</li>
 * </ul>
 * La comparaison ignore la casse et les espaces autour des numéros. Même syntaxe que {@code numero-serie.ts} du
 * chantier-ui.
 */
public final class MotifNumeroSerie {

    private static final Pattern SEPARATEURS = Pattern.compile("[,;\\r\\n]+");
    private static final Pattern MORCEAUX = Pattern.compile("[0-9]+|[^0-9]+");

    private MotifNumeroSerie() {
    }

    public static boolean correspond(String motifs, String numeroSerie) {
        if (motifs == null || numeroSerie == null || numeroSerie.isBlank()) {
            return false;
        }
        String numero = numeroSerie.trim().toUpperCase(Locale.ROOT);
        for (String motif : SEPARATEURS.split(motifs)) {
            String m = motif.trim().toUpperCase(Locale.ROOT);
            if (!m.isEmpty() && correspondMotif(m, numero)) {
                return true;
            }
        }
        return false;
    }

    private static boolean correspondMotif(String motif, String numero) {
        int plage = motif.indexOf("..");
        if (plage >= 0) {
            String debut = motif.substring(0, plage).trim();
            String fin = motif.substring(plage + 2).trim();
            if (debut.isEmpty() && fin.isEmpty()) {
                return false;
            }
            return (debut.isEmpty() || comparer(numero, debut) >= 0) && (fin.isEmpty() || comparer(numero, fin) <= 0);
        }
        StringBuilder regex = new StringBuilder();
        StringBuilder litteral = new StringBuilder();
        for (char c : motif.toCharArray()) {
            if (c == '*' || c == '?') {
                if (litteral.length() > 0) {
                    regex.append(Pattern.quote(litteral.toString()));
                    litteral.setLength(0);
                }
                regex.append(c == '*' ? ".*" : ".");
            } else {
                litteral.append(c);
            }
        }
        if (litteral.length() > 0) {
            regex.append(Pattern.quote(litteral.toString()));
        }
        return numero.matches(regex.toString());
    }

    // Comparaison « naturelle » : les suites de chiffres sont comparées par valeur (1B999 < 1B1000)
    static int comparer(String a, String b) {
        Matcher ma = MORCEAUX.matcher(a);
        Matcher mb = MORCEAUX.matcher(b);
        while (ma.find()) {
            if (!mb.find()) {
                return 1;
            }
            String pa = ma.group();
            String pb = mb.group();
            int c = estNombre(pa) && estNombre(pb) ? comparerNombres(pa, pb) : pa.compareTo(pb);
            if (c != 0) {
                return c;
            }
        }
        return mb.find() ? -1 : 0;
    }

    private static boolean estNombre(String morceau) {
        char c = morceau.charAt(0);
        return c >= '0' && c <= '9';
    }

    private static int comparerNombres(String a, String b) {
        String na = a.replaceFirst("^0+(?=.)", "");
        String nb = b.replaceFirst("^0+(?=.)", "");
        return na.length() != nb.length() ? Integer.compare(na.length(), nb.length()) : na.compareTo(nb);
    }
}
