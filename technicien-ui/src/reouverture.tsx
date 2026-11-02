import React, { useState } from 'react';
import { Button, Popconfirm, message } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import api from './api.ts';

export interface TacheRouvrable {
    itemId?: number;
    itemType?: string;
    itemStatus?: string;
    venteType?: string;
    dateDebut?: string;
    dateReouverture?: string;
    dureeReelle?: number;
}

const heuresDepuis = (debut: string | undefined, finMs: number): number | undefined => {
    if (!debut) return undefined;
    const debutMs = new Date(debut).getTime();
    if (isNaN(debutMs) || finMs <= debutMs) return undefined;
    return (finMs - debutMs) / 3600000;
};

const arrondi = (heures: number) => Math.round(heures * 100) / 100;

/**
 * Temps passé (heures) sur une tâche qu'on termine. Après une réouverture, le temps déjà compté
 * s'ajoute à celui écoulé depuis ; sinon c'est le temps écoulé depuis le début de la tâche.
 */
export const dureeReelleALaFin = (tache: TacheRouvrable, finMs: number): number => {
    const dejaCompte = tache.dureeReelle || 0;
    if (tache.dateReouverture) {
        return arrondi(dejaCompte + (heuresDepuis(tache.dateReouverture, finMs) ?? 0));
    }
    const depuisDebut = heuresDepuis(tache.dateDebut, finMs);
    return depuisDebut !== undefined ? arrondi(depuisDebut) : dejaCompte;
};

/** Une tâche terminée se rouvre tant que sa vente n'est pas payée. */
export const peutEtreRouverte = (tache: TacheRouvrable) =>
    tache.itemStatus === 'TERMINEE' && tache.venteType !== 'FACTURE_PAYEE';

/** Message d'erreur renvoyé par le portail technicien ({"message": ...}), sinon le message par défaut. */
export const messageErreur = (erreur: unknown, defaut: string): string =>
    (erreur as { response?: { data?: { message?: string } } })?.response?.data?.message || defaut;

interface BoutonRouvrirProps {
    tache: TacheRouvrable;
    onRouverte: (tache: any) => void;
}

export function BoutonRouvrir({ tache, onRouverte }: BoutonRouvrirProps) {
    const [enCours, setEnCours] = useState(false);

    const rouvrir = async () => {
        setEnCours(true);
        try {
            const type = tache.itemType === 'forfait' ? 'forfaits' : 'services';
            const res = await api.post(`/technicien-portal/${type}/${tache.itemId}/rouvrir`);
            message.success('Tâche rouverte');
            onRouverte(res.data);
        } catch (erreur) {
            message.error(messageErreur(erreur, 'Erreur lors de la réouverture de la tâche'));
        } finally {
            setEnCours(false);
        }
    };

    return (
        <Popconfirm
            title="Rouvrir la tâche ?"
            description={
                <div style={{ maxWidth: 280 }}>
                    <p style={{ margin: 0 }}>
                        Elle repasse en cours : vous pourrez ajouter des pièces, puis la terminer à nouveau.
                        Le temps déjà compté est conservé.
                    </p>
                    {tache.venteType === 'FACTURE_PRETE' && (
                        <p style={{ margin: '8px 0 0' }}>
                            La facture est déjà prête : elle repassera en attente jusqu'à la nouvelle clôture,
                            avec le même numéro.
                        </p>
                    )}
                </div>
            }
            okText="Rouvrir"
            cancelText="Annuler"
            onConfirm={rouvrir}
        >
            <Button size="small" icon={<UndoOutlined />} loading={enCours}>
                Rouvrir
            </Button>
        </Popconfirm>
    );
}
