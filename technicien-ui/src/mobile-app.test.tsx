import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import dayjs from 'dayjs';
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

const tache = (over: any) => ({
    itemId: 1,
    itemType: 'forfait',
    itemNom: 'Hivernage',
    itemStatus: 'PLANIFIEE',
    bonPourAccord: true,
    taches: [],
    ...over,
});

describe('Appli mobile technicien - recherche par client ou bateau', () => {
    beforeEach(() => {
        (api.get as jest.Mock).mockImplementation((url: string) => Promise.resolve({
            data: url === '/technicien-portal/techniciens/1/taches'
                ? [
                    tache({ clientNom: 'Dupont Jean', bateauNom: 'Galatée', bateauImmatriculation: 'CC 696123', statusDate: `${dayjs().format('YYYY-MM-DD')}T09:00:00` }),
                    tache({ itemId: 2, itemNom: 'Carénage', clientNom: 'Le Gall Yann', bateauNom: 'Albatros', statusDate: dayjs().add(3, 'day').format('YYYY-MM-DDT09:00:00') }),
                ]
                : [],
        }));
    });

    afterEach(() => jest.clearAllMocks());

    const rechercher = (texte: string) =>
        fireEvent.change(screen.getByLabelText('Rechercher une tâche'), { target: { value: texte } });

    it("filtre les tâches de l'onglet affiché", async () => {
        render(<MobileApp user={{ id: 1, nom: 'Leclerc' }} onLogout={jest.fn()} onChangePassword={jest.fn()} />);
        expect(await screen.findByText('Dupont Jean / Galatée (CC 696123)')).toBeInTheDocument();

        rechercher('galatee');
        expect(screen.getByText('Dupont Jean / Galatée (CC 696123)')).toBeInTheDocument();

        rechercher('martin');
        expect(screen.queryByText('Dupont Jean / Galatée (CC 696123)')).not.toBeInTheDocument();
        expect(screen.getByText('Aucune tâche ne correspond à la recherche')).toBeInTheDocument();
    });

    it("propose d'aller dans « Toutes » quand la tâche cherchée n'est pas aujourd'hui", async () => {
        render(<MobileApp user={{ id: 1, nom: 'Leclerc' }} onLogout={jest.fn()} onChangePassword={jest.fn()} />);
        expect(await screen.findByText('Dupont Jean / Galatée (CC 696123)')).toBeInTheDocument();

        rechercher('albatros');
        fireEvent.click(screen.getByRole('button', { name: 'Voir 1 tâche(s) dans « Toutes »' }));

        expect(screen.getByText('Le Gall Yann / Albatros')).toBeInTheDocument();
        expect(screen.queryByText('Dupont Jean / Galatée (CC 696123)')).not.toBeInTheDocument();
    });
});
