import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Parc from './parc.tsx';
import api from './api.ts';

jest.mock('./api.ts', () => ({ __esModule: true, default: { get: jest.fn() } }));

const get = api.get as jest.Mock;

describe('Parc', () => {
    beforeEach(() => {
        get.mockImplementation((url: string) => {
            if (url === '/bateaux') {
                return Promise.resolve({ data: [{ id: 1, name: 'Belle-Ile', immatriculation: 'AB-123', proprietaires: [{ nom: 'Dupont' }] }] });
            }
            if (url === '/technicien-portal/parc/bateaux/1/taches') {
                return Promise.resolve({ data: [{
                    itemId: 5, itemType: 'service', itemNom: 'Hivernage', itemStatus: 'EN_COURS',
                    taches: [{ id: 9, nom: 'Vidanger le moteur', done: true }],
                }] });
            }
            return Promise.resolve({ data: [] });
        });
    });

    it('liste le parc et affiche les tâches des prestations du bateau', async () => {
        render(<Parc />);
        fireEvent.click(await screen.findByText('Belle-Ile'));
        await waitFor(() => expect(get).toHaveBeenCalledWith('/technicien-portal/parc/bateaux/1/taches'));
        fireEvent.click(await screen.findByText('Hivernage'));
        expect(await screen.findByText('Vidanger le moteur')).toBeInTheDocument();
    });
});
