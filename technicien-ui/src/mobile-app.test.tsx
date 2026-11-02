import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import MobileApp from './mobile-app.tsx';
import api from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.setTimeout(30000);

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;

const aujourdhui = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

const terminee = {
    itemId: 8,
    venteId: 3,
    itemType: 'service',
    itemNom: 'Vidange',
    itemStatus: 'TERMINEE',
    venteType: 'FACTURE_EN_ATTENTE',
    statusDate: `${aujourdhui()}T09:00:00`,
    clientNom: 'Dupont',
    bonPourAccord: true,
    dureeReelle: 1.5,
    taches: [],
    produits: [],
    produitsExtra: [],
    images: [],
    documents: [],
};

const afficher = (tache: object) => {
    get.mockImplementation((url: string) =>
        Promise.resolve({ data: url === '/technicien-portal/techniciens/1/taches' ? [tache] : [] }));
    render(<MobileApp user={{ id: 1, nom: 'Leclerc' }} onLogout={jest.fn()} onChangePassword={jest.fn()} />);
};

describe('Application mobile technicien - réouverture', () => {
    afterEach(() => jest.clearAllMocks());

    it('rouvre une tâche terminée puis ouvre sa fiche', async () => {
        post.mockResolvedValue({ data: { ...terminee, itemStatus: 'EN_COURS', dateReouverture: '2026-11-02 14:00:00.0' } });
        afficher(terminee);

        fireEvent.click(await screen.findByRole('button', { name: /Rouvrir/ }));
        const confirmation = (await screen.findByText('Rouvrir la tâche ?')).closest('.ant-popover') as HTMLElement;
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Rouvrir' }));

        await waitFor(() => expect(post).toHaveBeenCalledWith('/technicien-portal/services/8/rouvrir'));
        expect(await screen.findByLabelText('Note client')).toBeInTheDocument();
        expect(screen.getByLabelText('Temps passe (heures)')).toHaveValue('1.50');
    });

    it("ne propose pas de rouvrir une tâche d'une vente payée", async () => {
        afficher({ ...terminee, venteType: 'FACTURE_PAYEE' });

        expect(await screen.findByText('Vidange')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Rouvrir/ })).not.toBeInTheDocument();
    });
});
