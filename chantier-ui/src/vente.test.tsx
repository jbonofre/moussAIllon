import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Vente from './vente.tsx';
import api from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

// Mock child components to isolate the sale form logic
jest.mock('./ImageUpload.tsx', () => () => null);
jest.mock('./DocumentUpload.tsx', () => () => null);
jest.mock('./CommandeFournisseurFromVenteModal.tsx', () => () => null);
jest.mock('./FicheCatalogueModal.tsx', () => ({ __esModule: true, default: () => null, FicheCataloguePopover: () => null }));

// Le rendu du formulaire complet est lent sous jsdom
jest.setTimeout(90000);

const PLACEHOLDER_LIGNE = 'Package, forfait, produit, bateau, moteur...';

// Même identifiant dans chaque référentiel : chaque ligne doit garder le type de son article
const produit = { id: 1, designation: 'Anode zinc', ref: 'AN-1', stock: 10, prixVenteTTC: 12 };
const bateau = { id: 1, designation: 'Cap Camarat 6.5', stock: 1, prixVenteTTC: 45000 };
const moteur = { id: 1, designation: 'F115 XB', stock: 2, prixVenteTTC: 13000 };
const forfait = { id: 1, nom: 'Hivernage', reference: 'FORFAIT-001', prixTTC: 300 };

const donnees: Record<string, any[]> = {
    '/catalogue/packages': [
        {
            id: 7,
            designation: 'Pack prêt à naviguer',
            ref: 'PKG-000007',
            lignes: [
                { id: 1, bateau, quantite: 1 },
                { id: 2, moteur, quantite: 1 },
                { id: 3, produit, quantite: 4 },
            ],
        },
        { id: 8, designation: 'Pack vide', ref: 'PKG-000008', lignes: [] },
    ],
    '/catalogue/produits': [produit],
    '/catalogue/bateaux': [bateau],
    '/catalogue/moteurs': [moteur],
    '/forfaits': [forfait],
    '/clients': [{ id: 3, nom: 'Jean Dupont' }],
};

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockImplementation((url: string) => Promise.resolve({ data: donnees[url] || [] }) as any);
    mockedApi.post.mockImplementation((_url: string, body: any) => Promise.resolve({ data: { ...body, id: 42 } }) as any);
});

const ouvrirNouvelleVente = async (): Promise<HTMLElement> => {
    render(<Vente />);
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/ventes'));
    fireEvent.click(document.querySelector('.anticon-plus-circle')!.closest('button')!);
    await screen.findByText('Transaction/Prestation');
    return document.querySelector('.ant-modal') as HTMLElement;
};

// Un sélecteur vide se reconnaît à son texte d'aide ; pour les lignes, c'est toujours celui de la ligne de saisie
const choisir = async (modal: HTMLElement, placeholder: string, libelle: string) => {
    const select = within(modal).getByText(placeholder).closest('.ant-select') as HTMLElement;
    fireEvent.mouseDown(within(select).getByRole('combobox'));
    const option = await waitFor(() => {
        const found = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
            .find((element) => element.textContent === libelle);
        expect(found).toBeTruthy();
        return found as HTMLElement;
    });
    fireEvent.click(option);
};

const choisirDansLaLigneVide = (modal: HTMLElement, libelle: string) => choisir(modal, PLACEHOLDER_LIGNE, libelle);

describe('Transactions - packages', () => {
    it('peuple la transaction avec le contenu du package choisi', async () => {
        const modal = await ouvrirNouvelleVente();
        expect(mockedApi.get).toHaveBeenCalledWith('/catalogue/packages');

        await choisir(modal, 'Rechercher un client par prénom ou nom', 'Jean Dupont');
        await choisirDansLaLigneVide(modal, 'FORFAIT-001 - Hivernage');
        await within(modal).findByText('FORFAIT-001 - Hivernage');
        await choisirDansLaLigneVide(modal, 'PKG-000007 - Pack prêt à naviguer');

        expect(await within(modal).findByText('Cap Camarat 6.5')).toBeInTheDocument();
        expect(within(modal).getByText('F115 XB')).toBeInTheDocument();
        expect(within(modal).getByText('AN-1 - Anode zinc')).toBeInTheDocument();
        // le forfait déjà saisi est conservé, et la saisie se poursuit sur une ligne vide
        expect(within(modal).getByText('FORFAIT-001 - Hivernage')).toBeInTheDocument();
        expect(within(modal).queryByText('PKG-000007 - Pack prêt à naviguer')).not.toBeInTheDocument();
        expect(within(modal).getByText(PLACEHOLDER_LIGNE)).toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('58348.00');

        fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/ventes', expect.objectContaining({
            client: expect.objectContaining({ nom: 'Jean Dupont' }),
            venteForfaits: [expect.objectContaining({ forfait: expect.objectContaining({ nom: 'Hivernage' }), quantite: 1 })],
            venteBateauxCatalogue: [expect.objectContaining({ bateau: expect.objectContaining({ designation: 'Cap Camarat 6.5' }), quantite: 1 })],
            venteMoteursCatalogue: [expect.objectContaining({ moteur: expect.objectContaining({ designation: 'F115 XB' }), quantite: 1 })],
            venteProduits: [expect.objectContaining({ produit: expect.objectContaining({ designation: 'Anode zinc' }), quantite: 4 })],
            montantTTC: 58348,
            prixVenteTTC: 58348,
        })));
    });

    it('laisse la transaction inchangée pour un package sans article', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaLigneVide(modal, 'PKG-000008 - Pack vide');

        expect(await screen.findByText('Ce package ne contient aucun article.')).toBeInTheDocument();
        await waitFor(() => expect(within(modal).queryByText('PKG-000008 - Pack vide')).not.toBeInTheDocument());
        expect(within(modal).getAllByText(PLACEHOLDER_LIGNE)).toHaveLength(1);
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('0.00');
    });
});
