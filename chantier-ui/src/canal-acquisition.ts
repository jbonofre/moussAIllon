// Libellés des canaux d'acquisition des clients (champ canalAcquisition).
export const CANAL_ACQUISITION_LABELS: Record<string, string> = {
    BOUCHE_A_OREILLE: 'Bouche à oreille',
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    LINKEDIN: 'LinkedIn',
    PASSAGE: 'Passage',
    SITE_INTERNET: 'Site Internet',
    PAGES_JAUNES: 'Pages Jaunes',
};

export const libelleCanalAcquisition = (canal?: string | null): string =>
    (canal && CANAL_ACQUISITION_LABELS[canal]) || 'Non renseigné';
