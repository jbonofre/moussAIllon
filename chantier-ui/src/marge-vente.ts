const arrondir = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface LigneMarge {
    type?: string;
    itemId?: number;
    quantite?: number;
    remise?: number;
    dureeReelle?: number;
}

export interface ProduitMarge {
    id: number;
    prixVenteHT?: number;
    tva?: number;
}

export interface PrestationMarge {
    id: number;
    dureeEstimee?: number;
    mainOeuvres?: Array<{ mainOeuvre?: { prixHT?: number }; quantite?: number }>;
}

export interface AchatProduit {
    produit?: { id: number };
    prixAchatHT?: number;
}

// Tarif horaire HT de la main d'œuvre d'une prestation : chaque unité de main d'œuvre vaut 1 h
const tarifHoraire = (prestation?: PrestationMarge) => {
    const mainOeuvres = prestation?.mainOeuvres ?? [];
    const heures = mainOeuvres.reduce((s, m) => s + (m.quantite || 0), 0);
    const cout = mainOeuvres.reduce((s, m) => s + (m.mainOeuvre?.prixHT || 0) * (m.quantite || 0), 0);
    return heures > 0 ? cout / heures : 0;
};

/**
 * Marge HT d'une transaction :
 *  - produits : (prix de vente HT - prix d'achat HT moyen chez les fournisseurs) x quantité, remise de ligne déduite ;
 *  - services et forfaits : (durée estimée - durée réelle) x tarif de la main d'œuvre, une fois le temps réel saisi
 *    (négatif en cas de dépassement).
 */
export const calculerMarge = (
    lignes: LigneMarge[],
    produits: ProduitMarge[],
    achats: AchatProduit[],
    services: PrestationMarge[],
    forfaits: PrestationMarge[],
) => {
    const achatsMoyens = new Map<number, number>();
    const prixParProduit = new Map<number, number[]>();
    achats.forEach((a) => {
        if (!a.produit) return;
        prixParProduit.set(a.produit.id, [...(prixParProduit.get(a.produit.id) ?? []), a.prixAchatHT || 0]);
    });
    prixParProduit.forEach((prix, id) => achatsMoyens.set(id, prix.reduce((s, p) => s + p, 0) / prix.length));

    let marge = 0;
    lignes.forEach((ligne) => {
        if (!ligne.type || !ligne.itemId) return;
        const quantite = Math.max(1, Math.floor(ligne.quantite || 1));
        if (ligne.type === 'produit') {
            const produit = produits.find((p) => p.id === ligne.itemId);
            if (!produit) return;
            const remiseHT = (ligne.remise || 0) / (1 + (produit.tva || 0) / 100);
            marge += ((produit.prixVenteHT || 0) - (achatsMoyens.get(produit.id) ?? 0)) * quantite - remiseHT;
        } else if (ligne.type === 'service' || ligne.type === 'forfait') {
            if (!(ligne.dureeReelle && ligne.dureeReelle > 0)) return;
            const prestation = (ligne.type === 'service' ? services : forfaits).find((p) => p.id === ligne.itemId);
            marge += ((prestation?.dureeEstimee || 0) * quantite - ligne.dureeReelle) * tarifHoraire(prestation);
        }
    });
    return arrondir(marge);
};

interface VenteMarge {
    venteProduits?: Array<{ produit?: ProduitMarge; quantite?: number; remise?: number }>;
    venteServices?: Array<{ service?: PrestationMarge; quantite?: number; remise?: number; dureeReelle?: number }>;
    venteForfaits?: Array<{ forfait?: PrestationMarge; quantite?: number; remise?: number; dureeReelle?: number }>;
}

// Marge HT d'une vente enregistrée, avec le même calcul que le formulaire de transaction
export const calculerMargeVente = (vente: VenteMarge, achats: AchatProduit[]) => {
    const produits = (vente.venteProduits ?? []).flatMap((l) => (l.produit ? [l.produit] : []));
    const services = (vente.venteServices ?? []).flatMap((l) => (l.service ? [l.service] : []));
    const forfaits = (vente.venteForfaits ?? []).flatMap((l) => (l.forfait ? [l.forfait] : []));
    const lignes: LigneMarge[] = [
        ...(vente.venteProduits ?? []).map((l) => ({ type: 'produit', itemId: l.produit?.id, quantite: l.quantite, remise: l.remise })),
        ...(vente.venteServices ?? []).map((l) => ({ type: 'service', itemId: l.service?.id, quantite: l.quantite, dureeReelle: l.dureeReelle })),
        ...(vente.venteForfaits ?? []).map((l) => ({ type: 'forfait', itemId: l.forfait?.id, quantite: l.quantite, dureeReelle: l.dureeReelle })),
    ];
    return calculerMarge(lignes, produits, achats, services, forfaits);
};
