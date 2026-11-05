import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Facturation from './facturation.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));

// jsPDF (factures) ne se charge pas sous jsdom
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));

const mockedFetch = fetchWithAuth as jest.Mock;

const reponse = (data: any, ok = true) =>
    Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(data), text: () => Promise.resolve('') });

const dans = (jours: number) => new Date(Date.now() + jours * 86400000).toISOString().slice(0, 19);

// Mois payés non terminés : le mois en cours et le suivant (paiement d'avance), avec Vente et Parc
const moisPaye = (debut: number, fin: number) => ({
    id: debut + 100, debut: dans(debut), fin: dans(fin), montant: 106.5, statut: 'PAYE', typePaiement: 'MENSUEL',
    payeLe: dans(-10), nombreUtilisateurs: 3, nombreTechniciens: 2, nombreClients: 15, modules: ['VENTE', 'PARC', 'PARAMETRAGE'],
});

// 3 utilisateurs × 10 € + 2 techniciens × 10 € + 15 clients du portail × 0,10 € + Vente 35 € + Parc 20 € = 106,50 € par mois
const societe = {
    id: 1, nom: 'MS Plaisance', modules: ['VENTE', 'PARC', 'PARAMETRAGE'], abonnementNombreUtilisateurs: 3,
    abonnementNombreTechniciens: 2, abonnementNombreClients: 15, abonnementActivationMontant: 350,
    abonnementActif: true, abonnementAJour: true, abonnementProchainPaiementDate: dans(50),
    abonnementMois: [ moisPaye(20, 50), moisPaye(-10, 20) ],
    abonnementProchainPaiementMontant: 106.5, abonnementMontantAnnuel: 1171.5, abonnementResilie: false, paiements: [],
};
const nonActive = {
    ...societe, abonnementActif: false, abonnementAJour: false, abonnementActivationDate: null,
    abonnementProchainPaiementDate: null, abonnementMois: [],
};
const tarifs = {
    prixUtilisateur: 10, prixTechnicien: 10, prixClient: 0.1, moisFacturesAnnuel: 11,
    prixModules: { VENTE: 35, PARC: 20, CATALOGUE: 25, ATELIER: 20, MARKETING: 20, COMPTABILITE: 20, PARAMETRAGE: 0 },
};

const appel = (url: string, method: string) =>
    mockedFetch.mock.calls.find(([u, options]) => u === url && options?.method === method);

beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === './societe') return reponse(societe);
        if (url === './societe/tarifs') return reponse(tarifs);
        if (url === './societe/modules') {
            const modules = JSON.parse(options!.body as string);
            return reponse({ ...societe, modules: [ ...modules, 'PARAMETRAGE' ], abonnementProchainPaiementMontant: 131.5, abonnementMontantAnnuel: 1446.5 });
        }
        return reponse(null, false);
    });
});

describe('Facturation - prix selon les utilisateurs et les modules', () => {
    it('propose de payer le montant calculé par le serveur', async () => {
        render(<Facturation />);

        expect(await screen.findByRole('button', { name: /Payer ce mois — 106,50/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /Payer l'année — 1\s171,50/ })).toBeEnabled();
        // Détail du prix : techniciens et clients ayant accès au portail comptent aussi
        expect(screen.getByText(/Techniciens \(2 × 10,00/)).toBeInTheDocument();
        expect(screen.getByText(/Clients \(accès au portail\) \(15 × 0,10/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Paramétrage — inclus/)).toBeDisabled();
    });

    it('recalcule le prix en cochant un module puis enregistre les modules avant l\'activation', async () => {
        mockedFetch.mockImplementation((url: string, options?: RequestInit) => {
            if (url === './societe/tarifs') return reponse(tarifs);
            if (url === './societe/modules') {
                const modules = JSON.parse(options!.body as string);
                return reponse({ ...nonActive, modules: [ ...modules, 'PARAMETRAGE' ], abonnementProchainPaiementMontant: 131.5, abonnementMontantAnnuel: 1446.5 });
            }
            return reponse(nonActive);
        });
        render(<Facturation />);

        // Le premier paiement comprend les frais d'activation : 106,50 € + 350 €
        expect(await screen.findByRole('button', { name: /Activer au mois — 456,50/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /Activer à l'année — 1\s521,50/ })).toBeEnabled();
        expect(screen.getByText(/Non activé/)).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText(/Catalogue/));

        expect(screen.getByText(/131,50/, { selector: 'strong' })).toBeInTheDocument();
        // Le paiement attend l'enregistrement des modules
        expect(screen.getByRole('button', { name: /Activer au mois/ })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modules' }));

        await waitFor(() => expect(appel('./societe/modules', 'PUT')).toBeDefined());
        expect(JSON.parse(appel('./societe/modules', 'PUT')[1].body)).toEqual(expect.arrayContaining(['VENTE', 'PARC', 'CATALOGUE']));
        expect(await screen.findByRole('button', { name: /Activer au mois — 481,50/ })).toBeEnabled();
    });

    it("fait payer tout de suite un module ajouté, pour chaque mois déjà payé", async () => {
        mockedFetch.mockImplementation((url: string) => {
            if (url === './societe/tarifs') return reponse({ ...tarifs, paiementEnLigne: { STRIPE: true, PAYPLUG: false } });
            if (url === './societe/paiement/en-ligne') return reponse({ url: 'https://checkout.stripe.com/modules' });
            return reponse(societe);
        });
        const fenetre: any = { location: { href: '' } };
        const ouvrir = jest.spyOn(window, 'open').mockReturnValue(fenetre);
        try {
            render(<Facturation />);

            fireEvent.click(await screen.findByLabelText(/Catalogue/));

            // Catalogue : 25 € pour le mois en cours et 25 € pour le mois suivant déjà payé
            expect(screen.queryByRole('button', { name: 'Enregistrer les modules' })).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /Payer et activer les modules — 50,00/ }));
            expect(screen.getByText(/Ajout de modules — 50,00/)).toBeInTheDocument();

            fireEvent.mouseDown(screen.getByRole('combobox'));
            fireEvent.click(await screen.findByText('Stripe', { selector: '.ant-select-item-option-content' }));
            fireEvent.click(screen.getByRole('button', { name: /Payer via Stripe — 50,00/ }));

            await waitFor(() => expect(fenetre.location.href).toBe('https://checkout.stripe.com/modules'));
            expect(JSON.parse(appel('./societe/paiement/en-ligne', 'POST')[1].body))
                .toEqual({ type: 'MODULES', mode: 'STRIPE', modules: ['VENTE', 'PARC', 'PARAMETRAGE', 'CATALOGUE'] });
            expect(appel('./societe/modules', 'PUT')).toBeUndefined();
        } finally {
            ouvrir.mockRestore();
        }
    });

    it("refuse l'ajout de modules tant qu'une échéance est en retard, et suit les mois", async () => {
        const enRetard = {
            ...societe, abonnementAJour: false, abonnementProchainPaiementDate: dans(-5),
            abonnementMois: [ { debut: dans(-5), fin: dans(25), montant: 106.5, statut: 'A_PAYER', modules: ['VENTE', 'PARC', 'PARAMETRAGE'] }, moisPaye(-35, -5) ],
        };
        mockedFetch.mockImplementation((url: string) => reponse(url === './societe/tarifs' ? tarifs : enRetard));
        render(<Facturation />);

        expect(await screen.findByText('À payer')).toBeInTheDocument();
        expect(screen.getByText(/Payé le/)).toBeInTheDocument();
        expect(screen.getByText('En cours')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText(/Catalogue/));
        expect(screen.getByText("Réglez d'abord les échéances en retard pour ajouter des modules.")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enregistrer les modules' })).toBeDisabled();
    });

    it("affiche l'échéance impayée et l'abonnement gratuit, et en informe l'espace de travail", async () => {
        const impaye = {
            ...societe, abonnementBlocageImpayeDate: '2026-10-01T00:00:00', accesBloqueImpaye: true, versionFree: false,
        };
        mockedFetch.mockImplementation((url: string) => reponse(url === './societe/tarifs' ? tarifs : impaye));
        const onSocieteChange = jest.fn();
        const { unmount } = render(<Facturation onSocieteChange={onSocieteChange} />);

        expect(await screen.findByText(/Échéance impayée : accès limité à la facturation depuis le 01\/10\/2026/)).toBeInTheDocument();
        expect(onSocieteChange).toHaveBeenCalledWith(expect.objectContaining({ accesBloqueImpaye: true }));
        unmount();

        mockedFetch.mockImplementation((url: string) => reponse(url === './societe/tarifs' ? tarifs : { ...societe, versionFree: true }));
        render(<Facturation />);
        expect(await screen.findByText('Abonnement gratuit : les accès ne sont jamais bloqués')).toBeInTheDocument();
        expect(screen.queryByText(/Échéance/)).not.toBeInTheDocument();
    });

    it("affiche clairement l'abonnement gratuit, même sans abonnement activé", async () => {
        mockedFetch.mockImplementation((url: string) => reponse(url === './societe/tarifs' ? tarifs : { ...nonActive, versionFree: true }));
        render(<Facturation />);

        // Dans le titre et en bandeau
        expect(await screen.findByText('Abonnement gratuit')).toBeInTheDocument();
        expect(screen.getByText('Abonnement gratuit : les accès ne sont jamais bloqués')).toBeInTheDocument();
        expect(screen.getByText(/les modules s'ajoutent sans paiement/)).toBeInTheDocument();
        // L'abonnement non activé ne limite pas l'accès
        expect(screen.getByText('Non activé')).toBeInTheDocument();
        expect(screen.queryByText(/accès limité à la facturation/)).not.toBeInTheDocument();
    });

    it("n'affiche pas l'abonnement gratuit quand il n'est pas accordé", async () => {
        render(<Facturation />);

        expect(await screen.findByText('Actif')).toBeInTheDocument();
        expect(screen.queryByText(/Abonnement gratuit/)).not.toBeInTheDocument();
    });

    it("ouvre le paiement en ligne au montant de l'échéance", async () => {
        mockedFetch.mockImplementation((url: string) => {
            if (url === './societe/tarifs') return reponse({ ...tarifs, paiementEnLigne: { STRIPE: true, PAYPLUG: false } });
            if (url === './societe/paiement/en-ligne') return reponse({ url: 'https://checkout.stripe.com/session' });
            return reponse(societe);
        });
        const fenetre: any = { location: { href: '' } };
        const ouvrir = jest.spyOn(window, 'open').mockReturnValue(fenetre);
        try {
            render(<Facturation />);
            fireEvent.click(await screen.findByRole('button', { name: /Payer ce mois/ }));

            fireEvent.mouseDown(screen.getByRole('combobox'));
            fireEvent.click(await screen.findByText('Stripe', { selector: '.ant-select-item-option-content' }));
            fireEvent.click(screen.getByRole('button', { name: /Payer via Stripe — 106,50/ }));

            await waitFor(() => expect(fenetre.location.href).toBe('https://checkout.stripe.com/session'));
            expect(JSON.parse(appel('./societe/paiement/en-ligne', 'POST')[1].body)).toEqual({ type: 'MENSUEL', mode: 'STRIPE' });
        } finally {
            ouvrir.mockRestore();
        }
    });

    it("demande confirmation avant de retirer un module aux utilisateurs", async () => {
        render(<Facturation />);

        fireEvent.click(await screen.findByLabelText(/Parc/));
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modules' }));

        expect(await screen.findByText(/perdront l'accès aux modules retirés : Parc/)).toBeInTheDocument();
        expect(appel('./societe/modules', 'PUT')).toBeUndefined();
    });
});
