package net.nanthrax.moussaillon.services;

import java.io.StringWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.xml.stream.XMLOutputFactory;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamWriter;

import net.nanthrax.moussaillon.persistence.AnnonceEntity;
import net.nanthrax.moussaillon.persistence.BateauCatalogueEntity;
import net.nanthrax.moussaillon.persistence.BateauClientEntity;
import net.nanthrax.moussaillon.persistence.MoteurCatalogueEntity;
import net.nanthrax.moussaillon.persistence.MoteurSerie;
import net.nanthrax.moussaillon.persistence.SocieteEntity;

/**
 * Flux d'annonces au format NautiX 1.4 (https://nautix.nautic-network.org/v1.4/NautiX.xsd),
 * standard d'échange des portails nautiques (Boat24, Bateaux.com...).
 * Le chantier est le seul compte/bureau du flux : ses coordonnées viennent de la fiche Société.
 */
public final class NautixFlux {

    public static final String VERSION = "1.4";
    static final String NAMESPACE = "https://nautix.nautic-network.org/v1.4/";
    static final String OFFICE_ID = "1";
    // La fiche Société ne porte pas de pays : le chantier est en France
    static final String PAYS = "FR";

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssxxx");
    private static final Pattern CODE_POSTAL_VILLE = Pattern.compile("^(\\d{5})\\s+(.+)$");
    private static final Pattern MOBILE = Pattern.compile("^(\\+33\\s*|0)[67].*");
    private static final Map<String, String> TYPES_IMAGE = Map.of(
            "jpg", "image/jpeg", "jpeg", "image/jpeg", "png", "image/png", "gif", "image/gif", "webp", "image/webp");

    private NautixFlux() {
    }

    // Adresse libre de la fiche Société : la dernière ligne (ou partie après une virgule) porte "code postal ville"
    record Adresse(String rue, String codePostal, String ville) {
    }

    static Adresse adresse(String adresse) {
        if (adresse == null || adresse.isBlank()) {
            return new Adresse(null, null, null);
        }
        List<String> parties = Arrays.stream(adresse.split(adresse.contains("\n") ? "\\R" : ","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
        String derniere = parties.get(parties.size() - 1);
        String rue = parties.size() > 1 ? String.join(", ", parties.subList(0, parties.size() - 1)) : null;
        Matcher m = CODE_POSTAL_VILLE.matcher(derniere);
        if (m.matches()) {
            return new Adresse(rue, m.group(1), m.group(2).trim());
        }
        return new Adresse(rue != null ? rue + ", " + derniere : derniere, null, null);
    }

    // Problèmes de la fiche Société qui rendent le flux invalide ou incomplet
    public static List<String> avertissements(SocieteEntity societe) {
        List<String> avertissements = new ArrayList<>();
        if (societe == null || estVide(societe.nom)) {
            avertissements.add("Nom de la société manquant (fiche Société)");
        }
        if (societe == null || estVide(societe.adresse)) {
            avertissements.add("Adresse de la société manquante (fiche Société)");
        } else if (adresse(societe.adresse).ville() == null) {
            avertissements.add("L'adresse de la société doit se terminer par le code postal et la ville (ex. 56000 Vannes)");
        }
        if (societe == null || estVide(societe.email)) {
            avertissements.add("Email de la société manquant (fiche Société)");
        }
        return avertissements;
    }

    // Annonces dont les données sont trop pauvres pour être bien présentées par les plateformes
    public static List<String> avertissements(List<AnnonceEntity> annonces) {
        List<String> avertissements = new ArrayList<>();
        for (AnnonceEntity annonce : annonces) {
            String libelle = "« " + (estVide(annonce.titre) ? "Annonce " + annonce.id : annonce.titre) + " »";
            if (annonce.bateau == null) {
                avertissements.add(libelle + " : aucun bateau associé, le type et le modèle ne sont pas transmis");
            }
            if (photos(annonce).isEmpty()) {
                avertissements.add(libelle + " : aucune photo");
            }
        }
        return avertissements;
    }

    public static String generer(List<AnnonceEntity> annonces, SocieteEntity societe, String urlPublique, OffsetDateTime maintenant) {
        try {
            StringWriter out = new StringWriter();
            XMLStreamWriter w = XMLOutputFactory.newInstance().createXMLStreamWriter(out);
            w.writeStartDocument("UTF-8", "1.0");
            w.writeStartElement("nautix");
            w.writeDefaultNamespace(NAMESPACE);
            w.writeAttribute("version", VERSION);
            w.writeAttribute("origin", "moussAIllon");
            w.writeAttribute("date", DATE_TIME.format(maintenant));

            w.writeStartElement("account");
            w.writeAttribute("status", "active");
            texte(w, "account_name", societe != null ? societe.nom : null);
            ecrireBureau(w, societe);
            w.writeStartElement("adverts");
            w.writeAttribute("count", String.valueOf(annonces.size()));
            for (AnnonceEntity annonce : annonces) {
                ecrireAnnonce(w, annonce, societe, urlPublique, maintenant);
            }
            w.writeEndElement(); // adverts
            w.writeEndElement(); // account

            w.writeEndElement(); // nautix
            w.writeEndDocument();
            w.close();
            return out.toString();
        } catch (XMLStreamException e) {
            throw new IllegalStateException("Génération du flux NautiX impossible", e);
        }
    }

    private static void ecrireBureau(XMLStreamWriter w, SocieteEntity societe) throws XMLStreamException {
        Adresse adresse = adresse(societe != null ? societe.adresse : null);
        w.writeStartElement("offices");
        w.writeStartElement("office");
        w.writeAttribute("id", OFFICE_ID);
        texte(w, "office_name", societe != null ? societe.nom : null);
        texte(w, "address", adresse.rue() != null ? adresse.rue() : adresse.ville());
        // Sans "code postal ville" reconnu, la ville reprend l'adresse : signalé dans les avertissements
        texte(w, "town", adresse.ville() != null ? adresse.ville() : adresse.rue());
        optionnel(w, "postcode", adresse.codePostal());
        texte(w, "country", PAYS);
        texte(w, "email", societe != null ? societe.email : null);
        w.writeStartElement("phones");
        if (societe != null && !estVide(societe.telephone)) {
            w.writeStartElement("phone");
            w.writeAttribute("type", MOBILE.matcher(societe.telephone.trim()).matches() ? "mobile" : "fixed");
            w.writeCharacters(societe.telephone.trim());
            w.writeEndElement();
        }
        w.writeEndElement(); // phones
        w.writeStartElement("languages");
        texte(w, "language", "fr");
        w.writeEndElement();
        w.writeEndElement(); // office
        w.writeEndElement(); // offices
    }

    private static void ecrireAnnonce(XMLStreamWriter w, AnnonceEntity annonce, SocieteEntity societe, String urlPublique, OffsetDateTime maintenant) throws XMLStreamException {
        Timestamp modification = annonce.dateModification != null ? annonce.dateModification : annonce.dateCreation;
        w.writeStartElement("advert");
        w.writeAttribute("id", String.valueOf(annonce.id));
        w.writeAttribute("purpose", "sale");
        w.writeAttribute("type", "boat");
        w.writeAttribute("status", "active");
        w.writeAttribute("modified", DATE_TIME.format(modification != null
                ? modification.toInstant().atZone(ZoneId.systemDefault()).toOffsetDateTime()
                : maintenant));

        w.writeStartElement("advert_data");
        texte(w, "office_id", OFFICE_ID);
        String description = description(annonce);
        if (description != null) {
            w.writeStartElement("marketing_description");
            w.writeStartElement("text");
            w.writeAttribute("language", "fr");
            w.writeCharacters(description);
            w.writeEndElement();
            w.writeEndElement();
        }
        w.writeEndElement(); // advert_data

        w.writeStartElement("sale_data");
        // Bateau d'un client du chantier : toujours d'occasion
        texte(w, "sale_class", "used");
        w.writeStartElement("price");
        if (annonce.prix > 0) {
            w.writeAttribute("type", "fixed");
            w.writeAttribute("currency", "EUR");
            w.writeCharacters(decimal(annonce.prix));
        } else {
            w.writeAttribute("type", "on-request");
        }
        w.writeEndElement();
        ecrireLocalisation(w, annonce.bateau, societe);
        w.writeEndElement(); // sale_data

        if (annonce.bateau != null) {
            ecrireBateau(w, annonce, annonce.bateau);
            ecrireMoteurs(w, annonce.bateau);
        }

        List<String> photos = photos(annonce);
        if (!photos.isEmpty()) {
            w.writeStartElement("media");
            // non-strict : md5 de l'URL, qui change avec la photo (les fichiers stockés ont un nom unique)
            w.writeAttribute("validation", "non-strict");
            w.writeStartElement("images");
            for (String photo : photos) {
                String url = urlAbsolue(photo, urlPublique);
                w.writeStartElement("image");
                w.writeAttribute("type", typeImage(photo));
                w.writeAttribute("md5", md5(url));
                w.writeCharacters(url);
                w.writeEndElement();
            }
            w.writeEndElement(); // images
            w.writeEndElement(); // media
        }

        w.writeEndElement(); // advert
    }

    // HTML autorisé par NautiX : le texte brut est échappé et ses retours à la ligne conservés ; une description mise en
    // forme garde son gras, son italique, son soulignement et ses listes (en lignes)
    static String description(AnnonceEntity annonce) {
        List<String> blocs = new ArrayList<>();
        if (!estVide(annonce.titre)) {
            blocs.add("<b>" + html(annonce.titre.trim()) + "</b>");
        }
        if (!estVide(annonce.description)) {
            String description = TexteRiche.estHtml(annonce.description)
                    ? TexteRiche.versHtmlSimple(annonce.description)
                    : html(annonce.description.trim()).replaceAll("\\R", "<br>");
            if (!description.isBlank()) {
                blocs.add(description);
            }
        }
        return blocs.isEmpty() ? null : String.join("<br><br>", blocs);
    }

    private static void ecrireLocalisation(XMLStreamWriter w, BateauClientEntity bateau, SocieteEntity societe) throws XMLStreamException {
        w.writeStartElement("location");
        w.writeAttribute("country", PAYS);
        double[] gps = gps(bateau != null ? bateau.localisationGps : null);
        if (gps != null) {
            w.writeAttribute("lat", String.valueOf(gps[0]));
            w.writeAttribute("lon", String.valueOf(gps[1]));
        }
        String lieu = bateau != null && !estVide(bateau.localisation) ? bateau.localisation.trim()
                : adresse(societe != null ? societe.adresse : null).ville();
        if (lieu != null) {
            w.writeCharacters(lieu);
        }
        w.writeEndElement();
    }

    private static void ecrireBateau(XMLStreamWriter w, AnnonceEntity annonce, BateauClientEntity bateau) throws XMLStreamException {
        BateauCatalogueEntity modele = bateau.modele;
        double longueur = modele != null ? modele.longueurExterieure : 0;
        w.writeStartElement("boat_data");
        w.writeStartElement("boat_types");
        w.writeStartElement("type");
        w.writeAttribute("primary", "true");
        w.writeCharacters(typeBateau(modele != null ? modele.type : null, longueur));
        w.writeEndElement();
        w.writeEndElement(); // boat_types
        texte(w, "model", premier(modele != null ? modele.designation : null, bateau.name, annonce.titre));
        optionnel(w, "boat_name", bateau.name);
        optionnel(w, "year_built", annee(bateau.dateMeS));
        if (modele != null) {
            if (modele.categorieCe != null && modele.categorieCe.trim().matches("[ABCD]")) {
                texte(w, "ce_design_category", modele.categorieCe.trim());
            }
            if (modele.nombrePassagersMax > 0) {
                texte(w, "ce_passenger_capacity", String.valueOf(modele.nombrePassagersMax));
            }
            List<String[]> dimensions = new ArrayList<>();
            ajouterDimension(dimensions, "loa", modele.longueurExterieure);
            ajouterDimension(dimensions, "beam", modele.largeur);
            ajouterDimension(dimensions, "draught", modele.tirantEau);
            ajouterDimension(dimensions, "clearance", modele.tirantAir);
            long poids = Math.round(modele.poidsVide);
            if (!dimensions.isEmpty() || poids > 0) {
                w.writeStartElement("dimensions");
                for (String[] dimension : dimensions) {
                    w.writeStartElement(dimension[0]);
                    w.writeAttribute("unit", "m");
                    w.writeCharacters(dimension[1]);
                    w.writeEndElement();
                }
                if (poids > 0) {
                    w.writeStartElement("displacement");
                    w.writeAttribute("unit", "kg");
                    w.writeCharacters(String.valueOf(poids));
                    w.writeEndElement();
                }
                w.writeEndElement(); // dimensions
            }
        }
        if (!estVide(bateau.numeroSerie)) {
            w.writeStartElement("hull");
            texte(w, "hin", bateau.numeroSerie.trim());
            w.writeEndElement();
        }
        List<MoteurCatalogueEntity> moteurs = bateau.moteurs != null ? bateau.moteurs : List.of();
        if (!moteurs.isEmpty()) {
            w.writeStartElement("drive");
            texte(w, "number_of_engines", String.valueOf(moteurs.size()));
            if (moteurs.stream().allMatch(m -> "outboard".equals(typeMoteur(m.type)))) {
                texte(w, "propulsion", "outboard");
            }
            w.writeEndElement();
        }
        if (modele != null && (modele.reservoirEau >= 1 || modele.reservoirCarburant >= 1)) {
            w.writeStartElement("tanks");
            reservoir(w, "freshwater", modele.reservoirEau);
            reservoir(w, "fuel", modele.reservoirCarburant);
            w.writeEndElement();
        }
        w.writeEndElement(); // boat_data
    }

    private static void ecrireMoteurs(XMLStreamWriter w, BateauClientEntity bateau) throws XMLStreamException {
        List<MoteurCatalogueEntity> moteurs = bateau.moteurs != null ? bateau.moteurs : List.of();
        if (moteurs.isEmpty()) {
            return;
        }
        // Une entrée de numéro de série par moteur physique, dans l'ordre des moteurs du bateau
        List<MoteurSerie> series = new ArrayList<>(bateau.numerosSerieMoteurs != null ? bateau.numerosSerieMoteurs : List.of());
        long heures = bateau.heuresMoteur != null ? Math.round(bateau.heuresMoteur) : 0;
        w.writeStartElement("engine_data");
        // NautiX limite à 10 moteurs par annonce
        for (MoteurCatalogueEntity moteur : moteurs.subList(0, Math.min(10, moteurs.size()))) {
            w.writeStartElement("engine");
            MoteurSerie serie = series.stream().filter(s -> moteur.id.equals(s.moteurId)).findFirst().orElse(null);
            if (serie != null) {
                series.remove(serie);
                optionnel(w, "serial_number", serie.numeroSerie);
            }
            optionnel(w, "engine_type", typeMoteur(moteur.type));
            optionnel(w, "model", moteur.designation);
            if (moteur.puissanceCv >= 0.1) {
                w.writeStartElement("power");
                w.writeAttribute("unit", "hp");
                w.writeCharacters(decimal(moteur.puissanceCv));
                w.writeEndElement();
            }
            optionnel(w, "fuel", carburant(moteur.type));
            // Le relevé d'heures est fait au niveau du bateau : il vaut pour chacun de ses moteurs
            if (heures > 0) {
                texte(w, "hours", String.valueOf(heures));
            }
            if (moteur.cylindres > 0 && moteur.cylindres <= 255) {
                texte(w, "cylinders", String.valueOf(moteur.cylindres));
            }
            if (moteur.cylindree >= 30) {
                w.writeStartElement("capacity");
                w.writeAttribute("unit", "cm3");
                w.writeCharacters(String.valueOf(moteur.cylindree));
                w.writeEndElement();
            }
            w.writeEndElement(); // engine
        }
        w.writeEndElement(); // engine_data
    }

    /**
     * Type NautiX déduit du type du catalogue (liste de référence TYPE_BATEAU, modifiable).
     * Pour une catégorie générale (bateau à moteur, voilier, autre), NautiX préconise un yacht
     * au-delà de 9 m, sinon un bateau habitable (voile) ou un day cruiser (moteur).
     */
    static String typeBateau(String type, double longueur) {
        String t = normaliser(type);
        boolean grand = longueur > 9;
        if (t.contains("catamaran")) {
            return t.contains("moteur") ? "power-catamaran" : "sail-catamaran";
        }
        if (t.contains("trimaran")) {
            return "sail-trimaran";
        }
        if (t.contains("voil")) {
            return grand ? "sail-yacht" : "sail-cabin";
        }
        if (t.contains("semi-rigide") || t.contains("semi rigide") || t.matches(".*\\brib\\b.*")) {
            return "inflatable-rib";
        }
        if (t.contains("pneumatique") || t.contains("gonflable")) {
            return "inflatable-soft";
        }
        if (t.contains("peniche")) {
            return "power-houseboat";
        }
        if (t.contains("peche")) {
            return "power-fishing";
        }
        if (t.contains("annexe")) {
            return "small-dinghy";
        }
        if (t.contains("jet") || t.contains("scooter")) {
            return "pwc-jetski";
        }
        return grand ? "power-yacht" : "power-daycruiser";
    }

    // Liste de référence TYPE_MOTEUR : Hors-bord, In-bord, Electrique, Diesel
    static String typeMoteur(String type) {
        String t = normaliser(type);
        if (t.contains("hors")) {
            return "outboard";
        }
        if (t.contains("in-bord") || t.contains("inbord")) {
            return "inboard";
        }
        return null;
    }

    static String carburant(String type) {
        String t = normaliser(type);
        if (t.contains("electrique")) {
            return "electric";
        }
        if (t.contains("diesel")) {
            return "diesel";
        }
        return null;
    }

    private static List<String> photos(AnnonceEntity annonce) {
        return annonce.photos == null ? List.of() : annonce.photos.stream()
                .filter(p -> p != null && !p.isBlank() && typeImage(p) != null)
                .toList();
    }

    // Formats d'image acceptés par NautiX, d'après l'extension du fichier stocké
    static String typeImage(String url) {
        String chemin = url.split("[?#]")[0];
        int point = chemin.lastIndexOf('.');
        return point < 0 ? null : TYPES_IMAGE.get(chemin.substring(point + 1).toLowerCase());
    }

    // Les photos sont stockées en relatif (/api/images/...) : les plateformes ont besoin d'une URL complète
    static String urlAbsolue(String url, String urlPublique) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return url;
        }
        String base = urlPublique.endsWith("/") ? urlPublique.substring(0, urlPublique.length() - 1) : urlPublique;
        return base + (url.startsWith("/") ? url : "/" + url);
    }

    static double[] gps(String valeur) {
        if (estVide(valeur)) {
            return null;
        }
        String[] parties = valeur.split(",");
        if (parties.length != 2) {
            return null;
        }
        try {
            double lat = Double.parseDouble(parties[0].trim());
            double lon = Double.parseDouble(parties[1].trim());
            return lat >= -90 && lat <= 90 && lon >= -180 && lon < 180 ? new double[] { lat, lon } : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // Date de mise en service "AAAA-MM-JJ" : seule l'année est transmise
    static String annee(String date) {
        if (date == null || !date.matches("^\\d{4}.*")) {
            return null;
        }
        int annee = Integer.parseInt(date.substring(0, 4));
        return annee >= 1700 && annee <= 2200 ? String.valueOf(annee) : null;
    }

    private static void ajouterDimension(List<String[]> dimensions, String nom, double valeur) {
        // NautiX : en mètres, 2 décimales, entre 0,01 et 460
        if (valeur >= 0.01 && valeur <= 460) {
            dimensions.add(new String[] { nom, decimal(valeur) });
        }
    }

    private static void reservoir(XMLStreamWriter w, String nom, double litres) throws XMLStreamException {
        long volume = Math.round(litres);
        if (volume < 1) {
            return;
        }
        w.writeStartElement(nom);
        w.writeAttribute("unit", "l");
        w.writeAttribute("volume", String.valueOf(volume));
        w.writeCharacters("true");
        w.writeEndElement();
    }

    static String decimal(double valeur) {
        return BigDecimal.valueOf(valeur).setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    static String md5(String valeur) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest(valeur.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String html(String texte) {
        return texte.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static String normaliser(String valeur) {
        if (valeur == null) {
            return "";
        }
        return Normalizer.normalize(valeur, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase().trim();
    }

    private static String premier(String... valeurs) {
        return Arrays.stream(valeurs).filter(v -> !estVide(v)).map(String::trim).findFirst().orElse(null);
    }

    private static boolean estVide(String valeur) {
        return valeur == null || valeur.isBlank();
    }

    // Élément obligatoire : écrit même vide (le flux sera alors refusé, d'où les avertissements)
    private static void texte(XMLStreamWriter w, String nom, String valeur) throws XMLStreamException {
        w.writeStartElement(nom);
        if (valeur != null) {
            w.writeCharacters(valeur.trim());
        }
        w.writeEndElement();
    }

    private static void optionnel(XMLStreamWriter w, String nom, String valeur) throws XMLStreamException {
        if (!estVide(valeur)) {
            texte(w, nom, valeur);
        }
    }

}
