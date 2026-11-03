import { lignesReception, receptionRenseignee } from './reception.ts';
import { buildReceptionHtml } from './printing/invoiceTemplate.ts';

describe('reception', () => {
    const reception = {
        nombreCles: 2,
        volumeCarburant: ' 1/2 ',
        nableCoque: true,
        nombreCoupeCircuits: 0,
        nourriceCarburant: false,
        rampeFeuxRemorque: null,
        manivelleRemorque: true,
        informations: 'Rayure <babord>',
        photos: ['/api/images/reception.jpg'],
    };

    it('liste les seuls points de contrôle renseignés, zéro et absence compris', () => {
        expect(lignesReception(reception)).toEqual([
            ['Nombre de clés', '2'],
            ['Carburant dans le réservoir', '1/2'],
            ['Nable de coque', 'Présent'],
            ['Nombre de coupe-circuits', '0'],
            ['Nourrice de carburant', 'Absente'],
            ['Manivelle de remorque', 'Présente'],
        ]);
    });

    it('considère une réception vide comme non renseignée', () => {
        expect(receptionRenseignee(undefined)).toBe(false);
        expect(receptionRenseignee({ volumeCarburant: '  ', informations: '', photos: [] })).toBe(false);
        expect(receptionRenseignee({ informations: 'Coque sale' })).toBe(true);
        expect(receptionRenseignee({ photos: ['/api/images/a.jpg'] })).toBe(true);
    });

    it('imprime la réception avec ses informations échappées et ses photos en URL absolue', () => {
        const container = document.createElement('div');
        container.innerHTML = buildReceptionHtml(reception);

        expect(container.querySelector('h3')?.textContent).toBe('Bon de Réception');
        expect(Array.from(container.querySelectorAll('.reception-row')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
            'Nombre de clés : 2',
            'Carburant dans le réservoir : 1/2',
            'Nable de coque : Présent',
            'Nombre de coupe-circuits : 0',
            'Nourrice de carburant : Absente',
            'Manivelle de remorque : Présente',
        ]);
        expect(container.textContent).toContain('Rayure <babord>');
        expect(container.querySelector('img')?.getAttribute('src')).toBe(`${window.location.origin}/api/images/reception.jpg`);
    });

    it("n'imprime rien sans réception renseignée", () => {
        expect(buildReceptionHtml(undefined)).toBe('');
        expect(buildReceptionHtml({ photos: [] })).toBe('');
    });
});
