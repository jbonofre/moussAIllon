import axios from 'axios';

// Administration de l'instance : jeton de l'administrateur défini dans la configuration du backend.
export const CLE_JETON = 'moussaillon-admin-token';
export const CLE_ADMIN = 'moussaillon-admin-user';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem(CLE_JETON);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && localStorage.getItem(CLE_JETON)) {
            localStorage.removeItem(CLE_JETON);
            localStorage.removeItem(CLE_ADMIN);
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default api;

/** Raison d'un refus donnée par le serveur (texte), sinon le message par défaut. */
export function messageErreur(error: unknown, parDefaut: string): string {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    return typeof data === 'string' && data.trim() ? data.trim() : parDefaut;
}

export interface Chantier {
    code: string;
    nom: string;
    email?: string;
    dateCreation?: string;
    accesSuspendu: boolean;
    accesSuspenduDate?: string;
    gratuit: boolean;
}

export interface Paiement {
    id: number;
    type: 'MENSUEL' | 'ANNUEL' | 'MODULES';
    mode: string;
    montant: number;
    montantActivation?: number;
    date?: string;
    periodeDebut?: string;
    periodeFin?: string;
}

export interface Societe {
    nom: string;
    email?: string;
    modules: string[];
    versionFree: boolean;
    abonnementActif: boolean;
    abonnementAJour: boolean;
    abonnementResilie: boolean;
    abonnementResiliationDate?: string;
    abonnementBlocageDate?: string;
    abonnementBlocageImpayeDate?: string;
    abonnementActivationDate?: string;
    abonnementActivationMontant?: number;
    abonnementProchainPaiementDate?: string;
    abonnementProchainPaiementMontant?: number;
    abonnementMontantAnnuel?: number;
    abonnementNombreUtilisateurs: number;
    abonnementNombreTechniciens: number;
    abonnementNombreClients: number;
    accesLimiteFacturation: boolean;
    accesBloque: boolean;
    accesBloqueImpaye: boolean;
    paiements: Paiement[];
}

export interface ChantierVue {
    chantier: Chantier;
    societe?: Societe | null;
}

// Modules de l'application, dans l'ordre du menu ; Paramétrage est toujours souscrit.
export const MODULES = [
    { value: 'VENTE', label: 'Vente' },
    { value: 'PARC', label: 'Parc' },
    { value: 'CATALOGUE', label: 'Catalogue' },
    { value: 'ATELIER', label: 'Atelier' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'COMPTABILITE', label: 'Comptabilité' },
    { value: 'PARAMETRAGE', label: 'Paramétrage' },
];

export const MODULE_PARAMETRAGE = 'PARAMETRAGE';

export const FORMAT_CODE = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const MESSAGE_FORMAT_CODE = '2 à 40 caractères : lettres minuscules, chiffres et tirets, sans tiret au début';

export function formatDate(date?: string): string {
    return date ? new Date(date).toLocaleDateString('fr-FR') : '—';
}

export function formatMontant(montant?: number): string {
    return montant === undefined || montant === null
        ? '—'
        : montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

/** Lien d'un espace du chantier, pré-remplissant son code à la connexion. */
export function lienEspace(espace: 'chantier' | 'client' | 'technicien', code: string): string {
    return `${window.location.origin}/${espace}/?chantier=${encodeURIComponent(code)}`;
}

/** Statut de l'abonnement d'un chantier, du plus bloquant au plus favorable. */
export function statutAbonnement(vue: ChantierVue): { label: string; color: string } {
    const societe = vue.societe;
    if (!societe) {
        return { label: 'Société absente', color: 'default' };
    }
    if (vue.chantier.gratuit) {
        return { label: 'Gratuit', color: 'blue' };
    }
    if (societe.abonnementResilie) {
        return { label: societe.accesBloque ? 'Résilié, accès bloqué' : 'Résilié', color: 'red' };
    }
    if (!societe.abonnementActif) {
        return { label: 'Non activé', color: 'orange' };
    }
    if (societe.accesBloqueImpaye) {
        return { label: 'Impayé, accès limité', color: 'red' };
    }
    if (!societe.abonnementAJour) {
        return { label: 'Échéance dépassée', color: 'orange' };
    }
    return { label: 'À jour', color: 'green' };
}
