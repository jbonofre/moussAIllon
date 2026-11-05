import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Relances from './relances.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));

jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;

const journal = {
    relancesAutomatiques: false,
    relances: [
        { venteId: 12, devis: false, ordreDeReparation: false, numero: 'FA26-00012', clientId: 100, client: 'Jean Dupont',
            email: 'jean.dupont@test.com', dateDepart: '2026-10-01', joursEcoules: 35, niveau: 2, montant: 300 },
        { venteId: 41, devis: true, ordreDeReparation: true, numero: 'DE26-00041', clientId: 101, client: 'Sophie Martin',
            email: 'sophie.martin@test.com', dateDepart: '2026-10-28', joursEcoules: 8, niveau: 1, montant: 1200 },
    ],
    ventesSuspendues: [
        { venteId: 7, devis: false, ordreDeReparation: false, numero: 'FA26-00007', client: 'Paul Durand',
            depuis: '2026-11-01', jusquau: '2026-12-15', motif: 'Paiement en 3 fois' },
    ],
    clientsSuspendus: [{ clientId: 102, client: 'Marina du Port', motif: 'Règle à 60 jours' }],
};

const reponse = (data: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve('') });

const ligne = (texte: string) => screen.getByText(texte).closest('tr') as HTMLElement;

const appels = (url: string, method: string) =>
    mockedFetch.mock.calls.filter(([u, options]) => u === url && options?.method === method);

beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) =>
        reponse(url === './relances/envoyer' ? { envoyees: 1, erreurs: [] } : journal));
});

describe('Journal des relances', () => {
    it('liste les relances dues, toutes cochées', async () => {
        render(<Relances />);

        expect(await screen.findByText('FA26-00012')).toBeInTheDocument();
        expect(mockedFetch).toHaveBeenCalledWith('./relances');
        expect(screen.getByText('Relances à valider')).toBeInTheDocument();
        const facture = ligne('FA26-00012');
        expect(within(facture).getByText('Paiement')).toBeInTheDocument();
        expect(within(facture).getByText('Relance 2')).toBeInTheDocument();
        expect(within(facture).getByText('Échéance 01/10/2026')).toBeInTheDocument();
        expect(within(facture).getByText('solde dû')).toBeInTheDocument();
        expect(within(facture).getByRole('checkbox')).toBeChecked();
        const devis = ligne('DE26-00041');
        expect(within(devis).getByText('OR')).toBeInTheDocument();
        expect(within(devis).getByText('Devis du 28/10/2026')).toBeInTheDocument();
        expect(within(devis).getByRole('checkbox')).toBeChecked();
        expect(screen.getByRole('button', { name: /Envoyer la sélection \(2\)/ })).toBeEnabled();
    });

    it("n'envoie que les relances cochées puis recharge le journal", async () => {
        render(<Relances />);
        await screen.findByText('DE26-00041');

        fireEvent.click(within(ligne('DE26-00041')).getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /Envoyer la sélection \(1\)/ }));
        fireEvent.click(await screen.findByRole('button', { name: 'Envoyer' }));

        await waitFor(() => expect(appels('./relances/envoyer', 'POST')).toHaveLength(1));
        expect(JSON.parse(appels('./relances/envoyer', 'POST')[0][1].body)).toEqual({ ventes: [12] });
        await waitFor(() => expect(mockedFetch.mock.calls.filter(([url]) => url === './relances')).toHaveLength(2));
        // La relance décochée le reste après le rechargement
        await waitFor(() => expect(within(ligne('DE26-00041')).getByRole('checkbox')).not.toBeChecked());
    });

    it('ignore une relance avec son motif', async () => {
        render(<Relances />);
        await screen.findByText('FA26-00012');

        fireEvent.click(within(ligne('FA26-00012')).getByRole('button', { name: /Ignorer/ }));
        const modale = await screen.findByRole('dialog');
        expect(within(modale).getByText('Ignorer la relance 2 de FA26-00012')).toBeInTheDocument();
        fireEvent.change(within(modale).getByLabelText('Motif'), { target: { value: 'Accord téléphonique' } });
        fireEvent.click(within(modale).getByRole('button', { name: 'Ignorer' }));

        await waitFor(() => expect(appels('./relances/12/ignorer', 'POST')).toHaveLength(1));
        expect(JSON.parse(appels('./relances/12/ignorer', 'POST')[0][1].body)).toEqual({ motif: 'Accord téléphonique' });
    });

    it('suspend les relances de la vente jusqu\'à leur reprise', async () => {
        render(<Relances />);
        await screen.findByText('FA26-00012');

        fireEvent.click(within(ligne('FA26-00012')).getByRole('button', { name: /Suspendre/ }));
        const modale = await screen.findByRole('dialog');
        expect(within(modale).getByText('Toutes celles de Jean Dupont (accord particulier)')).toBeInTheDocument();
        fireEvent.change(within(modale).getByLabelText('Motif'), { target: { value: 'Échéancier' } });
        fireEvent.click(within(modale).getByRole('button', { name: 'Suspendre' }));

        await waitFor(() => expect(appels('./relances/ventes/12/suspension', 'POST')).toHaveLength(1));
        expect(JSON.parse(appels('./relances/ventes/12/suspension', 'POST')[0][1].body)).toEqual({ motif: 'Échéancier', jusquau: null });
    });

    it('suspend toutes les relances du client', async () => {
        render(<Relances />);
        await screen.findByText('FA26-00012');

        fireEvent.click(within(ligne('FA26-00012')).getByRole('button', { name: /Suspendre/ }));
        const modale = await screen.findByRole('dialog');
        fireEvent.click(within(modale).getByLabelText('Toutes celles de Jean Dupont (accord particulier)'));
        expect(within(modale).queryByText("Jusqu'au (inclus)")).not.toBeInTheDocument();
        fireEvent.click(within(modale).getByRole('button', { name: 'Suspendre' }));

        await waitFor(() => expect(appels('./relances/clients/100/suspension', 'POST')).toHaveLength(1));
        expect(JSON.parse(appels('./relances/clients/100/suspension', 'POST')[0][1].body)).toEqual({ motif: '' });
    });

    it('liste les relances suspendues et les reprend', async () => {
        render(<Relances />);

        const vente = (await screen.findByText('FA26-00007')).closest('tr') as HTMLElement;
        expect(within(vente).getByText('15/12/2026')).toBeInTheDocument();
        expect(within(vente).getByText('Paiement en 3 fois')).toBeInTheDocument();
        const client = ligne('Marina du Port');
        expect(within(client).getByText('Règle à 60 jours')).toBeInTheDocument();

        fireEvent.click(within(vente).getByRole('button', { name: /Reprendre/ }));
        await waitFor(() => expect(appels('./relances/ventes/7/suspension', 'DELETE')).toHaveLength(1));
        fireEvent.click(within(client).getByRole('button', { name: /Reprendre/ }));
        await waitFor(() => expect(appels('./relances/clients/102/suspension', 'DELETE')).toHaveLength(1));
    });

    it("signale l'envoi automatique", async () => {
        mockedFetch.mockImplementation(() => reponse({ ...journal, relancesAutomatiques: true, relances: [] }));
        render(<Relances />);

        expect(await screen.findByText('Envoi automatique activé')).toBeInTheDocument();
        expect(screen.getByText("Aucune relance à envoyer aujourd'hui")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Envoyer la sélection \(0\)/ })).toBeDisabled();
    });
});
