interface TacheSaisie {
    nom?: string;
    description?: string;
}

interface TacheStockee extends TacheSaisie {
    mainOeuvreIndex?: number | null;
}

// Tâches (checklist) d'une ligne de main d'oeuvre, à partir de la liste plate stockée sur le service ou le forfait.
// Les tâches non rattachées (anciennes checklists) vont sur la première ligne affichée.
export const tachesDeLigne = (taches: TacheStockee[] | undefined, index: number, premiereLigne: boolean): TacheSaisie[] =>
    (taches || [])
        .filter((t) => t.mainOeuvreIndex === index || (premiereLigne && (t.mainOeuvreIndex === null || t.mainOeuvreIndex === undefined)))
        .map((t) => ({ nom: t.nom || '', description: t.description || '' }));

// Liste plate des tâches à enregistrer, chacune rattachée au rang de sa ligne de main d'oeuvre
export const aplatirTaches = (lignes: Array<{ taches?: TacheSaisie[] }>) =>
    lignes.flatMap((ligne, index) =>
        (ligne.taches || [])
            .filter((t) => t.nom?.trim())
            .map((t) => ({ nom: t.nom, description: t.description || '', done: false, mainOeuvreIndex: index }))
    );
