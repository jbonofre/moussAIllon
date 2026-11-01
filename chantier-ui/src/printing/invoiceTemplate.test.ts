import { buildBoatBoxHtml, buildCompositionDetails, buildInvoiceTableHtml, buildTvaBreakdownHtml, InvoicePrintLine, montantOccasion } from './invoiceTemplate.ts';

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

    it('imprime une TVA à 0 % sur les articles d\'occasion', () => {
        const occasion: InvoicePrintLine = {
            type: 'Moteur', reference: 'MOT-1', label: 'F115 occasion', quantite: 1,
            puTTC: 6000, remise: 0, remisePct: 0, totalPrixTTC: 6000, occasion: true,
        };
        const html = buildInvoiceTableHtml([forfaitLine([]), occasion], { showPrices: true, tva: 20 });

        expect(rows(html).map((row) => row.cells[4])).toEqual(['20.00', '0.00']);
        expect(montantOccasion([forfaitLine([]), occasion])).toBe(6000);
    });

    it('sépare la base des articles d\'occasion dans le récapitulatif TVA', () => {
        // 700 TTC soumis à 20 % (583.33 HT + 116.67 TVA) et 6000 d'occasion sans TVA
        const html = buildTvaBreakdownHtml({ tva: 20, montantHT: 6583.33, montantTVA: 116.67, montantOccasion: 6000 });

        expect(rows(html).map((row) => row.cells)).toEqual([
            ['20.00', '583.33 EUR', '116.67 EUR'],
            ['0.00 (occasion)', '6000.00 EUR', '0.00 EUR'],
        ]);
    });

    it('ne garde que la ligne occasion si toute la vente est d\'occasion', () => {
        const html = buildTvaBreakdownHtml({ tva: 20, montantHT: 6000, montantTVA: 0, montantOccasion: 6000 });

        expect(rows(html).map((row) => row.cells)).toEqual([['0.00 (occasion)', '6000.00 EUR', '0.00 EUR']]);
    });

    it('garde une seule ligne au taux de la vente sans article d\'occasion', () => {
        const html = buildTvaBreakdownHtml({ tva: 20, montantHT: 100, montantTVA: 20 });

        expect(rows(html).map((row) => row.cells)).toEqual([['20.00', '100.00 EUR', '20.00 EUR']]);
    });

    it('imprime le cadre bateau/moteur avec modèle, immatriculation et numéros de série', () => {
        const html = buildBoatBoxHtml(
            { name: 'Mon <Bateau>', immatriculation: 'CC 123456', numeroSerie: 'BSN1', modele: { designation: 'Merry Fisher 695' } },
            { numeroSerie: 'MSN2', modele: { designation: 'Yamaha F115' } },
        );

        expect(html).toContain('Merry Fisher 695');
        expect(html).toContain('CC 123456');
        expect(html).toContain('BSN1');
        expect(html).toContain('Yamaha F115');
        expect(html).toContain('MSN2');
        expect(html).toContain('Mon &lt;Bateau&gt;');
    });

    it('imprime les heures moteur, celles du moteur primant sur celles du bateau', () => {
        expect(buildBoatBoxHtml({ name: 'B', heuresMoteur: 80 }, undefined)).toContain('80 h');
        const html = buildBoatBoxHtml({ name: 'B', heuresMoteur: 80 }, { heuresMoteur: 120.5 });
        expect(html).toContain('Heures moteur');
        expect(html).toContain('120.5 h');
        expect(html).not.toContain('80 h');
    });

    it('n\'imprime pas de cadre bateau/moteur sans bateau ni moteur', () => {
        expect(buildBoatBoxHtml(undefined, undefined)).toBe('');
        expect(buildBoatBoxHtml({}, {})).toBe('');
    });
});
