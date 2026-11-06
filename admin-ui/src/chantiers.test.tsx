import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from './api.ts';
import Chantiers from './chantiers.tsx';

jest.mock('./api.ts', () => {
    const actual = jest.requireActual('./api.ts');
    return {
        __esModule: true,
        ...actual,
        default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
    };
});

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock; put: jest.Mock; delete: jest.Mock };

const societe = (modifs: object = {}) => ({
    nom: 'MS Plaisance',
    modules: ['VENTE', 'PARAMETRAGE'],
    versionFree: false,
    abonnementActif: true,
    abonnementAJour: true,
    abonnementResilie: false,
    abonnementActivationDate: '2026-01-10T10:00:00',
    abonnementActivationMontant: 350,
    abonnementProchainPaiementDate: '2026-12-10T10:00:00',
    abonnementProchainPaiementMontant: 75,
    abonnementMontantAnnuel: 825,
    abonnementNombreUtilisateurs: 3,
    abonnementNombreTechniciens: 2,
    abonnementNombreClients: 10,
    accesLimiteFacturation: false,
    accesBloque: false,
    accesBloqueImpaye: false,
    paiements: [{ id: 1, type: 'MENSUEL', mode: 'VIREMENT', montant: 425, date: '2026-01-10T10:00:00' }],
    ...modifs,
});

const vue = (code: string, nom: string, chantier: object = {}, soc: object = {}) => ({
    chantier: { code, nom, email: `contact@${code}.fr`, dateCreation: '2026-01-01T00:00:00', accesSuspendu: false, gratuit: false, ...chantier },
    societe: societe({ nom, ...soc }),
});

const chantiers = [
    vue('ms-plaisance', 'MS Plaisance'),
    vue('port-gratuit', 'Port Gratuit', { gratuit: true }, { abonnementActif: false }),
    vue('port-suspendu', 'Port Suspendu', { accesSuspendu: true, accesSuspenduDate: '2026-10-01T00:00:00' }, { abonnementActif: false }),
    vue('port-essai', 'Port Essai', { essaiFin: '2026-12-06T10:00:00' }, { abonnementActif: false, enEssai: true }),
];

const gerer = async (nom: string) => {
    const ligne = (await screen.findByText(nom)).closest('tr') as HTMLElement;
    fireEvent.click(within(ligne).getByRole('button', { name: /Gérer/ }));
};

describe('Chantiers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedApi.get.mockResolvedValue({ data: chantiers });
    });

    it('liste les chantiers avec leur abonnement et leur accès', async () => {
        render(<Chantiers />);
        expect(await screen.findByText('MS Plaisance')).toBeInTheDocument();
        expect(mockedApi.get).toHaveBeenCalledWith('/admin/chantiers');
        expect(screen.getByText('À jour')).toBeInTheDocument();
        expect(screen.getByText('Gratuit')).toBeInTheDocument();
        expect(screen.getByText('Non activé')).toBeInTheDocument();
        expect(screen.getByText('Suspendu')).toBeInTheDocument();
        expect(screen.getByText("Essai jusqu'au 06/12/2026")).toBeInTheDocument();
        expect(screen.getAllByText('3 / 2 / 10')).toHaveLength(4);
    });

    it('filtre les chantiers', async () => {
        render(<Chantiers />);
        await screen.findByText('MS Plaisance');
        fireEvent.change(screen.getByPlaceholderText('Rechercher'), { target: { value: 'gratuit' } });
        expect(screen.queryByText('MS Plaisance')).not.toBeInTheDocument();
        expect(screen.getByText('Port Gratuit')).toBeInTheDocument();
    });

    it('crée un chantier avec son premier utilisateur et ses modules', async () => {
        mockedApi.post.mockResolvedValue({ data: vue('port-neuf', 'Port Neuf') });
        render(<Chantiers />);
        await screen.findByText('MS Plaisance');

        fireEvent.click(screen.getByRole('button', { name: /Nouveau chantier/ }));
        const dialogue = within(await screen.findByRole('dialog'));
        fireEvent.change(dialogue.getByLabelText('Code chantier'), { target: { value: 'Port-Neuf' } });
        fireEvent.change(dialogue.getByLabelText('Nom'), { target: { value: 'Port Neuf' } });
        fireEvent.change(dialogue.getByLabelText('Email du chantier'), { target: { value: 'contact@port-neuf.fr' } });
        fireEvent.change(dialogue.getByLabelText('Mot de passe'), { target: { value: 'secret' } });
        fireEvent.click(dialogue.getByLabelText('Marketing'));
        fireEvent.click(dialogue.getByRole('button', { name: /Créer/ }));

        await waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
        const [url, corps] = mockedApi.post.mock.calls[0];
        expect(url).toBe('/admin/chantiers');
        expect(corps).toMatchObject({
            code: 'port-neuf', nom: 'Port Neuf', email: 'contact@port-neuf.fr', utilisateur: 'admin', motDePasse: 'secret', gratuit: false,
        });
        expect(corps.modules).not.toContain('MARKETING');
        expect(corps.modules).toContain('PARAMETRAGE');
        // Les liens à transmettre au chantier portent son code
        expect(await screen.findByText(/chantier\/\?chantier=port-neuf/)).toBeInTheDocument();
    });

    it('refuse un code chantier invalide', async () => {
        render(<Chantiers />);
        await screen.findByText('MS Plaisance');
        fireEvent.click(screen.getByRole('button', { name: /Nouveau chantier/ }));
        fireEvent.change(await screen.findByLabelText('Code chantier'), { target: { value: '-port neuf' } });
        fireEvent.click(screen.getByRole('button', { name: /Créer/ }));
        expect(await screen.findByText(/2 à 40 caractères/)).toBeInTheDocument();
        expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it("coupe l'accès d'un chantier", async () => {
        mockedApi.put.mockResolvedValue({ data: vue('ms-plaisance', 'MS Plaisance', { accesSuspendu: true, accesSuspenduDate: '2026-11-05T00:00:00' }) });
        render(<Chantiers />);
        await gerer('MS Plaisance');

        fireEvent.click(await screen.findByRole('button', { name: /Couper l'accès/ }));
        const confirmation = await screen.findByText("Couper l'accès au chantier ?");
        fireEvent.click(within(confirmation.closest('.ant-popover') as HTMLElement).getByRole('button', { name: /Couper l'accès/ }));

        await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/admin/chantiers/ms-plaisance', { accesSuspendu: true }));
        expect(await screen.findByRole('button', { name: /Rétablir l'accès/ })).toBeInTheDocument();
    });

    it("accorde l'abonnement gratuit et enregistre un paiement", async () => {
        mockedApi.put.mockResolvedValue({ data: vue('ms-plaisance', 'MS Plaisance', { gratuit: true }) });
        mockedApi.post.mockResolvedValue({ data: vue('ms-plaisance', 'MS Plaisance') });
        render(<Chantiers />);
        await gerer('MS Plaisance');

        fireEvent.click(await screen.findByRole('switch', { name: 'Abonnement gratuit' }));
        await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/admin/chantiers/ms-plaisance', { gratuit: true }));

        fireEvent.click(screen.getByRole('button', { name: /Enregistrer le paiement/ }));
        const confirmation = await screen.findByText('Enregistrer ce paiement ?');
        fireEvent.click(within(confirmation.closest('.ant-popover') as HTMLElement).getByRole('button', { name: /Enregistrer/ }));
        await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/admin/chantiers/ms-plaisance/paiements', { type: 'MENSUEL', mode: 'VIREMENT' }));
    });

    it("change le code d'un chantier", async () => {
        mockedApi.put.mockResolvedValue({ data: vue('port-libre', 'Port Gratuit', { gratuit: true }, { abonnementActif: false }) });
        render(<Chantiers />);
        await gerer('Port Gratuit');

        fireEvent.click(await screen.findByRole('button', { name: /Modifier le code/ }));
        const champ = await screen.findByLabelText('Nouveau code chantier');
        const dialogue = within(champ.closest('.ant-modal') as HTMLElement);
        expect(dialogue.getByText('Modifier le code du chantier port-gratuit')).toBeInTheDocument();
        fireEvent.change(dialogue.getByLabelText('Nouveau code chantier'), { target: { value: 'port gratuit' } });
        fireEvent.click(dialogue.getByRole('button', { name: /Modifier le code/ }));
        expect(await dialogue.findByText(/2 à 40 caractères/)).toBeInTheDocument();
        fireEvent.change(dialogue.getByLabelText('Nouveau code chantier'), { target: { value: 'port-gratuit' } });
        fireEvent.click(dialogue.getByRole('button', { name: /Modifier le code/ }));
        expect(await dialogue.findByText('Le code est inchangé')).toBeInTheDocument();
        expect(mockedApi.put).not.toHaveBeenCalled();

        fireEvent.change(dialogue.getByLabelText('Nouveau code chantier'), { target: { value: 'Port-Libre' } });
        fireEvent.click(dialogue.getByRole('button', { name: /Modifier le code/ }));
        await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/admin/chantiers/port-gratuit/code', { code: 'port-libre' }));
        // Le détail reste ouvert sur le chantier, avec son nouveau code et ses nouveaux liens
        expect(await screen.findByText('Port Gratuit (port-libre)')).toBeInTheDocument();
        expect(screen.getByText(/chantier\/\?chantier=port-libre/)).toBeInTheDocument();
    });

    it('supprime un chantier après confirmation de son code', async () => {
        mockedApi.delete.mockResolvedValue({});
        render(<Chantiers />);
        await gerer('Port Gratuit');

        fireEvent.click(await screen.findByRole('button', { name: /Supprimer le chantier/ }));
        const bouton = await screen.findByRole('button', { name: /Supprimer définitivement/ });
        expect(bouton).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Code du chantier à supprimer'), { target: { value: 'port-gratuit' } });
        expect(bouton).toBeEnabled();
        fireEvent.click(bouton);

        await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/admin/chantiers/port-gratuit', { params: { confirmation: 'port-gratuit' } }));
        await waitFor(() => expect(screen.queryByText('Port Gratuit')).not.toBeInTheDocument());
    });
});
