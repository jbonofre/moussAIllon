import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {
        get: (...args: any[]) => mockGet(...args),
        post: (...args: any[]) => mockPost(...args),
    },
}));

const mockMessageError = jest.fn();
jest.mock('antd', () => {
    const actual = jest.requireActual('antd');
    return {
        ...actual,
        message: {
            ...actual.message,
            error: (...args: any[]) => mockMessageError(...args),
            success: actual.message.success,
        },
    };
});

import MonProfil from './mon-profil.tsx';

const mockClient = {
    id: 1,
    nom: 'Jean Dupont',
    type: 'PARTICULIER',
    email: 'jean@test.com',
    telephone: '0612345678',
    adresse: '1 rue du Port',
};

beforeEach(() => {
    mockGet.mockResolvedValue({ data: mockClient });
    mockMessageError.mockClear();
});

describe('MonProfil', () => {
    it('affiche les informations du profil', async () => {
        render(<MonProfil clientId={1} />);
        await waitFor(() => {
            expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
        });
        expect(screen.getByText('jean@test.com')).toBeInTheDocument();
    });

    it('affiche le formulaire de changement de mot de passe', async () => {
        render(<MonProfil clientId={1} />);
        await waitFor(() => {
            expect(screen.getByText('Changer le mot de passe')).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('Mot de passe actuel')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Nouveau mot de passe')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Confirmer le mot de passe')).toBeInTheDocument();
    });

    it('envoie la requete de changement de mot de passe', async () => {
        mockPost.mockResolvedValue({ data: {} });
        const user = userEvent.setup();
        render(<MonProfil clientId={1} />);

        await waitFor(() => {
            expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
        });

        await user.type(screen.getByPlaceholderText('Mot de passe actuel'), 'oldpass');
        await user.type(screen.getByPlaceholderText('Nouveau mot de passe'), 'newpass');
        await user.type(screen.getByPlaceholderText('Confirmer le mot de passe'), 'newpass');
        await user.click(screen.getByText('Modifier'));

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith('/portal/clients/1/change-password', {
                currentPassword: 'oldpass',
                newPassword: 'newpass',
            });
        });
    });

    it('affiche une erreur si le mot de passe actuel est incorrect', async () => {
        mockPost.mockRejectedValue({
            response: { data: 'Mot de passe actuel invalide.' },
        });
        const user = userEvent.setup();
        render(<MonProfil clientId={1} />);

        await waitFor(() => {
            expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
        });

        await user.type(screen.getByPlaceholderText('Mot de passe actuel'), 'wrong');
        await user.type(screen.getByPlaceholderText('Nouveau mot de passe'), 'newpass');
        await user.type(screen.getByPlaceholderText('Confirmer le mot de passe'), 'newpass');
        await user.click(screen.getByText('Modifier'));

        await waitFor(() => {
            expect(mockMessageError).toHaveBeenCalledWith('Mot de passe actuel invalide.');
        });
    });
});
