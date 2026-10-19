// Packages du catalogue : regroupements d'articles (produits, bateaux, moteurs, hélices, remorques) et de forfaits
// dont les lignes sont recopiées dans une vente comptoir ou une transaction.

export type TypeArticlePackage = 'produit' | 'bateau' | 'moteur' | 'helice' | 'remorque' | 'forfait';

export const TYPES_ARTICLE_PACKAGE: TypeArticlePackage[] = ['produit', 'bateau', 'moteur', 'helice', 'remorque', 'forfait'];

export interface ArticlePackage {
    id: number;
    designation: string;
    ref?: string;
    prixVenteTTC?: number;
}

export interface ForfaitPackage {
    id: number;
    nom: string;
    reference?: string;
    prixTTC?: number;
}

// Un forfait se présente comme un article : son nom, sa référence et son prix TTC
export const forfaitVersArticle = ({ id, nom, reference, prixTTC }: ForfaitPackage): ArticlePackage =>
    ({ id, designation: nom, ref: reference, prixVenteTTC: prixTTC });

// Une ligne ne désigne qu'un seul article, porté par le champ de son type
export interface PackageLigne {
    id?: number;
    produit?: ArticlePackage;
    bateau?: ArticlePackage;
    moteur?: ArticlePackage;
    helice?: ArticlePackage;
    remorque?: ArticlePackage;
    forfait?: ForfaitPackage;
    quantite?: number;
}

export interface PackageEntity {
    id?: number;
    designation: string;
    ref?: string;
    description?: string;
    lignes?: PackageLigne[];
}

export interface ArticleDePackage {
    type: TypeArticlePackage;
    article: ArticlePackage;
    quantite: number;
}

// Articles d'un package, dans l'ordre de ses lignes
export const articlesDuPackage = (pack?: PackageEntity | null): ArticleDePackage[] =>
    (pack?.lignes || []).flatMap((ligne) => {
        const type = TYPES_ARTICLE_PACKAGE.find((t) => ligne?.[t]?.id);
        if (!type) return [];
        const article = type === 'forfait' ? forfaitVersArticle(ligne.forfait!) : ligne[type] as ArticlePackage;
        return [{ type, article, quantite: Math.max(1, Math.floor(ligne.quantite || 1)) }];
    });

export const totalPackageTTC = (pack?: PackageEntity | null): number =>
    Math.round((articlesDuPackage(pack).reduce((total, { article, quantite }) => total + (article.prixVenteTTC || 0) * quantite, 0) + Number.EPSILON) * 100) / 100;

export const getPackageLabel = (pack: PackageEntity): string =>
    pack.ref ? `${pack.ref} - ${pack.designation}` : pack.designation;

// Identifiant d'un package choisi dans un sélecteur de lignes de vente (valeur « package:<id> »)
export const parsePackageRef = (ref?: string): number | undefined => {
    const [type, idStr] = (ref || '').split(':');
    const id = parseInt(idStr, 10);
    return type === 'package' && !isNaN(id) ? id : undefined;
};
