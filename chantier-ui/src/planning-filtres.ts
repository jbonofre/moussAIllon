export type TypePrestation = 'forfait' | 'service';
export type FiltreBonPourAccord = 'avec' | 'sans';

export interface FiltresPlanning {
    recherche?: string;
    technicienId?: number;
    type?: TypePrestation;
    bonPourAccord?: FiltreBonPourAccord;
}

export interface LignePlanningFiltrable {
    vente: { bonPourAccord?: boolean };
    item: {
        type: TypePrestation;
        nom?: string;
        clientNom?: string;
        bateauNom?: string;
        bateauImmatriculation?: string;
        techniciens?: Array<{ id: number }>;
    };
}

// Minuscules et sans accents : « Hélène » se trouve en tapant « helene ».
const normaliser = (texte: string) =>
    texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Sans espaces ni ponctuation : « CM-123 456 » se trouve en tapant « cm123456 ».
const compacter = (texte: string) => texte.replace(/[^a-z0-9]/g, '');

/**
 * Chaque mot de la recherche doit se retrouver dans au moins un des champs :
 * « dupont bavaria » trouve le bateau Bavaria du client Dupont.
 */
export const correspondRecherche = (champs: Array<string | undefined>, recherche?: string) => {
    const termes = normaliser(recherche || '').split(/\s+/).filter(Boolean);
    if (termes.length === 0) {
        return true;
    }
    const textes = champs.filter((champ): champ is string => !!champ).map(normaliser);
    const compacts = textes.map(compacter);
    return termes.every((terme) => {
        const termeCompact = compacter(terme);
        return textes.some((texte) => texte.includes(terme))
            || (termeCompact !== '' && compacts.some((compact) => compact.includes(termeCompact)));
    });
};

/** Filtres communs à toutes les sections du planning (le statut est traité à part, section par section). */
export const correspondFiltres = (ligne: LignePlanningFiltrable, filtres: FiltresPlanning) => {
    const { item, vente } = ligne;
    if (filtres.technicienId && !(item.techniciens || []).some((t) => t.id === filtres.technicienId)) {
        return false;
    }
    if (filtres.type && item.type !== filtres.type) {
        return false;
    }
    if (filtres.bonPourAccord && !!vente.bonPourAccord !== (filtres.bonPourAccord === 'avec')) {
        return false;
    }
    return correspondRecherche([item.clientNom, item.bateauNom, item.bateauImmatriculation, item.nom], filtres.recherche);
};

export const nombreFiltresActifs = (filtres: FiltresPlanning & { statut?: string }) =>
    [filtres.recherche?.trim(), filtres.technicienId, filtres.type, filtres.bonPourAccord, filtres.statut].filter(Boolean).length;
