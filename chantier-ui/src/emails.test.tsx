import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Emails from './emails.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));
// L'éditeur riche ne fonctionne pas sous jsdom : une zone de texte suffit pour le formulaire
jest.mock('react-quill-new/dist/quill.snow.css', () => ({}));
jest.mock('react-quill-new', () => ({
    __esModule: true,
    default: ({ id, value, onChange }: any) => (
        <textarea id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    ),
}));

jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;

const reponse = (data: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });

// Modèles dans l'ordre de création en base
const modeles = [
    { id: 1, type: 'RAPPEL', sujet: 'Relance de paiement - Facture {numeroFacture}', contenu: '<p>1</p>', description: 'Variables disponibles : {soldeDu}' },
    { id: 2, type: 'FACTURE', sujet: 'Votre {typeVente}', contenu: '-', description: '' },
    { id: 3, type: 'RELANCE_DEVIS', sujet: 'Votre {typeDevis}', contenu: '<p>1</p>', description: '' },
    { id: 4, type: 'RELANCE_3', sujet: 'Mise en demeure de payer - Facture {numeroFacture}', contenu: '<p>3</p>', description: 'Variables disponibles : {soldeDu}' },
    { id: 5, type: 'RELANCE_2', sujet: 'Deuxième relance - Facture {numeroFacture}', contenu: '<p>2</p>', description: '' },
];

beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => reponse(url === './email-templates' ? modeles : null));
});

describe('Modèles d\'emails', () => {
    it('liste un modèle par relance, dans l\'ordre des relances', async () => {
        render(<Emails />);

        await screen.findByText('Relance de paiement 1');
        const types = screen.getAllByRole('row').slice(1).map((ligne) => within(ligne).getAllByRole('cell')[0].textContent);
        expect(types).toEqual([
            'Relance de paiement 1', 'Relance de paiement 2', 'Relance de paiement 3', 'Relance de devis 1', 'Facture',
        ]);
        expect(mockedFetch).toHaveBeenCalledWith('./email-templates/init', { method: 'POST' });
    });

    it('signale que le modèle de la relance 3 sert aussi au courrier', async () => {
        render(<Emails />);

        fireEvent.click(await screen.findByText('Mise en demeure de payer - Facture {numeroFacture}'));

        const modale = await screen.findByRole('dialog');
        expect(within(modale).getByText('Ce modèle sert aussi au courrier de mise en demeure')).toBeInTheDocument();
        expect(within(modale).getByLabelText("Sujet de l'email")).toHaveValue('Mise en demeure de payer - Facture {numeroFacture}');
    });

    it("n'affiche pas la mention du courrier pour les autres relances", async () => {
        render(<Emails />);

        fireEvent.click(await screen.findByText('Deuxième relance - Facture {numeroFacture}'));

        const modale = await screen.findByRole('dialog');
        expect(within(modale).queryByText('Ce modèle sert aussi au courrier de mise en demeure')).not.toBeInTheDocument();
    });
});
