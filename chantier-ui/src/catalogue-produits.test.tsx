import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CatalogueProduits from './catalogue-produits.tsx';
import api from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

// Mock child components to isolate the catalogue view logic
jest.mock('./ImageUpload.tsx', () => () => null);
jest.mock('./DocumentUpload.tsx', () => () => null);
jest.mock('./ImportCsvButton.tsx', () => () => null);
jest.mock('./ForfaitFormModal.tsx', () => () => null);
jest.mock('./produit-historique.tsx', () => () => null);
jest.mock('./fournisseur-produits.tsx', () => () => <div data-testid="fournisseurs-produit" />);
jest.mock('./fournisseur-bateaux.tsx', () => () => <div data-testid="fournisseurs-bateau" />);
jest.mock('./fournisseur-moteurs.tsx', () => () => <div data-testid="fournisseurs-moteur" />);
jest.mock('./fournisseur-helices.tsx', () => () => <div data-testid="fournisseurs-helice" />);
jest.mock('./fournisseur-remorques.tsx', () => () => <div data-testid="fournisseurs-remorque" />);

// Le rendu du formulaire complet est lent sous jsdom
jest.setTimeout(60000);

// Même identifiant dans chaque référentiel : les lignes doivent rester distinctes
const catalogue: Record<string, any[]> = {
    '/catalogue/produits': [{ id: 1, designation: 'Anode zinc', categorie: 'Accastillage', ref: 'AN-1', stock: 4, prixVenteTTC: 12 }],
    '/catalogue/bateaux': [{ id: 1, designation: 'Cap Camarat 6.5', type: 'Open', stock: 1, prixVenteTTC: 45000, options: [] }],
    '/catalogue/moteurs': [{ id: 1, designation: 'F115 XB', type: 'Hors-bord', stock: 2, prixVenteTTC: 13000, helicesCompatibles: [{ id: 1, designation: 'Alu 13x19' }] }],
    '/catalogue/helices': [{ id: 1, designation: 'Alu 13x19', prixVenteTTC: 150 }],
    '/catalogue/remorques': [{ id: 1, designation: 'Satellite 750', stock: 1, prixVenteTTC: 1900 }],
};

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockImplementation((url: string) => Promise.resolve({ data: catalogue[url] || [] }) as any);
    mockedApi.post.mockImplementation((_url: string, body: any) => Promise.resolve({ data: { ...body, id: 42 } }) as any);
    mockedApi.put.mockImplementation((_url: string, body: any) => Promise.resolve({ data: body }) as any);
    mockedApi.delete.mockResolvedValue({} as any);
});

const renderCatalogue = async () => {
    render(<CatalogueProduits />);
    await screen.findByText('Satellite 750');
};

const formItem = (label: string) => screen.getByText(label).closest('.ant-form-item') as HTMLElement;

const typeProduitSelect = () => within(formItem('Type de produit')).getByRole('combobox');

describe('CatalogueProduits', () => {
    it('regroupe produits, bateaux, moteurs, hélices et remorques dans une seule liste', async () => {
        await renderCatalogue();
        ['Anode zinc', 'Cap Camarat 6.5', 'F115 XB', 'Alu 13x19', 'Satellite 750'].forEach((designation) => {
            expect(screen.getByText(designation)).toBeInTheDocument();
        });
    });

    it('filtre la liste par type de produit', async () => {
        await renderCatalogue();
        fireEvent.click(screen.getByText('Bateaux'));
        await waitFor(() => expect(screen.queryByText('Anode zinc')).not.toBeInTheDocument());
        expect(screen.getByText('Cap Camarat 6.5')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Articles'));
        expect(await screen.findByText('Anode zinc')).toBeInTheDocument();
        expect(screen.queryByText('Cap Camarat 6.5')).not.toBeInTheDocument();
    });

    it('filtre la liste avec la recherche', async () => {
        await renderCatalogue();
        fireEvent.change(screen.getByPlaceholderText('Recherche'), { target: { value: 'hors-bord' } });
        fireEvent.keyDown(screen.getByPlaceholderText('Recherche'), { key: 'Enter', code: 'Enter', keyCode: 13 });
        await waitFor(() => expect(screen.queryByText('Anode zinc')).not.toBeInTheDocument());
        expect(screen.getByText('F115 XB')).toBeInTheDocument();
    });

    it('affiche les champs du type du produit ouvert en modification', async () => {
        await renderCatalogue();
        fireEvent.click(screen.getByText('Cap Camarat 6.5'));

        expect(await screen.findByText('Modifier un bateau')).toBeInTheDocument();
        expect(screen.getByLabelText('Longueur coque')).toBeInTheDocument();
        expect(screen.getByLabelText('Type de bateau')).toBeInTheDocument();
        expect(screen.queryByLabelText('Référence interne')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('PTAC')).not.toBeInTheDocument();
        expect(screen.getByTestId('fournisseurs-bateau')).toBeInTheDocument();
        expect(typeProduitSelect()).toBeDisabled();
    });

    it('adapte le formulaire au type choisi et enregistre dans le bon référentiel', async () => {
        await renderCatalogue();
        fireEvent.click(document.querySelector('.anticon-plus-circle')!.closest('button')!);

        expect(await screen.findByText('Ajouter un article')).toBeInTheDocument();
        expect(screen.getByLabelText('Référence interne')).toBeInTheDocument();
        // l'en-tête de colonne triable porte le même libellé : on cible le champ du formulaire
        fireEvent.change(screen.getByLabelText('Désignation', { selector: 'input' }), { target: { value: 'Inox 14x21' } });

        fireEvent.mouseDown(typeProduitSelect());
        const option = await waitFor(() => {
            const found = Array.from(document.querySelectorAll('.ant-select-item-option'))
                .find((element) => element.textContent === 'Hélice');
            expect(found).toBeTruthy();
            return found as HTMLElement;
        });
        fireEvent.click(option);

        expect(await screen.findByText('Ajouter une hélice')).toBeInTheDocument();
        expect(screen.getByLabelText('Diamètre')).toBeInTheDocument();
        expect(screen.queryByLabelText('Référence interne')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Stock', { selector: 'input' })).not.toBeInTheDocument();
        // les champs communs déjà saisis sont conservés
        expect(screen.getByLabelText('Désignation', { selector: 'input' })).toHaveValue('Inox 14x21');

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
            '/catalogue/helices',
            expect.objectContaining({ designation: 'Inox 14x21', diametre: 0 }),
        ));
        expect(await screen.findByTestId('fournisseurs-helice')).toBeInTheDocument();
    });

    it('enregistre une modification dans le référentiel du type du produit', async () => {
        await renderCatalogue();
        fireEvent.click(screen.getByText('F115 XB'));
        expect(await screen.findByText('Modifier un moteur')).toBeInTheDocument();
        expect(screen.getByLabelText('Type de moteur')).toBeInTheDocument();
        expect(within(formItem('Hélices compatibles')).getByText('Alu 13x19')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
            '/catalogue/moteurs/1',
            expect.objectContaining({ id: 1, designation: 'F115 XB', type: 'Hors-bord', helicesCompatibles: [{ id: 1 }] }),
        ));
        const body = mockedApi.put.mock.calls[0][1] as any;
        ['typeProduit', 'key', 'forfaitIds'].forEach((champ) => expect(body).not.toHaveProperty(champ));
    });

    it('enregistre les moteurs compatibles d\'une hélice sur les moteurs', async () => {
        await renderCatalogue();
        fireEvent.click(screen.getByText('Alu 13x19'));
        expect(await screen.findByText('Modifier une hélice')).toBeInTheDocument();

        const moteursCompatibles = formItem('Moteurs compatibles');
        expect(within(moteursCompatibles).getByText('F115 XB')).toBeInTheDocument();
        fireEvent.click(within(moteursCompatibles).getByLabelText('close'));
        await waitFor(() => expect(within(moteursCompatibles).queryByText('F115 XB')).not.toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
            '/catalogue/moteurs/1',
            expect.objectContaining({ id: 1, helicesCompatibles: [] }),
        ));
        const heliceCall = mockedApi.put.mock.calls.find(([url]) => url === '/catalogue/helices/1');
        expect(heliceCall).toBeTruthy();
        expect(heliceCall![1]).not.toHaveProperty('moteursCompatibles');
    });

    it('supprime dans le référentiel du type du produit', async () => {
        await renderCatalogue();
        const row = screen.getByText('Satellite 750').closest('tr') as HTMLElement;
        fireEvent.click(row.querySelector('.anticon-delete')!.closest('button')!);
        expect(await screen.findByText('Supprimer cette remorque ?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Oui' }));
        await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/catalogue/remorques/1'));
    });
});
