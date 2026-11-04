import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './app.tsx';

// Mock child components to isolate App logic
jest.mock('./login.tsx', () => {
    return function MockLogin({ setUser }: any) {
        return (
            <div data-testid="login-component">
                <button onClick={() => setUser({ name: 'admin', modules: ['VENTE', 'PARAMETRAGE'] })}>
                    Se connecter
                </button>
            </div>
        );
    };
});

jest.mock('./workspace.tsx', () => {
    return function MockWorkspace({ user, modules }: any) {
        return <div data-testid="workspace-component">Workspace: {user} ({modules.join(',')})</div>;
    };
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
        expect(screen.getByTestId('workspace-component')).toBeInTheDocument();
        expect(screen.getByText('Workspace: admin (VENTE,PARAMETRAGE)')).toBeInTheDocument();
    });

    it("redemande la connexion pour une session ouverte avant l'introduction des modules", () => {
        localStorage.setItem('moussaillon-user', JSON.stringify({ name: 'admin', roles: 'admin' }));
        try {
            render(<App />);
            expect(screen.getByTestId('login-component')).toBeInTheDocument();
        } finally {
            localStorage.removeItem('moussaillon-user');
        }
    });
});
