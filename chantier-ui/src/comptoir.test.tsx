import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { message } from 'antd';
import '@testing-library/jest-dom';
import Comptoir from './comptoir.tsx';
import api from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

// Mock child components to isolate the sale form logic
jest.mock('./ImageUpload.tsx', () => () => null);
jest.mock('./CommandeFournisseurFromVenteModal.tsx', () => () => null);
jest.mock('./FicheCatalogueModal.tsx', () => ({ __esModule: true, default: () => null, FicheCataloguePopover: () => null }));

// Le rendu du formulaire complet est lent sous jsdom
jest.setTimeout(60000);

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
        {
            id: 9,
            designation: 'Pack entretien',
            ref: 'PKG-000009',
            lignes: [
                { id: 4, forfait, quantite: 1 },
                { id: 5, produit, quantite: 2 },
            ],
        },
        { id: 10, designation: 'Pack hivernage', ref: 'PKG-000010', lignes: [{ id: 6, forfait, quantite: 1 }] },
    ],
    '/catalogue/produits': [produit],
    '/catalogue/bateaux': [bateau],
    '/catalogue/moteurs': [moteur],
};

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockImplementation((url: string) => Promise.resolve({ data: donnees[url] || [] }) as any);
    mockedApi.post.mockImplementation((_url: string, body: any) => Promise.resolve({ data: { ...body, id: 42 } }) as any);
});

afterEach(() => {
    // Les toasts antd vivent hors de l'arbre React : on les purge pour qu'ils ne fuient pas d'un test à l'autre
    message.destroy();
});

const ouvrirNouvelleVente = async (): Promise<HTMLElement> => {
    render(<Comptoir />);
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/ventes/search', { params: { comptoir: true } }));
    fireEvent.click(document.querySelector('.anticon-plus-circle')!.closest('button')!);
    await screen.findByText('Ajouter une vente comptoir');
    return document.querySelector('.ant-modal') as HTMLElement;
};

const lignesProduits = (modal: HTMLElement) =>
    Array.from(modal.querySelectorAll('.ant-select'))
        .filter((select) => select.closest('.ant-form-item')?.closest('.ant-space'));

const choisirDansLaDerniereLigne = async (modal: HTMLElement, libelle: string) => {
    const lignes = lignesProduits(modal);
    fireEvent.mouseDown(within(lignes[lignes.length - 1] as HTMLElement).getByRole('combobox'));
    const option = await waitFor(() => {
        const found = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
            .find((element) => element.textContent === libelle);
        expect(found).toBeTruthy();
        return found as HTMLElement;
    });
    fireEvent.click(option);
};

describe('Comptoir - saisie des produits', () => {
    it('calcule le montant dès la saisie d\'un produit, pour une quantité de 1', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaDerniereLigne(modal, 'AN-1 - Anode zinc');

        await waitFor(() => expect(lignesProduits(modal)).toHaveLength(2));
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('12.00');
        expect(within(modal).getByLabelText('Prix vente TTC')).toHaveValue('12.00');
    });
});

describe('Comptoir - ligne libre', () => {
    const saisir = (champ: HTMLElement, valeur: string) => fireEvent.change(champ, { target: { value: valeur } });

    const ajouterLigneLibre = async (modal: HTMLElement): Promise<HTMLElement> => {
        fireEvent.click(within(modal).getByRole('button', { name: /Ajouter une ligne libre/ }));
        return (await within(modal).findByPlaceholderText('Réf.')).closest('.ant-space') as HTMLElement;
    };

    it('crée au catalogue l\'article saisi sur une ligne libre, à l\'enregistrement de la vente', async () => {
        const articleCree = { id: 77, ref: 'MAN-6', designation: 'Manille inox', categorie: 'Non classé', stock: 0, prixVenteTTC: 4.5, tva: 20 };
        mockedApi.post.mockImplementation((_url: string, body: any) => Promise.resolve({
            data: { ...body, id: 42, venteProduits: [{ id: 1, produit: articleCree, quantite: 2, remise: 0 }] },
        }) as any);
        const modal = await ouvrirNouvelleVente();

        const ligne = await ajouterLigneLibre(modal);
        expect(within(ligne).getByPlaceholderText('TVA')).toHaveValue('20');
        saisir(within(ligne).getByPlaceholderText('Réf.'), 'MAN-6');
        saisir(within(ligne).getByPlaceholderText('Désignation'), 'Manille inox');
        saisir(within(ligne).getByPlaceholderText('P.U.'), '4.5');
        saisir(within(ligne).getByPlaceholderText('Qte'), '2');

        await waitFor(() => expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('9.00'));
        // la ligne de saisie d'un article du catalogue reste disponible
        expect(lignesProduits(modal)).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/ventes', expect.objectContaining({
            venteProduits: [expect.objectContaining({ produit: { ref: 'MAN-6', designation: 'Manille inox', prixVenteTTC: 4.5, tva: 20 }, quantite: 2 })],
            montantTTC: 9,
            prixVenteTTC: 9,
        })));

        // la ligne désigne désormais l'article créé au catalogue
        expect(await screen.findByText('Ajouté au catalogue : Manille inox')).toBeInTheDocument();
        expect(await within(modal).findByTitle('MAN-6 - Manille inox')).toBeInTheDocument();
        expect(within(modal).queryByPlaceholderText('Réf.')).not.toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('9.00');
    });

    it('refuse un article déjà au catalogue, sans enregistrer la vente', async () => {
        const modal = await ouvrirNouvelleVente();

        const ligne = await ajouterLigneLibre(modal);
        saisir(within(ligne).getByPlaceholderText('Désignation'), ' anode ZINC ');
        saisir(within(ligne).getByPlaceholderText('P.U.'), '12');
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

        expect(await within(modal).findByText('Article déjà au catalogue')).toBeInTheDocument();
        expect(mockedApi.post).not.toHaveBeenCalled();
    });
});

describe('Comptoir - packages', () => {
    it('peuple la vente avec le contenu du package choisi', async () => {
        const modal = await ouvrirNouvelleVente();
        expect(mockedApi.get).toHaveBeenCalledWith('/catalogue/packages');

        await choisirDansLaDerniereLigne(modal, 'PKG-000007 - Pack prêt à naviguer');

        // une ligne par article du package, puis la ligne vide de saisie
        await waitFor(() => expect(lignesProduits(modal)).toHaveLength(4));
        expect(within(modal).getByText('Cap Camarat 6.5')).toBeInTheDocument();
        expect(within(modal).getByText('F115 XB')).toBeInTheDocument();
        expect(within(modal).getByText('AN-1 - Anode zinc')).toBeInTheDocument();
        expect(within(modal).queryByText('PKG-000007 - Pack prêt à naviguer')).not.toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('58048.00');
        expect(within(modal).getByLabelText('Prix vente TTC')).toHaveValue('58048.00');

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/ventes', expect.objectContaining({
            comptoir: true,
            venteBateauxCatalogue: [expect.objectContaining({ bateau: expect.objectContaining({ designation: 'Cap Camarat 6.5' }), quantite: 1 })],
            venteMoteursCatalogue: [expect.objectContaining({ moteur: expect.objectContaining({ designation: 'F115 XB' }), quantite: 1 })],
            venteProduits: [expect.objectContaining({ produit: expect.objectContaining({ designation: 'Anode zinc' }), quantite: 4 })],
            montantTTC: 58048,
            prixVenteTTC: 58048,
        })));
    });

    it('ajoute le package à la suite des lignes déjà saisies', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaDerniereLigne(modal, 'AN-1 - Anode zinc');
        await waitFor(() => expect(lignesProduits(modal)).toHaveLength(2));
        await choisirDansLaDerniereLigne(modal, 'PKG-000007 - Pack prêt à naviguer');

        await waitFor(() => expect(lignesProduits(modal)).toHaveLength(5));
        expect(within(modal).getAllByText('AN-1 - Anode zinc')).toHaveLength(2);
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('58060.00');
    });

    it('ne reprend que les articles d\'un package contenant un forfait', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaDerniereLigne(modal, 'PKG-000009 - Pack entretien');

        expect(await screen.findByText('Les forfaits du package ne sont pas repris dans une vente comptoir.')).toBeInTheDocument();
        await waitFor(() => expect(lignesProduits(modal)).toHaveLength(2));
        expect(within(modal).getByTitle('AN-1 - Anode zinc')).toBeInTheDocument();
        expect(within(modal).queryByTitle(/Hivernage/)).not.toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('24.00');
    });

    it('laisse la vente inchangée pour un package ne contenant que des forfaits', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaDerniereLigne(modal, 'PKG-000010 - Pack hivernage');

        expect(await screen.findByText('Les forfaits du package ne sont pas repris dans une vente comptoir.')).toBeInTheDocument();
        expect(screen.queryByText('Ce package ne contient aucun article.')).not.toBeInTheDocument();
        expect(lignesProduits(modal)).toHaveLength(1);
        await waitFor(() => expect(within(modal).queryByText('PKG-000010 - Pack hivernage')).not.toBeInTheDocument());
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('0.00');
    });

    it('laisse la vente inchangée pour un package sans article', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaDerniereLigne(modal, 'PKG-000008 - Pack vide');

        expect(await screen.findByText('Ce package ne contient aucun article.')).toBeInTheDocument();
        expect(lignesProduits(modal)).toHaveLength(1);
        await waitFor(() => expect(within(modal).queryByText('PKG-000008 - Pack vide')).not.toBeInTheDocument());
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('0.00');
    });
});
