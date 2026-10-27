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

// Comme au backend, la désignation est unique au catalogue, sans tenir compte de la casse
export const erreurDesignationLibre = (
    designation: string | undefined,
    catalogue: ArticleCatalogue[],
    autresLignesLibres: LigneLibre[],
): string | undefined => {
    const saisie = normaliser(designation);
    if (!saisie) return 'Désignation requise';
    if (catalogue.some((article) => normaliser(article.designation) === saisie)) return 'Article déjà au catalogue';
    if (autresLignesLibres.some((ligne) => normaliser(ligne.designation) === saisie)) return 'Déjà saisie sur une autre ligne';
    return undefined;
};

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

// Article créé pour une ligne libre, retrouvé par sa désignation parmi les produits de la vente enregistrée
export const articleCreePourLigneLibre = <P extends ArticleCatalogue>(ligne: LigneLibre, produitsVendus: P[]): P | undefined => {
    const designation = normaliser(ligne.designation);
    return produitsVendus.find((produit) => !!produit.id && normaliser(produit.designation) === designation);
};

// La ligne libre prend place avant la ligne vide de saisie qui termine la liste, recréée au besoin
export const insererLigneLibre = <L>(lignes: L[], ligneLibre: L, ligneVide: L, estVide: (ligne: L) => boolean): L[] => {
    const derniere = lignes[lignes.length - 1];
    return derniere !== undefined && estVide(derniere)
        ? [...lignes.slice(0, -1), ligneLibre, derniere]
        : [...lignes, ligneLibre, ligneVide];
};
