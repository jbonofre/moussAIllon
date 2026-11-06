// Motifs de numéros de série moteur d'un forfait (même syntaxe que MotifNumeroSerie côté backend), séparés par des
// virgules, des points-virgules ou des retours à la ligne. Chaque motif est un numéro exact, un motif avec jokers
// (* pour une suite de caractères, ? pour un seul caractère, ex. 6EK-10*) ou une plage début..fin, bornes incluses,
// l'une des bornes pouvant être omise (ex. 1B000000..1B099999, 1B050000..). La casse est ignorée.

export const MOTIFS_NUMERO_SERIE_AIDE =
    'Forfait proposé pour les moteurs clients dont le numéro de série correspond (parmi les moteurs associés s\'il y en a). '
    + 'Motifs séparés par des virgules : numéro exact, jokers (* plusieurs caractères, ? un caractère) ou plage début..fin.';

export const MOTIFS_NUMERO_SERIE_PLACEHOLDER = 'Ex : 6EK-10*, 1B000000..1B099999';

export const motifsNumeroSerie = (motifs?: string | null): string[] =>
    (motifs || '').split(/[,;\r\n]+/).map((motif) => motif.trim().toUpperCase()).filter(Boolean);

const comparerTextes = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Comparaison « naturelle » : les suites de chiffres sont comparées par valeur (1B999 < 1B1000)
export const comparerNumeroSerie = (a: string, b: string): number => {
    const ma = a.match(/[0-9]+|[^0-9]+/g) || [];
    const mb = b.match(/[0-9]+|[^0-9]+/g) || [];
    for (let i = 0; i < Math.min(ma.length, mb.length); i++) {
        let c: number;
        if (/^[0-9]/.test(ma[i]) && /^[0-9]/.test(mb[i])) {
            const na = ma[i].replace(/^0+(?=.)/, '');
            const nb = mb[i].replace(/^0+(?=.)/, '');
            c = na.length - nb.length || comparerTextes(na, nb);
        } else {
            c = comparerTextes(ma[i], mb[i]);
        }
        if (c !== 0) return c;
    }
    return ma.length - mb.length;
};

const correspondMotif = (motif: string, numero: string): boolean => {
    const plage = motif.indexOf('..');
    if (plage >= 0) {
        const debut = motif.slice(0, plage).trim();
        const fin = motif.slice(plage + 2).trim();
        if (!debut && !fin) return false;
        return (!debut || comparerNumeroSerie(numero, debut) >= 0) && (!fin || comparerNumeroSerie(numero, fin) <= 0);
    }
    const regex = motif
        .split('')
        .map((c) => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\-]/g, '\\$&')))
        .join('');
    return new RegExp(`^${regex}$`).test(numero);
};

export const correspondNumeroSerie = (motifs?: string | null, numeroSerie?: string | null): boolean => {
    const numero = (numeroSerie || '').trim().toUpperCase();
    return !!numero && motifsNumeroSerie(motifs).some((motif) => correspondMotif(motif, numero));
};

interface ForfaitMoteurs {
    moteursAssocies?: Array<{ id: number }>;
    moteursClientsAssocies?: Array<{ id: number }>;
    numerosSerieMoteur?: string;
}

interface MoteurClient {
    id?: number;
    numeroSerie?: string;
    modele?: { id?: number };
}

// Un forfait s'applique au moteur client qui lui est associé directement. Sinon, sans motif de numéro de série, à tout
// moteur client d'un modèle du catalogue associé ; avec des motifs, aux moteurs clients dont le numéro de série
// correspond, limités aux modèles du catalogue associés s'il y en a.
export const forfaitCorrespondAuMoteur = (forfait: ForfaitMoteurs, moteur?: MoteurClient | null): boolean => {
    if (!moteur) return false;
    if (moteur.id && (forfait.moteursClientsAssocies || []).some((m) => m.id === moteur.id)) return true;
    const modeles = forfait.moteursAssocies || [];
    const modeleAssocie = !!moteur.modele?.id && modeles.some((m) => m.id === moteur.modele?.id);
    if (motifsNumeroSerie(forfait.numerosSerieMoteur).length > 0) {
        return correspondNumeroSerie(forfait.numerosSerieMoteur, moteur.numeroSerie) && (modeles.length === 0 || modeleAssocie);
    }
    return modeleAssocie;
};
