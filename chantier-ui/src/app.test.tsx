import { vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import App from './app.tsx';

// Mock child components to isolate App logic
vi.mock('./login.tsx', () => {
    return { default: function MockLogin({ setUser }: any) {
        return (
            <div data-testid="login-component">
                <button onClick={() => setUser({ name: 'admin', roles: 'ADMIN' })}>
                    Se connecter
                </button>
            </div>
        );
    } };
});

vi.mock('./workspace.tsx', () => {
    return { default: function MockWorkspace({ user, roles }: any) {
        return <div data-testid="workspace-component">Workspace: {user} ({roles})</div>;
    } };
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
        expect(screen.getByText('Workspace: admin (ADMIN)')).toBeInTheDocument();
    });
});
