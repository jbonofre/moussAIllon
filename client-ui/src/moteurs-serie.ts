// Un moteur par entrée (modèles identiques possibles), avec son numéro de série s'il est renseigné
export const moteursAvecSerie = (
    moteurs?: Array<{ id: number; designation?: string }>,
    series?: Array<{ moteurId: number; numeroSerie: string }>,
): string[] => {
    const restantes = [...(series || [])];
    return (moteurs || []).map((m) => {
        const index = restantes.findIndex((s) => s.moteurId === m.id);
        const serie = index >= 0 ? restantes.splice(index, 1)[0].numeroSerie : undefined;
        const nom = m.designation || `#${m.id}`;
        return serie ? `${nom} - N° série ${serie}` : nom;
    });
};
