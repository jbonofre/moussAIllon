import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockGet = jest.fn();
const mockPost = jest.fn();

// Mock api
jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {
        get: (...args: any[]) => mockGet(...args),
        post: (...args: any[]) => mockPost(...args),
    },
}));

// Mock subcomponents used in modal tabs to isolate tests
jest.mock('./fournisseur-produits.tsx', () => () => <div data-testid="fournisseur-produits">Fournisseurs Produits</div>);
jest.mock('./produit-historique.tsx', () => () => <div data-testid="produit-historique">Historique Produits</div>);
jest.mock('./fournisseur-bateaux.tsx', () => () => <div data-testid="fournisseur-bateaux">Fournisseurs Bateaux</div>);
jest.mock('./fournisseur-moteurs.tsx', () => () => <div data-testid="fournisseur-moteurs">Fournisseurs Moteurs</div>);
jest.mock('./fournisseur-helices.tsx', () => () => <div data-testid="fournisseur-helices">Fournisseurs Hélices</div>);
jest.mock('./fournisseur-remorques.tsx', () => () => <div data-testid="fournisseur-remorques">Fournisseurs Remorques</div>);

import FicheCatalogueModal, { FicheCataloguePopover } from './FicheCatalogueModal.tsx';

describe('FicheCatalogueModal and FicheCataloguePopover', () => {
    const mockNavigate = jest.fn();

    const sampleProduits = [
        {
            id: 42,
            designation: 'Filtre à huile Yamaha',
            categorie: 'Entretien',
            ref: 'REF-YAM-042',
            stock: 12,
            stockMini: 3,
            emplacement: 'Rayon B2',
            prixVenteHT: 15,
            prixVenteTTC: 18,
            description: 'Filtre à huile d\'origine pour moteur hors-bord Yamaha',
        },
    ];

    beforeEach(() => {
        mockGet.mockReset();
        mockPost.mockReset();
        mockGet.mockResolvedValue({ data: sampleProduits[0] });
        mockNavigate.mockReset();
    });

    it('renders the info button and does not navigate when clicking "Voir dans le catalogue"', async () => {
        render(
            <FicheCataloguePopover
                type="produit"
                itemId={42}
                produits={sampleProduits}
                navigate={mockNavigate}
            />
        );

        // Find the info button by title "Fiche produit"
        const infoButton = screen.getByTitle('Fiche produit');
        expect(infoButton).toBeInTheDocument();
        fireEvent.click(infoButton);

        // Popover should display summary and the "Voir dans le catalogue" link
        const voirCatalogueBtn = await screen.findByRole('button', { name: /voir dans le catalogue/i });
        expect(voirCatalogueBtn).toBeInTheDocument();

        // Click "Voir dans le catalogue"
        fireEvent.click(voirCatalogueBtn);

        // Crucial requirement: navigate MUST NOT be called (page state is preserved)
        expect(mockNavigate).not.toHaveBeenCalled();

        // The modal should open showing the full fiche produit
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toBeInTheDocument();
            expect(within(dialog).getByText(/Fiche produit :/i)).toBeInTheDocument();
            expect(within(dialog).getAllByText('Filtre à huile Yamaha').length).toBeGreaterThanOrEqual(1);
            expect(within(dialog).getByText('REF-YAM-042')).toBeInTheDocument();
            expect(within(dialog).getByText('12 en stock')).toBeInTheDocument();
            expect(within(dialog).getByText('Rayon B2')).toBeInTheDocument();
        });

        // Close modal
        const closeBtn = screen.getByRole('button', { name: /fermer/i });
        fireEvent.click(closeBtn);
    });

    it('renders directly with FicheCatalogueModal for boat and motor types', async () => {
        const sampleBateaux = [
            {
                id: 101,
                designation: 'Cap Camarat 7.5 WA',
                type: 'Hors-bord',
                longueurExterieure: 7.37,
                prixVenteTTC: 65000,
            },
        ];

        mockGet.mockResolvedValue({ data: sampleBateaux[0] });

        render(
            <FicheCatalogueModal
                open={true}
                onClose={jest.fn()}
                type="bateau"
                itemId={101}
                catalogueBateaux={sampleBateaux}
            />
        );

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toBeInTheDocument();
            expect(within(dialog).getByText(/Fiche bateau :/i)).toBeInTheDocument();
            expect(within(dialog).getAllByText('Cap Camarat 7.5 WA').length).toBeGreaterThanOrEqual(1);
            expect(within(dialog).getByText('7.37 m')).toBeInTheDocument();
        });
    });
});
