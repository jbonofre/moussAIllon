package net.nanthrax.moussaillon.services;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import net.nanthrax.moussaillon.persistence.ClientEntity;
import net.nanthrax.moussaillon.persistence.RappelHistoriqueEntity;
import net.nanthrax.moussaillon.persistence.SocieteEntity;

/**
 * Courriers des relances de paiement (mise en demeure), réunis dans un PDF à imprimer : une lettre par relance, avec
 * l'adresse du client placée pour une enveloppe à fenêtre, l'objet et le message préparés à partir du modèle d'email
 * de la relance. La lettre est datée de sa première impression.
 */
@ApplicationScoped
public class RelanceCourrierService {

    private static final DateTimeFormatter FORMAT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final PDRectangle FORMAT = PDRectangle.A4;
    private static final float MARGE = 56f;
    private static final float LARGEUR = FORMAT.getWidth() - 2 * MARGE;
    // Bloc destinataire dans la fenêtre d'une enveloppe DL (110 mm du bord gauche, 50 mm du haut)
    private static final float X_DESTINATAIRE = 312f;
    private static final float Y_DESTINATAIRE = FORMAT.getHeight() - 142f;
    private static final float TAILLE = 10.5f;
    private static final float INTERLIGNE = 14f;
    private static final float ESPACE_PARAGRAPHE = 7f;
    private static final float BAS_DE_PAGE = 60f;

    private static final Pattern JETONS_HTML = Pattern.compile("<[^>]*>|[^<]+");
    // Mots et espaces : l'espace insécable (&nbsp;) reste dans le mot
    private static final Pattern MOTS = Pattern.compile("[^ \\t\\r\\n]+|[ \\t\\r\\n]+");
    private static final Pattern ENTITES = Pattern.compile("&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z]+);");
    private static final Map<String, String> ENTITES_NOMMEES = Map.of(
        "nbsp", " ", "amp", "&", "lt", "<", "gt", ">", "quot", "\"", "apos", "'",
        "rsquo", "’", "lsquo", "‘", "laquo", "«", "raquo", "»");

    /** Mot du message, en gras ou non, séparé du précédent par une espace ou accolé à lui. */
    record Mot(String texte, boolean gras, boolean espaceAvant) {}

    /** Ligne du message (renvoyée à la ligne à l'impression), suivie d'un espace si elle termine un paragraphe. */
    record Ligne(List<Mot> mots, boolean finParagraphe) {}

    public byte[] generer(List<RappelHistoriqueEntity> courriers, SocieteEntity societe) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            Redaction redaction = new Redaction(doc, societe != null ? FacturXService.buildInfosLegales(societe) : "");
            for (RappelHistoriqueEntity courrier : courriers) {
                ecrireLettre(redaction, societe, courrier);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private static void ecrireLettre(Redaction r, SocieteEntity societe, RappelHistoriqueEntity courrier) throws IOException {
        r.nouvellePage();
        float yExpediteur = r.y;
        if (societe != null) {
            yExpediteur = r.bloc(r.gras, 12, List.of(texte(societe.nom)), MARGE, yExpediteur);
            List<String> coordonnees = new ArrayList<>(lignesAdresse(societe.adresse));
            if (societe.telephone != null && !societe.telephone.isBlank()) {
                coordonnees.add("Tél. : " + societe.telephone);
            }
            if (societe.email != null && !societe.email.isBlank()) {
                coordonnees.add(societe.email);
            }
            yExpediteur = r.bloc(r.normal, 9, coordonnees, MARGE, yExpediteur);
        }

        ClientEntity client = courrier.vente.client;
        float yDestinataire = r.bloc(r.gras, 11, List.of(texte(client.nom)), X_DESTINATAIRE, Y_DESTINATAIRE);
        yDestinataire = r.bloc(r.normal, TAILLE, lignesAdresse(client.adresse), X_DESTINATAIRE, yDestinataire);

        Timestamp date = courrier.dateImpression != null ? courrier.dateImpression : new Timestamp(System.currentTimeMillis());
        r.y = Math.min(yExpediteur, yDestinataire) - 2 * INTERLIGNE;
        r.ecrire(r.normal, TAILLE, "Le " + FORMAT_DATE.format(date.toLocalDateTime().toLocalDate()), X_DESTINATAIRE, r.y);
        r.y -= 3 * INTERLIGNE;

        List<Mot> objet = new ArrayList<>();
        objet.add(new Mot("Objet :", true, false));
        for (Ligne ligne : lignes(texte(courrier.sujet))) {
            for (Mot mot : ligne.mots()) {
                objet.add(new Mot(mot.texte(), true, true));
            }
        }
        r.message(List.of(new Ligne(objet, true)));
        r.y -= INTERLIGNE;
        r.message(lignes(texte(courrier.contenu)));
        r.fermer();
    }

    private static String texte(String valeur) {
        return valeur != null ? valeur : "";
    }

    private static List<String> lignesAdresse(String adresse) {
        List<String> lignes = new ArrayList<>();
        if (adresse != null) {
            for (String ligne : adresse.split("\\r?\\n")) {
                if (!ligne.isBlank()) {
                    lignes.add(ligne.trim());
                }
            }
        }
        return lignes;
    }

    /**
     * Lignes d'un message HTML (modèle d'email) : les paragraphes, retours à la ligne et éléments de liste sont conservés,
     * ainsi que le gras ; les autres balises sont retirées.
     */
    static List<Ligne> lignes(String html) {
        List<Ligne> lignes = new ArrayList<>();
        List<Mot> courante = new ArrayList<>();
        int gras = 0;
        boolean espace = false;
        // Lignes produites par des <br> depuis l'ouverture du paragraphe : un <p><br></p> n'ajoute qu'une ligne vide
        int lignesDuParagraphe = 0;
        Matcher jetons = JETONS_HTML.matcher(html);
        while (jetons.find()) {
            String jeton = jetons.group();
            if (!jeton.startsWith("<")) {
                Matcher mots = MOTS.matcher(decoder(jeton));
                while (mots.find()) {
                    String mot = mots.group();
                    if (Character.isWhitespace(mot.charAt(0))) {
                        espace = true;
                    } else {
                        courante.add(new Mot(mot, gras > 0, espace));
                        espace = false;
                    }
                }
                continue;
            }
            boolean fermante = jeton.startsWith("</");
            String balise = jeton.replaceAll("[</>]", " ").trim().split("\\s+")[0].toLowerCase(Locale.ROOT);
            switch (balise) {
                case "strong", "b" -> gras = Math.max(0, gras + (fermante ? -1 : 1));
                case "br" -> {
                    lignes.add(new Ligne(courante, false));
                    courante = new ArrayList<>();
                    espace = false;
                    lignesDuParagraphe++;
                }
                case "p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6" -> {
                    if (fermante) {
                        if (courante.isEmpty() && lignesDuParagraphe > 0) {
                            Ligne derniere = lignes.remove(lignes.size() - 1);
                            lignes.add(new Ligne(derniere.mots(), true));
                        } else {
                            lignes.add(new Ligne(courante, true));
                        }
                        courante = new ArrayList<>();
                    } else {
                        if (!courante.isEmpty()) {
                            lignes.add(new Ligne(courante, false));
                            courante = new ArrayList<>();
                        }
                        if (balise.equals("li")) {
                            courante.add(new Mot("•", false, false));
                        }
                    }
                    espace = !fermante && balise.equals("li");
                    lignesDuParagraphe = 0;
                }
                default -> {
                    // Balise de mise en forme sans effet sur le courrier (em, u, span, a, ol, ul...)
                }
            }
        }
        if (!courante.isEmpty()) {
            lignes.add(new Ligne(courante, true));
        }
        return lignes;
    }

    private static String decoder(String texte) {
        Matcher entites = ENTITES.matcher(texte);
        StringBuilder resultat = new StringBuilder();
        while (entites.find()) {
            String nom = entites.group(1);
            String remplacement;
            if (nom.startsWith("#x")) {
                remplacement = new String(Character.toChars(Integer.parseInt(nom.substring(2), 16)));
            } else if (nom.startsWith("#")) {
                remplacement = new String(Character.toChars(Integer.parseInt(nom.substring(1))));
            } else {
                remplacement = ENTITES_NOMMEES.getOrDefault(nom, entites.group());
            }
            entites.appendReplacement(resultat, Matcher.quoteReplacement(remplacement));
        }
        entites.appendTail(resultat);
        return resultat.toString();
    }

    /** Écriture des lettres page après page, avec les mentions légales de la société en pied de page. */
    private static final class Redaction {
        private final PDDocument doc;
        private final String piedDePage;
        private final PDType1Font normal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        private final PDType1Font gras = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
        private PDPageContentStream flux;
        private float y;

        Redaction(PDDocument doc, String piedDePage) {
            this.doc = doc;
            this.piedDePage = piedDePage;
        }

        void nouvellePage() throws IOException {
            fermer();
            PDPage page = new PDPage(FORMAT);
            doc.addPage(page);
            flux = new PDPageContentStream(doc, page);
            if (!piedDePage.isBlank()) {
                float largeur = largeur(normal, 7.5f, piedDePage);
                ecrire(normal, 7.5f, piedDePage, Math.max(MARGE, (FORMAT.getWidth() - largeur) / 2), 30f);
            }
            y = FORMAT.getHeight() - MARGE;
        }

        void fermer() throws IOException {
            if (flux != null) {
                flux.close();
                flux = null;
            }
        }

        /** Lignes courtes (coordonnées) écrites telles quelles à partir de yDebut ; renvoie la position suivante. */
        float bloc(PDType1Font police, float taille, List<String> lignes, float x, float yDebut) throws IOException {
            float yLigne = yDebut;
            for (String ligne : lignes) {
                ecrire(police, taille, ligne, x, yLigne);
                yLigne -= taille + 3;
            }
            return yLigne;
        }

        /** Lignes du message renvoyées à la ligne dans la largeur de la page, avec saut de page si nécessaire. */
        void message(List<Ligne> lignes) throws IOException {
            for (Ligne ligne : lignes) {
                List<Mot> courante = new ArrayList<>();
                float largeurCourante = 0;
                for (Mot mot : ligne.mots()) {
                    float largeurMot = largeur(police(mot), TAILLE, mot.texte());
                    float espace = courante.isEmpty() || !mot.espaceAvant() ? 0 : largeur(police(mot), TAILLE, " ");
                    if (!courante.isEmpty() && largeurCourante + espace + largeurMot > LARGEUR) {
                        imprimer(courante);
                        courante = new ArrayList<>();
                        largeurCourante = 0;
                        espace = 0;
                    }
                    courante.add(mot);
                    largeurCourante += espace + largeurMot;
                }
                imprimer(courante);
                if (ligne.finParagraphe()) {
                    y -= ESPACE_PARAGRAPHE;
                }
            }
        }

        private void imprimer(List<Mot> mots) throws IOException {
            if (y < BAS_DE_PAGE) {
                nouvellePage();
            }
            float x = MARGE;
            for (int i = 0; i < mots.size(); i++) {
                Mot mot = mots.get(i);
                if (i > 0 && mot.espaceAvant()) {
                    x += largeur(police(mot), TAILLE, " ");
                }
                ecrire(police(mot), TAILLE, mot.texte(), x, y);
                x += largeur(police(mot), TAILLE, mot.texte());
            }
            y -= INTERLIGNE;
        }

        private PDType1Font police(Mot mot) {
            return mot.gras() ? gras : normal;
        }

        void ecrire(PDType1Font police, float taille, String texte, float x, float yTexte) throws IOException {
            flux.beginText();
            flux.setFont(police, taille);
            flux.newLineAtOffset(x, yTexte);
            flux.showText(winAnsi(police, texte));
            flux.endText();
        }

        private static float largeur(PDType1Font police, float taille, String texte) throws IOException {
            return police.getStringWidth(winAnsi(police, texte)) / 1000f * taille;
        }

        // Les polices standard n'encodent que le jeu WinAnsi (Latin-1, €, guillemets typographiques...)
        private static String winAnsi(PDType1Font police, String texte) {
            StringBuilder resultat = new StringBuilder();
            texte.codePoints().forEach(c -> {
                String caractere = c == 0x00A0 || c == 0x202F ? " " : new String(Character.toChars(c));
                try {
                    police.encode(caractere);
                    resultat.append(caractere);
                } catch (IOException | IllegalArgumentException e) {
                    resultat.append('?');
                }
            });
            return resultat.toString();
        }
    }
}
