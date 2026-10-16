import { vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import App from './app.tsx';

// Mock all child components to avoid ESM/axios issues
vi.mock('./login.tsx', () => {
    return { default: function MockLogin({ setUser }: any) {
        return (
            <div data-testid="login-component">
                <button onClick={() => setUser({ id: 1, nom: 'Jean Dupont', type: 'Particulier' })}>
                    Se connecter
                </button>
            </div>
        );
    } };
});

vi.mock('./dashboard.tsx', () => {
    return { default: function MockDashboard() {
        return <div data-testid="dashboard">Dashboard</div>;
    } };
});

vi.mock('./mes-bateaux.tsx', () => {
    return { default: function MockMesBateaux() {
        return <div>Mes Bateaux</div>;
    } };
});

vi.mock('./mes-moteurs.tsx', () => {
    return { default: function MockMesMoteurs() {
        return <div>Mes Moteurs</div>;
    } };
});

vi.mock('./mes-remorques.tsx', () => {
    return { default: function MockMesRemorques() {
        return <div>Mes Remorques</div>;
    } };
});

vi.mock('./mes-factures.tsx', () => {
    return { default: function MockMesFactures() {
        return <div>Mes Factures</div>;
    } };
});

vi.mock('./mes-prestations.tsx', () => {
    return { default: function MockMesPrestations() {
        return <div>Mes Prestations</div>;
    } };
});

vi.mock('./mon-profil.tsx', () => {
    return { default: function MockMonProfil() {
        return <div>Mon Profil</div>;
    } };
});

vi.mock('./petites-annonces.tsx', () => {
    return { default: function MockPetitesAnnonces() {
        return <div>Petites Annonces</div>;
    } };
});

vi.mock('./mobile-app.tsx', () => {
    return { default: function MockMobileApp() {
        return <div data-testid="mobile-app">Mobile</div>;
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

    it('renders dashboard after login', () => {
        render(<App />);
        act(() => {
            screen.getByText('Se connecter').click();
        });
        expect(screen.getByText(/Jean Dupont/)).toBeInTheDocument();
        expect(screen.getByText('Deconnexion')).toBeInTheDocument();
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });
});
