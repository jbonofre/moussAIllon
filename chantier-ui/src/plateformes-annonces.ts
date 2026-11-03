// Plateformes de diffusion des petites annonces. Celles marquées `flux` sont alimentées
// automatiquement par un flux XML qu'elles viennent lire ; les autres restent un suivi manuel.
export interface PlateformeAnnonce {
    key: string;
    label: string;
    color: string;
    flux?: boolean;
    // Précision sur le format attendu, affichée dans la configuration
    infoFlux?: string;
}

export const plateformes: PlateformeAnnonce[] = [
    { key: 'YOUBOAT', label: 'YouBoat', color: '#0070c0', flux: true, infoFlux: 'Format à confirmer avec YouBoat : demandez si le flux NautiX est accepté.' },
    { key: 'LEBONCOIN', label: 'Leboncoin', color: '#f56a00', flux: true, infoFlux: "Format à confirmer avec leboncoin Pro : l'import professionnel peut exiger son propre format." },
    { key: 'BAND_OF_BOATS', label: 'Band of Boats', color: '#1a3c5e' },
    { key: 'BOAT24', label: 'Boat24', color: '#006837', flux: true, infoFlux: 'Boat24 importe gratuitement les flux NautiX (compte professionnel requis).' },
    { key: 'YACHTWORLD', label: 'YachtWorld', color: '#003366' },
];

// Configuration renvoyée par le backend pour une plateforme alimentée par flux
export interface PlateformeConfig {
    id?: number;
    code: string;
    actif: boolean;
    format: string;
    notes?: string;
    derniereLecture?: string;
    urlFlux?: string;
    nombreAnnonces?: number;
    avertissements?: string[];
}

export const formatsFlux = [{ value: 'NAUTIX', label: 'NautiX 1.4' }];
