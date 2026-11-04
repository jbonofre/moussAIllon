import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Utilisateurs from './utilisateurs.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));

const mockedFetch = fetchWithAuth as jest.Mock;

const reponse = (data: any, ok = true) =>
    Promise.resolve({ ok, status: ok ? 201 : 400, json: () => Promise.resolve(data), text: () => Promise.resolve('') });

const utilisateurs = [
    { name: 'admin', email: 'admin@test.com', modules: ['PARAMETRAGE', 'VENTE', 'PARC'] },
];

const appel = (url: string, method: string) =>
    mockedFetch.mock.calls.find(([u, options]) => u === url && options?.method === method);

beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/users' && options?.method === 'POST') return reponse(JSON.parse(options.body as string));
        if (url === '/users') return reponse(utilisateurs);
        if (url === '/societe') return reponse({ id: 1, modules: ['VENTE', 'PARC', 'PARAMETRAGE'] });
        return reponse(null, false);
    });
});

describe('Utilisateurs - accès aux modules', () => {
    it("affiche les modules de chaque utilisateur dans l'ordre du menu", async () => {
        render(<Utilisateurs />);

        const ligne = (await screen.findByText('admin@test.com')).closest('tr') as HTMLElement;
        const modules = within(ligne).getAllByText(/^(Vente|Parc|Paramétrage)$/).map((tag) => tag.textContent);
        expect(modules).toEqual(['Vente', 'Parc', 'Paramétrage']);
    });

    it("ne permet pas de retirer le module Paramétrage à l'utilisateur admin", async () => {
        render(<Utilisateurs />);
        await screen.findByText('admin@test.com');
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith('/societe'));

        fireEvent.click(screen.getByRole('button', { name: /edit/ }));
        const modal = await screen.findByRole('dialog');

        expect(within(modal).getByLabelText('Paramétrage')).toBeChecked();
        expect(within(modal).getByLabelText('Paramétrage')).toBeDisabled();
        expect(within(modal).getByLabelText('Vente')).toBeEnabled();
    });

    it('ne propose que les modules souscrits et envoie les modules choisis', async () => {
        render(<Utilisateurs />);
        await screen.findByText('admin@test.com');
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith('/societe'));

        fireEvent.click(screen.getByRole('button', { name: /plus-circle/ }));
        const modal = await screen.findByRole('dialog');

        expect(within(modal).getByLabelText('Vente')).toBeInTheDocument();
        expect(within(modal).queryByLabelText('Marketing')).not.toBeInTheDocument();

        fireEvent.change(within(modal).getByLabelText('Utilisateur'), { target: { value: 'vendeur' } });
        fireEvent.change(within(modal).getByLabelText('Email'), { target: { value: 'vendeur@test.com' } });
        fireEvent.change(within(modal).getByLabelText('Mot de passe'), { target: { value: 'secret' } });
        fireEvent.click(within(modal).getByLabelText('Vente'));
        fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }));

        await waitFor(() => expect(appel('/users', 'POST')).toBeDefined());
        expect(JSON.parse(appel('/users', 'POST')[1].body)).toMatchObject({ name: 'vendeur', modules: ['VENTE'] });
    });
});
