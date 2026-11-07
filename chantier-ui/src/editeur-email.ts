// Mise en page des emails rédigés dans l'éditeur, à garder en accord avec EmailHtml côté serveur.

/** Largeur de la colonne de l'email (px). */
export const LARGEUR_EMAIL = 600;
/** Marge intérieure de la colonne (px). */
export const MARGE_EMAIL = 20;
/** Largeur utile pour le texte et les images (px). */
export const LARGEUR_CONTENU = LARGEUR_EMAIL - 2 * MARGE_EMAIL;
/** Largeur maximale des images enregistrées : le double de la colonne, pour rester nettes sur les écrans haute densité. */
export const LARGEUR_STOCKEE = LARGEUR_CONTENU * 2;

export const STYLE_SEPARATEUR = 'border:none;border-top:1px solid #d9d9d9;margin:16px 0;';

/** Largeur d'affichage d'une image insérée : sa taille d'origine, dans la limite de la colonne (0 si inconnue). */
export function largeurParDefaut(largeurNaturelle: number): number {
    return largeurNaturelle > 0 ? Math.min(largeurNaturelle, LARGEUR_CONTENU) : 0;
}

/**
 * Format dans lequel une image est enregistrée : JPEG et PNG gardent le leur, le WebP (mal affiché par Outlook) passe
 * en JPEG. Null pour les formats laissés tels quels, comme le GIF (souvent animé).
 */
export function typeApresConversion(type: string): string | null {
    if (type === 'image/jpeg' || type === 'image/png') return type;
    if (type === 'image/webp') return 'image/jpeg';
    return null;
}

/**
 * Adresse d'un lien ou d'une image : complétée en https:// quand elle n'a pas de protocole (www.exemple.fr). Les
 * adresses relatives, les ancres et les variables des modèles ({lien}) restent telles quelles.
 */
export function normaliserLien(url: string): string {
    const adresse = url.trim();
    if (!adresse || /^[a-z][a-z0-9+.-]*:/i.test(adresse) || /^[/#?{]/.test(adresse)) return adresse;
    return 'https://' + adresse;
}
