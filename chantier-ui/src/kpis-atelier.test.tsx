import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import dayjs from 'dayjs';
import KpisAtelier, { depassement, formatHeures } from './kpis-atelier.tsx';
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

const indicateurs = (valeurs: Record<string, number | null> = {}) => ({
    heuresDisponibles: 0, heuresPrevues: 0, heuresRealisees: 0, heuresFacturees: 0, heuresSav: 0,
    caMainOeuvreHT: 0, caPiecesHT: 0, interventions: 0, interventionsSav: 0,
    tauxProductivite: null, tauxEfficience: null, tauxValorisation: null, tauxSav: null,
    ...valeurs,
});

const kpis = {
    debut: '2025-12',
    fin: '2026-11',
    n: indicateurs({
        heuresDisponibles: 3507, heuresPrevues: 8, heuresRealisees: 6.5, heuresFacturees: 3, heuresSav: 2,
        caMainOeuvreHT: 170, caPiecesHT: 180, interventions: 5, interventionsSav: 1,
        tauxProductivite: 0.2, tauxEfficience: 46.2, tauxValorisation: 0.1, tauxSav: 30.8,
    }),
    n1: indicateurs({ heuresDisponibles: 3570, heuresRealisees: 2, heuresFacturees: 2, tauxValorisation: 0.1, tauxEfficience: 100 }),
    mois: [{ mois: '2026-03', n: indicateurs({ heuresRealisees: 3.5, heuresFacturees: 3 }), n1: indicateurs() }],
    techniciens: [
        {
            technicienId: 1, nom: 'Alice ATELIER', heuresHebdomadaires: 35, heuresContrat: 1820, heuresFeries: 49,
            heuresAbsence: 35, joursAbsence: 5, tauxValorisationN1: 0.1,
            n: indicateurs({ heuresDisponibles: 1736, heuresPrevues: 2, heuresRealisees: 2, heuresFacturees: 2,
                caMainOeuvreHT: 110, caPiecesHT: 97.14, interventions: 2, tauxEfficience: 100, tauxValorisation: 0.1 }),
        },
        {
            technicienId: 2, nom: 'Bruno ATELIER', heuresHebdomadaires: null, heuresContrat: 0, heuresFeries: 0,
            heuresAbsence: 0, joursAbsence: 0, tauxValorisationN1: null,
            n: indicateurs({ heuresPrevues: 3, heuresRealisees: 3.5, heuresFacturees: 1, heuresSav: 2,
                caMainOeuvreHT: 60, caPiecesHT: 82.86, interventions: 2, interventionsSav: 1, tauxEfficience: 28.6 }),
        },
        {
            technicienId: null, nom: 'Non affecté', heuresHebdomadaires: null, heuresContrat: 0, heuresFeries: 0,
            heuresAbsence: 0, joursAbsence: 0, tauxValorisationN1: null,
            n: indicateurs({ heuresPrevues: 3, heuresRealisees: 1, interventions: 2 }),
        },
    ],
    prestations: [
        { cle: 'F7', type: 'Forfait', nom: 'Révision moteur', n: indicateurs({ heuresPrevues: 6, heuresRealisees: 5, heuresFacturees: 2,
            heuresSav: 2, caMainOeuvreHT: 120, caPiecesHT: 80, interventions: 3, interventionsSav: 1, tauxEfficience: 40 }) },
        { cle: 'S3', type: 'Service', nom: 'Diagnostic', n: indicateurs({ heuresPrevues: 2, heuresRealisees: 1.5, heuresFacturees: 1,
            caMainOeuvreHT: 50, interventions: 2, tauxEfficience: 66.7 }) },
    ],
    techniciensSansHoraire: ['Bruno ATELIER'],
    prestationsSansDureeReelle: 1,
};

const reponse = (data: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });

// Texte d'un élément, espaces (dont insécables des montants) ignorés
const texte = (attendu: string) => (_: string, element: Element | null) =>
    !!element && element.children.length === 0 && (element.textContent || '').replace(/\s/g, '') === attendu.replace(/\s/g, '');

beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(() => reponse(kpis));
});

describe('KPIs atelier', () => {
    it('charge les KPIs des 12 mois se terminant au mois en cours', async () => {
        render(<KpisAtelier />);

        expect(await screen.findByText(/12 mois glissants de 12\/2025 à 11\/2026/)).toBeInTheDocument();
        expect(mockedFetch).toHaveBeenCalledWith(`./kpis-atelier?fin=${dayjs().format('YYYY-MM')}`);
        expect(screen.getAllByText(texte('3 507 h')).length).toBeGreaterThan(0);
        expect(screen.getByText(texte('dont 2 h SAV (30,8 %)'))).toBeInTheDocument();
        expect(screen.getAllByText(texte('46,2 %')).length).toBeGreaterThan(0);
        expect(screen.getAllByText(texte('170 €')).length).toBeGreaterThan(0);
    });

    it('signale les techniciens sans durée hebdomadaire et les prestations sans durée réelle', async () => {
        render(<KpisAtelier />);

        expect(await screen.findByText('1 technicien sans durée hebdomadaire')).toBeInTheDocument();
        expect(screen.getByText(/Bruno ATELIER : leurs heures disponibles ne sont pas comptées/)).toBeInTheDocument();
        expect(screen.getByText('1 prestation terminée sans durée réelle')).toBeInTheDocument();
    });

    it('détaille la productivité par technicien et par prestation', async () => {
        render(<KpisAtelier />);

        const alice = (await screen.findByText('Alice ATELIER')).closest('tr') as HTMLElement;
        expect(within(alice).getByText(texte('1 736 h'))).toBeInTheDocument();
        expect(within(alice).getByText(texte('97,14 €'))).toBeInTheDocument();
        expect(within(alice).getByText(texte('100 %'))).toBeInTheDocument();

        const bruno = screen.getByText('Bruno ATELIER').closest('tr') as HTMLElement;
        expect(within(bruno).getByText('Non renseigné')).toBeInTheDocument();
        // 3,5 h réalisées pour 3 h prévues
        expect(within(bruno).getByText(texte('+16,7 %'))).toBeInTheDocument();
        expect(screen.getByText('Non affecté')).toBeInTheDocument();

        const revision = screen.getByText('Révision moteur').closest('tr') as HTMLElement;
        expect(within(revision).getByText('Forfait')).toBeInTheDocument();
        expect(within(revision).getByText(texte('-16,7 %'))).toBeInTheDocument();
        expect(within(revision).getByText(texte('80,00 €'))).toBeInTheDocument();
        expect(screen.getByText('Diagnostic').closest('tr')).toHaveTextContent('Service');
    });
});

describe('depassement', () => {
    it('rapporte les heures réalisées aux heures prévues', () => {
        expect(depassement(3, 3.5)).toBe(16.7);
        expect(depassement(6, 5)).toBe(-16.7);
        expect(depassement(0, 2)).toBeNull();
    });
});

describe('formatHeures', () => {
    it('affiche les heures à une décimale', () => {
        expect(formatHeures(1.25).replace(/\s/g, ' ')).toBe('1,3 h');
        expect(formatHeures(null)).toBe('0 h');
    });
});
