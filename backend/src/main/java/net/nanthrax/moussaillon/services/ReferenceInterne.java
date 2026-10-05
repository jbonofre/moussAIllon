package net.nanthrax.moussaillon.services;

/** Génération de la référence interne des articles du catalogue lorsqu'elle n'est pas renseignée. */
public final class ReferenceInterne {

    private ReferenceInterne() {
    }

    public static boolean absente(String ref) {
        return ref == null || ref.isBlank();
    }

    /** Construit une référence unique à partir du préfixe du type et de l'identifiant (ex. BAT-000012). */
    public static String generer(String prefixe, Long id) {
        return String.format("%s-%06d", prefixe, id);
    }
}
