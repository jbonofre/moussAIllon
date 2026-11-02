interface PointChecklist {
    nom?: string;
    done?: boolean;
    nonFait?: boolean;
    motif?: string;
}

interface PrestationAvecChecklist {
    status?: string;
    incidentDate?: string;
    incidentDetails?: string;
    forfait?: { nom?: string };
    service?: { nom?: string };
    taches?: PointChecklist[];
}

interface VenteAvecChecklist {
    venteForfaits?: PrestationAvecChecklist[];
    venteServices?: PrestationAvecChecklist[];
}

export interface ProgressionChecklist {
    total: number;
    traites: number;
    pourcentage: number;
}

// Part des points de checklist de la vente marqués « fait » ou « non fait » (null s'il n'y a aucun point)
export const progressionChecklist = (vente?: VenteAvecChecklist | null): ProgressionChecklist | null => {
    const points = [
        ...(vente?.venteForfaits || []).flatMap((vf) => vf.taches || []),
        ...(vente?.venteServices || []).flatMap((vs) => vs.taches || []),
    ];
    if (points.length === 0) {
        return null;
    }
    const traites = points.filter((t) => t.done || t.nonFait).length;
    return { total: points.length, traites, pourcentage: Math.round((traites / points.length) * 100) };
};

export interface AlertesVente {
    incidents: Array<{ prestation: string; details?: string; date?: string }>;
    pointsNonFaits: Array<{ prestation: string; nom?: string; motif?: string }>;
}

// Prestations en incident (avec leur détail) et points de checklist « non fait » (avec leur motif) de la vente
export const alertesVente = (vente?: VenteAvecChecklist | null): AlertesVente => {
    const prestations = [...(vente?.venteForfaits || []), ...(vente?.venteServices || [])].map((p) => ({
        prestation: p.forfait?.nom || p.service?.nom || 'Prestation',
        p,
    }));
    return {
        incidents: prestations
            .filter(({ p }) => p.status === 'INCIDENT')
            .map(({ prestation, p }) => ({ prestation, details: p.incidentDetails, date: p.incidentDate })),
        pointsNonFaits: prestations.flatMap(({ prestation, p }) =>
            (p.taches || []).filter((t) => t.nonFait).map((t) => ({ prestation, nom: t.nom, motif: t.motif }))),
    };
};
