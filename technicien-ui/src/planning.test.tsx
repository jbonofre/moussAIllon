import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Planning from './planning.tsx';
import api from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

// La page complète (tableaux et modale antd) est lente à rendre dans jsdom
jest.setTimeout(30000);

const get = api.get as jest.Mock;
const put = api.put as jest.Mock;

const prestation = {
    itemId: 7,
    venteId: 3,
    itemType: 'forfait',
    itemNom: 'Hivernage',
    itemStatus: 'EN_COURS',
    clientNom: 'Dupont',
    bonPourAccord: true,
    notes: 'Clé au bureau',
    noteVente: 'Anode à changer',
    taches: [],
    produits: [],
    produitsExtra: [],
    images: [],
    documents: [],
};

const ouvrirPrestation = async () => {
    fireEvent.click((await screen.findAllByText('Editer'))[0]);
    return (await screen.findByLabelText('Note client')) as HTMLTextAreaElement;
};

const enregistrer = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    return put.mock.calls[0];
};

describe('Planning technicien - note client', () => {
    beforeEach(() => {
        get.mockImplementation((url: string) =>
            Promise.resolve({ data: url === '/technicien-portal/techniciens/1/taches' ? [prestation] : [] }));
        put.mockImplementation((_url: string, body: any) =>
            Promise.resolve({ data: { ...prestation, ...body, noteVente: body.noteVente ?? prestation.noteVente } }));
    });

    afterEach(() => jest.clearAllMocks());

    it('envoie la note client modifiée par le technicien, à côté de la note interne', async () => {
        render(<Planning technicienId={1} />);
        const note = await ouvrirPrestation();
        await waitFor(() => expect(note).toHaveValue('Anode à changer'));

        fireEvent.change(note, { target: { value: 'Oxydation importante au niveau du thermostat' } });
        const [url, body] = await enregistrer();

        expect(url).toBe('/technicien-portal/forfaits/7');
        expect(body.noteVente).toBe('Oxydation importante au niveau du thermostat');
        expect(body.notes).toBe('Clé au bureau');
    });

    it("n'envoie pas la note client quand elle n'a pas été modifiée", async () => {
        render(<Planning technicienId={1} />);
        const note = await ouvrirPrestation();
        await waitFor(() => expect(note).toHaveValue('Anode à changer'));

        const [, body] = await enregistrer();

        expect(body.noteVente).toBeUndefined();
    });
});
