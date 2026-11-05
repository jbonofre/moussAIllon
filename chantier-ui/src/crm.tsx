import React from 'react';
import { Tag } from 'antd';
import { CalendarOutlined, EditOutlined, EnvironmentOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

// Suivi commercial des clients et des prospects (échanges et actions à faire)

export type StatutClient = 'PROSPECT' | 'CLIENT' | 'INACTIF';
export type TypeInteraction = 'APPEL' | 'EMAIL' | 'VISITE' | 'RENDEZ_VOUS' | 'NOTE';
export type StatutInteraction = 'A_FAIRE' | 'FAITE';

export interface Interaction {
    id: number;
    clientId: number;
    clientNom: string;
    clientTelephone?: string | null;
    clientEmail?: string | null;
    clientStatut?: StatutClient | null;
    type: TypeInteraction;
    statut: StatutInteraction;
    sujet: string;
    compteRendu?: string | null;
    // Date de l'échange, ou échéance de l'action à faire
    date: string;
    dateRealisation?: string | null;
    utilisateur?: string | null;
    creePar?: string | null;
}

export const STATUTS_CLIENT: { value: StatutClient; label: string; color: string }[] = [
    { value: 'PROSPECT', label: 'Prospect', color: 'gold' },
    { value: 'CLIENT', label: 'Client', color: 'green' },
    { value: 'INACTIF', label: 'Inactif', color: 'default' },
];

export const StatutClientTag = ({ statut }: { statut?: StatutClient | null }) => {
    const s = STATUTS_CLIENT.find((o) => o.value === (statut || 'CLIENT'));
    return s ? <Tag color={s.color}>{s.label}</Tag> : null;
};

export const TYPES_INTERACTION: { value: TypeInteraction; label: string; icon: React.ReactNode }[] = [
    { value: 'APPEL', label: 'Appel', icon: <PhoneOutlined /> },
    { value: 'EMAIL', label: 'Email', icon: <MailOutlined /> },
    { value: 'VISITE', label: 'Visite', icon: <EnvironmentOutlined /> },
    { value: 'RENDEZ_VOUS', label: 'Rendez-vous', icon: <CalendarOutlined /> },
    { value: 'NOTE', label: 'Note', icon: <EditOutlined /> },
];

export const TypeInteractionTag = ({ type }: { type: TypeInteraction }) => {
    const t = TYPES_INTERACTION.find((o) => o.value === type);
    return t ? <Tag icon={t.icon}>{t.label}</Tag> : null;
};

export type Echeance = 'EN_RETARD' | 'AUJOURD_HUI' | 'A_VENIR';

// Échéance d'une action à faire par rapport à aujourd'hui
export const echeance = (date: string, aujourdhui = dayjs()): Echeance => {
    const jour = dayjs(date).startOf('day');
    if (jour.isBefore(aujourdhui.startOf('day'))) return 'EN_RETARD';
    if (jour.isSame(aujourdhui, 'day')) return 'AUJOURD_HUI';
    return 'A_VENIR';
};

const ECHEANCES: Record<Echeance, { label: string; color: string }> = {
    EN_RETARD: { label: 'En retard', color: 'red' },
    AUJOURD_HUI: { label: "Aujourd'hui", color: 'orange' },
    A_VENIR: { label: 'À venir', color: 'blue' },
};

export const EcheanceTag = ({ date }: { date: string }) => {
    const e = ECHEANCES[echeance(date)];
    return <Tag color={e.color}>{e.label}</Tag>;
};

// Date (et heure si elle n'est pas minuit) d'un échange ou d'une action
export const formatDateHeure = (v?: string | null) => {
    if (!v) return '—';
    const d = dayjs(v);
    return d.hour() === 0 && d.minute() === 0 ? d.format('DD/MM/YYYY') : d.format('DD/MM/YYYY HH:mm');
};

// Utilisateur connecté (enregistré à la connexion)
export const utilisateurConnecte = (): string | null => {
    try {
        return JSON.parse(localStorage.getItem('moussaillon-user') || 'null')?.name ?? null;
    } catch {
        return null;
    }
};
