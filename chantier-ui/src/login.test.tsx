import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from './login';

const reponse = (ok: boolean, status: number, corps: any) => Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(corps),
    text: () => Promise.resolve(corps),
});

const seConnecter = (utilisateur: string, motDePasse: string) => {
    fireEvent.change(screen.getByPlaceholderText('Utilisateur'), { target: { value: utilisateur } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: motDePasse } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));
};

describe('Login', () => {
    beforeEach(() => {
        localStorage.clear();
        window.history.pushState({}, '', '/');
    });

    it('pré-remplit le code chantier du lien et l\'envoie à la connexion', async () => {
        window.history.pushState({}, '', '/?chantier=Port-Test');
        const setUser = jest.fn();
        global.fetch = jest.fn(() => reponse(true, 200, { token: 'jeton', name: 'admin', modules: ['VENTE'], chantier: 'port-test' })) as any;

        render(<Login setUser={setUser} />);
        expect(screen.getByLabelText('Code chantier')).toHaveValue('port-test');
        seConnecter('admin', 'secret');

        await waitFor(() => expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'admin', chantier: 'port-test' })));
        expect(global.fetch).toHaveBeenCalledWith('/api/users/authenticate', expect.objectContaining({
            body: JSON.stringify({ name: 'admin', password: 'secret' }),
            headers: expect.objectContaining({ 'X-Chantier': 'port-test' }),
        }));
        // Mémorisé pour la prochaine connexion
        expect(localStorage.getItem('moussaillon-chantier')).toBe('port-test');
        expect(localStorage.getItem('moussaillon-token')).toBe('jeton');
    });

    it('reprend le dernier code chantier utilisé', () => {
        localStorage.setItem('moussaillon-chantier', 'ms-plaisance');
        render(<Login setUser={jest.fn()} />);
        expect(screen.getByLabelText('Code chantier')).toHaveValue('ms-plaisance');
    });

    it('exige le code chantier', async () => {
        global.fetch = jest.fn() as any;
        render(<Login setUser={jest.fn()} />);
        seConnecter('admin', 'secret');
        expect(await screen.findByText('Le code chantier est requis')).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('affiche la raison du refus donnée par le serveur', async () => {
        localStorage.setItem('moussaillon-chantier', 'port-test');
        const setUser = jest.fn();
        global.fetch = jest.fn(() => reponse(false, 403, "Accès bloqué : l'accès à ce chantier est suspendu.")) as any;

        render(<Login setUser={setUser} />);
        seConnecter('admin', 'secret');

        expect(await screen.findByText(/l'accès à ce chantier est suspendu/)).toBeInTheDocument();
        expect(setUser).not.toHaveBeenCalled();
    });
});
