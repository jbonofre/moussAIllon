// Libellés et recherche des produits / mains d'œuvre composant les lignes d'un forfait.

export interface LigneOption {
    value: number;
    label: string;
    search: string;
}

const searchText = (parts: Array<string | undefined | null>) => parts.filter(Boolean).join(' ').toLowerCase();

// Un produit se recherche par référence interne (et codes barres), référence fournisseur ou désignation.
// Les références fournisseur ne sont renseignées que par /catalogue/produits/search.
export const produitLigneOptions = (produits: any[]): LigneOption[] =>
    produits.map((p) => ({
        value: p.id,
        label: p.ref ? `${p.ref} - ${p.designation}` : p.designation,
        search: searchText([p.ref, p.designation, ...(p.refs || []), ...(p.referencesFournisseurs || [])]),
    }));

export const mainOeuvreLigneOptions = (mainOeuvres: any[]): LigneOption[] =>
    mainOeuvres.map((mo) => ({
        value: mo.id,
        label: mo.reference ? `${mo.reference} - ${mo.nom}` : mo.nom,
        search: searchText([mo.reference, mo.nom]),
    }));

export const filterLigneOption = (input: string, option?: { search?: string }) =>
    (option?.search || '').includes(input.trim().toLowerCase());
