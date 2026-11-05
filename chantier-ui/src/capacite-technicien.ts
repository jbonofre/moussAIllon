// Capacité de travail d'un technicien (KPIs atelier) : jours travaillés et types d'absence

// Jours de la semaine, numérotés comme le backend (1 = lundi ... 7 = dimanche)
export const JOURS_SEMAINE = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mer' },
    { value: 4, label: 'Jeu' },
    { value: 5, label: 'Ven' },
    { value: 6, label: 'Sam' },
    { value: 7, label: 'Dim' },
];

// Semaine retenue quand les jours travaillés ne sont pas renseignés
export const SEMAINE_DEFAUT = [1, 2, 3, 4, 5];

// Jours travaillés enregistrés (« 1,2,3,4,5 ») vers les cases à cocher du formulaire
export const joursDepuisFiche = (jours?: string | null): number[] => {
    const valeurs = (jours || '').split(',').map((j) => Number(j.trim())).filter((j) => j >= 1 && j <= 7);
    return valeurs.length > 0 ? valeurs : SEMAINE_DEFAUT;
};

// Cases cochées vers la fiche ; aucune case cochée revient à la semaine par défaut
export const joursVersFiche = (jours?: number[]): string | undefined =>
    jours && jours.length > 0 ? [...jours].sort((a, b) => a - b).join(',') : undefined;

export const TYPES_ABSENCE = [
    { value: 'CONGES', label: 'Congés' },
    { value: 'MALADIE', label: 'Maladie' },
    { value: 'FORMATION', label: 'Formation' },
    { value: 'AUTRE', label: 'Autre' },
];

export const libelleTypeAbsence = (type?: string) => TYPES_ABSENCE.find((t) => t.value === type)?.label ?? 'Autre';
