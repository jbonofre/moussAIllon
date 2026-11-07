package net.nanthrax.moussaillon.services;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.quarkus.mailer.Mail;
import org.jboss.logging.Logger;

/**
 * Emails HTML rédigés dans l'éditeur de l'application (campagnes, séquences, modèles d'emails) : le contenu est mis en
 * page dans une colonne de 600 px façon « newsletter », avec les styles en ligne que les messageries comprennent, et les
 * images de l'application sont jointes au message (affichées sans que le serveur soit joignable depuis Internet).
 * La mise en page est à garder en accord avec l'éditeur (chantier-ui, editeur-email.ts).
 */
public final class EmailHtml {

    private static final Logger LOG = Logger.getLogger(EmailHtml.class);

    static final int LARGEUR_EMAIL = 600;
    static final int MARGE_EMAIL = 20;
    static final String COULEUR_FOND = "#f4f5f7";

    private static final Pattern BALISE = Pattern.compile("<[a-zA-Z!/][^>]*>");
    private static final Pattern DOCUMENT_COMPLET = Pattern.compile("<html[\\s>]", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMAGE = Pattern.compile("<img\\b[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern SRC = Pattern.compile("(\\ssrc\\s*=\\s*)(\"[^\"]*\"|'[^']*')", Pattern.CASE_INSENSITIVE);
    private static final Pattern STYLE = Pattern.compile("(\\sstyle\\s*=\\s*)(\"([^\"]*)\"|'([^']*)')", Pattern.CASE_INSENSITIVE);
    // Image envoyée dans l'application (ImageResource) : seul un nom de fichier simple est accepté
    private static final Pattern IMAGE_LOCALE = Pattern.compile("^(?:/api)?/images/([A-Za-z0-9_-][A-Za-z0-9._-]*)$");
    private static final Pattern IMAGE_INTEGREE = Pattern.compile("^data:(image/[a-zA-Z0-9.+-]+);base64,(.*)$", Pattern.DOTALL);
    // Espaces insécables : l'éditeur (Quill 2.0.3) en met entre tous les mots, ce qui empêche le texte de passer à la ligne
    private static final Pattern ESPACE_INSECABLE = Pattern.compile("&nbsp;(?!&nbsp;)");

    // Styles par défaut des balises, en ligne : les messageries ignorent souvent les feuilles de style
    private static final Map<String, String> STYLES = new LinkedHashMap<>();
    static {
        // Pas de marge entre paragraphes, comme dans l'éditeur (les lignes vides y sont des paragraphes vides)
        STYLES.put("p", "margin:0;");
        STYLES.put("h1", "margin:0;line-height:1.25;");
        STYLES.put("h2", "margin:0;line-height:1.25;");
        STYLES.put("h3", "margin:0;line-height:1.25;");
        STYLES.put("ul", "margin:0;padding-left:1.5em;");
        STYLES.put("ol", "margin:0;padding-left:1.5em;");
        STYLES.put("blockquote", "margin:5px 0;padding-left:16px;border-left:4px solid #cccccc;");
        STYLES.put("img", "max-width:100%;height:auto;border:0;");
    }
    private static final Pattern BALISE_STYLEE = Pattern.compile(
            "<(" + String.join("|", STYLES.keySet()) + ")(?=[\\s>/])([^>]*)>", Pattern.CASE_INSENSITIVE);

    private EmailHtml() {
    }

    /** Email HTML mis en page, avec les images de l'application en pièces jointes affichées dans le message. */
    public static Mail mail(String destinataire, String sujet, String html) {
        return mail(destinataire, sujet, html, ImageResource.UPLOAD_DIR);
    }

    static Mail mail(String destinataire, String sujet, String html, Path dossierImages) {
        Mail mail = new Mail().addTo(destinataire).setSubject(sujet);
        String contenu = html != null ? html : "";
        if (!DOCUMENT_COMPLET.matcher(contenu).find()) {
            contenu = miseEnPage(styler(texteEnHtml(contenu)));
        }
        return mail.setHtml(joindreImages(mail, contenu, dossierImages));
    }

    /** Un texte sans balise (message par défaut, hors modèle) garde ses retours à la ligne. */
    static String texteEnHtml(String contenu) {
        if (BALISE.matcher(contenu).find()) {
            return ESPACE_INSECABLE.matcher(contenu).replaceAll(" ");
        }
        return contenu.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replaceAll("\\r?\\n", "<br>");
    }

    /** Ajoute les styles par défaut aux balises ; un style déjà présent (alignement, couleur...) l'emporte. */
    static String styler(String contenu) {
        Matcher balises = BALISE_STYLEE.matcher(contenu);
        StringBuilder resultat = new StringBuilder();
        while (balises.find()) {
            String nom = balises.group(1);
            String attributs = balises.group(2);
            String defaut = STYLES.get(nom.toLowerCase(Locale.ROOT));
            Matcher style = STYLE.matcher(attributs);
            String remplacement;
            if (style.find()) {
                String existant = style.group(3) != null ? style.group(3) : style.group(4);
                remplacement = "<" + nom + attributs.substring(0, style.start())
                        + " style=\"" + defaut + existant.replace("\"", "'") + "\""
                        + attributs.substring(style.end()) + ">";
            } else {
                boolean fermante = attributs.endsWith("/");
                String debut = fermante ? attributs.substring(0, attributs.length() - 1).stripTrailing() : attributs;
                remplacement = "<" + nom + debut + " style=\"" + defaut + "\"" + (fermante ? " /" : "") + ">";
            }
            balises.appendReplacement(resultat, Matcher.quoteReplacement(remplacement));
        }
        balises.appendTail(resultat);
        return resultat.toString();
    }

    /** Colonne centrée de 600 px sur fond gris, en tableaux : la seule mise en page qu'Outlook respecte. */
    static String miseEnPage(String contenu) {
        return "<!DOCTYPE html>"
                + "<html lang=\"fr\"><head>"
                + "<meta charset=\"UTF-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
                + "<style>img{max-width:100%;height:auto;}</style>"
                + "</head>"
                + "<body style=\"margin:0;padding:0;background-color:" + COULEUR_FOND + ";\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"background-color:" + COULEUR_FOND + ";\">"
                + "<tr><td align=\"center\" style=\"padding:24px 12px;\">"
                + "<table role=\"presentation\" width=\"" + LARGEUR_EMAIL + "\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\""
                + " style=\"width:100%;max-width:" + LARGEUR_EMAIL + "px;background-color:#ffffff;\">"
                + "<tr><td style=\"padding:" + MARGE_EMAIL + "px;font-family:Arial,Helvetica,sans-serif;font-size:14px;"
                + "line-height:1.5;color:#222222;text-align:left;\">"
                + contenu
                + "</td></tr></table>"
                + "</td></tr></table>"
                + "</body></html>";
    }

    /**
     * Les images de l'application (adresse relative /api/images/...) et celles intégrées en base64 deviennent des pièces
     * jointes affichées dans le message (cid:) ; les images en ligne (https://...) restent des liens.
     */
    static String joindreImages(Mail mail, String contenu, Path dossierImages) {
        Map<String, String> jointes = new LinkedHashMap<>();
        Matcher images = IMAGE.matcher(contenu);
        StringBuilder resultat = new StringBuilder();
        while (images.find()) {
            String balise = images.group();
            Matcher src = SRC.matcher(balise);
            if (src.find()) {
                String valeur = src.group(2);
                String adresse = valeur.substring(1, valeur.length() - 1).trim();
                String cid = jointes.computeIfAbsent(adresse, a -> joindre(mail, a, dossierImages, jointes.size() + 1));
                if (cid != null) {
                    balise = balise.substring(0, src.start()) + src.group(1) + "\"cid:" + cid + "\"" + balise.substring(src.end());
                }
            }
            images.appendReplacement(resultat, Matcher.quoteReplacement(balise));
        }
        images.appendTail(resultat);
        return resultat.toString();
    }

    /** Joint l'image désignée par l'adresse et renvoie son identifiant (cid), ou null si elle reste en lien. */
    private static String joindre(Mail mail, String adresse, Path dossierImages, int numero) {
        Matcher locale = IMAGE_LOCALE.matcher(adresse);
        if (locale.matches()) {
            String nom = locale.group(1);
            Path dossier = dossierImages.toAbsolutePath().normalize();
            Path fichier = dossier.resolve(nom).normalize();
            if (!fichier.startsWith(dossier) || !Files.isRegularFile(fichier)) {
                LOG.warnf("Image %s introuvable : elle ne sera pas affichée dans l'email", adresse);
                return null;
            }
            String cid = nom + "@moussaillon";
            mail.addInlineAttachment(nom, fichier.toFile(), typeImage(fichier), "<" + cid + ">");
            return cid;
        }
        Matcher integree = IMAGE_INTEGREE.matcher(adresse);
        if (integree.matches()) {
            byte[] donnees;
            try {
                donnees = Base64.getMimeDecoder().decode(integree.group(2));
            } catch (IllegalArgumentException e) {
                return null;
            }
            String type = integree.group(1).toLowerCase(Locale.ROOT);
            String nom = "image-" + numero + "." + type.substring("image/".length()).replaceAll("[^a-z0-9]", "");
            String cid = nom + "@moussaillon";
            mail.addInlineAttachment(nom, donnees, type, "<" + cid + ">");
            return cid;
        }
        return null;
    }

    private static String typeImage(Path fichier) {
        try {
            String type = Files.probeContentType(fichier);
            if (type != null) {
                return type;
            }
        } catch (IOException e) {
            // type déduit de l'extension ci-dessous
        }
        String nom = fichier.getFileName().toString().toLowerCase(Locale.ROOT);
        if (nom.endsWith(".png")) return "image/png";
        if (nom.endsWith(".gif")) return "image/gif";
        if (nom.endsWith(".webp")) return "image/webp";
        if (nom.endsWith(".jpg") || nom.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }
}
