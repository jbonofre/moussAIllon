// Informations relevées par le chantier à la réception du bateau, du moteur ou de la remorque :
// imprimées sur le devis/OR et reprises sur le bon pour accord à signer.
// Un booléen null ou absent signifie « non renseigné ».
export interface Reception {
    nombreCles?: number | null;
    volumeCarburant?: string | null;
    nableCoque?: boolean | null;
    nombreCoupeCircuits?: number | null;
    nourriceCarburant?: boolean | null;
    rampeFeuxRemorque?: boolean | null;
    manivelleRemorque?: boolean | null;
    nombreSanglesArrimage?: number | null;
    informations?: string | null;
    photos?: string[];
}

const presence = (value: boolean, feminin = false) => (value ? 'Présent' : 'Absent') + (feminin ? 'e' : '');

const nombre = (value?: number | null) => (value != null ? String(value) : undefined);

// Points de contrôle renseignés, dans l'ordre de la fiche de réception : [libellé, valeur]
export const lignesReception = (reception?: Reception | null): Array<[string, string]> => {
    if (!reception) return [];
    const lignes: Array<[string, string | undefined]> = [
        ['Nombre de clés', nombre(reception.nombreCles)],
        ['Carburant dans le réservoir', reception.volumeCarburant?.trim() || undefined],
        ['Nable de coque', reception.nableCoque != null ? presence(reception.nableCoque) : undefined],
        ['Nombre de coupe-circuits', nombre(reception.nombreCoupeCircuits)],
        ['Nourrice de carburant', reception.nourriceCarburant != null ? presence(reception.nourriceCarburant, true) : undefined],
        ['Rampe de feux de remorque', reception.rampeFeuxRemorque != null ? presence(reception.rampeFeuxRemorque, true) : undefined],
        ['Manivelle de remorque', reception.manivelleRemorque != null ? presence(reception.manivelleRemorque, true) : undefined],
        ['Nombre de sangles d\'arrimage', nombre(reception.nombreSanglesArrimage)],
    ];
    return lignes.filter((ligne): ligne is [string, string] => !!ligne[1]);
};

export const receptionRenseignee = (reception?: Reception | null) =>
    lignesReception(reception).length > 0
    || !!reception?.informations?.trim()
    || (reception?.photos?.length ?? 0) > 0;

// L'impression se fait dans une iframe : les URLs relatives des images sont rendues absolues.
export const urlAbsolue = (url: string) => {
    try {
        return new URL(url, window.location.origin).href;
    } catch {
        return url;
    }
};
