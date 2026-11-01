import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
// L'éditeur riche ne fonctionne pas sous jsdom : une zone de texte suffit pour le formulaire
jest.mock('react-quill-new/dist/quill.snow.css', () => ({}));
jest.mock('react-quill-new', () => ({
    __esModule: true,
    default: ({ id, value, onChange }: any) => (
        <textarea id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    ),
}));

// Le formulaire complet est lent à rendre sous jsdom quand toute la suite tourne en parallèle
jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;

const reponse = (data: any, ok = true) =>
    Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(data) });

const societe = {
    id: 1, nom: 'MS Plaisance', siren: '123456789', adresse: '10 quai du Port', images: [],
    conditionsPaiement: '30 jours nets', indemniteForfaitaire: 40,
};
const modeleRelance = {
    id: 5, type: 'RAPPEL', sujet: 'Relance {numeroFacture}', contenu: '<p>Solde : {soldeDu}</p>',
    description: 'Variables disponibles : {soldeDu}',
};

const appel = (url: string, method: string) =>
    mockedFetch.mock.calls.find(([u, options]) => u === url && options?.method === method);

beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string, options?: RequestInit) => {
        const corps = options?.body ? JSON.parse(options.body as string) : undefined;
        if (url === './societe') return reponse(options?.method === 'PUT' ? { ...societe, ...corps } : societe);
        if (url === './email-templates/init') return reponse(null);
        if (url === './email-templates') return reponse([{ id: 4, type: 'FACTURE', sujet: 'Facture', contenu: '-' }, modeleRelance]);
        if (url === './email-templates/5') return reponse(corps);
        return reponse(null, false);
    });
});

describe('Société - conditions et relances de paiement', () => {
    it("enregistre les conditions de paiement avec la société et l'email de relance dans son modèle", async () => {
        render(<Societe />);

        const sujet = await screen.findByLabelText("Sujet de l'email de relance");
        expect(sujet).toHaveValue('Relance {numeroFacture}');
        expect(screen.getByLabelText('Message de relance')).toHaveValue('<p>Solde : {soldeDu}</p>');
        expect(screen.getByLabelText('Conditions de paiement')).toHaveValue('30 jours nets');
        expect(screen.getByText(/Variables disponibles : \{soldeDu\}/)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Pénalités de retard'), { target: { value: '3 fois le taux légal' } });
        fireEvent.change(sujet, { target: { value: 'Facture {numeroFacture} impayée' } });
        fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

        await screen.findByText('La société a été mise à jour.');
        const corpsSociete = JSON.parse(appel('./societe', 'PUT')[1].body);
        expect(corpsSociete).toMatchObject({ conditionsPaiement: '30 jours nets', penalitesRetard: '3 fois le taux légal', indemniteForfaitaire: 40 });
        expect(corpsSociete).not.toHaveProperty('relanceSujet');
        expect(corpsSociete).not.toHaveProperty('relanceContenu');
        expect(JSON.parse(appel('./email-templates/5', 'PUT')[1].body)).toMatchObject({
            id: 5, type: 'RAPPEL', sujet: 'Facture {numeroFacture} impayée', contenu: '<p>Solde : {soldeDu}</p>',
        });
    });

    it("ne réenregistre pas l'email de relance resté inchangé", async () => {
        render(<Societe />);

        await screen.findByLabelText("Sujet de l'email de relance");
        fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

        await screen.findByText('La société a été mise à jour.');
        expect(appel('./societe', 'PUT')).toBeTruthy();
        expect(appel('./email-templates/5', 'PUT')).toBeUndefined();
    });
});
