// Libellés et recherche des bateaux / moteurs clients associés à un forfait.

export interface ClientOption {
    value: number;
    label: string;
    search: string;
}

const join = (parts: Array<string | undefined | null | false>) => parts.filter(Boolean).join(' - ');

export const bateauClientLabel = (b: any): string =>
    join([
        b?.name || b?.modele?.designation || `Bateau #${b?.id}`,
        b?.immatriculation,
        b?.numeroSerie && `N° ${b.numeroSerie}`,
        (b?.moteurs || []).length > 0 && `Moteur : ${(b.moteurs as any[]).map((m) => m.designation).join(', ')}`,
    ]);

// Bateaux d'un propriétaire équipés du modèle de ce moteur (le moteur client n'a pas de lien direct vers un bateau).
export const bateauxDuMoteurClient = (m: any, bateaux: any[]): any[] =>
    bateaux.filter((b) =>
        m?.modele?.id &&
        (b.moteurs || []).some((bm: any) => bm.id === m.modele.id) &&
        (!m.proprietaire?.id || (b.proprietaires || []).some((p: any) => p.id === m.proprietaire.id))
    );

export const moteurClientLabel = (m: any, bateaux: any[] = []): string =>
    join([
        m?.modele?.designation || `Moteur #${m?.id}`,
        m?.numeroSerie && `N° ${m.numeroSerie}`,
        m?.proprietaire?.nom,
        bateauxDuMoteurClient(m, bateaux).length > 0 &&
            `Bateau : ${bateauxDuMoteurClient(m, bateaux).map((b) => b.name || b.immatriculation).join(', ')}`,
    ]);

export const bateauClientOptions = (bateaux: any[]): ClientOption[] =>
    bateaux.map((b) => {
        const label = bateauClientLabel(b);
        const proprietaires = (b.proprietaires || []).map((p: any) => p.nom).join(' ');
        return { value: b.id, label, search: `${label} ${b.modele?.designation || ''} ${proprietaires}`.toLowerCase() };
    });

export const moteurClientOptions = (moteurs: any[], bateaux: any[]): ClientOption[] =>
    moteurs.map((m) => {
        const label = moteurClientLabel(m, bateaux);
        return { value: m.id, label, search: `${label} ${m.numeroClef || ''}`.toLowerCase() };
    });

export const filterClientOption = (input: string, option?: { search?: string }) =>
    (option?.search || '').includes(input.trim().toLowerCase());
