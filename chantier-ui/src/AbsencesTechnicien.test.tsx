import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AbsencesTechnicien from './AbsencesTechnicien.tsx';
import { joursDepuisFiche, joursVersFiche } from './capacite-technicien.ts';
import api from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.setTimeout(30000);

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock; delete: jest.Mock };

const absences = [
    { id: 2, dateDebut: '2026-10-12', dateFin: '2026-10-12', type: 'FORMATION' },
    { id: 1, dateDebut: '2026-08-03', dateFin: '2026-08-21', type: 'CONGES', motif: 'Été' },
];

beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.delete.mockReset();
    mockedApi.get.mockResolvedValue({ data: absences });
    mockedApi.post.mockResolvedValue({ data: {} });
    mockedApi.delete.mockResolvedValue({});
});

describe('AbsencesTechnicien', () => {
    it('liste les absences du technicien', async () => {
        render(<AbsencesTechnicien technicienId={7} />);

        const conges = (await screen.findByText('Été')).closest('tr') as HTMLElement;
        expect(mockedApi.get).toHaveBeenCalledWith('/techniciens/7/absences');
        expect(within(conges).getByText('03/08/2026')).toBeInTheDocument();
        expect(within(conges).getByText('21/08/2026')).toBeInTheDocument();
        expect(within(conges).getByText('Congés')).toBeInTheDocument();
        expect(screen.getByText('Formation')).toBeInTheDocument();
    });

    it("demande les dates avant d'ajouter une absence", async () => {
        render(<AbsencesTechnicien technicienId={7} />);
        await screen.findByText('Été');

        fireEvent.click(screen.getByRole('button', { name: /Ajouter/ }));

        expect(await screen.findByText("Choisissez les dates de début et de fin de l'absence.")).toBeInTheDocument();
        expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('supprime une absence et recharge la liste', async () => {
        render(<AbsencesTechnicien technicienId={7} />);
        const conges = (await screen.findByText('Été')).closest('tr') as HTMLElement;

        fireEvent.click(within(conges).getByTitle("Supprimer l'absence"));
        fireEvent.click(await screen.findByRole('button', { name: 'Oui' }));

        await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/techniciens/7/absences/1'));
        await waitFor(() => expect(mockedApi.get).toHaveBeenCalledTimes(2));
    });
});

describe('jours travaillés', () => {
    it('convertit la fiche en cases à cocher et inversement', () => {
        expect(joursDepuisFiche(null)).toEqual([1, 2, 3, 4, 5]);
        expect(joursDepuisFiche('2, 3,6')).toEqual([2, 3, 6]);
        expect(joursVersFiche([6, 2, 3])).toBe('2,3,6');
        expect(joursVersFiche([])).toBeUndefined();
    });
});
