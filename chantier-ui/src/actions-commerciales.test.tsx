import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import dayjs from 'dayjs';
import ActionsCommerciales from './actions-commerciales.tsx';
import { NavigationContext } from './navigation-context.tsx';
import { fetchWithAuth } from './api.ts';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: {},
    fetchWithAuth: jest.fn(),
}));

jest.setTimeout(30000);

const mockedFetch = fetchWithAuth as jest.Mock;
const navigate = jest.fn();

const jour = (decalage: number) => dayjs().add(decalage, 'day').hour(9).minute(0).second(0).format('YYYY-MM-DDTHH:mm:ss');

const actions = [
    { id: 1, clientId: 100, clientNom: 'Jean Dupont', clientTelephone: '0612345678', clientEmail: 'jean.dupont@test.com',
        clientStatut: 'PROSPECT', type: 'APPEL', statut: 'A_FAIRE', sujet: 'Rappeler pour le devis hivernage', date: jour(-2),
        utilisateur: 'admin' },
    { id: 2, clientId: 101, clientNom: 'Sophie Martin', clientTelephone: null, clientEmail: 'sophie.martin@test.com',
        clientStatut: 'CLIENT', type: 'RENDEZ_VOUS', statut: 'A_FAIRE', sujet: 'Visite du semi-rigide', date: jour(0),
        compteRendu: 'Au ponton B', utilisateur: 'admin' },
    { id: 3, clientId: 102, clientNom: 'Paul Durand', clientStatut: 'CLIENT', type: 'EMAIL', statut: 'A_FAIRE',
        sujet: "Envoyer l'offre moteur", date: jour(5), utilisateur: 'technicien1' },
];

const reponse = (data: any) => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve(''),
});

const appels = (url: string, method: string) =>
    mockedFetch.mock.calls.filter(([u, options]) => u === url && options?.method === method);

const ligne = (texte: string) => screen.getByText(texte).closest('tr') as HTMLElement;

const afficher = () => render(
    <NavigationContext.Provider value={{ navigate, pageState: null }}>
        <ActionsCommerciales />
    </NavigationContext.Provider>,
);

beforeEach(() => {
    mockedFetch.mockReset();
    navigate.mockReset();
    localStorage.setItem('moussaillon-user', JSON.stringify({ name: 'admin', modules: ['VENTE'] }));
    mockedFetch.mockImplementation((url: string) => {
        if (url === './interactions/utilisateurs') return reponse(['admin', 'technicien1']);
        if (url === './interactions/a-faire?utilisateur=admin') return reponse(actions.slice(0, 2));
        if (url === './interactions/a-faire') return reponse(actions);
        if (url.startsWith('./clients/search')) return reponse([{ id: 103, nom: 'Marina du Port' }]);
        return reponse({});
    });
});

afterEach(() => localStorage.removeItem('moussaillon-user'));

describe('Actions commerciales', () => {
    it("liste mes actions à faire avec leur échéance et le contact du client", async () => {
        afficher();

        expect(await screen.findByText('Rappeler pour le devis hivernage')).toBeInTheDocument();
        expect(mockedFetch).toHaveBeenCalledWith('./interactions/a-faire?utilisateur=admin');
        const retard = ligne('Rappeler pour le devis hivernage');
        expect(within(retard).getByText('En retard')).toBeInTheDocument();
        expect(within(retard).getByText('Prospect')).toBeInTheDocument();
        expect(within(retard).getByText('0612345678')).toHaveAttribute('href', 'tel:0612345678');
        expect(within(retard).getByText('Appel')).toBeInTheDocument();
        const aujourdhui = ligne('Visite du semi-rigide');
        expect(within(aujourdhui).getAllByText("Aujourd'hui").length).toBeGreaterThan(0);
        expect(within(aujourdhui).getByText('Au ponton B')).toBeInTheDocument();
        expect(screen.getByText('1 action en retard')).toBeInTheDocument();
        expect(screen.queryByText("Envoyer l'offre moteur")).not.toBeInTheDocument();
    });

    it("affiche les actions de tous les utilisateurs", async () => {
        afficher();
        await screen.findByText('Rappeler pour le devis hivernage');

        fireEvent.click(screen.getByText('Toutes'));

        expect(await screen.findByText("Envoyer l'offre moteur")).toBeInTheDocument();
        expect(mockedFetch).toHaveBeenCalledWith('./interactions/a-faire');
        expect(within(ligne("Envoyer l'offre moteur")).getByText('technicien1')).toBeInTheDocument();
        expect(within(ligne("Envoyer l'offre moteur")).getByText('À venir')).toBeInTheDocument();
    });

    it('ouvre la fiche du client', async () => {
        afficher();
        fireEvent.click(await screen.findByText('Jean Dupont'));
        expect(navigate).toHaveBeenCalledWith('/clients', { ouvrirClientId: 100 });
    });

    it("marque l'action comme faite et planifie le suivi", async () => {
        afficher();
        await screen.findByText('Rappeler pour le devis hivernage');

        fireEvent.click(within(ligne('Rappeler pour le devis hivernage')).getByRole('button', { name: /Fait/ }));
        const modale = await screen.findByRole('dialog');
        fireEvent.change(within(modale).getByLabelText('Compte rendu'), { target: { value: 'Devis accepté oralement' } });
        fireEvent.click(within(modale).getByLabelText('Planifier une action de suivi'));
        fireEvent.change(await within(modale).findByLabelText('Action de suivi'), { target: { value: 'Faire signer le devis' } });
        fireEvent.click(within(modale).getByRole('button', { name: 'Marquer comme faite' }));

        await waitFor(() => expect(appels('./interactions/1/terminer', 'POST')).toHaveLength(1));
        expect(JSON.parse(appels('./interactions/1/terminer', 'POST')[0][1].body)).toEqual({ compteRendu: 'Devis accepté oralement' });
        await waitFor(() => expect(appels('./interactions', 'POST')).toHaveLength(1));
        const suivi = JSON.parse(appels('./interactions', 'POST')[0][1].body);
        expect(suivi).toMatchObject({ clientId: 100, type: 'APPEL', statut: 'A_FAIRE', sujet: 'Faire signer le devis', utilisateur: 'admin' });
        expect(suivi.date).toBe(dayjs().add(7, 'day').format('YYYY-MM-DD') + 'T09:00:00');
        // La liste est rechargée
        await waitFor(() => expect(mockedFetch.mock.calls.filter(([u]) => u === './interactions/a-faire?utilisateur=admin')).toHaveLength(2));
    });

    it('marque une action comme faite sans suivi', async () => {
        afficher();
        await screen.findByText('Visite du semi-rigide');

        fireEvent.click(within(ligne('Visite du semi-rigide')).getByRole('button', { name: /Fait/ }));
        const modale = await screen.findByRole('dialog');
        fireEvent.click(within(modale).getByRole('button', { name: 'Marquer comme faite' }));

        await waitFor(() => expect(appels('./interactions/2/terminer', 'POST')).toHaveLength(1));
        // Le compte rendu saisi à la planification est repris
        expect(JSON.parse(appels('./interactions/2/terminer', 'POST')[0][1].body)).toEqual({ compteRendu: 'Au ponton B' });
        expect(appels('./interactions', 'POST')).toHaveLength(0);
    });

    it('planifie une action pour un client à rechercher', async () => {
        afficher();
        await screen.findByText('Rappeler pour le devis hivernage');

        fireEvent.click(screen.getByRole('button', { name: /Planifier une action/ }));
        const modale = await screen.findByRole('dialog');
        expect(within(modale).getByText('Planifier une action')).toBeInTheDocument();
        const champ = modale.querySelector('#clientId') as HTMLElement;
        fireEvent.mouseDown(champ);
        fireEvent.change(champ, { target: { value: 'Marina' } });
        const option = await waitFor(() => {
            const found = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'))
                .find((element) => element.textContent === 'Marina du Port');
            expect(found).toBeTruthy();
            return found as HTMLElement;
        });
        fireEvent.click(option);
        fireEvent.change(within(modale).getByLabelText('Action'), { target: { value: 'Proposer le contrat d’entretien' } });
        fireEvent.click(within(modale).getByRole('button', { name: 'Enregistrer' }));

        await waitFor(() => expect(appels('./interactions', 'POST')).toHaveLength(1));
        const action = JSON.parse(appels('./interactions', 'POST')[0][1].body);
        expect(action).toMatchObject({
            clientId: 103, type: 'APPEL', statut: 'A_FAIRE', sujet: 'Proposer le contrat d’entretien', utilisateur: 'admin',
        });
        // Échéance le lendemain à 9h par défaut
        expect(action.date).toBe(dayjs().add(1, 'day').format('YYYY-MM-DD') + 'T09:00:00');
    });

    it('supprime une action', async () => {
        afficher();
        await screen.findByText('Visite du semi-rigide');

        fireEvent.click(within(ligne('Visite du semi-rigide')).getByTitle('Supprimer'));
        fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));

        await waitFor(() => expect(appels('./interactions/2', 'DELETE')).toHaveLength(1));
    });
});
