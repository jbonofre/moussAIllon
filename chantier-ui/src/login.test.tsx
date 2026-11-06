import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from './login';

const reponse = (ok: boolean, status: number, corps: any) => Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(corps),
    text: () => Promise.resolve(corps),
});

// Serveur simulé : réponse par « MÉTHODE url », 404 sinon.
const serveur = (routes: Record<string, () => Promise<any>>) => jest.fn((url: string, options?: any) => {
    const route = routes[`${options?.method || 'GET'} ${url}`];
    return route ? route() : reponse(false, 404, '');
}) as any;

const seConnecter = (utilisateur: string, motDePasse: string) => {
    fireEvent.change(screen.getByPlaceholderText('Utilisateur'), { target: { value: utilisateur } });
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: motDePasse } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));
};

describe('Login', () => {
    beforeEach(() => {
        localStorage.clear();
        window.history.pushState({}, '', '/');
    });

    it('pré-remplit le code chantier du lien et l\'envoie à la connexion', async () => {
        window.history.pushState({}, '', '/?chantier=Port-Test');
        const setUser = jest.fn();
        global.fetch = jest.fn(() => reponse(true, 200, { token: 'jeton', name: 'admin', modules: ['VENTE'], chantier: 'port-test' })) as any;

        render(<Login setUser={setUser} />);
        expect(screen.getByLabelText('Code chantier')).toHaveValue('port-test');
        seConnecter('admin', 'secret');

        await waitFor(() => expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'admin', chantier: 'port-test' })));
        expect(global.fetch).toHaveBeenCalledWith('/api/users/authenticate', expect.objectContaining({
            body: JSON.stringify({ name: 'admin', password: 'secret' }),
            headers: expect.objectContaining({ 'X-Chantier': 'port-test' }),
        }));
        // Mémorisé pour la prochaine connexion
        expect(localStorage.getItem('moussaillon-chantier')).toBe('port-test');
        expect(localStorage.getItem('moussaillon-token')).toBe('jeton');
    });

    it('reprend le dernier code chantier utilisé', () => {
        localStorage.setItem('moussaillon-chantier', 'ms-plaisance');
        render(<Login setUser={jest.fn()} />);
        expect(screen.getByLabelText('Code chantier')).toHaveValue('ms-plaisance');
    });

    it('exige le code chantier', async () => {
        global.fetch = jest.fn() as any;
        render(<Login setUser={jest.fn()} />);
        seConnecter('admin', 'secret');
        expect(await screen.findByText('Le code chantier est requis')).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalledWith('/api/users/authenticate', expect.anything());
    });

    it('affiche la raison du refus donnée par le serveur', async () => {
        localStorage.setItem('moussaillon-chantier', 'port-test');
        const setUser = jest.fn();
        global.fetch = jest.fn(() => reponse(false, 403, "Accès bloqué : l'accès à ce chantier est suspendu.")) as any;

        render(<Login setUser={setUser} />);
        seConnecter('admin', 'secret');

        expect(await screen.findByText(/l'accès à ce chantier est suspendu/)).toBeInTheDocument();
        expect(setUser).not.toHaveBeenCalled();
    });

    it('ne propose pas de créer un chantier quand les inscriptions sont fermées', async () => {
        global.fetch = serveur({ 'GET /api/inscription': () => reponse(true, 200, { active: false, essaiMois: 1 }) });
        render(<Login setUser={jest.fn()} />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/inscription'));
        expect(screen.queryByText('Créez votre chantier en 1 minute !')).not.toBeInTheDocument();
    });

    it('crée un chantier puis connecte son premier utilisateur', async () => {
        localStorage.setItem('moussaillon-chantier', 'ancien-chantier');
        const setUser = jest.fn();
        global.fetch = serveur({
            'GET /api/inscription': () => reponse(true, 200, { active: true, essaiMois: 1 }),
            'POST /api/inscription': () => reponse(true, 201, { code: 'chantier-de-l-etang', utilisateur: 'admin', essaiFin: '2026-12-06T10:00:00' }),
            'POST /api/users/authenticate': () => reponse(true, 200, { token: 'jeton', name: 'admin', modules: ['VENTE', 'PARAMETRAGE'], chantier: 'chantier-de-l-etang' }),
        });
        render(<Login setUser={setUser} />);

        fireEvent.click(await screen.findByRole('button', { name: 'Créez votre chantier en 1 minute !' }));
        expect(screen.getByText('Le premier mois est gratuit, sans carte bancaire.')).toBeInTheDocument();
        // Le code chantier est proposé d'après le nom
        fireEvent.change(screen.getByLabelText('Nom du chantier'), { target: { value: "Chantier de l'Étang" } });
        expect(screen.getByLabelText('Code du nouveau chantier')).toHaveValue('chantier-de-l-etang');
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'contact@etang.fr' } });
        fireEvent.change(screen.getByLabelText('Choisissez un mot de passe'), { target: { value: 'motdepasse' } });
        fireEvent.change(screen.getByLabelText('Confirmation du mot de passe'), { target: { value: 'motdepasse' } });
        fireEvent.click(screen.getByRole('button', { name: /Créer mon chantier/ }));

        await waitFor(() => expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'admin', chantier: 'chantier-de-l-etang' })));
        const [ , creation ] = (global.fetch as jest.Mock).mock.calls.find(([ url, options ]) => url === '/api/inscription' && options?.method === 'POST');
        expect(JSON.parse(creation.body)).toEqual({
            nom: "Chantier de l'Étang", code: 'chantier-de-l-etang', email: 'contact@etang.fr', utilisateur: 'admin', motDePasse: 'motdepasse',
        });
        // Le chantier n'existe pas encore : pas d'en-tête X-Chantier (le code mémorisé serait refusé)
        expect(creation.headers['X-Chantier']).toBeUndefined();
        expect(global.fetch).toHaveBeenCalledWith('/api/users/authenticate', expect.objectContaining({
            body: JSON.stringify({ name: 'admin', password: 'motdepasse' }),
            headers: expect.objectContaining({ 'X-Chantier': 'chantier-de-l-etang' }),
        }));
        expect(localStorage.getItem('moussaillon-chantier')).toBe('chantier-de-l-etang');
    });

    it("vérifie l'inscription et affiche le refus du serveur", async () => {
        global.fetch = serveur({
            'GET /api/inscription': () => reponse(true, 200, { active: true, essaiMois: 2 }),
            'POST /api/inscription': () => reponse(false, 400, 'Le chantier port existe déjà.'),
        });
        render(<Login setUser={jest.fn()} />);

        fireEvent.click(await screen.findByRole('button', { name: 'Créez votre chantier en 1 minute !' }));
        expect(screen.getByText('Les 2 premiers mois sont gratuits, sans carte bancaire.')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Nom du chantier'), { target: { value: 'Port' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'contact@port.fr' } });
        fireEvent.change(screen.getByLabelText('Choisissez un mot de passe'), { target: { value: 'court' } });
        fireEvent.change(screen.getByLabelText('Confirmation du mot de passe'), { target: { value: 'autre' } });
        fireEvent.click(screen.getByRole('button', { name: /Créer mon chantier/ }));
        expect(await screen.findByText('Au moins 8 caractères')).toBeInTheDocument();
        expect(screen.getByText('Les mots de passe sont différents')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Choisissez un mot de passe'), { target: { value: 'motdepasse' } });
        fireEvent.change(screen.getByLabelText('Confirmation du mot de passe'), { target: { value: 'motdepasse' } });
        fireEvent.click(screen.getByRole('button', { name: /Créer mon chantier/ }));
        expect(await screen.findByText('Le chantier port existe déjà.')).toBeInTheDocument();

        // Retour à la connexion
        fireEvent.click(screen.getByRole('button', { name: /me connecter/ }));
        expect(screen.getByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
    });
});
