import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import PlanningGeneral from './planning-general.tsx';
import api from './api.ts';

vi.mock('./api.ts', () => ({ __esModule: true, default: { get: vi.fn() } }));

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
        (api.get as Mock).mockResolvedValue({
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
