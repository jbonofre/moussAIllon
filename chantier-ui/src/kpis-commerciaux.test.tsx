import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import dayjs from 'dayjs';
import KpisCommerciaux from './kpis-commerciaux.tsx';
import { ecartPoints } from './kpis-commun.tsx';
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

const devis = (venteId: number, client: string, autres: object = {}) => ({
    venteId, numero: `DE26-0000${venteId}`, ordreDeReparation: false, client, canal: 'FACEBOOK', dateDevis: '2026-08-01',
    joursAttente: 96, montantHT: 1000, montantTTC: 1200, niveauRelance: 0, emailClient: true, relanceAutomatique: true,
    aRelancer: true, ...autres,
});

const kpis = {
    debut: '2025-12',
    fin: '2026-11',
    leads: 24, leadsN1: 20, acceptes: 12, acceptesN1: 8, refuses: 6, refusesN1: 4, enAttente: 6,
    montantLeadsHT: 48000, montantLeadsHTN1: 40000, montantAccepteHT: 30000, montantAccepteHTN1: 20000,
    tauxConversion: 50, tauxConversionN1: 40, delaiMoyenAcceptationJours: 8.5,
    mois: [{ mois: '2026-03', leads: 4, leadsN1: 3, acceptes: 2, acceptesN1: 1, refuses: 1, enAttente: 1,
        montantLeadsHT: 8000, montantAccepteHT: 5000, tauxConversion: 50, tauxConversionN1: 33.3,
        leadsParCanal: { FACEBOOK: 3, NON_RENSEIGNE: 1 }, echanges: 5, echangesN1: 2, echangesParType: { APPEL: 3, VISITE: 2 } }],
    canaux: [
        { code: 'FACEBOOK', leads: 15, leadsN1: 10, acceptes: 9, refuses: 3, enAttente: 3, montantLeadsHT: 30000, montantAccepteHT: 22000, tauxConversion: 60 },
        { code: 'NON_RENSEIGNE', leads: 9, leadsN1: 10, acceptes: 3, refuses: 3, enAttente: 3, montantLeadsHT: 18000, montantAccepteHT: 8000, tauxConversion: 33.3 },
    ],
    motifsRefus: [{ motif: 'Prix', nombre: 4, montantHT: 9000 }],
    pipeline: {
        nombreDevis: 2, montantHT: 1500, montantTTC: 1800, montant0a15HT: 500, montant16a30HT: 0, montant31a60HT: 0,
        montantPlus60HT: 1000, nombreARelancer: 1, montantARelancerHT: 1000, seuilRelanceJours: 15, relanceAutomatique: false,
        devis: [
            devis(41, 'Jean Dupont', { clientId: 7, niveauRelance: 2, derniereRelance: '2026-10-20', prochaineAction: '2020-01-15' }),
            devis(42, 'Sophie Martin', { ordreDeReparation: true, canal: 'NON_RENSEIGNE', joursAttente: 3, montantHT: 500,
                emailClient: false, relanceAutomatique: false, aRelancer: false, dernierEchange: '2026-11-02' }),
        ],
    },
    suivi: {
        echanges: 30, echangesN1: 18, actionsFaites: 8, actionsFaitesALEcheance: 6, tauxRespectEcheances: 75,
        actionsAFaire: 5, actionsEnRetard: 2, prospects: 12, prospectsSansAction: 4,
        prospectsConvertis: 6, prospectsConvertisN1: 3, delaiMoyenConversionJours: 21.5,
        utilisateurs: [
            { utilisateur: 'marie', echanges: 25, actionsFaites: 8, actionsFaitesALEcheance: 6, tauxRespectEcheances: 75, actionsAFaire: 3, actionsEnRetard: 2 },
            { utilisateur: null, echanges: 5, actionsFaites: 0, actionsFaitesALEcheance: 0, tauxRespectEcheances: null, actionsAFaire: 2, actionsEnRetard: 0 },
        ],
    },
};

const mockNavigate = jest.fn();
jest.mock('./navigation-context.tsx', () => ({
    useNavigation: () => ({ navigate: mockNavigate, pageState: null }),
}));

const reponse = (data: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve('') });

beforeEach(() => {
    mockNavigate.mockReset();
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(() => reponse(kpis));
});

describe('KPIs commerciaux', () => {
    it('charge les KPIs des 12 mois se terminant au mois en cours', async () => {
        render(<KpisCommerciaux />);

        expect(await screen.findByText(/Leads \(devis\/OR\) et suivi commercial de 12\/2025 à 11\/2026/)).toBeInTheDocument();
        expect(mockedFetch).toHaveBeenCalledWith(`./kpis-commerciaux?fin=${dayjs().format('YYYY-MM')}`);
        expect(screen.getByText('50 %')).toBeInTheDocument();
        expect(screen.getByText('+10 pts')).toBeInTheDocument();
        expect(screen.getByText('12 acceptés, 6 refusés, 6 en attente')).toBeInTheDocument();
        expect(screen.getByText(/signés en 8,5 j en moyenne/)).toBeInTheDocument();
        expect(screen.getByText('2 devis/OR en attente, dont 1 à relancer')).toBeInTheDocument();
    });

    it('détaille les leads par origine et les motifs de refus', async () => {
        render(<KpisCommerciaux />);

        const facebook = (await screen.findAllByText('Facebook'))[0].closest('tr') as HTMLElement;
        expect(within(facebook).getByText('60 %')).toBeInTheDocument();
        expect(screen.getAllByText('Non renseigné').length).toBeGreaterThan(0);
        const prix = screen.getByText('Prix').closest('tr') as HTMLElement;
        expect(within(prix).getByText('4')).toBeInTheDocument();
    });

    it('liste le pipeline et signale la relance automatique désactivée', async () => {
        render(<KpisCommerciaux />);

        expect(await screen.findByText('Relance automatique des devis désactivée')).toBeInTheDocument();
        const premier = screen.getByText('DE26-000041').closest('tr') as HTMLElement;
        expect(within(premier).getByText('À relancer')).toBeInTheDocument();
        expect(within(premier).getByText('96 j')).toBeInTheDocument();
        expect(within(premier).getByText('2/3')).toBeInTheDocument();

        const second = screen.getByText('DE26-000042').closest('tr') as HTMLElement;
        expect(within(second).getByText('OR')).toBeInTheDocument();
        expect(within(second).getByText('Client sans email')).toBeInTheDocument();
        expect(within(second).getByRole('button', { name: /Relancer/ })).toBeDisabled();
    });

    it("affiche le suivi commercial du client de chaque devis et ouvre sa fiche", async () => {
        render(<KpisCommerciaux />);

        const premier = (await screen.findByText('DE26-000041')).closest('tr') as HTMLElement;
        expect(within(premier).getByText('Action le 15/01/2020')).toBeInTheDocument();
        expect(within(premier).getByText('En retard')).toBeInTheDocument();
        const second = screen.getByText('DE26-000042').closest('tr') as HTMLElement;
        expect(within(second).getByText('Dernier échange le 02/11/2026')).toBeInTheDocument();

        fireEvent.click(within(premier).getByText('Jean Dupont'));
        expect(mockNavigate).toHaveBeenCalledWith('/clients', { ouvrirClientId: 7 });
        // Sans identifiant de client, pas de lien
        expect(within(second).getByText('Sophie Martin').tagName).not.toBe('A');
    });

    it('résume les échanges, les actions et les prospects, par utilisateur', async () => {
        render(<KpisCommerciaux />);

        expect(await screen.findByText('Suivi commercial', { selector: '.ant-card-head-title' })).toBeInTheDocument();
        expect(screen.getByText('N-1 : 18')).toBeInTheDocument();
        expect(screen.getByText('dont 2 en retard')).toBeInTheDocument();
        expect(screen.getByText('6 sur 8 actions faites')).toBeInTheDocument();
        expect(screen.getByText('dont 4 sans action à faire')).toBeInTheDocument();
        expect(screen.getByText(/6 devenus clients \(N-1 : 3\), en 21,5 j en moyenne/)).toBeInTheDocument();

        const marie = screen.getByText('marie').closest('tr') as HTMLElement;
        expect(within(marie).getByText('25')).toBeInTheDocument();
        expect(within(marie).getByText('75 %')).toBeInTheDocument();
        expect(screen.getByText('Non attribué')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Actions commerciales/ }));
        expect(mockNavigate).toHaveBeenCalledWith('/actions-commerciales');
    });

    it('relance un devis puis recharge les KPIs', async () => {
        render(<KpisCommerciaux />);

        const premier = (await screen.findByText('DE26-000041')).closest('tr') as HTMLElement;
        fireEvent.click(within(premier).getByRole('button', { name: /Relancer/ }));

        await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith('./ventes/41/rappel', { method: 'POST' }));
        await waitFor(() => expect(mockedFetch.mock.calls.filter(([url]) => String(url).startsWith('./kpis-commerciaux')).length).toBe(2));
    });
});

describe('ecartPoints', () => {
    it("calcule l'écart en points entre deux taux", () => {
        expect(ecartPoints(50, 40)).toBe(10);
        expect(ecartPoints(33.3, 40)).toBe(-6.7);
        expect(ecartPoints(null, 40)).toBeNull();
        expect(ecartPoints(50, undefined)).toBeNull();
    });
});
