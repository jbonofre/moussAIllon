import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
const post = api.post as jest.Mock;

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

describe('Planning technicien - réouverture', () => {
    const terminee = {
        ...prestation,
        itemStatus: 'TERMINEE',
        venteType: 'FACTURE_EN_ATTENTE',
        dateDebut: '2026-10-30 08:00:00.0',
        dateFin: '2026-10-30 10:00:00.0',
        dureeReelle: 2,
    };

    const afficher = (tache: object) => {
        get.mockImplementation((url: string) =>
            Promise.resolve({ data: url === '/technicien-portal/techniciens/1/taches' ? [tache] : [] }));
        render(<Planning technicienId={1} />);
    };

    // Le bouton « Rouvrir » de la tâche ouvre une confirmation, qui a son propre bouton « Rouvrir »
    const demanderReouverture = async () => {
        fireEvent.click((await screen.findAllByRole('button', { name: /Rouvrir/ }))[0]);
        const titre = await screen.findByText('Rouvrir la tâche ?');
        return titre.closest('.ant-popover') as HTMLElement;
    };

    afterEach(() => jest.clearAllMocks());

    it('rouvre une tâche terminée puis ouvre sa fiche pour ajouter des pièces', async () => {
        const rouverte = { ...terminee, itemStatus: 'EN_COURS', dateFin: undefined, dateReouverture: '2026-11-02 14:00:00.0' };
        post.mockResolvedValue({ data: rouverte });
        afficher(terminee);

        const confirmation = await demanderReouverture();
        expect(within(confirmation).queryByText(/La facture est déjà prête/)).not.toBeInTheDocument();
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Rouvrir' }));

        await waitFor(() => expect(post).toHaveBeenCalledWith('/technicien-portal/forfaits/7/rouvrir'));
        expect(await screen.findByLabelText('Note client')).toBeInTheDocument();
        expect(screen.getByText('Produits supplementaires')).toBeInTheDocument();
    });

    it('prévient que la facture prête repassera en attente', async () => {
        afficher({ ...terminee, venteType: 'FACTURE_PRETE' });

        const confirmation = await demanderReouverture();

        expect(within(confirmation).getByText(/La facture est déjà prête/)).toBeInTheDocument();
    });

    it("ne propose pas de rouvrir une tâche d'une vente payée", async () => {
        afficher({ ...terminee, venteType: 'FACTURE_PAYEE' });

        expect(await screen.findAllByText('Hivernage')).not.toHaveLength(0);
        expect(screen.queryByRole('button', { name: /Rouvrir/ })).not.toBeInTheDocument();
    });

    it('affiche le refus du portail', async () => {
        post.mockRejectedValue({ response: { status: 400, data: { message: 'La facture a déjà reçu un paiement' } } });
        afficher({ ...terminee, venteType: 'FACTURE_PRETE' });

        const confirmation = await demanderReouverture();
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Rouvrir' }));

        expect(await screen.findByText('La facture a déjà reçu un paiement')).toBeInTheDocument();
    });

    it('à la clôture, ajoute au temps déjà compté celui passé depuis la réouverture', async () => {
        const rouverte = { ...terminee, itemStatus: 'EN_COURS', dateFin: undefined, dateReouverture: '2026-11-02T14:00:00' };
        afficher(rouverte);
        put.mockImplementation((_url: string, body: any) => Promise.resolve({ data: { ...rouverte, ...body } }));

        const terminer = (await screen.findAllByRole('button', { name: /Terminer/ }))[0];
        const maintenant = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-02T14:30:00').getTime());
        fireEvent.click(terminer);
        maintenant.mockRestore();
        const [, body] = await enregistrer();

        expect(body.status).toBe('TERMINEE');
        expect(body.dureeReelle).toBe(2.5);
    });
});
