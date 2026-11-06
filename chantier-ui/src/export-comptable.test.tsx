import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExportComptable, { moisPrecedent } from './export-comptable.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));

jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;

const parametres = {
    journalVentes: 'VE', journalBanque: 'BQ', journalCaisse: 'CA', compteClients: '411000', comptePrestations: '706000',
    compteMarchandises: '707000', compteOccasion: '707000', compteTvaCollectee: '445710', compteBanque: '512000',
    compteCaisse: '530000',
};

const ecriture = (compte: string, debit: number, credit: number, journal = 'VE', numero = 1) => ({
    numero, date: '2026-10-15', journal, journalLibelle: journal === 'VE' ? 'Journal des ventes' : 'Journal de banque',
    compte, compteLibelle: compte, piece: 'FA26-000042', libelle: 'Facture Jean Dupont', debit, credit,
    ...(compte === '411000' ? { compteAuxiliaire: 'C000100', compteAuxiliaireLibelle: 'Jean Dupont' } : {}),
});

const ecritures = [ecriture('411000', 120, 0), ecriture('706000', 0, 100), ecriture('445710', 0, 20)];
const reglement = [ecriture('512000', 120, 0, 'BQ', 2), ecriture('411000', 0, 120, 'BQ', 2)];

const reponse = (data: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data),
    headers: { get: () => 'attachment; filename="123456789FEC20261031.txt"' },
    blob: () => Promise.resolve(new Blob(['JournalCode\tJournalLib'])) });

// Texte d'un élément, espaces (dont insécables des montants) ignorés
const texte = (attendu: string) => (_: string, element: Element | null) =>
    !!element && element.children.length === 0 && (element.textContent || '').replace(/\s/g, '') === attendu.replace(/\s/g, '');

const [debut, fin] = moisPrecedent().map((d) => d.format('YYYY-MM-DD'));

beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.startsWith('./export-comptable/parametres')) {
            return reponse(options?.method === 'PUT' ? JSON.parse(options.body as string) : parametres);
        }
        if (url.includes('reglements=true')) {
            return reponse([...ecritures, ...reglement]);
        }
        return reponse(ecritures);
    });
});

describe('Export comptable', () => {
    it('affiche les écritures du mois précédent et le plan comptable', async () => {
        render(<ExportComptable />);

        expect(await screen.findAllByText('FA26-000042')).toHaveLength(3);
        expect(mockedFetch).toHaveBeenCalledWith(`./export-comptable/ecritures?debut=${debut}&fin=${fin}&reglements=false`);
        expect(screen.getAllByText(texte('120,00 €')).length).toBeGreaterThan(0);
        expect(screen.getByText('C000100 Jean Dupont')).toBeInTheDocument();
        expect(await screen.findByDisplayValue('445710')).toBeInTheDocument();
    });

    it('ajoute les règlements à la demande, avec un avertissement', async () => {
        render(<ExportComptable />);
        await screen.findAllByText('FA26-000042');

        fireEvent.click(screen.getByLabelText(/Inclure les règlements/));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(
            `./export-comptable/ecritures?debut=${debut}&fin=${fin}&reglements=true`));
        expect(await screen.findByText(/comptés deux fois/)).toBeInTheDocument();
        expect(await screen.findByText('512000')).toBeInTheDocument();
    });

    it('télécharge le FEC de la période, sous le nom donné par le serveur', async () => {
        const createObjectURL = jest.fn(() => 'blob:ecritures');
        const revokeObjectURL = jest.fn();
        Object.assign(URL, { createObjectURL, revokeObjectURL });
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.download).toBe('123456789FEC20261031.txt');
        });
        render(<ExportComptable />);
        await screen.findAllByText('FA26-000042');

        fireEvent.click(screen.getByRole('button', { name: /Télécharger le FEC/ }));

        await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:ecritures'));
        expect(click).toHaveBeenCalled();
        expect(mockedFetch).toHaveBeenCalledWith(`./export-comptable/fec?debut=${debut}&fin=${fin}&reglements=false`);
        click.mockRestore();
    });

    it('enregistre le plan comptable', async () => {
        render(<ExportComptable />);
        const compteBanque = await screen.findByDisplayValue('512000');

        fireEvent.change(compteBanque, { target: { value: '512100' } });
        fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith('./export-comptable/parametres', expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('"compteBanque":"512100"'),
        })));
    });
});
