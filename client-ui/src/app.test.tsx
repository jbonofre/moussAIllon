import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './app.tsx';

// Mock all child components to avoid ESM/axios issues
jest.mock('./login.tsx', () => {
    return function MockLogin({ setUser }: any) {
        return (
            <div data-testid="login-component">
                <button onClick={() => setUser({ id: 1, nom: 'Jean Dupont', type: 'Particulier' })}>
                    Se connecter
                </button>
            </div>
        );
    };
});

jest.mock('./dashboard.tsx', () => {
    return function MockDashboard() {
        return <div data-testid="dashboard">Dashboard</div>;
    };
});

jest.mock('./mes-bateaux.tsx', () => {
    return function MockMesBateaux() {
        return <div>Mes Bateaux</div>;
    };
});

jest.mock('./mes-moteurs.tsx', () => {
    return function MockMesMoteurs() {
        return <div>Mes Moteurs</div>;
    };
});

jest.mock('./mes-remorques.tsx', () => {
    return function MockMesRemorques() {
        return <div>Mes Remorques</div>;
    };
});

jest.mock('./mes-factures.tsx', () => {
    return function MockMesFactures() {
        return <div>Mes Factures</div>;
    };
});

jest.mock('./mes-prestations.tsx', () => {
    return function MockMesPrestations() {
        return <div>Mes Prestations</div>;
    };
});

jest.mock('./mon-profil.tsx', () => {
    return function MockMonProfil() {
        return <div>Mon Profil</div>;
    };
});

jest.mock('./petites-annonces.tsx', () => {
    return function MockPetitesAnnonces() {
        return <div>Petites Annonces</div>;
    };
});

jest.mock('./mobile-app.tsx', () => {
    return function MockMobileApp() {
        return <div data-testid="mobile-app">Mobile</div>;
    };
});

jest.mock('./use-is-mobile.tsx', () => {
    return () => false;
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
