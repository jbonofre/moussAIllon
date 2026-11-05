import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Stock from './stock.tsx';
import { fetchWithAuth } from './api.ts';
import { NavigationContext } from './navigation-context.tsx';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));

jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;
const navigate = jest.fn();

const article = (champs: Record<string, unknown>) => ({
    type: 'produit', ref: null, categorie: 'Entretien', emplacement: 'Allée B', emplacementMagasin: null, stock: 0, seuil: 0,
    reserve: 0, disponible: 0, enCommande: 0, coutUnitaireHT: 0, valeur: 0, prixVenteHT: 0, occasion: false, suivi: true,
    statut: 'OK', ...champs,
});

const articles = [
    article({ cle: 'produit-1', id: 1, designation: 'Huile 4T', ref: 'H4T', stock: 10, seuil: 3, reserve: 6, disponible: 4,
        enCommande: 5, coutUnitaireHT: 4, valeur: 40 }),
    article({ cle: 'produit-2', id: 2, designation: 'Filtre à huile', categorie: 'Filtres', emplacement: 'Allée C', stock: 2,
        seuil: 5, disponible: 2, coutUnitaireHT: 3, valeur: 6, statut: 'SOUS_SEUIL' }),
    article({ cle: 'bateau-7', type: 'bateau', id: 7, designation: 'Open 505', categorie: 'Open', emplacement: 'Parc', stock: 1,
        seuil: 1, reserve: 1, disponible: 0, coutUnitaireHT: 15000, valeur: 15000, statut: 'RUPTURE' }),
    article({ cle: 'produit-3', id: 3, designation: 'Bougie non suivie', suivi: false, statut: 'RUPTURE' }),
];

const reappro = [{
    cle: 'produit-2', type: 'produit', id: 2, designation: 'Filtre à huile', ref: 'FH', categorie: 'Filtres', stock: 2, seuil: 5,
    reserve: 0, disponible: 2, enCommande: 0, quantiteSuggeree: 8, fournisseurId: 50,
    fournisseurs: [{ fournisseurId: 50, fournisseurNom: 'Marine Parts', prixAchatHT: 3, tva: 20, nombreMinACommander: 1 }],
}];

const inventaireResume = {
    id: 5, reference: 'INV-2026-0001', libelle: 'Inventaire de printemps', statut: 'VALIDE', dateCreation: '2026-04-01T08:00:00',
    dateValidation: '2026-04-02T08:00:00', nombreLignes: 12, nombreComptees: 12, nombreEcarts: 2, valeurEcarts: -18.5,
};

const inventaireLance = {
    id: 6, reference: 'INV-2026-0002', libelle: 'Inventaire du 05/11/2026', statut: 'EN_COURS', categorie: 'Entretien',
    dateCreation: '2026-11-05T08:00:00',
    lignes: [
        { id: 11, typeArticle: 'produit', articleId: 1, designation: 'Huile 4T', ref: 'H4T', emplacement: 'Allée B', stockTheorique: 10,
            stockCompte: null, coutUnitaireHT: 4 },
        { id: 12, typeArticle: 'produit', articleId: 2, designation: 'Filtre à huile', emplacement: 'Allée C', stockTheorique: 2,
            stockCompte: null, coutUnitaireHT: 3 },
    ],
};

const reponse = (data: any) => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve(''),
});

const appels = (url: string, method: string) =>
    mockedFetch.mock.calls.filter(([u, options]) => u === url && options?.method === method);

const corps = (url: string, method: string) => JSON.parse(appels(url, method)[0][1].body);

const ligne = (texte: string) => screen.getByText(texte).closest('tr') as HTMLElement;

// getByRole calcule le rôle et le nom accessible de chaque élément de la page (lent sous jsdom avec les tableaux du stock)
const bouton = (conteneur: HTMLElement, nom: string | RegExp) => within(conteneur).getByText(nom).closest('button') as HTMLElement;

const afficher = (pageState: any = null) => render(
    <NavigationContext.Provider value={{ navigate, pageState }}>
        <Stock />
    </NavigationContext.Provider>,
);

beforeEach(() => {
    mockedFetch.mockReset();
    navigate.mockReset();
    mockedFetch.mockImplementation((url: string, options?: RequestInit) => {
        const method = options?.method ?? 'GET';
        if (url === './stock' && method === 'GET') return reponse(articles);
        if (url === './stock/reapprovisionnement' && method === 'GET') return reponse(reappro);
        if (url === './stock/reapprovisionnement' && method === 'POST') {
            return reponse([{ id: 42, reference: 'CF-2026-0042', fournisseurNom: 'Marine Parts', nombreLignes: 1, montantHT: 24 }]);
        }
        if (url === './catalogue/fournisseurs') return reponse([{ id: 50, nom: 'Marine Parts' }, { id: 51, nom: 'Nautic Distribution' }]);
        if (url === './stock/inventaires' && method === 'GET') return reponse([inventaireResume]);
        if (url === './stock/inventaires' && method === 'POST') return reponse(inventaireLance);
        if (url === './stock/inventaires/6/comptage') {
            return reponse({ ...inventaireLance, lignes: [{ ...inventaireLance.lignes[0], stockCompte: 7.5 }, inventaireLance.lignes[1]] });
        }
        if (url === './stock/inventaires/6/valider') {
            return reponse({ ...inventaireLance, statut: 'VALIDE', dateValidation: '2026-11-05T10:00:00',
                lignes: [{ ...inventaireLance.lignes[0], stockCompte: 7.5 }, inventaireLance.lignes[1]] });
        }
        if (url === './stock/produit/1/mouvements') {
            return reponse([{ id: 1, type: 'AJUSTEMENT_MANUEL', quantite: -2, stockApres: 10, motif: 'CASSE', commentaire: 'Bidon percé',
                utilisateur: 'marie', date: '2026-11-04T10:00:00' }]);
        }
        return reponse({});
    });
});

describe('Stock - état du stock', () => {
    it('affiche les articles suivis, leur réservé, disponible et valeur', async () => {
        afficher();

        expect(await screen.findByText('Huile 4T')).toBeInTheDocument();
        expect(mockedFetch).toHaveBeenCalledWith('./stock', expect.anything());
        const huile = ligne('Huile 4T');
        expect(within(huile).getByText('Réf. H4T')).toBeInTheDocument();
        expect(within(huile).getByText('6')).toBeInTheDocument();
        expect(within(huile).getByText('40,00 €')).toBeInTheDocument();
        expect(within(huile).getByText('OK')).toBeInTheDocument();
        expect(within(ligne('Open 505')).getByText('Rupture')).toBeInTheDocument();
        expect(within(ligne('Filtre à huile')).getByText('Sous le seuil')).toBeInTheDocument();
        // Valeur totale du stock suivi
        expect(screen.getAllByText('15 046,00 €').length).toBeGreaterThan(0);
        // Un article non géré en stock n'apparaît qu'avec tout le catalogue
        expect(screen.queryByText('Bougie non suivie')).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Tout le catalogue'));
        expect(await screen.findByText('Bougie non suivie')).toBeInTheDocument();
    });

    it('filtre les articles à surveiller et par recherche', async () => {
        afficher();
        await screen.findByText('Huile 4T');

        fireEvent.click(screen.getByText('À surveiller'));
        await waitFor(() => expect(screen.queryByText('Huile 4T')).not.toBeInTheDocument());
        expect(screen.getByText('Filtre à huile')).toBeInTheDocument();
        expect(screen.getByText('Open 505')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Désignation, référence, catégorie, emplacement'), { target: { value: 'parc' } });
        await waitFor(() => expect(screen.queryByText('Filtre à huile')).not.toBeInTheDocument());
        expect(screen.getByText('Open 505')).toBeInTheDocument();
    });

    it("arrive sur les alertes depuis le tableau de bord", async () => {
        afficher({ alertes: true });

        expect(await screen.findByText('Filtre à huile')).toBeInTheDocument();
        expect(screen.queryByText('Huile 4T')).not.toBeInTheDocument();
    });

    it("ajuste le stock d'un article avec son motif", async () => {
        afficher();
        await screen.findByText('Huile 4T');

        fireEvent.click(within(ligne('Huile 4T')).getByRole('button', { name: /Ajuster/ }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Stock actuel : 10')).toBeInTheDocument();
        fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '8' } });
        fireEvent.mouseDown(within(dialog).getByRole('combobox'));
        fireEvent.click(await screen.findByText('Casse', { selector: '.ant-select-item-option-content' }));
        fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Bidon percé' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Ajuster' }));

        await waitFor(() => expect(appels('./stock/ajustement', 'POST')).toHaveLength(1));
        expect(corps('./stock/ajustement', 'POST')).toEqual({
            type: 'produit', id: 1, nouveauStock: 8, variation: null, motif: 'CASSE', commentaire: 'Bidon percé',
        });
    });

    it("affiche l'historique des mouvements d'un article", async () => {
        afficher();
        await screen.findByText('Huile 4T');

        fireEvent.click(within(ligne('Huile 4T')).getByTitle('Historique'));

        const dialog = await screen.findByRole('dialog');
        expect(await within(dialog).findByText('Ajustement manuel')).toBeInTheDocument();
        expect(within(dialog).getByText('Casse')).toBeInTheDocument();
        expect(within(dialog).getByText('Bidon percé')).toBeInTheDocument();
        expect(within(dialog).getByText('marie')).toBeInTheDocument();
    });
});

describe('Stock - réapprovisionnement', () => {
    it('crée les commandes fournisseur des articles sélectionnés', async () => {
        afficher();
        await screen.findByText('Huile 4T');

        fireEvent.click(screen.getByText('Réapprovisionnement'));
        expect(await screen.findByText('Marine Parts (3,00 €)')).toBeInTheDocument();
        expect(screen.getByText('24,00 €')).toBeInTheDocument();

        fireEvent.click(bouton(document.body, /Créer les commandes \(1\)/));
        fireEvent.click((await screen.findByText('Créer')).closest('button') as HTMLElement);

        await waitFor(() => expect(appels('./stock/reapprovisionnement', 'POST')).toHaveLength(1));
        expect(corps('./stock/reapprovisionnement', 'POST')).toEqual({
            lignes: [{ type: 'produit', id: 2, fournisseurId: 50, quantite: 8 }],
        });
        fireEvent.click(await screen.findByText('CF-2026-0042'));
        expect(navigate).toHaveBeenCalledWith('/commandes-fournisseur', { commandeId: 42 });
    });
});

describe('Stock - inventaires', () => {
    it("lance un inventaire, enregistre le comptage et le valide", async () => {
        afficher();
        await screen.findByText('Huile 4T');

        fireEvent.click(screen.getByText('Inventaires'));
        expect(await screen.findByText('INV-2026-0001')).toBeInTheDocument();
        expect(within(ligne('INV-2026-0001')).getByText('12 / 12')).toBeInTheDocument();
        expect(within(ligne('INV-2026-0001')).getByText('-18,50 €')).toBeInTheDocument();

        fireEvent.click(bouton(document.body, /Lancer un inventaire/));
        const dialog = await screen.findByRole('dialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Lancer' }));
        await waitFor(() => expect(appels('./stock/inventaires', 'POST')).toHaveLength(1));
        expect(corps('./stock/inventaires', 'POST')).toEqual({ toutLeCatalogue: false });

        const detail = (await screen.findByText('INV-2026-0002 · Inventaire du 05/11/2026')).closest('.ant-card') as HTMLElement;
        const huile = () => within(detail).getByText('Huile 4T').closest('tr') as HTMLElement;
        fireEvent.change(within(detail).getByLabelText('Compté Huile 4T'), { target: { value: '7.5' } });
        await waitFor(() => expect(within(huile()).getByText('-2,5')).toBeInTheDocument());
        expect(within(huile()).getByText('-10,00 €')).toBeInTheDocument();

        fireEvent.click(bouton(detail, /Enregistrer le comptage/));
        await waitFor(() => expect(appels('./stock/inventaires/6/comptage', 'PUT')).toHaveLength(1));
        expect(corps('./stock/inventaires/6/comptage', 'PUT')).toEqual([{ ligneId: 11, stockCompte: 7.5 }]);

        // Le comptage enregistré, plus rien n'est à enregistrer
        await waitFor(() => expect(bouton(detail, /Enregistrer le comptage/)).toBeDisabled());
        await waitFor(() => expect(bouton(detail, /Valider l'inventaire/)).not.toHaveClass('ant-btn-loading'));
        fireEvent.click(bouton(detail, /Valider l'inventaire/));
        fireEvent.click((await screen.findByText('Valider')).closest('button') as HTMLElement);
        await waitFor(() => expect(appels('./stock/inventaires/6/valider', 'POST')).toHaveLength(1));
        expect(await screen.findByText('Validé')).toBeInTheDocument();
        // Le stock est rechargé après la validation
        expect(mockedFetch.mock.calls.filter(([u]) => u === './stock').length).toBeGreaterThan(1);
    });
});
