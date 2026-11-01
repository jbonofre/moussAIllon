import React from 'react';
import { render, screen, fireEvent, within, createEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Planning from './planning.tsx';
import api from './api.ts';
import dayjs from 'dayjs';

jest.mock('./api.ts', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

// La courbe des marées dessine sur un canvas, absent de jsdom
jest.mock('@ant-design/charts', () => ({ Line: () => null }));

jest.setTimeout(30000);

const ilYA = (minutes: number) => dayjs().subtract(minutes, 'minute').format('YYYY-MM-DDTHH:mm');

const ventes = [
    {
        id: 1,
        status: 'DEVIS',
        bonPourAccord: true,
        client: { id: 1, nom: 'Hélène Le Gall' },
        bateau: { id: 1, name: 'Bavaria 32', immatriculation: 'CM 123456' },
        venteForfaits: [{ id: 11, forfait: { id: 1, nom: 'Hivernage moteur' }, status: 'EN_ATTENTE' }],
        venteServices: [{ id: 12, service: { id: 2, nom: 'Carénage' }, status: 'TERMINEE' }],
    },
    {
        id: 2,
        status: 'DEVIS',
        bonPourAccord: false,
        client: { id: 2, nom: 'Yann Dupont' },
        bateau: { id: 2, name: 'Jeanneau Merry Fisher', immatriculation: 'BR 987654' },
        venteServices: [{ id: 21, service: { id: 3, nom: 'Remplacement anode' } }],
    },
    {
        id: 3,
        status: 'DEVIS',
        bonPourAccord: true,
        client: { id: 3, nom: 'Marc Riou' },
        bateau: { id: 3, name: 'Cap Camarat' },
        venteForfaits: [{ id: 31, forfait: { id: 4, nom: 'Révision 100h' }, status: 'INCIDENT' }],
    },
    {
        id: 4,
        status: 'DEVIS',
        bonPourAccord: true,
        client: { id: 4, nom: 'Gwen Le Bihan' },
        bateau: { id: 4, name: 'Zodiac Medline', immatriculation: 'LO 77821' },
        venteForfaits: [
            // Prévue il y a deux heures, jamais commencée : en retard
            { id: 41, forfait: { id: 5, nom: 'Pose sondeur', dureeEstimee: 1 }, status: 'PLANIFIEE', statusDate: ilYA(120) },
            // Commencée il y a 30 min pour 2 h : dans les temps
            { id: 42, forfait: { id: 6, nom: 'Antifouling', dureeEstimee: 2 }, status: 'EN_COURS', dateDebut: ilYA(30) },
            // Commencée il y a 3 h pour 1 h : dépassée
            { id: 43, forfait: { id: 7, nom: 'Changement hélice', dureeEstimee: 1 }, status: 'EN_COURS', dateDebut: ilYA(180) },
        ],
    },
];

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockImplementation((url: string) =>
        Promise.resolve({ data: url === '/ventes' ? ventes : url === '/marees' ? {} : [] }) as any
    );
});

const sectionEnAttente = () => screen.getByText(/A planifier — en attente/).closest('.ant-card') as HTMLElement;

const choisir = (libelle: string, option: string) => {
    fireEvent.mouseDown(within(screen.getByLabelText(libelle).closest('.ant-select') as HTMLElement).getByRole('combobox'));
    const options = Array.from(document.querySelectorAll('.ant-select-item-option'))
        .filter((element) => element.textContent === option) as HTMLElement[];
    fireEvent.click(options[options.length - 1]);
};

describe('Planning — filtres', () => {
    it('liste les tâches en attente, avec ou sans statut renseigné', async () => {
        render(<Planning />);
        expect(await screen.findByText('Hivernage moteur')).toBeInTheDocument();
        expect(within(sectionEnAttente()).getByText('Remplacement anode')).toBeInTheDocument();
        expect(screen.getByText(/A planifier — en attente \(2\)/)).toBeInTheDocument();
    });

    it("retrouve les tâches d'un client, d'un bateau ou d'une immatriculation", async () => {
        render(<Planning />);
        await screen.findByText('Hivernage moteur');
        const recherche = screen.getByLabelText('Rechercher une tâche');

        fireEvent.change(recherche, { target: { value: 'dupont' } });
        expect(within(sectionEnAttente()).getByText('Remplacement anode')).toBeInTheDocument();
        expect(within(sectionEnAttente()).queryByText('Hivernage moteur')).not.toBeInTheDocument();

        fireEvent.change(recherche, { target: { value: 'bavaria' } });
        expect(within(sectionEnAttente()).getByText('Hivernage moteur')).toBeInTheDocument();
        expect(within(sectionEnAttente()).queryByText('Remplacement anode')).not.toBeInTheDocument();

        fireEvent.change(recherche, { target: { value: 'br987654' } });
        expect(within(sectionEnAttente()).getByText('Remplacement anode')).toBeInTheDocument();

        fireEvent.change(recherche, { target: { value: 'inconnu' } });
        expect(within(sectionEnAttente()).getByText('Aucune tâche en attente ne correspond aux filtres.')).toBeInTheDocument();
    });

    it('ne garde que les tâches planifiables avec le filtre bon pour accord', async () => {
        render(<Planning />);
        await screen.findByText('Hivernage moteur');

        choisir('Filtrer par bon pour accord', 'Bon pour accord signé');

        expect(within(sectionEnAttente()).getByText('Hivernage moteur')).toBeInTheDocument();
        expect(within(sectionEnAttente()).queryByText('Remplacement anode')).not.toBeInTheDocument();
    });

    it('masque les sections sans rapport avec le statut choisi', async () => {
        render(<Planning />);
        await screen.findByText('Hivernage moteur');
        expect(screen.getByText(/Terminées \(1\)/)).toBeInTheDocument();

        choisir('Filtrer par statut', 'En attente');

        expect(sectionEnAttente()).toBeInTheDocument();
        expect(screen.queryByText(/Terminées \(/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Tâches en cours/)).not.toBeInTheDocument();
    });

    it('affiche les incidents quand on filtre sur ce statut', async () => {
        render(<Planning />);
        await screen.findByText('Hivernage moteur');
        expect(screen.queryByText('Révision 100h')).not.toBeInTheDocument();

        choisir('Filtrer par statut', 'Incident');

        expect(screen.getByText(/Incidents \(1\)/)).toBeInTheDocument();
        expect(screen.getByText('Révision 100h')).toBeInTheDocument();
        expect(screen.queryByText(/A planifier — en attente/)).not.toBeInTheDocument();
    });

    it('place les tâches au bon pour accord signé en tête du panneau', async () => {
        render(<Planning />);
        await screen.findByText('Hivernage moteur');
        const taches = within(sectionEnAttente()).getAllByTestId('tache-a-planifier');
        expect(taches[0]).toHaveTextContent('Hivernage moteur');
        expect(taches[1]).toHaveTextContent('Remplacement anode');
        expect(taches[1]).toHaveTextContent('Bon pour accord à signer avant démarrage');
        expect(taches[1]).toHaveAttribute('draggable', 'true');
    });

    it('montre le créneau visé pendant le glisser, puis ouvre la planification au dépôt', async () => {
        render(<Planning />);
        await screen.findByText('Hivernage moteur');
        const tache = within(sectionEnAttente()).getAllByTestId('tache-a-planifier')[0];
        const jour = document.querySelectorAll('[data-timeline-cell]')[1] as HTMLElement;

        fireEvent.dragStart(tache, { dataTransfer: { setData: jest.fn(), effectAllowed: '' } });
        fireEvent.dragOver(jour, { dataTransfer: { dropEffect: '' }, clientX: 0 });
        // Sans mise en page sous jsdom, le pointeur tombe au début de la journée ; durée par défaut : 1 h
        expect(within(jour).getByText('07:00 · 1 h')).toBeInTheDocument();

        fireEvent.drop(jour, { dataTransfer: {}, clientX: 0 });
        expect(within(jour).queryByText('07:00 · 1 h')).not.toBeInTheDocument();
        expect(await screen.findByText('Planifier: Hivernage moteur')).toBeInTheDocument();
    });

    it('affiche les tâches en retard dans le panneau, sous les tâches à planifier', async () => {
        render(<Planning />);
        await screen.findByText('Hivernage moteur');

        const retards = screen.getByText(/En retard \(2\)/).closest('.ant-card') as HTMLElement;
        const taches = within(retards).getAllByTestId('tache-en-retard');
        // La plus ancienne d'abord
        expect(taches[0]).toHaveTextContent('Changement hélice');
        expect(taches[0]).toHaveTextContent('En cours depuis le');
        expect(taches[1]).toHaveTextContent('Pose sondeur');
        expect(taches[1]).toHaveTextContent('Prévue le');
        // Une tâche en cours dans sa durée n'est pas en retard
        expect(within(retards).queryByText('Antifouling')).not.toBeInTheDocument();
        // Sous « A planifier »
        expect(sectionEnAttente().compareDocumentPosition(retards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(within(retards).getAllByRole('button', { name: 'Replanifier' })).toHaveLength(2);

        // Glissée sur le calendrier, elle se replanifie
        const jour = document.querySelectorAll('[data-timeline-cell]')[2] as HTMLElement;
        fireEvent.dragStart(taches[1], { dataTransfer: { setData: jest.fn(), effectAllowed: '' } });
        fireEvent.drop(jour, { dataTransfer: {}, clientX: 0 });
        expect(await screen.findByText('Planifier: Pose sondeur')).toBeInTheDocument();
    });

    it('réinitialise tous les filtres en un clic', async () => {
        render(<Planning />);
        await screen.findByText('Hivernage moteur');

        fireEvent.change(screen.getByLabelText('Rechercher une tâche'), { target: { value: 'dupont' } });
        choisir('Filtrer par statut', 'En attente');
        expect(screen.getByText('Filtres (2)')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));

        expect(screen.getByText('Filtres')).toBeInTheDocument();
        expect(screen.getByLabelText('Rechercher une tâche')).toHaveValue('');
        expect(within(sectionEnAttente()).getByText('Hivernage moteur')).toBeInTheDocument();
        expect(screen.getByText(/Terminées \(1\)/)).toBeInTheDocument();
    });
});

describe('Planning — déplacer une tâche sur le calendrier', () => {
    const aujourdhui = dayjs().format('YYYY-MM-DD');
    const technicien = { id: 7, nom: 'Le Goff', prenom: 'Erwan' };
    // Deux interventions du même technicien : 8h30-10h45 (2h15) et 13h-15h
    const ventesCalendrier = [
        {
            id: 9,
            status: 'DEVIS',
            bonPourAccord: true,
            client: { id: 9, nom: 'Anne Kerjean' },
            bateau: { id: 9, name: 'Jopo' },
            venteForfaits: [
                { id: 91, forfait: { id: 91, nom: 'Gréement', dureeEstimee: 2.25 }, status: 'PLANIFIEE', statusDate: `${aujourdhui}T08:30`, techniciens: [technicien] },
                { id: 92, forfait: { id: 92, nom: 'Vidange', dureeEstimee: 2 }, status: 'PLANIFIEE', statusDate: `${aujourdhui}T13:00`, techniciens: [technicien] },
            ],
        },
    ];

    const rect = (left: number, width: number) => () => ({ left, width, top: 0, right: left + width, bottom: 24, height: 24, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

    // jsdom n'a pas de DragEvent : la position du pointeur est posée sur l'événement
    const glisser = (type: 'dragStart' | 'dragOver' | 'drop', element: HTMLElement, clientX: number) => {
        const event = createEvent[type](element, { dataTransfer: { setData: jest.fn(), effectAllowed: '', dropEffect: '' } });
        Object.defineProperty(event, 'clientX', { value: clientX });
        fireEvent(element, event);
    };

    // Saisit la Vidange en son milieu (14h) ; la journée 7h-19h fait 1200 px, soit 100 px par heure
    const saisirVidange = async () => {
        mockedApi.get.mockImplementation((url: string) =>
            Promise.resolve({ data: url === '/ventes' ? ventesCalendrier : url === '/marees' ? {} : [] }) as any
        );
        render(<Planning />);
        const barre = (await screen.findByText('Jopo · Vidange')) as HTMLElement;
        const jour = barre.closest('[data-timeline-cell]') as HTMLElement;
        jour.getBoundingClientRect = rect(0, 1200);
        barre.getBoundingClientRect = rect(600, 200);
        glisser('dragStart', barre, 700);
        return jour;
    };

    it('pose la tâche là où se trouve son bord gauche, pas sous le pointeur', async () => {
        const jour = await saisirVidange();
        // Pointeur à 13h30 : le bord gauche de la barre est à 12h30
        glisser('dragOver', jour, 650);
        expect(within(jour).getByText('12:30 · 2 h')).toBeInTheDocument();
    });

    it('colle la tâche à la fin de la précédente du même technicien', async () => {
        const jour = await saisirVidange();
        // Bord gauche amené vers 10h50, juste après le Gréement (fin à 10h45)
        glisser('dragOver', jour, 485);
        expect(within(jour).getByText('10:45 · 2 h')).toBeInTheDocument();

        glisser('drop', jour, 485);
        expect(await screen.findByText('Planifier: Vidange')).toBeInTheDocument();
        expect(screen.getByDisplayValue(`${dayjs().format('DD/MM/YYYY')} 10:45`)).toBeInTheDocument();
    });
});
