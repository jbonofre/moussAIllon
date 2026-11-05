import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import dayjs from 'dayjs';
import SuiviCommercial from './SuiviCommercial.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));

jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;

const suivi = [
    { id: 5, clientId: 100, clientNom: 'Jean Dupont', type: 'VISITE', statut: 'A_FAIRE', sujet: 'Voir le bateau au ponton',
        date: dayjs().add(3, 'day').format('YYYY-MM-DD') + 'T14:30:00', utilisateur: 'technicien1' },
    { id: 4, clientId: 100, clientNom: 'Jean Dupont', type: 'APPEL', statut: 'FAITE', sujet: 'Demande de devis carénage',
        compteRendu: 'Rappeler avec un prix', date: '2026-10-01T14:00:00', utilisateur: 'admin' },
    { id: 3, clientId: 100, clientNom: 'Jean Dupont', type: 'EMAIL', statut: 'FAITE', sujet: 'Offre envoyée',
        date: '2026-09-20T00:00:00', dateRealisation: '2026-09-22T10:15:00', utilisateur: 'admin' },
];

const reponse = (data: any) => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve(''),
});

const appels = (url: string, method: string) =>
    mockedFetch.mock.calls.filter(([u, options]) => u === url && options?.method === method);

const ligne = (texte: string) => screen.getByText(texte).closest('tr') as HTMLElement;

beforeEach(() => {
    mockedFetch.mockReset();
    localStorage.setItem('moussaillon-user', JSON.stringify({ name: 'admin', modules: ['VENTE'] }));
    mockedFetch.mockImplementation((url: string) =>
        reponse(url === './interactions/utilisateurs' ? ['admin', 'technicien1'] : suivi));
});

afterEach(() => localStorage.removeItem('moussaillon-user'));

describe('Suivi commercial du client', () => {
    it('sépare les actions à faire des échanges', async () => {
        render(<SuiviCommercial clientId={100} />);

        expect(await screen.findByText('Voir le bateau au ponton')).toBeInTheDocument();
        expect(mockedFetch).toHaveBeenCalledWith('./interactions?clientId=100');
        expect(screen.getByText('Actions à faire (1)')).toBeInTheDocument();
        expect(screen.getByText('Échanges (2)')).toBeInTheDocument();
        const action = ligne('Voir le bateau au ponton');
        expect(within(action).getByText('À venir')).toBeInTheDocument();
        expect(within(action).getByText('technicien1')).toBeInTheDocument();
        expect(within(action).getByText(dayjs().add(3, 'day').format('DD/MM/YYYY') + ' 14:30')).toBeInTheDocument();
        const appel = ligne('Demande de devis carénage');
        expect(within(appel).getByText('01/10/2026 14:00')).toBeInTheDocument();
        expect(within(appel).getByText('Rappeler avec un prix')).toBeInTheDocument();
        // Une action faite est datée du jour où elle a été faite
        expect(within(ligne('Offre envoyée')).getByText('22/09/2026 10:15')).toBeInTheDocument();
    });

    it('note un échange avec le client', async () => {
        render(<SuiviCommercial clientId={100} />);
        await screen.findByText('Voir le bateau au ponton');

        fireEvent.click(screen.getByRole('button', { name: /Noter un échange/ }));
        const modale = await screen.findByRole('dialog');
        expect(within(modale).queryByText('Client ou prospect')).not.toBeInTheDocument();
        fireEvent.change(within(modale).getByLabelText('Sujet'), { target: { value: 'Question sur l’antifouling' } });
        fireEvent.change(within(modale).getByLabelText('Compte rendu'), { target: { value: 'Conseillé la gamme érodable' } });
        fireEvent.click(within(modale).getByRole('button', { name: 'Enregistrer' }));

        await waitFor(() => expect(appels('./interactions', 'POST')).toHaveLength(1));
        const echange = JSON.parse(appels('./interactions', 'POST')[0][1].body);
        expect(echange).toMatchObject({
            clientId: 100, type: 'APPEL', statut: 'FAITE', sujet: 'Question sur l’antifouling',
            compteRendu: 'Conseillé la gamme érodable', utilisateur: 'admin',
        });
        expect(echange.date.startsWith(dayjs().format('YYYY-MM-DD'))).toBe(true);
        await waitFor(() => expect(mockedFetch.mock.calls.filter(([u]) => u === './interactions?clientId=100')).toHaveLength(2));
    });

    it("modifie l'échéance d'une action", async () => {
        render(<SuiviCommercial clientId={100} />);
        await screen.findByText('Voir le bateau au ponton');

        fireEvent.click(within(ligne('Voir le bateau au ponton')).getByTitle('Modifier'));
        const modale = await screen.findByRole('dialog');
        expect(within(modale).getByText("Modifier l'action")).toBeInTheDocument();
        expect(within(modale).getByLabelText('Action')).toHaveValue('Voir le bateau au ponton');
        fireEvent.change(within(modale).getByLabelText('Action'), { target: { value: 'Voir le bateau au ponton C' } });
        fireEvent.click(within(modale).getByRole('button', { name: 'Enregistrer' }));

        await waitFor(() => expect(appels('./interactions/5', 'PUT')).toHaveLength(1));
        expect(JSON.parse(appels('./interactions/5', 'PUT')[0][1].body)).toMatchObject({
            clientId: 100, type: 'VISITE', statut: 'A_FAIRE', sujet: 'Voir le bateau au ponton C', utilisateur: 'technicien1',
            date: suivi[0].date,
        });
    });

    it('supprime un échange', async () => {
        render(<SuiviCommercial clientId={100} />);
        await screen.findByText('Offre envoyée');

        fireEvent.click(within(ligne('Offre envoyée')).getByTitle('Supprimer'));
        fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));

        await waitFor(() => expect(appels('./interactions/3', 'DELETE')).toHaveLength(1));
    });
});
