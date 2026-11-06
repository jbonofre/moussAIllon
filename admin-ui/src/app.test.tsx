import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import App from './app.tsx';

jest.mock('axios', () => {
    const instance = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
    return { __esModule: true, default: { create: () => instance, post: jest.fn() } };
});

jest.mock('./chantiers.tsx', () => () => <div data-testid="chantiers">Chantiers</div>);

const mockedAxios = axios as unknown as { post: jest.Mock };

describe('App', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    it("affiche la connexion de l'administrateur, puis les chantiers", async () => {
        mockedAxios.post.mockResolvedValue({ data: { token: 'jeton', name: 'admin', email: 'admin@moussaillon.local' } });
        render(<App />);

        fireEvent.change(screen.getByPlaceholderText('Utilisateur'), { target: { value: 'admin' } });
        fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'secret' } });
        fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

        expect(await screen.findByTestId('chantiers')).toBeInTheDocument();
        expect(mockedAxios.post).toHaveBeenCalledWith('/api/admin/authenticate', { name: 'admin', password: 'secret' });
        expect(localStorage.getItem('moussaillon-admin-token')).toBe('jeton');
    });

    it('affiche le refus de connexion', async () => {
        mockedAxios.post.mockRejectedValue({ response: { status: 401, data: 'Identifiants invalides.' } });
        render(<App />);
        fireEvent.change(screen.getByPlaceholderText('Utilisateur'), { target: { value: 'admin' } });
        fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'faux' } });
        fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));
        expect(await screen.findByText('Identifiants invalides.')).toBeInTheDocument();
        expect(screen.queryByTestId('chantiers')).not.toBeInTheDocument();
    });

    it('se déconnecte', async () => {
        localStorage.setItem('moussaillon-admin-token', 'jeton');
        localStorage.setItem('moussaillon-admin-user', JSON.stringify({ name: 'admin' }));
        render(<App />);
        expect(screen.getByTestId('chantiers')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Déconnexion/ }));
        await waitFor(() => expect(screen.getByPlaceholderText('Utilisateur')).toBeInTheDocument());
        expect(localStorage.getItem('moussaillon-admin-token')).toBeNull();
    });
});
