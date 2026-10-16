import { vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import App from './app.tsx';

// Mock child components
vi.mock('./login.tsx', () => {
    return { default: function MockLogin({ setUser }: any) {
        return (
            <div data-testid="login-component">
                <button onClick={() => setUser({ id: 1, nom: 'Leclerc', prenom: 'Pierre' })}>
                    Se connecter
                </button>
            </div>
        );
    } };
});

vi.mock('./planning.tsx', () => {
    return { default: function MockPlanning({ technicienId }: any) {
        return <div data-testid="planning-component">Planning: {technicienId}</div>;
    } };
});

vi.mock('./mobile-app.tsx', () => {
    return { default: function MockMobileApp({ onChangePassword }: any) {
        return (
            <div data-testid="mobile-app">
                <button onClick={onChangePassword}>Changer mot de passe mobile</button>
            </div>
        );
    } };
});

vi.mock('./change-password-modal.tsx', () => {
    return { default: function MockChangePasswordModal({ open, onClose, technicienId }: any) {
        if (!open) return null;
        return (
            <div data-testid="change-password-modal">
                Change password for {technicienId}
                <button onClick={onClose}>Fermer</button>
            </div>
        );
    } };
});

vi.mock('./use-is-mobile.tsx', () => {
    return { default: () => false };
});

describe('App', () => {
    it('renders login when no user is set', () => {
        render(<App />);
        expect(screen.getByTestId('login-component')).toBeInTheDocument();
    });

    it('renders workspace after login', () => {
        render(<App />);
        act(() => {
            screen.getByText('Se connecter').click();
        });
        expect(screen.getByText(/Pierre Leclerc/)).toBeInTheDocument();
        expect(screen.getByText('Deconnexion')).toBeInTheDocument();
    });

    it('shows password change button after login', () => {
        render(<App />);
        act(() => {
            screen.getByText('Se connecter').click();
        });
        expect(screen.getByText('Mot de passe')).toBeInTheDocument();
    });

    it('opens password change modal when button is clicked', () => {
        render(<App />);
        act(() => {
            screen.getByText('Se connecter').click();
        });
        expect(screen.queryByTestId('change-password-modal')).not.toBeInTheDocument();
        act(() => {
            screen.getByText('Mot de passe').click();
        });
        expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
    });

    it('closes password change modal', () => {
        render(<App />);
        act(() => {
            screen.getByText('Se connecter').click();
        });
        act(() => {
            screen.getByText('Mot de passe').click();
        });
        expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
        act(() => {
            screen.getByText('Fermer').click();
        });
        expect(screen.queryByTestId('change-password-modal')).not.toBeInTheDocument();
    });
});
