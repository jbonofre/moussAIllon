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
        {
            id: 9,
            designation: 'Pack entretien',
            ref: 'PKG-000009',
            lignes: [
                { id: 4, forfait, quantite: 1 },
                { id: 5, produit, quantite: 2 },
            ],
        },
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

describe('Transactions - saisie des lignes', () => {
    it('calcule le montant dès la saisie d\'un produit, pour une quantité de 1', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaLigneVide(modal, 'AN-1 - Anode zinc');

        expect(await within(modal).findByText('Anode zinc')).toBeInTheDocument();
        expect(within(modal).getByText(PLACEHOLDER_LIGNE)).toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('12.00');
    });

    it('recalcule le montant TTC quand le taux de TVA change, le HT restant inchangé', async () => {
        const modal = await ouvrirNouvelleVente();
        await choisirDansLaLigneVide(modal, 'AN-1 - Anode zinc');
        await waitFor(() => expect(within(modal).getByLabelText('Montant HT (EUR)')).toHaveValue('10.00'));

        fireEvent.change(within(modal).getByLabelText('TVA (%)'), { target: { value: '10' } });

        await waitFor(() => expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('11.00'));
        expect(within(modal).getByLabelText('Montant TVA')).toHaveValue('1.00');
        expect(within(modal).getByLabelText('Montant HT (EUR)')).toHaveValue('10.00');
    });

    it('recalcule le taux de TVA et le montant TTC quand le montant de TVA change, le HT restant inchangé', async () => {
        const modal = await ouvrirNouvelleVente();
        await choisirDansLaLigneVide(modal, 'AN-1 - Anode zinc');
        await waitFor(() => expect(within(modal).getByLabelText('Montant TVA')).toHaveValue('2.00'));

        fireEvent.change(within(modal).getByLabelText('Montant TVA'), { target: { value: '3' } });

        await waitFor(() => expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('13.00'));
        expect(within(modal).getByLabelText('TVA (%)')).toHaveValue('30.00');
        expect(within(modal).getByLabelText('Montant HT (EUR)')).toHaveValue('10.00');
    });
});

describe('Transactions - référence', () => {
    it("affiche le numéro de transaction une fois la transaction enregistrée", async () => {
        const modal = await ouvrirNouvelleVente();
        const reference = within(modal).getByLabelText('Référence');
        expect(reference).toHaveValue('');
        expect(reference).toHaveAttribute('placeholder', "Attribuée à l'enregistrement");

        await choisir(modal, 'Rechercher un client par prénom ou nom', 'Jean Dupont');
        await choisirDansLaLigneVide(modal, 'AN-1 - Anode zinc');
        await within(modal).findByText('Anode zinc');
        fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }));

        await waitFor(() => expect(within(modal).getByLabelText('Référence')).toHaveValue(`FACT-${new Date().getFullYear()}-00042`));
    });

    it('reprend le numéro de facture attribué', async () => {
        const vente = { id: 12, numeroFacture: 'FACT-2025-00012', date: '2025-06-01T10:00:00', status: 'FACTURE_PRETE', client: { id: 3, nom: 'Jean Dupont' } };
        mockedApi.get.mockImplementation((url: string) => Promise.resolve({
            data: url === '/ventes' ? [vente] : url === '/ventes/12' ? vente : (donnees[url] || []),
        }) as any);
        render(<Vente />);

        fireEvent.click(await screen.findByText('FACT-2025-00012'));
        await screen.findByText('Transaction/Prestation');
        const modal = document.querySelector('.ant-modal') as HTMLElement;

        await waitFor(() => expect(within(modal).getByLabelText('Référence')).toHaveValue('FACT-2025-00012'));
    });
});

describe('Transactions - liste', () => {
    it('classe les transactions du plus récent au plus ancien', async () => {
        const client = { id: 3, nom: 'Jean Dupont' };
        const ventes = [
            { id: 1, numeroFacture: 'FA-ANCIENNE', date: '2026-09-15T00:00:00', status: 'FACTURE_PAYEE', client },
            { id: 2, numeroFacture: 'FA-MEME-JOUR-AVANT', date: '2026-10-30T00:00:00', status: 'DEVIS', client },
            { id: 4, numeroFacture: 'FA-MILIEU', date: '2026-10-01T00:00:00', status: 'DEVIS', client },
            { id: 3, numeroFacture: 'FA-MEME-JOUR-APRES', date: '2026-10-30T00:00:00', status: 'DEVIS', client },
        ];
        mockedApi.get.mockImplementation((url: string) => Promise.resolve({
            data: url === '/ventes' ? ventes : (donnees[url] || []),
        }) as any);
        render(<Vente />);

        await screen.findByText('FA-ANCIENNE');
        const references = Array.from(document.querySelectorAll('.ant-table-tbody tr.ant-table-row'))
            .map((ligne) => ligne.querySelector('td')?.textContent);
        expect(references).toEqual(['FA-MEME-JOUR-APRES', 'FA-MEME-JOUR-AVANT', 'FA-MILIEU', 'FA-ANCIENNE']);
    });
});

describe('Transactions - onglet Produits & Paiements', () => {
    it('regroupe la note, les montants et les conditions de paiement avec les lignes', async () => {
        const conditions = { conditionsPaiement: '30 jours nets', penalitesRetard: '3 fois le taux légal', indemniteForfaitaire: 45 };
        mockedApi.get.mockImplementation((url: string) => Promise.resolve({
            data: url === '/societe' ? conditions : (donnees[url] || []),
        }) as any);
        const modal = await ouvrirNouvelleVente();

        const onglet = within(modal).getByRole('button', { name: /Ajouter une ligne libre/ }).closest('[role="tabpanel"]') as HTMLElement;
        expect(onglet).not.toBeNull();
        expect(within(onglet).getByLabelText('Note')).toBeInTheDocument();
        expect(within(onglet).getByLabelText('Montant TTC')).toBeInTheDocument();
        expect(within(onglet).getByLabelText("Date d'échéance")).toBeInTheDocument();
        // Conditions du paramétrage global, affichées sans être saisissables sur la transaction
        expect(await within(onglet).findByText('30 jours nets')).toBeInTheDocument();
        expect(within(onglet).getByText('3 fois le taux légal')).toBeInTheDocument();
        expect(within(onglet).getByText('45.00 EUR')).toBeInTheDocument();
        expect(within(onglet).queryByLabelText('Conditions de paiement')).toBeNull();
    });
});

describe('Transactions - création de service', () => {
    it("choisit une main d'œuvre par sa référence et calcule le prix et la durée du service", async () => {
        const mainOeuvre = { id: 1, reference: 'MO-1', nom: 'Mécanique', prixTTC: 60 };
        mockedApi.get.mockImplementation((url: string) => Promise.resolve({
            data: url === '/main-oeuvres' ? [mainOeuvre] : (donnees[url] || []),
        }) as any);
        const transaction = await ouvrirNouvelleVente();
        fireEvent.click(within(transaction).getByRole('button', { name: /Ajouter Service/ }));
        await screen.findByText('Créer un service');
        const modal = Array.from(document.querySelectorAll('.ant-modal')).find((m) => m.textContent?.includes('Créer un service')) as HTMLElement;

        const reference = within(modal.querySelector('.ligne-article') as HTMLElement).getAllByRole('combobox')[0];
        fireEvent.mouseDown(reference);
        fireEvent.change(reference, { target: { value: 'mo-1' } });
        const option = await waitFor(() => {
            const found = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
                .filter((element) => element.textContent === 'MO-1 - Mécanique');
            expect(found).toHaveLength(1);
            return found[0] as HTMLElement;
        });
        fireEvent.click(option);

        // la saisie se poursuit sur une ligne vide
        await waitFor(() => expect(modal.querySelectorAll('.ligne-article')).toHaveLength(2));
        expect(within(modal.querySelector('.ligne-article') as HTMLElement).getByText('Mécanique')).toBeInTheDocument();
        expect(within(modal).getByLabelText('Prix TTC')).toHaveValue('60.00');
        expect(within(modal).getByLabelText('Durée estimée')).toHaveValue('1.00');
    });
});

describe('Transactions - création de forfait', () => {
    it('présente les produits inclus comme les lignes de la transaction et calcule le prix du forfait', async () => {
        const transaction = await ouvrirNouvelleVente();
        fireEvent.click(within(transaction).getByRole('button', { name: /Créer Forfait/ }));
        await screen.findByText('Créer un forfait');
        const modal = Array.from(document.querySelectorAll('.ant-modal')).find((m) => m.textContent?.includes('Créer un forfait')) as HTMLElement;

        // la première liste est celle des produits inclus
        const designation = within(modal.querySelector('.ligne-article') as HTMLElement).getAllByRole('combobox')[1];
        fireEvent.mouseDown(designation);
        const option = await waitFor(() => {
            const found = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
                .find((element) => element.textContent === 'AN-1 - Anode zinc');
            expect(found).toBeTruthy();
            return found as HTMLElement;
        });
        fireEvent.click(option);

        const premiere = await waitFor(() => {
            const lignes = modal.querySelectorAll('.ligne-article');
            // une ligne vide est ajoutée après le produit, la main d'œuvre garde sa ligne de saisie
            expect(lignes).toHaveLength(3);
            return lignes[0] as HTMLElement;
        });
        expect(within(premiere).getByText('AN-1')).toBeInTheDocument();
        expect(within(premiere).getByText('Anode zinc')).toBeInTheDocument();
        expect(within(modal).getByLabelText('Prix TTC')).toHaveValue('12.00');
    });
});

describe('Transactions - lignes forfait', () => {
    it("n'affiche pas les techniciens mais conserve ceux affectés au planning", async () => {
        const technicien = { id: 5, prenom: 'Paul', nom: 'Martin' };
        const vente = {
            id: 20, date: '2026-10-20T10:00:00', status: 'DEVIS', bonPourAccord: true,
            client: { id: 3, nom: 'Jean Dupont' },
            venteForfaits: [{ id: 1, forfait, quantite: 1, status: 'PLANIFIEE', techniciens: [technicien] }],
        };
        mockedApi.get.mockImplementation((url: string) => Promise.resolve({
            data: url === '/ventes' ? [vente] : url === '/ventes/20' ? vente : url === '/techniciens' ? [technicien] : (donnees[url] || []),
        }) as any);
        mockedApi.put.mockImplementation((_url: string, body: any) => Promise.resolve({ data: body }) as any);
        render(<Vente />);

        fireEvent.click(await screen.findByText('FACT-2026-00020'));
        await screen.findByText('Transaction/Prestation');
        const modal = document.querySelector('.ant-modal') as HTMLElement;
        expect(await within(modal).findByText('Hivernage')).toBeInTheDocument();

        expect(within(modal).getByText('Planifiee')).toBeInTheDocument();
        expect(within(modal).queryByText('Techniciens')).not.toBeInTheDocument();
        // Planifier est regroupé avec les actions secondaires de la ligne
        fireEvent.click(within(modal).getByTitle('Autres actions'));
        expect(await screen.findByText('Planifier')).toBeInTheDocument();

        fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/ventes/20', expect.objectContaining({
            venteForfaits: [expect.objectContaining({ techniciens: [technicien] })],
        })));
    });
});

describe('Transactions - recherche par référence', () => {
    it('retrouve un article en saisissant sa référence dans le champ Référence', async () => {
        const modal = await ouvrirNouvelleVente();

        const select = within(modal).getAllByText('Réf.')[0].closest('.ant-select') as HTMLElement;
        const champ = within(select).getByRole('combobox');
        fireEvent.mouseDown(champ);
        fireEvent.change(champ, { target: { value: 'an-1' } });
        const option = await waitFor(() => {
            const found = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
                .filter((element) => element.textContent === 'AN-1 - Anode zinc');
            expect(found).toHaveLength(1);
            return found[0] as HTMLElement;
        });
        fireEvent.click(option);

        expect(await within(modal).findByText('Anode zinc')).toBeInTheDocument();
        expect(within(modal).getByText('AN-1')).toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('12.00');
    });
});

describe('Transactions - ligne libre', () => {
    const saisir = (champ: HTMLElement, valeur: string) => fireEvent.change(champ, { target: { value: valeur } });

    it('crée au catalogue l\'article saisi sur une ligne libre, à l\'enregistrement de la transaction', async () => {
        const articleCree = { id: 77, ref: 'MAN-6', designation: 'Manille inox', categorie: 'Non classé', stock: 0, prixVenteTTC: 4.5, tva: 20 };
        mockedApi.post.mockImplementation((_url: string, body: any) => Promise.resolve({
            data: { ...body, id: 42, venteProduits: [{ id: 1, produit: articleCree, quantite: 2, remise: 0 }] },
        }) as any);
        const modal = await ouvrirNouvelleVente();

        await choisir(modal, 'Rechercher un client par prénom ou nom', 'Jean Dupont');
        fireEvent.click(within(modal).getByRole('button', { name: /Ajouter une ligne libre/ }));
        const ligne = (await within(modal).findByPlaceholderText('Réf.')).closest('.ligne-vente') as HTMLElement;
        saisir(within(ligne).getByPlaceholderText('Réf.'), 'MAN-6');
        saisir(within(ligne).getByPlaceholderText('Désignation'), 'Manille inox');
        saisir(within(ligne).getByPlaceholderText('P.U.'), '4.5');
        saisir(within(ligne).getByPlaceholderText('Qte'), '2');

        await waitFor(() => expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('9.00'));
        // la ligne de saisie d'un article du catalogue reste disponible
        expect(within(modal).getAllByText(PLACEHOLDER_LIGNE)).toHaveLength(1);

        fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/ventes', expect.objectContaining({
            venteProduits: [expect.objectContaining({ produit: { ref: 'MAN-6', designation: 'Manille inox', prixVenteTTC: 4.5, tva: 20 }, quantite: 2 })],
            montantTTC: 9,
        })));

        // la ligne désigne désormais l'article créé au catalogue
        expect(await screen.findByText('Ajouté au catalogue : Manille inox')).toBeInTheDocument();
        expect(await within(modal).findByText('Manille inox')).toBeInTheDocument();
        expect(within(modal).queryByPlaceholderText('Réf.')).not.toBeInTheDocument();
    });

    it('affiche le refus du serveur', async () => {
        mockedApi.post.mockRejectedValue({ response: { status: 400, data: { message: 'La référence « MAN-6 » est déjà utilisée au catalogue' } } });
        const modal = await ouvrirNouvelleVente();

        await choisir(modal, 'Rechercher un client par prénom ou nom', 'Jean Dupont');
        fireEvent.click(within(modal).getByRole('button', { name: /Ajouter une ligne libre/ }));
        const ligne = (await within(modal).findByPlaceholderText('Réf.')).closest('.ligne-vente') as HTMLElement;
        saisir(within(ligne).getByPlaceholderText('Réf.'), 'MAN-6');
        saisir(within(ligne).getByPlaceholderText('Désignation'), 'Manille inox');
        saisir(within(ligne).getByPlaceholderText('P.U.'), '4.5');
        fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }));

        expect(await screen.findByText('La référence « MAN-6 » est déjà utilisée au catalogue')).toBeInTheDocument();
        // la ligne libre reste à corriger
        expect(within(modal).getByPlaceholderText('Réf.')).toHaveValue('MAN-6');
    });
});

describe('Transactions - packages', () => {
    it('peuple la transaction avec le contenu du package choisi', async () => {
        const modal = await ouvrirNouvelleVente();
        expect(mockedApi.get).toHaveBeenCalledWith('/catalogue/packages');

        await choisir(modal, 'Rechercher un client par prénom ou nom', 'Jean Dupont');
        await choisirDansLaLigneVide(modal, 'FORFAIT-001 - Hivernage');
        await within(modal).findByText('Hivernage');
        await choisirDansLaLigneVide(modal, 'PKG-000007 - Pack prêt à naviguer');

        expect(await within(modal).findByText('Cap Camarat 6.5')).toBeInTheDocument();
        expect(within(modal).getByText('F115 XB')).toBeInTheDocument();
        expect(within(modal).getByText('Anode zinc')).toBeInTheDocument();
        // le forfait déjà saisi est conservé, et la saisie se poursuit sur une ligne vide
        expect(within(modal).getByText('Hivernage')).toBeInTheDocument();
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

    it('ajoute les forfaits du package, à planifier', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisir(modal, 'Rechercher un client par prénom ou nom', 'Jean Dupont');
        await choisirDansLaLigneVide(modal, 'PKG-000009 - Pack entretien');

        expect(await within(modal).findByText('Hivernage')).toBeInTheDocument();
        expect(within(modal).getByText('Anode zinc')).toBeInTheDocument();
        expect(within(modal).queryByText('PKG-000009 - Pack entretien')).not.toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('324.00');

        fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/ventes', expect.objectContaining({
            venteForfaits: [expect.objectContaining({ forfait: expect.objectContaining({ nom: 'Hivernage' }), quantite: 1, status: 'EN_ATTENTE' })],
            venteProduits: [expect.objectContaining({ produit: expect.objectContaining({ designation: 'Anode zinc' }), quantite: 2 })],
            montantTTC: 324,
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

describe('Transactions - produits ajoutés automatiquement aux interventions', () => {
    const traitementDechets = { id: 2, designation: 'Traitement des déchets', ref: 'DECHETS', stock: 0, prixVenteTTC: 15, ajoutAutomatiqueIntervention: true };
    const LIGNE_DECHETS = 'Traitement des déchets';

    beforeEach(() => {
        const avecDechets: Record<string, any[]> = { ...donnees, '/catalogue/produits': [produit, traitementDechets] };
        mockedApi.get.mockImplementation((url: string) => Promise.resolve({ data: avecDechets[url] || [] }) as any);
    });

    it("ajoute le produit automatique dès qu'une intervention est saisie", async () => {
        const modal = await ouvrirNouvelleVente();

        await choisir(modal, 'Rechercher un client par prénom ou nom', 'Jean Dupont');
        await choisirDansLaLigneVide(modal, 'FORFAIT-001 - Hivernage');

        expect(await within(modal).findByText(LIGNE_DECHETS)).toBeInTheDocument();
        // la saisie se poursuit sur une ligne vide, après la ligne ajoutée
        expect(within(modal).getAllByText(PLACEHOLDER_LIGNE)).toHaveLength(1);
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('315.00');

        fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/ventes', expect.objectContaining({
            venteForfaits: [expect.objectContaining({ forfait: expect.objectContaining({ nom: 'Hivernage' }) })],
            venteProduits: [expect.objectContaining({ produit: expect.objectContaining({ designation: 'Traitement des déchets' }), quantite: 1 })],
            montantTTC: 315,
        })));
    });

    it("n'ajoute pas le produit automatique sans intervention", async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaLigneVide(modal, 'AN-1 - Anode zinc');

        await within(modal).findByText('Anode zinc');
        expect(within(modal).queryByText(LIGNE_DECHETS)).not.toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('12.00');
    });

    it('ne remet pas le produit automatique retiré à la main', async () => {
        const modal = await ouvrirNouvelleVente();

        await choisirDansLaLigneVide(modal, 'FORFAIT-001 - Hivernage');
        const ligneDechets = (await within(modal).findByText(LIGNE_DECHETS)).closest('.ligne-vente') as HTMLElement;
        fireEvent.click(ligneDechets.querySelector('.anticon-delete')!.closest('button')!);

        await waitFor(() => expect(within(modal).queryByText(LIGNE_DECHETS)).not.toBeInTheDocument());
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('300.00');

        await choisirDansLaLigneVide(modal, 'AN-1 - Anode zinc');
        await within(modal).findByText('Anode zinc');
        expect(within(modal).queryByText(LIGNE_DECHETS)).not.toBeInTheDocument();
        expect(within(modal).getByLabelText('Montant TTC')).toHaveValue('312.00');
    });
});
