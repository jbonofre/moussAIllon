import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();

// Mock api
jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {
        get: (...args: any[]) => mockGet(...args),
        post: (...args: any[]) => mockPost(...args),
        put: (...args: any[]) => mockPut(...args),
    },
}));

// Mock subcomponents used in modals to isolate tests
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
        mockPut.mockReset();
        mockGet.mockImplementation((url: string) =>
            Promise.resolve({ data: url.startsWith('/reference-valeurs') ? [{ valeur: 'Entretien' }] : sampleProduits[0] })
        );
        mockNavigate.mockReset();
    });

    it('opens the editable fiche produit without navigating when clicking "Voir dans le catalogue"', async () => {
        const onProduitSaved = jest.fn();
        const saved = { ...sampleProduits[0], emplacement: 'Rayon C4' };
        mockPut.mockResolvedValue({ data: saved });

        render(
            <FicheCataloguePopover
                type="produit"
                itemId={42}
                produits={sampleProduits}
                navigate={mockNavigate}
                onProduitSaved={onProduitSaved}
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

        // The modal should open the real, editable fiche produit (same form as the catalogue)
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Modifier un produit')).toBeInTheDocument();
        expect(within(dialog).getByLabelText('Désignation')).toHaveValue('Filtre à huile Yamaha');
        expect(within(dialog).getByLabelText('Référence interne')).toHaveValue('REF-YAM-042');
        expect(within(dialog).getByTestId('fournisseur-produits')).toBeInTheDocument();
        expect(within(dialog).getByTestId('produit-historique')).toBeInTheDocument();

        // The product is reloaded before editing
        await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/catalogue/produits/42'));
        const emplacement = within(dialog).getByLabelText('Emplacement atelier');
        await waitFor(() => expect(emplacement).toHaveValue('Rayon B2'));
        expect(emplacement).toBeEnabled();

        // Edit and save
        const saveBtn = within(dialog).getByRole('button', { name: /enregistrer/i });
        await waitFor(() => expect(saveBtn).toBeEnabled());
        fireEvent.change(emplacement, { target: { value: 'Rayon C4' } });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(mockPut).toHaveBeenCalledWith(
                '/catalogue/produits/42',
                expect.objectContaining({ id: 42, designation: 'Filtre à huile Yamaha', emplacement: 'Rayon C4' })
            );
            expect(onProduitSaved).toHaveBeenCalledWith(saved);
        });
    }, 30000); // the full product form is slow to render in jsdom

    it('keeps the read-only fiche for non-produit types opened from the popover', async () => {
        const sampleMoteurs = [{ id: 7, designation: 'Yamaha F115', puissanceCv: 115, prixVenteTTC: 12500 }];
        mockGet.mockResolvedValue({ data: sampleMoteurs[0] });

        render(<FicheCataloguePopover type="moteur" itemId={7} catalogueMoteurs={sampleMoteurs} />);

        fireEvent.click(screen.getByTitle('Fiche produit'));
        fireEvent.click(await screen.findByRole('button', { name: /voir dans le catalogue/i }));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText(/Fiche moteur :/i)).toBeInTheDocument();
        expect(within(dialog).getByText('115 CV')).toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: /enregistrer/i })).not.toBeInTheDocument();
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
