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
}

export interface InvoicePrintClient {
    adresse?: string;
    telephone?: string;
    email?: string;
    siret?: string;
}

export interface InvoicePrintLine {
    type: string;
    label: string;
    quantite: number;
    puTTC: number;
    remise: number;
    remisePct: number;
    totalPrixTTC: number;
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

export const buildSocieteBlockHtml = (societe?: InvoicePrintSociete) => societe ? `
    <div class="societe-block">
        ${societe.nom ? `<div class="societe-nom">${escapeHtml(societe.nom)}</div>` : ''}
        ${societe.adresse ? `<div style="white-space:pre-line">${escapeHtml(societe.adresse)}</div>` : ''}
        ${societe.telephone ? `<div>Tél : ${escapeHtml(societe.telephone)}</div>` : ''}
        ${societe.email ? `<div>Email : ${escapeHtml(societe.email)}</div>` : ''}
    </div>` : '<div class="societe-block"></div>';

export const buildDocBoxHtml = (docTitle: string, rows: Array<[string, string]>) => `
    <div class="doc-box">
        <div class="doc-box-title">${escapeHtml(docTitle)}</div>
        ${rows.map(([label, value]) => `<div class="doc-box-row"><span>${label}</span><strong>${value}</strong></div>`).join('')}
    </div>`;

export const buildClientBoxHtml = (client: InvoicePrintClient | undefined, clientLabel: string) => `
    <div class="client-box">
        <div class="client-name">${escapeHtml(clientLabel)}</div>
        ${client?.adresse ? `<div style="white-space:pre-line">${escapeHtml(client.adresse)}</div>` : ''}
        ${client?.telephone ? `<div>Tél : ${escapeHtml(client.telephone)}</div>` : ''}
        ${client?.email ? `<div>Email : ${escapeHtml(client.email)}</div>` : ''}
        ${client?.siret ? `<div>SIRET : ${escapeHtml(client.siret)}</div>` : ''}
    </div>`;

export const buildInvoiceTableHtml = (lines: InvoicePrintLine[], opts: { showPrices: boolean; tva?: number }) => {
    if (lines.length === 0) {
        return '<p>Aucun élément</p>';
    }
    const { showPrices, tva } = opts;
    return `<table class="invoice-table">
        <thead><tr>
            <th>Description</th>
            <th class="num">Qté</th>
            ${showPrices ? '<th class="num">% Rem</th><th class="num">TVA</th><th class="num">P.U. TTC</th><th class="num">Montant TTC</th>' : ''}
        </tr></thead>
        <tbody>${lines.map((line) => {
            const remisePct = Math.min(100, Math.max(0, line.remisePct));
            return `
            <tr>
                <td>${escapeHtml(line.type)} — ${escapeHtml(line.label)}</td>
                <td class="num">${line.quantite}</td>
                ${showPrices ? `<td class="num">${remisePct > 0 ? remisePct.toFixed(2) : '-'}</td>` : ''}
                ${showPrices ? `<td class="num">${tva != null ? tva.toFixed(2) : '-'}</td>` : ''}
                ${showPrices ? `<td class="num">${escapeHtml(formatEuro(line.puTTC))}</td>` : ''}
                ${showPrices ? `<td class="num">${escapeHtml(formatEuro(line.totalPrixTTC))}</td>` : ''}
            </tr>`;
        }).join('')}
        </tbody>
      </table>`;
};

export const buildTvaBreakdownHtml = (params: { tva?: number; montantHT?: number; montantTVA?: number }) => `
    <table class="tva-box">
        <thead><tr><th>Taux</th><th class="num">Base HT</th><th class="num">Montant TVA</th></tr></thead>
        <tbody><tr>
            <td>${params.tva != null ? params.tva.toFixed(2) : '-'}</td>
            <td class="num">${escapeHtml(formatEuro(params.montantHT))}</td>
            <td class="num">${escapeHtml(formatEuro(params.montantTVA))}</td>
        </tr></tbody>
    </table>`;

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
    .societe-nom { font-size: 18px; font-weight: bold; margin-bottom: 4px; font-style: italic; }
    .info-row { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
    .doc-box, .client-box { border: 1px solid #1f1f1f; border-radius: 4px; padding: 10px 14px; flex: 1; }
    .doc-box-title { font-size: 20px; font-style: italic; font-weight: bold; margin-bottom: 8px; }
    .doc-box-row { display: flex; justify-content: space-between; gap: 16px; padding: 2px 0; border-top: 1px solid #e8e8e8; }
    .doc-box-row:first-of-type { border-top: none; }
    .client-name { font-weight: bold; margin-bottom: 4px; }
    .invoice-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .invoice-table th, .invoice-table td { border: 1px solid #d9d9d9; padding: 6px 8px; }
    .invoice-table th { background: #f0f0f0; text-align: left; }
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
