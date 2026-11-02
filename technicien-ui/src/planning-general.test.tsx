import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import dayjs from 'dayjs';
import PlanningGeneral from './planning-general.tsx';
import api from './api.ts';

jest.mock('./api.ts', () => ({ __esModule: true, default: { get: jest.fn() } }));

const item = (over: any) => ({
    itemId: 1,
    itemType: 'forfait',
    itemNom: 'Hivernage',
    itemStatus: 'PLANIFIEE',
    dateDebut: dayjs().startOf('week').add(1, 'day').hour(9).format('YYYY-MM-DDTHH:mm:ss'),
    dureePlanifiee: 2,
    bateauNom: 'Albatros',
    techniciens: [],
    ...over,
});

describe('PlanningGeneral', () => {
    beforeEach(() => {
        (api.get as jest.Mock).mockResolvedValue({
            data: [
                item({ techniciens: [{ id: 1, prenom: 'Pierre', nom: 'Leclerc' }] }),
                item({ itemId: 2, bateauNom: 'Pen Duick', techniciens: [{ id: 2, prenom: 'Anne', nom: 'Martin' }] }),
            ],
        });
    });

    it('affiche les prestations de tous les techniciens', async () => {
        render(<PlanningGeneral technicienId={1} />);
        await waitFor(() => expect(screen.getByText('Albatros')).toBeInTheDocument());
        expect(screen.getByText('Pen Duick')).toBeInTheDocument();
        expect(screen.getByText('Pierre Leclerc')).toBeInTheDocument();
        expect(screen.getByText('Anne Martin')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/technicien-portal/planning-general');
    });
});

describe('PlanningGeneral - recherche par client ou bateau', () => {
    beforeEach(() => {
        (api.get as jest.Mock).mockResolvedValue({
            data: [
                item({ clientNom: 'Dupont Jean' }),
                item({ itemId: 2, bateauNom: 'Pen Duick', clientNom: 'Le Gall Yann', bateauImmatriculation: 'CC 696123' }),
                item({
                    itemId: 3,
                    bateauNom: 'Korrigan',
                    clientNom: 'Martin Paul',
                    dateDebut: dayjs().startOf('week').add(8, 'day').hour(9).format('YYYY-MM-DDTHH:mm:ss'),
                }),
            ],
        });
    });

    const rechercher = (texte: string) =>
        fireEvent.change(screen.getByLabelText('Rechercher une prestation'), { target: { value: texte } });

    it("n'affiche que les prestations du client ou du bateau recherché", async () => {
        render(<PlanningGeneral technicienId={1} />);
        await waitFor(() => expect(screen.getByText('Albatros')).toBeInTheDocument());

        rechercher('le gall');
        expect(screen.getByText('Pen Duick')).toBeInTheDocument();
        expect(screen.queryByText('Albatros')).not.toBeInTheDocument();

        rechercher('CC696123');
        expect(screen.getByText('Pen Duick')).toBeInTheDocument();
        expect(screen.queryByText('Albatros')).not.toBeInTheDocument();
    });

    it('propose la semaine de la prestation trouvée quand la semaine affichée est vide', async () => {
        render(<PlanningGeneral technicienId={1} />);
        await waitFor(() => expect(screen.getByText('Albatros')).toBeInTheDocument());

        rechercher('martin');
        expect(screen.getByText('Aucune prestation ne correspond à la recherche cette semaine')).toBeInTheDocument();
        const semaine = dayjs().startOf('week').add(1, 'week').format('DD/MM/YYYY');
        fireEvent.click(screen.getByRole('button', { name: `Aller à la semaine du ${semaine}` }));

        expect(screen.getByText('Korrigan')).toBeInTheDocument();
        expect(screen.queryByText('Albatros')).not.toBeInTheDocument();
    });
});
