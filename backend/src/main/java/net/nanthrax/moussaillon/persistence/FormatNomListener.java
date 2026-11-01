package net.nanthrax.moussaillon.persistence;

import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reformate les champs {@link FormatNom} avant chaque insertion ou mise à jour, quelle qu'en soit
 * l'origine (formulaire, import CSV, CLI...).
 */
public class FormatNomListener {

    private static final String SEPARATEURS = "-'’/(.&";

    private static final ClassValue<List<Field>> CHAMPS = new ClassValue<>() {
        @Override
        protected List<Field> computeValue(Class<?> type) {
            List<Field> champs = new ArrayList<>();
            for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
                for (Field champ : c.getDeclaredFields()) {
                    if (champ.isAnnotationPresent(FormatNom.class) && champ.getType() == String.class) {
                        champ.setAccessible(true);
                        champs.add(champ);
                    }
                }
            }
            return champs;
        }
    };

    @PrePersist
    @PreUpdate
    void formaterNoms(Object entite) {
        for (Field champ : CHAMPS.get(entite.getClass())) {
            try {
                String valeur = (String) champ.get(entite);
                String formatee = formater(valeur);
                if (valeur != null && !valeur.equals(formatee)) {
                    champ.set(entite, formatee);
                }
            } catch (IllegalAccessException e) {
                throw new IllegalStateException("Champ " + champ.getName() + " inaccessible", e);
            }
        }
    }

    /**
     * Remet en casse « Titre » une valeur saisie tout en majuscules ou tout en minuscules. Une casse
     * mixte est considérée comme voulue et laissée telle quelle (ex. « McDonald », « Yamaha F150 XL »).
     * Les mots contenant un chiffre (références, modèles : « F150 », « 15CV ») ne sont pas modifiés.
     */
    public static String formater(String valeur) {
        if (valeur == null) {
            return null;
        }
        boolean majuscules = valeur.equals(valeur.toUpperCase(Locale.FRENCH));
        boolean minuscules = valeur.equals(valeur.toLowerCase(Locale.FRENCH));
        if (majuscules == minuscules) {
            // Casse mixte, ou aucune lettre.
            return valeur;
        }
        StringBuilder resultat = new StringBuilder(valeur.length());
        int debut = 0;
        while (debut < valeur.length()) {
            if (estSeparateur(valeur.charAt(debut))) {
                resultat.append(valeur.charAt(debut));
                debut++;
                continue;
            }
            int fin = debut;
            while (fin < valeur.length() && !estSeparateur(valeur.charAt(fin))) {
                fin++;
            }
            String mot = valeur.substring(debut, fin);
            if (mot.chars().anyMatch(Character::isDigit)) {
                resultat.append(mot);
            } else {
                boolean premiereLettre = true;
                for (char c : mot.toCharArray()) {
                    if (Character.isLetter(c)) {
                        resultat.append(premiereLettre ? Character.toUpperCase(c) : Character.toLowerCase(c));
                        premiereLettre = false;
                    } else {
                        resultat.append(c);
                    }
                }
            }
            debut = fin;
        }
        return resultat.toString();
    }

    private static boolean estSeparateur(char c) {
        return Character.isWhitespace(c) || SEPARATEURS.indexOf(c) >= 0;
    }
}
