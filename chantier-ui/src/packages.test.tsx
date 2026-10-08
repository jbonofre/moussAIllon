import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Packages from './packages.tsx';
import api from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

// Le rendu du formulaire complet est lent sous jsdom
jest.setTimeout(60000);

// Même identifiant dans chaque référentiel : une ligne doit garder le type de son article
const produit = { id: 1, designation: 'Anode zinc', ref: 'AN-1', prixVenteTTC: 12 };
const bateau = { id: 1, designation: 'Cap Camarat 6.5', prixVenteTTC: 45000 };
const moteur = { id: 1, designation: 'F115 XB', prixVenteTTC: 13000 };
const helice = { id: 1, designation: 'Alu 13x19', prixVenteTTC: 150 };
const remorque = { id: 1, designation: 'Satellite 750', prixVenteTTC: 1900 };

const pack = {
    id: 7,
    designation: 'Pack prêt à naviguer',
    ref: 'PKG-000007',
    description: 'Bateau, moteur et anodes',
    lignes: [
        { id: 1, bateau, quantite: 1 },
        { id: 2, moteur, quantite: 1 },
        { id: 3, produit, quantite: 4 },
    ],
};

const donnees: Record<string, any[]> = {
    '/catalogue/packages': [pack],
    '/catalogue/produits': [produit],
    '/catalogue/bateaux': [bateau],
    '/catalogue/moteurs': [moteur],
    '/catalogue/helices': [helice],
    '/catalogue/remorques': [remorque],
};

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockImplementation((url: string) => Promise.resolve({ data: donnees[url] || [] }) as any);
    mockedApi.post.mockImplementation((_url: string, body: any) => Promise.resolve({ data: { ...body, id: 42 } }) as any);
    mockedApi.put.mockImplementation((_url: string, body: any) => Promise.resolve({ data: { ...body, id: 7 } }) as any);
    mockedApi.delete.mockResolvedValue({} as any);
});

const renderPackages = async () => {
    render(<Packages />);
    await screen.findByText('Pack prêt à naviguer');
};

// La liste déroulante d'une ligne déjà renseignée reste dans le DOM, masquée : on choisit dans celle qui est ouverte
const choisirArticle = async (combobox: HTMLElement, libelle: string) => {
    fireEvent.mouseDown(combobox);
    const option = await waitFor(() => {
        const found = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
            .find((element) => element.textContent === libelle);
        expect(found).toBeTruthy();
        return found as HTMLElement;
    });
    fireEvent.click(option);
};

describe('Packages', () => {
    it('liste les packages avec leur contenu et leur prix catalogue', async () => {
        await renderPackages();
        const row = screen.getByText('Pack prêt à naviguer').closest('tr') as HTMLElement;
        expect(within(row).getByText('PKG-000007')).toBeInTheDocument();
        expect(within(row).getByText('Cap Camarat 6.5')).toBeInTheDocument();
        expect(within(row).getByText('F115 XB')).toBeInTheDocument();
        expect(within(row).getByText('4 × Anode zinc')).toBeInTheDocument();
        expect(within(row).getByText('58048.00 €')).toBeInTheDocument();
    });

    it('crée un package avec des articles de types différents', async () => {
        await renderPackages();
        fireEvent.click(document.querySelector('.anticon-plus-circle')!.closest('button')!);
        expect(await screen.findByText('Ajouter un package')).toBeInTheDocument();
        const modal = document.querySelector('.ant-modal') as HTMLElement;

        fireEvent.change(within(modal).getByLabelText('Désignation'), { target: { value: 'Pack motorisation' } });
        await choisirArticle(within(modal).getAllByRole('combobox')[0], 'F115 XB');
        fireEvent.click(within(modal).getByRole('button', { name: /Ajouter un article/ }));
        await waitFor(() => expect(within(modal).getAllByRole('combobox')).toHaveLength(2));
        await choisirArticle(within(modal).getAllByRole('combobox')[1], 'Alu 13x19');
        expect(await within(modal).findByText('13150.00 €')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
            '/catalogue/packages',
            expect.objectContaining({
                designation: 'Pack motorisation',
                lignes: [
                    { moteur: { id: 1 }, quantite: 1 },
                    { helice: { id: 1 }, quantite: 1 },
                ],
            }),
        ));
    });

    it('refuse un package sans article', async () => {
        await renderPackages();
        fireEvent.click(document.querySelector('.anticon-plus-circle')!.closest('button')!);
        expect(await screen.findByText('Ajouter un package')).toBeInTheDocument();
        const modal = document.querySelector('.ant-modal') as HTMLElement;
        fireEvent.change(within(modal).getByLabelText('Désignation'), { target: { value: 'Pack vide' } });

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        expect(await screen.findByText('Ajoutez au moins un article au package.')).toBeInTheDocument();
        expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('reprend le contenu d\'un package en modification', async () => {
        await renderPackages();
        fireEvent.click(screen.getByText('Pack prêt à naviguer'));
        expect(await screen.findByText('Modifier un package')).toBeInTheDocument();
        const modal = document.querySelector('.ant-modal') as HTMLElement;
        expect(within(modal).getByLabelText('Désignation')).toHaveValue('Pack prêt à naviguer');
        expect(within(modal).getByText('AN-1 - Anode zinc')).toBeInTheDocument();
        expect(within(modal).getByText('58048.00 €')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith(
            '/catalogue/packages/7',
            {
                designation: 'Pack prêt à naviguer',
                ref: 'PKG-000007',
                description: 'Bateau, moteur et anodes',
                lignes: [
                    { bateau: { id: 1 }, quantite: 1 },
                    { moteur: { id: 1 }, quantite: 1 },
                    { produit: { id: 1 }, quantite: 4 },
                ],
            },
        ));
    });

    it('recherche les packages côté serveur', async () => {
        await renderPackages();
        fireEvent.change(screen.getByPlaceholderText('Recherche'), { target: { value: 'naviguer' } });
        fireEvent.keyDown(screen.getByPlaceholderText('Recherche'), { key: 'Enter', code: 'Enter', keyCode: 13 });
        await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/catalogue/packages/search', { params: { q: 'naviguer' } }));
    });

    it('supprime un package', async () => {
        await renderPackages();
        const row = screen.getByText('Pack prêt à naviguer').closest('tr') as HTMLElement;
        fireEvent.click(row.querySelector('.anticon-delete')!.closest('button')!);
        expect(await screen.findByText('Supprimer ce package ?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Oui' }));
        await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/catalogue/packages/7'));
    });
});
