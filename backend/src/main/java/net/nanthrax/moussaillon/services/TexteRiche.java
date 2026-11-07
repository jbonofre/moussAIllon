package net.nanthrax.moussaillon.services;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Texte mis en forme (gras, italique, souligné, barré, listes) saisi dans l'éditeur des descriptions d'annonces, au
 * chantier comme au portail client. Seules ces balises, sans attribut, sont conservées : le texte d'un client est
 * ensuite affiché au chantier. Un texte sans balise (saisi avant l'éditeur) reste du texte brut.
 */
public final class TexteRiche {

    static final Set<String> BALISES = Set.of("p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li");

    private static final Pattern BALISE_AUTORISEE = Pattern.compile(
            "</?(" + String.join("|", BALISES) + ")(\\s[^>]*)?/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOC_INTERDIT = Pattern.compile(
            "<(script|style|template|iframe|object|textarea)\\b[^>]*>.*?</\\1\\s*>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern COMMENTAIRE = Pattern.compile("<!--.*?-->", Pattern.DOTALL);
    private static final Pattern BALISE = Pattern.compile("<(/?)([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>");
    // L'éditeur (Quill 2.0.3) met une espace insécable entre tous les mots : le texte ne passerait plus à la ligne
    private static final Pattern ESPACE_INSECABLE = Pattern.compile("&nbsp;(?!&nbsp;)");

    private TexteRiche() {
    }

    /** Vrai si le texte vient de l'éditeur (au moins une balise de mise en forme). */
    public static boolean estHtml(String texte) {
        return texte != null && BALISE_AUTORISEE.matcher(texte).find();
    }

    /** Ne garde que les balises de mise en forme, sans attribut ; un texte brut est rendu tel quel. */
    public static String nettoyer(String texte) {
        if (!estHtml(texte)) {
            return texte;
        }
        String html = COMMENTAIRE.matcher(BLOC_INTERDIT.matcher(texte).replaceAll("")).replaceAll("");
        Matcher balises = BALISE.matcher(html);
        StringBuilder resultat = new StringBuilder();
        while (balises.find()) {
            String nom = balises.group(2).toLowerCase(Locale.ROOT);
            String remplacement = "";
            if (BALISES.contains(nom)) {
                remplacement = nom.equals("br") ? "<br>" : "<" + balises.group(1) + nom + ">";
            }
            balises.appendReplacement(resultat, Matcher.quoteReplacement(remplacement));
        }
        balises.appendTail(resultat);
        return ESPACE_INSECABLE.matcher(resultat).replaceAll(" ").trim();
    }

    /**
     * HTML réduit pour les flux d'annonces (NautiX) : gras, italique et souligné, retours à la ligne ; les paragraphes
     * deviennent des lignes et les listes des lignes à puce ou numérotées. Le texte doit venir de l'éditeur (estHtml).
     */
    public static String versHtmlSimple(String texte) {
        String html = nettoyer(texte);
        Matcher balises = BALISE.matcher(html);
        StringBuilder resultat = new StringBuilder();
        // Numéro du prochain élément de chaque liste ouverte (0 pour une liste à puces)
        Deque<int[]> listes = new ArrayDeque<>();
        int fin = 0;
        while (balises.find()) {
            resultat.append(html, fin, balises.start());
            fin = balises.end();
            boolean fermante = !balises.group(1).isEmpty();
            switch (balises.group(2).toLowerCase(Locale.ROOT)) {
                case "strong", "b" -> resultat.append(fermante ? "</b>" : "<b>");
                case "em", "i" -> resultat.append(fermante ? "</i>" : "<i>");
                case "u" -> resultat.append(fermante ? "</u>" : "<u>");
                case "br" -> resultat.append("<br>");
                case "p" -> {
                    if (fermante) {
                        finDeLigne(resultat);
                    }
                }
                case "ul", "ol" -> {
                    if (fermante) {
                        listes.poll();
                    } else {
                        // Liste imbriquée : elle commence sous la ligne de l'élément parent
                        finDeLigne(resultat);
                        listes.push(new int[] { balises.group(2).equalsIgnoreCase("ol") ? 1 : 0 });
                    }
                }
                case "li" -> {
                    if (fermante) {
                        finDeLigne(resultat);
                    } else {
                        int[] liste = listes.peek();
                        resultat.append("&nbsp;&nbsp;&nbsp;".repeat(Math.max(0, listes.size() - 1)));
                        resultat.append(liste != null && liste[0] > 0 ? (liste[0]++) + ". " : "• ");
                    }
                }
                default -> {
                    // balise retirée par nettoyer
                }
            }
        }
        resultat.append(html.substring(fin));
        return resultat.toString().replaceAll("(<br>)+$", "");
    }

    private static void finDeLigne(StringBuilder html) {
        if (html.length() > 0 && !html.toString().endsWith("<br>")) {
            html.append("<br>");
        }
    }
}
