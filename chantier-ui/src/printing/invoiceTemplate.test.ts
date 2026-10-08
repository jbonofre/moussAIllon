import { buildCompositionDetails, buildInvoiceTableHtml, InvoicePrintLine } from './invoiceTemplate.ts';

describe('invoiceTemplate', () => {
    const forfait = {
        mainOeuvres: [{ mainOeuvre: { reference: 'MO-MEC', nom: 'Main d\'oeuvre mécanique' }, quantite: 1.5 }],
        produits: [
            { produit: { ref: 'HUI-10W40', designation: 'Huile 10W40' }, quantite: 3 },
            { produit: { designation: 'Filtre à huile' }, quantite: 1 },
        ],
    };

    const forfaitLine = (details: InvoicePrintLine['details']): InvoicePrintLine => ({
        type: 'Forfait', reference: 'F-REV', label: 'Révision 100 h', quantite: 2,
        puTTC: 350, remise: 0, remisePct: 0, totalPrixTTC: 700, details,
    });

    const rows = (html: string) => {
        const container = document.createElement('div');
        container.innerHTML = html;
        return Array.from(container.querySelectorAll('tbody tr')).map((tr) => ({
            detail: tr.classList.contains('detail'),
            cells: Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()),
        }));
    };

    it('liste la main d\'oeuvre puis les produits, quantités multipliées par celle de la ligne', () => {
        expect(buildCompositionDetails(forfait, 2)).toEqual([
            { reference: 'MO-MEC', label: 'Main d\'oeuvre mécanique', quantite: 3 },
            { reference: 'HUI-10W40', label: 'Huile 10W40', quantite: 6 },
            { reference: '', label: 'Filtre à huile', quantite: 2 },
        ]);
    });

    it('ignore les composants sans main d\'oeuvre ni produit et l\'absence de composition', () => {
        expect(buildCompositionDetails({ mainOeuvres: [{ quantite: 1 }], produits: [{ quantite: 2 }] }, 1)).toEqual([]);
        expect(buildCompositionDetails(undefined, 1)).toEqual([]);
    });

    it('imprime le détail sous la ligne du forfait, sans prix', () => {
        const produitLine: InvoicePrintLine = {
            type: 'Produit', reference: 'ANODE', label: 'Anode', quantite: 1,
            puTTC: 12, remise: 0, remisePct: 0, totalPrixTTC: 12,
        };
        const html = buildInvoiceTableHtml(
            [forfaitLine(buildCompositionDetails(forfait, 2)), produitLine],
            { showPrices: true, tva: 20 },
        );

        expect(rows(html)).toEqual([
            { detail: false, cells: ['F-REV', 'Révision 100 h', '2', '-', '20.00', '350.00 EUR', '700.00 EUR'] },
            { detail: true, cells: ['MO-MEC', 'Main d\'oeuvre mécanique', '3', '', '', '', ''] },
            { detail: true, cells: ['HUI-10W40', 'Huile 10W40', '6', '', '', '', ''] },
            { detail: true, cells: ['-', 'Filtre à huile', '2', '', '', '', ''] },
            { detail: false, cells: ['ANODE', 'Anode', '1', '-', '20.00', '12.00 EUR', '12.00 EUR'] },
        ]);
    });

    it('garde le même nombre de colonnes sur un ordre de réparation (sans prix)', () => {
        const html = buildInvoiceTableHtml([forfaitLine(buildCompositionDetails(forfait, 1))], { showPrices: false });

        expect(rows(html)).toEqual([
            { detail: false, cells: ['F-REV', 'Révision 100 h', '2'] },
            { detail: true, cells: ['MO-MEC', 'Main d\'oeuvre mécanique', '1.5'] },
            { detail: true, cells: ['HUI-10W40', 'Huile 10W40', '3'] },
            { detail: true, cells: ['-', 'Filtre à huile', '1'] },
        ]);
    });

    it('arrondit les quantités décimales et échappe le HTML du détail', () => {
        const html = buildInvoiceTableHtml(
            [forfaitLine([{ reference: '<b>', label: 'A & B', quantite: 0.1 * 3 }])],
            { showPrices: false },
        );

        expect(rows(html)[1]).toEqual({ detail: true, cells: ['<b>', 'A & B', '0.3'] });
        expect(html).toContain('&lt;b&gt;');
    });
});
