export interface TacheRecherchable {
    itemNom?: string;
    clientNom?: string;
    bateauNom?: string;
    bateauImmatriculation?: string;
}

// Minuscules et sans accents : « Galatée » se trouve en tapant « galatee »
const normaliser = (texte: string) =>
    texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Recherche rapide d'une tâche par client, bateau, immatriculation ou opération.
 * Chaque mot saisi doit être trouvé : « dupont galatee » ne garde que les tâches
 * du client Dupont sur le bateau Galatée. Une recherche vide garde tout.
 */
export const tacheCorrespond = (tache: TacheRecherchable, recherche: string) => {
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
    if (mots.length === 0) return true;
    const texte = normaliser([
        tache.clientNom,
        tache.bateauNom,
        tache.bateauImmatriculation,
        // L'immatriculation se tape aussi sans espace (« CC123 » pour « CC 123 »)
        tache.bateauImmatriculation?.replace(/\s+/g, ''),
        tache.itemNom,
    ].filter(Boolean).join(' '));
    return mots.every((mot) => texte.includes(mot));
};

export const libelleBateau = (tache: TacheRecherchable) => {
    if (!tache.bateauNom) return tache.bateauImmatriculation || '-';
    return tache.bateauImmatriculation ? `${tache.bateauNom} (${tache.bateauImmatriculation})` : tache.bateauNom;
};

export const PLACEHOLDER_RECHERCHE = 'Client, bateau ou immatriculation';
