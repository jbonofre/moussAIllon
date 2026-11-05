import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import dayjs from 'dayjs';
import KpisFinanciers, { lignesActivites } from './kpis-financiers.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));
// Les graphiques ne s'affichent pas sous jsdom
jest.mock('@ant-design/charts', () => ({ Column: () => null, Line: () => null }));

jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;

const activite = (code: string, libelle: string, groupe: string, caHT: number, coutHT: number, caHTN1 = 0) => ({
    code, libelle, groupe, caHT, caHTN1, coutHT, margeBruteHT: caHT - coutHT, margeBruteHTN1: 0,
    tauxMarge: caHT ? Math.round(((caHT - coutHT) / caHT) * 1000) / 10 : null,
});

const kpis = {
    debut: '2025-12',
    fin: '2026-11',
    caHT: 10920,
    caHTN1: 100,
    margeBruteHT: 3650,
    margeBruteHTN1: 40,
    tauxMargeBrute: 33.4,
    encaissementsTTC: 11056,
    encaissementsTTCN1: 120,
    heuresSansCoutHoraire: 4.5,
    mois: [{ mois: '2026-03', caHT: 10900, caHTN1: 100, margeBruteHT: 3620, margeBruteHTN1: 40,
        encaissementsTTC: 11080, encaissementsTTCN1: 120, caHTParActivite: { PIECES: 200, BATEAUX_OCCASION: 10000 } }],
    activites: [
        activite('PRESTATIONS', 'Prestations atelier', 'Prestations', 200, 90),
        activite('HIVERNAGE_GARDIENNAGE', 'Hivernage / gardiennage', 'Hivernage / gardiennage', 500, 0),
        activite('PIECES', 'Pièces et accessoires', 'Transactions', 290, 180, 100),
        activite('BATEAUX_OCCASION', "Bateaux d'occasion", 'Transactions', 10000, 7000),
        activite('AVOIRS', 'Avoirs', 'Autres', -70, 0),
    ],
    creances: {
        totalTTC: 1108, nombreFactures: 2, nonEchuTTC: 1000, echuTTC: 108, nombreFacturesEchues: 1,
        retard1a30TTC: 0, retard31a60TTC: 0, retard61a90TTC: 0, retardPlus90TTC: 108,
        facturesEnRetard: [{ venteId: 7, numeroFacture: 'FA26-000007', client: 'Jean Dupont', dateFacture: '2026-05-02',
            dateEcheance: '2026-06-01', montantTTC: 108, soldeTTC: 108, joursRetard: 157, niveauRelance: 2 }],
    },
    stock: {
        valeurHT: 210, valeurDormanteHT: 140, valeurNonDateeHT: 0, articlesSansCout: 3, nombreArticlesDormants: 1,
        categories: [{ categorie: 'Pièces Moteur', quantite: 6, valeurHT: 210, valeur0a90: 70, valeur91a180: 0,
            valeur181a365: 0, valeurPlus365: 140, valeurNonDatee: 0 }],
        articlesDormants: [{ type: 'Produit', id: 3, designation: 'Bougie NGK', categorie: 'Pièces Moteur', stock: 6,
            coutUnitaireHT: 35, valeurHT: 210, valeurDormanteHT: 140, dateEntree: '2025-01-15', joursEnStock: 659 }],
    },
};

const reponse = (data: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });

// Texte d'un élément, espaces (dont insécables des montants) ignorés
const texte = (attendu: string) => (_: string, element: Element | null) =>
    !!element && element.children.length === 0 && (element.textContent || '').replace(/\s/g, '') === attendu.replace(/\s/g, '');

beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(() => reponse(kpis));
});

describe('KPIs financiers', () => {
    it('charge les KPIs des 12 mois se terminant au mois en cours', async () => {
        render(<KpisFinanciers />);

        expect(await screen.findByText(/12 mois glissants de 12\/2025 à 11\/2026/)).toBeInTheDocument();
        expect(mockedFetch).toHaveBeenCalledWith(`./kpis-financiers?fin=${dayjs().format('YYYY-MM')}`);
        expect(screen.getAllByText(texte('10 920 €')).length).toBeGreaterThan(0);
        expect(screen.getAllByText(texte('11 056 €')).length).toBeGreaterThan(0);
        expect(screen.getByText('Taux : 33,4 %')).toBeInTheDocument();
    });

    it("signale les heures sans coût horaire et les articles sans coût d'achat", async () => {
        render(<KpisFinanciers />);

        expect(await screen.findByText("4,5 h de main d'œuvre sans coût horaire")).toBeInTheDocument();
        expect(screen.getByText("3 articles en stock sans coût d'achat")).toBeInTheDocument();
    });

    it('détaille les activités, les factures en retard et le stock dormant', async () => {
        render(<KpisFinanciers />);

        const transactions = (await screen.findByText('Transactions')).closest('tr') as HTMLElement;
        // Groupe des transactions : somme de ses activités
        expect(within(transactions).getAllByText(texte('10 290,00 €')).length).toBeGreaterThan(0);
        expect(screen.getByText('Pièces et accessoires')).toBeInTheDocument();
        expect(screen.getByText('Prestations atelier')).toBeInTheDocument();

        const facture = screen.getByText('FA26-000007').closest('tr') as HTMLElement;
        expect(within(facture).getByText('Jean Dupont')).toBeInTheDocument();
        expect(within(facture).getByText('157 j')).toBeInTheDocument();
        expect(within(facture).getByText('2/3')).toBeInTheDocument();

        const dormant = screen.getByText('Bougie NGK').closest('tr') as HTMLElement;
        expect(within(dormant).getByText('15/01/2025 (659 j)')).toBeInTheDocument();
    });
});

describe('lignesActivites', () => {
    it('regroupe les transactions et garde les prestations et l\'hivernage en lignes simples', () => {
        const lignes = lignesActivites(kpis.activites);

        expect(lignes.map((l) => l.libelle)).toEqual(['Transactions', 'Prestations atelier', 'Hivernage / gardiennage', 'Avoirs']);
        const transactions = lignes[0];
        expect(transactions.children?.map((l) => l.code)).toEqual(['PIECES', 'BATEAUX_OCCASION']);
        expect(transactions.caHT).toBe(10290);
        expect(transactions.coutHT).toBe(7180);
        expect(transactions.margeBruteHT).toBe(3110);
        expect(transactions.tauxMarge).toBe(30.2);
        expect(lignes[1].children).toBeUndefined();
    });
});
