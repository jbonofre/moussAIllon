import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Societe from './societe.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));
jest.mock('./workspace.tsx', () => ({ demo: () => null }));
jest.mock('./ImageUpload.tsx', () => () => null);
const mockNavigate = jest.fn();
jest.mock('./navigation-context.tsx', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

// Le formulaire complet est lent à rendre sous jsdom quand toute la suite tourne en parallèle
jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;

const reponse = (data: any, ok = true) =>
    Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(data) });

const societe = {
    id: 1, nom: 'MS Plaisance', siren: '123456789', adresse: '10 quai du Port', images: [],
    conditionsPaiement: '30 jours nets', indemniteForfaitaire: 40, relance3Courrier: false,
};

const appel = (url: string, method: string) =>
    mockedFetch.mock.calls.find(([u, options]) => u === url && options?.method === method);

beforeEach(() => {
    mockedFetch.mockReset();
    mockNavigate.mockReset();
    mockedFetch.mockImplementation((url: string, options?: RequestInit) => {
        const corps = options?.body ? JSON.parse(options.body as string) : undefined;
        if (url === './societe') return reponse(options?.method === 'PUT' ? { ...societe, ...corps } : societe);
        return reponse(null, false);
    });
});

describe('Société - conditions et relances de paiement', () => {
    it('enregistre les conditions de paiement et la relance 3 par courrier avec la société', async () => {
        render(<Societe />);

        const penalites = await screen.findByLabelText('Pénalités de retard');
        expect(screen.getByLabelText('Conditions de paiement')).toHaveValue('30 jours nets');
        expect(screen.getByLabelText('Par email')).toBeChecked();

        fireEvent.change(penalites, { target: { value: '3 fois le taux légal' } });
        fireEvent.click(screen.getByLabelText(/Par courrier : mise en demeure à imprimer/));
        fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

        await screen.findByText('La société a été mise à jour.');
        expect(JSON.parse(appel('./societe', 'PUT')[1].body)).toMatchObject({
            conditionsPaiement: '30 jours nets', penalitesRetard: '3 fois le taux légal', indemniteForfaitaire: 40,
            relance3Courrier: true,
        });
        // Les textes des relances ne se modifient plus ici
        expect(mockedFetch.mock.calls.some(([url]) => String(url).startsWith('./email-templates'))).toBe(false);
    });

    it("renvoie vers Paramétrage > Emails pour le texte des relances", async () => {
        render(<Societe />);

        const liens = await screen.findAllByText('Paramétrage > Emails');
        expect(liens).toHaveLength(2);
        fireEvent.click(liens[0]);

        expect(mockNavigate).toHaveBeenCalledWith('/emails');
    });

    it('enregistre les délais des relances de devis', async () => {
        render(<Societe />);

        await screen.findByLabelText('Pénalités de retard');
        fireEvent.change(document.getElementById('societe_relanceDevis1Jours') as HTMLElement, { target: { value: '7' } });
        fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

        // Les messages des tests précédents peuvent encore être affichés
        await waitFor(() => expect(appel('./societe', 'PUT')).toBeTruthy());
        expect(JSON.parse(appel('./societe', 'PUT')[1].body)).toMatchObject({ relanceDevis1Jours: 7, relance3Courrier: false });
    });
});
