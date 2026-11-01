// Blocs HTML/CSS communs aux impressions devis/factures (Ventes et Comptoir),
// pour éviter que le format EBP ne diverge entre les deux écrans.

export interface InvoicePrintSociete {
    nom?: string;
    siren?: string;
    siret?: string;
    ape?: string;
    rcs?: string;
    forme?: string;
    numerotva?: string;
    capital?: number;
    adresse?: string;
    telephone?: string;
    email?: string;
    bancaire?: string;
    banque?: string;
    iban?: string;
    bic?: string;
    images?: string[];
}

export interface InvoicePrintClient {
    codeTiers?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
    siret?: string;
}

export interface InvoicePrintBateau {
    name?: string;
    immatriculation?: string;
    numeroSerie?: string;
    heuresMoteur?: number;
    modele?: { designation?: string };
}

export interface InvoicePrintMoteur {
    numeroSerie?: string;
    heuresMoteur?: number;
    modele?: { designation?: string };
}

export interface InvoicePrintDetailLine {
    reference?: string;
    label: string;
    quantite: number;
}

export interface InvoicePrintLine {
    type: string;
    reference?: string;
    label: string;
    quantite: number;
    puTTC: number;
    remise: number;
    remisePct: number;
    totalPrixTTC: number;
    // Article d'occasion : vendu sans TVA, quel que soit le taux de la vente.
    occasion?: boolean;
    // Composition d'un forfait/service, imprimée en retrait sous la ligne.
    details?: InvoicePrintDetailLine[];
}

export interface InvoicePrintComposition {
    mainOeuvres?: Array<{ mainOeuvre?: { reference?: string; nom?: string }; quantite?: number }>;
    produits?: Array<{ produit?: { ref?: string; designation?: string }; quantite?: number }>;
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} EUR`;

export const computeRemisePct = (remise: number, puTTC: number, quantite: number) => {
    const brut = puTTC * quantite;
    if (brut <= 0) {
        return 0;
    }
    const pct = Math.round(((remise / brut) * 100 + Number.EPSILON) * 100) / 100;
    return Math.min(100, Math.max(0, pct));
};

const formatQuantite = (value: number) => String(Math.round((value + Number.EPSILON) * 100) / 100);

// Les quantités du détail sont multipliées par la quantité de la ligne, comme pour
// le décrément de stock : le prix reste porté par la seule ligne du forfait/service.
export const buildCompositionDetails = (composition: InvoicePrintComposition | undefined, quantiteLigne: number): InvoicePrintDetailLine[] => [
    ...(composition?.mainOeuvres || []).flatMap((item) => item.mainOeuvre ? [{
        reference: item.mainOeuvre.reference || '',
        label: item.mainOeuvre.nom || '',
        quantite: (item.quantite || 0) * quantiteLigne,
    }] : []),
    ...(composition?.produits || []).flatMap((item) => item.produit ? [{
        reference: item.produit.ref || '',
        label: item.produit.designation || '',
        quantite: (item.quantite || 0) * quantiteLigne,
    }] : []),
];

export const buildSocieteBlockHtml = (societe?: InvoicePrintSociete) => {
    if (!societe) return '<div class="societe-block"></div>';
    const logo = societe.images && societe.images[0]
        ? `<img class="societe-logo" src="${escapeHtml(new URL(societe.images[0], window.location.origin).href)}" alt="" />`
        : '';
    return `
    <div class="societe-block">
        <div class="societe-header">
            ${logo}
            ${societe.nom ? `<div class="societe-nom">${escapeHtml(societe.nom)}</div>` : ''}
        </div>
        ${societe.adresse ? `<div style="white-space:pre-line">${escapeHtml(societe.adresse)}</div>` : ''}
        ${societe.telephone ? `<div>Tél : ${escapeHtml(societe.telephone)}</div>` : ''}
        ${societe.email ? `<div>Email : ${escapeHtml(societe.email)}</div>` : ''}
    </div>`;
};

export const buildDocBoxHtml = (docTitle: string, rows: Array<[string, string]>) => `
    <div class="doc-box">
        <div class="doc-box-title">${escapeHtml(docTitle)}</div>
        <div class="doc-box-rows">
            ${rows.map(([label, value]) => `<div class="doc-box-row"><span>${label}</span><strong>${value}</strong></div>`).join('')}
        </div>
    </div>`;

export const buildClientBoxHtml = (client: InvoicePrintClient | undefined, clientLabel: string) => `
    <div class="client-box">
        <div class="box-title">Client</div>
        <div class="client-name">${escapeHtml(clientLabel)}</div>
        ${client?.adresse ? `<div style="white-space:pre-line">${escapeHtml(client.adresse)}</div>` : ''}
        ${client?.telephone ? `<div>Tél : ${escapeHtml(client.telephone)}</div>` : ''}
        ${client?.email ? `<div>Email : ${escapeHtml(client.email)}</div>` : ''}
        ${client?.siret ? `<div>SIRET : ${escapeHtml(client.siret)}</div>` : ''}
    </div>`;

// Cadre « Bateau / Moteur » : vide (chaîne vide) quand la vente n'est liée à aucun des deux.
export const buildBoatBoxHtml = (bateau?: InvoicePrintBateau, moteur?: InvoicePrintMoteur) => {
    const heuresMoteur = moteur?.heuresMoteur ?? bateau?.heuresMoteur;
    const rows: Array<[string, string | undefined]> = [
        ['Bateau', bateau?.name],
        ['Modèle', bateau?.modele?.designation],
        ['Immatriculation', bateau?.immatriculation],
        ['N° de série bateau', bateau?.numeroSerie],
        ['Moteur', moteur?.modele?.designation],
        ['N° de série moteur', moteur?.numeroSerie],
        ['Heures moteur', heuresMoteur != null ? `${heuresMoteur} h` : undefined],
    ];
    const filled = rows.filter((row): row is [string, string] => !!row[1]);
    if (filled.length === 0) return '';
    return `
    <div class="boat-box">
        <div class="box-title">Bateau / Moteur</div>
        ${filled.map(([label, value]) => `<div class="boat-row"><span>${escapeHtml(label)} :</span> <strong>${escapeHtml(value)}</strong></div>`).join('')}
    </div>`;
};

// Cadre document en tête, puis client (gauche) et bateau/moteur (droite) en dessous.
export const buildInfoSectionHtml = (docBoxHtml: string, clientBoxHtml: string, boatBoxHtml: string) => `
    <div class="info-section">
        ${docBoxHtml}
        <div class="parties-row">${clientBoxHtml}${boatBoxHtml}</div>
    </div>`;

export const buildInvoiceTableHtml = (lines: InvoicePrintLine[], opts: { showPrices: boolean; tva?: number }) => {
    if (lines.length === 0) {
        return '<p>Aucun élément</p>';
    }
    const { showPrices, tva } = opts;
    return `<table class="invoice-table">
        <thead><tr>
            <th>Référence</th>
            <th>Description</th>
            <th class="num">Qté</th>
            ${showPrices ? '<th class="num">% Rem</th><th class="num">TVA</th><th class="num">P.U. TTC</th><th class="num">Montant TTC</th>' : ''}
        </tr></thead>
        <tbody>${lines.map((line) => {
            const remisePct = Math.min(100, Math.max(0, line.remisePct));
            return `
            <tr>
                <td>${escapeHtml(line.reference || '-')}</td>
                <td>${escapeHtml(line.label)}</td>
                <td class="num">${line.quantite}</td>
                ${showPrices ? `<td class="num">${remisePct > 0 ? remisePct.toFixed(2) : '-'}</td>` : ''}
                ${showPrices ? `<td class="num">${line.occasion ? (0).toFixed(2) : tva != null ? tva.toFixed(2) : '-'}</td>` : ''}
                ${showPrices ? `<td class="num">${escapeHtml(formatEuro(line.puTTC))}</td>` : ''}
                ${showPrices ? `<td class="num">${escapeHtml(formatEuro(line.totalPrixTTC))}</td>` : ''}
            </tr>${(line.details || []).map((detail) => `
            <tr class="detail">
                <td>${escapeHtml(detail.reference || '-')}</td>
                <td>${escapeHtml(detail.label)}</td>
                <td class="num">${formatQuantite(detail.quantite)}</td>
                ${showPrices ? '<td></td><td></td><td></td><td></td>' : ''}
            </tr>`).join('')}`;
        }).join('')}
        </tbody>
      </table>`;
};

export const buildBancaireHtml = (societe: InvoicePrintSociete | undefined) => {
    if (!societe) return '';
    const lines = [
        societe.banque ? `Banque : ${societe.banque}` : '',
        societe.iban ? `IBAN : ${societe.iban}` : '',
        societe.bic ? `BIC : ${societe.bic}` : '',
        societe.bancaire || '',
    ].filter(Boolean);
    if (lines.length === 0) return '';
    return `
    <div class="bancaire-box">
        <div class="bancaire-title">Coordonnées bancaires société :</div>
        <div style="white-space:pre-line">${escapeHtml(lines.join('\n'))}</div>
    </div>`;
};

// Montant des lignes d'occasion, vendues sans TVA : il est sorti de la base HT du taux de la vente.
export const montantOccasion = (lines: InvoicePrintLine[]) =>
    lines.filter((line) => line.occasion).reduce((sum, line) => sum + line.totalPrixTTC, 0);

export const buildTvaBreakdownHtml = (params: { tva?: number; montantHT?: number; montantTVA?: number; montantOccasion?: number }) => {
    const occasion = params.montantOccasion || 0;
    const baseTaxable = (params.montantHT || 0) - occasion;
    // [taux, base HT, montant TVA] ; la ligne du taux de la vente est omise si tout est d'occasion
    const rows: Array<[string, number, number]> = [];
    if (occasion <= 0 || baseTaxable > 0.005) {
        rows.push([params.tva != null ? params.tva.toFixed(2) : '-', baseTaxable, params.montantTVA || 0]);
    }
    if (occasion > 0) {
        rows.push(['0.00 (occasion)', occasion, 0]);
    }
    return `
    <table class="tva-box">
        <thead><tr><th>Taux</th><th class="num">Base HT</th><th class="num">Montant TVA</th></tr></thead>
        <tbody>${rows.map(([taux, base, montant]) => `<tr>
            <td>${escapeHtml(taux)}</td>
            <td class="num">${escapeHtml(formatEuro(base))}</td>
            <td class="num">${escapeHtml(formatEuro(montant))}</td>
        </tr>`).join('')}</tbody>
    </table>`;
};

export const buildTotalsHtml = (params: {
    remise?: number;
    montantHT?: number;
    montantTVA?: number;
    montantTTC?: number;
    prixVenteTTC?: number;
    soldeDu?: number;
    isFacture: boolean;
}) => {
    const totalsRows: Array<[string, string]> = [
        ...((params.remise || 0) > 0 ? [['Remise', formatEuro(params.remise)] as [string, string]] : []),
        ['Total HT Net', formatEuro(params.montantHT)],
        ['Total TVA', formatEuro(params.montantTVA)],
        ['Total TTC', formatEuro(params.montantTTC)],
        ['Net à payer', formatEuro(params.prixVenteTTC)],
        ...(params.isFacture ? [['Solde dû', formatEuro(params.soldeDu)] as [string, string]] : []),
    ];
    return `
        <table class="totals-box">
            <tbody>${totalsRows.map(([label, value], i) => `
                <tr class="${i === totalsRows.length - 1 ? 'net' : ''}"><td>${label}</td><td class="num">${escapeHtml(value)}</td></tr>`).join('')}
            </tbody>
        </table>`;
};

export const buildLegalLine = (societe?: InvoicePrintSociete) => societe ? [
    societe.forme || '',
    societe.siren ? `SIREN : ${societe.siren}` : '',
    societe.siret ? `Siret : ${societe.siret}` : '',
    societe.ape ? `APE : ${societe.ape}` : '',
    societe.rcs ? `RCS : ${societe.rcs}` : '',
    societe.numerotva ? `N° TVA intracom : ${societe.numerotva}` : '',
    societe.capital != null ? `Capital : ${formatEuro(societe.capital)}` : '',
].filter(Boolean).join(' - ') : '';

export const INVOICE_PRINT_STYLES = `
    @page { size: A4; margin: 16mm 14mm 18mm; }
    body { font-family: Arial, sans-serif; margin: 0; color: #1f1f1f; font-size: 13px; }
    h3 { margin: 0 0 6px; }
    .row { margin-bottom: 6px; }
    .section { margin-top: 18px; }
    .num { text-align: right; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f1f1f; padding-bottom: 12px; margin-bottom: 16px; }
    .societe-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
    .societe-logo { max-height: 60px; max-width: 120px; object-fit: contain; }
    .societe-nom { font-size: 18px; font-weight: bold; font-style: italic; }
    .info-section { margin-bottom: 20px; }
    .parties-row { display: flex; gap: 16px; margin-top: 12px; align-items: stretch; }
    .doc-box, .client-box, .boat-box { border: 1px solid #1f1f1f; border-radius: 4px; padding: 10px 14px; }
    .client-box, .boat-box { flex: 1; }
    .box-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #595959; margin-bottom: 6px; }
    .boat-row { padding: 1px 0; }
    .doc-box-rows { display: flex; flex-wrap: wrap; gap: 4px 24px; }
    .doc-box-title { font-size: 20px; font-style: italic; font-weight: bold; margin-bottom: 8px; }
    .doc-box-row { display: flex; flex-direction: column; min-width: 120px; padding: 2px 0; }
    .doc-box-row span { font-size: 11px; color: #595959; }
    .client-name { font-weight: bold; margin-bottom: 4px; }
    .invoice-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .invoice-table th, .invoice-table td { border: 1px solid #d9d9d9; padding: 6px 8px; }
    .invoice-table th { background: #f0f0f0; text-align: left; }
    .invoice-table tr.detail td { font-size: 0.9em; color: #595959; padding-top: 3px; padding-bottom: 3px; }
    .invoice-table tr.detail td:nth-child(-n+2) { padding-left: 24px; }
    .footer-row { display: flex; justify-content: space-between; gap: 24px; margin-top: 20px; align-items: flex-start; }
    .footer-left { flex: 1; }
    .tva-box { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .tva-box th, .tva-box td { border: 1px solid #d9d9d9; padding: 5px 8px; }
    .tva-box th { background: #f0f0f0; text-align: left; }
    .bancaire-box { font-size: 12px; }
    .bancaire-title { font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
    .totals-box { border-collapse: collapse; min-width: 260px; }
    .totals-box td { padding: 4px 10px; }
    .totals-box tr.net td { font-weight: bold; border-top: 1px solid #1f1f1f; padding-top: 6px; }
    .legal { font-size: 12px; border-top: 1px solid #d9d9d9; padding-top: 12px; margin-top: 20px; color: #595959; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10px; color: #595959; border-top: 1px solid #d9d9d9; padding-top: 6px; }
`;
