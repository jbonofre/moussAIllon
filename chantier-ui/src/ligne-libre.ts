// Ligne libre d'une vente comptoir ou d'une transaction : l'article n'est pas choisi dans le catalogue
// mais saisi sur la ligne (référence, désignation, prix TTC, TVA). Le backend le crée au catalogue
// à l'enregistrement de la vente.

export interface LigneLibre {
    ref?: string;
    designation?: string;
    prixVenteTTC?: number;
    tva?: number;
}

export const TVA_LIGNE_LIBRE_DEFAUT = 20;

export const nouvelleLigneLibre = (): LigneLibre => ({ tva: TVA_LIGNE_LIBRE_DEFAUT });

// Article d'une ligne de vente sans identifiant : le backend le crée au catalogue
export interface ArticleALaVolee {
    ref?: string;
    designation: string;
    prixVenteTTC: number;
    tva: number;
}

export const articleALaVolee = (ligne: LigneLibre): ArticleALaVolee => ({
    ref: ligne.ref?.trim() || undefined,
    designation: (ligne.designation || '').trim(),
    prixVenteTTC: ligne.prixVenteTTC || 0,
    tva: ligne.tva ?? TVA_LIGNE_LIBRE_DEFAUT,
});

interface ArticleCatalogue {
    id?: number;
    designation?: string;
    ref?: string;
}

const normaliser = (valeur?: string) => (valeur || '').trim().toLowerCase();

// Seule la référence est unique au catalogue : plusieurs articles peuvent partager une désignation
export const erreurDesignationLibre = (designation: string | undefined): string | undefined =>
    normaliser(designation) ? undefined : 'Désignation requise';

// La référence est facultative (générée par le backend), mais ne doit pas désigner un autre article
export const erreurRefLibre = (
    ref: string | undefined,
    catalogue: ArticleCatalogue[],
    autresLignesLibres: LigneLibre[],
): string | undefined => {
    const saisie = normaliser(ref);
    if (!saisie) return undefined;
    if (catalogue.some((article) => normaliser(article.ref) === saisie)) return 'Référence déjà utilisée';
    if (autresLignesLibres.some((ligne) => normaliser(ligne.ref) === saisie)) return 'Déjà saisie sur une autre ligne';
    return undefined;
};

// Article créé pour une ligne libre, retrouvé parmi les produits de la vente enregistrée : par sa référence
// quand elle est saisie, sinon par sa désignation (non unique) en écartant les articles déjà attribués
// (lignes du catalogue de la vente, lignes libres précédentes).
export const articleCreePourLigneLibre = <P extends ArticleCatalogue>(
    ligne: LigneLibre,
    produitsVendus: P[],
    dejaAttribues: Set<number> = new Set(),
): P | undefined => {
    const ref = normaliser(ligne.ref);
    const designation = normaliser(ligne.designation);
    const article = produitsVendus.find((produit) => !!produit.id && !dejaAttribues.has(produit.id)
        && (ref ? normaliser(produit.ref) === ref : normaliser(produit.designation) === designation));
    if (article?.id) dejaAttribues.add(article.id);
    return article;
};

// La ligne libre prend place avant la ligne vide de saisie qui termine la liste, recréée au besoin
export const insererLigneLibre = <L>(lignes: L[], ligneLibre: L, ligneVide: L, estVide: (ligne: L) => boolean): L[] => {
    const derniere = lignes[lignes.length - 1];
    return derniere !== undefined && estVide(derniere)
        ? [...lignes.slice(0, -1), ligneLibre, derniere]
        : [...lignes, ligneLibre, ligneVide];
};
