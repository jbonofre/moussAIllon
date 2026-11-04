import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Workspace from './workspace.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));
// Les pages sont remplacées : seuls le menu et l'accès aux pages sont testés ici
jest.mock('./dashboard.tsx', () => () => <div>Page Accueil</div>);
jest.mock('./facturation.tsx', () => () => <div>Page Facturation</div>);
jest.mock('./clients.tsx', () => () => null);
jest.mock('./catalogue-produits.tsx', () => () => null);
jest.mock('./fournisseurs.tsx', () => () => null);
jest.mock('./societe.tsx', () => () => null);
jest.mock('./reglements.tsx', () => () => null);
jest.mock('./connecteurs.tsx', () => () => null);
jest.mock('./rapprochement-bancaire.tsx', () => () => null);
jest.mock('./utilisateurs.tsx', () => () => null);
jest.mock('./forfaits.tsx', () => () => null);
jest.mock('./packages.tsx', () => () => null);
jest.mock('./clients-bateaux.tsx', () => () => null);
jest.mock('./clients-moteurs.tsx', () => () => null);
jest.mock('./clients-remorques.tsx', () => () => null);
jest.mock('./techniciens.tsx', () => () => null);
jest.mock('./main-oeuvres.tsx', () => () => null);
jest.mock('./vente.tsx', () => () => null);
jest.mock('./avoirs.tsx', () => () => null);
jest.mock('./planning.tsx', () => () => null);
jest.mock('./comptoir.tsx', () => () => null);
jest.mock('./annonces.tsx', () => () => null);
jest.mock('./campagnes.tsx', () => () => null);
jest.mock('./commandes-fournisseur.tsx', () => () => null);
jest.mock('./emails.tsx', () => () => null);
jest.mock('./sequence-emails.tsx', () => () => null);
jest.mock('./reference-valeurs.tsx', () => () => null);
jest.mock('./global-search.tsx', () => () => null);
jest.mock('./home.tsx', () => () => null);

const mockedFetch = fetchWithAuth as jest.Mock;

const reponse = (data: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });

const serveur = (modules: string[], accesLimiteFacturation: boolean, abonnementActif = true) => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
        if (url === '/societe') return reponse({ id: 1, accesLimiteFacturation, abonnementActif });
        return reponse({ name: 'marie', modules, theme: 'LIGHT' });
    });
};

describe('Workspace - modules et abonnement', () => {
    it("n'affiche que les groupes du menu des modules de l'utilisateur", async () => {
        serveur(['VENTE'], false);
        render(<Workspace user="marie" modules={['VENTE']} setUser={() => {}} />);

        expect(await screen.findByText('Page Accueil')).toBeInTheDocument();
        expect(screen.getByText('Vente')).toBeInTheDocument();
        expect(screen.queryByText('Catalogue')).not.toBeInTheDocument();
        expect(screen.queryByText('Paramétrage')).not.toBeInTheDocument();
    });

    it("limite l'accès à la facturation quand l'abonnement est impayé", async () => {
        serveur(['VENTE', 'PARAMETRAGE'], true);
        render(<Workspace user="marie" modules={['VENTE', 'PARAMETRAGE']} accesLimiteFacturation setUser={() => {}} />);

        expect(await screen.findByText('Page Facturation')).toBeInTheDocument();
        expect(screen.getByText('Accès limité à la facturation')).toBeInTheDocument();
        expect(screen.getByText(/impayée depuis 2 mois/)).toBeInTheDocument();
        expect(screen.queryByText('Vente')).not.toBeInTheDocument();
        expect(screen.queryByText('Page Accueil')).not.toBeInTheDocument();
    });

    it("limite l'accès à la facturation tant que l'abonnement n'est pas activé", async () => {
        serveur(['VENTE', 'PARAMETRAGE'], true, false);
        render(<Workspace user="marie" modules={['VENTE', 'PARAMETRAGE']} setUser={() => {}} />);

        expect(await screen.findByText(/L'abonnement n'est pas activé/)).toBeInTheDocument();
        expect(screen.getByText('Page Facturation')).toBeInTheDocument();
        expect(screen.queryByText('Page Accueil')).not.toBeInTheDocument();
    });

    it("bloque l'utilisateur sans le module Paramétrage quand l'abonnement est impayé", async () => {
        serveur(['VENTE'], true);
        render(<Workspace user="marie" modules={['VENTE']} setUser={() => {}} />);

        expect(await screen.findByText('Accès bloqué')).toBeInTheDocument();
        expect(screen.queryByText('Page Facturation')).not.toBeInTheDocument();
    });
});
