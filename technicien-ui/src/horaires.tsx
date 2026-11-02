import React, { useState } from 'react';
import { Button, DatePicker, Modal, Typography, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from './api.ts';
import { messageErreur } from './reouverture.tsx';

export interface TacheHoraires {
    itemId?: number;
    itemType?: string;
    itemStatus?: string;
    venteType?: string;
    dateDebut?: string;
    dateFin?: string;
    dureeReelle?: number;
    dateCorrectionHoraires?: string;
    dateDebutOriginale?: string;
    dateFinOriginale?: string;
}

// Écart maximal entre début et fin, aligné sur le portail technicien
export const ECART_MAX_JOURS = 7;

// Le portail renvoie « 2026-10-30 08:00:00.0 » : le « T » évite l'ambiguïté du format selon le navigateur
const lireDate = (valeur?: string) => (valeur ? dayjs(valeur.replace(' ', 'T')) : undefined);

const formatHeure = (valeur?: string) => {
    const date = lireDate(valeur);
    return date && date.isValid() ? date.format('DD/MM/YYYY HH:mm') : '-';
};

/** Les horaires se corrigent sur une tâche démarrée, tant que sa vente n'est pas payée. */
export const peutCorrigerHoraires = (tache: TacheHoraires) =>
    tache.venteType !== 'FACTURE_PAYEE' && ['EN_COURS', 'TERMINEE', 'INCIDENT'].includes(tache.itemStatus || '');

/** Message d'erreur si les horaires saisis sont incohérents, sinon undefined. */
export const erreurHoraires = (debut?: dayjs.Dayjs | null, fin?: dayjs.Dayjs | null, maintenant = dayjs()): string | undefined => {
    if (!debut) return "L'heure de début est requise";
    if (debut.isAfter(maintenant) || (fin && fin.isAfter(maintenant))) return 'Les horaires ne peuvent pas être dans le futur';
    if (fin) {
        if (!fin.isAfter(debut)) return "L'heure de fin doit être postérieure à l'heure de début";
        if (fin.diff(debut, 'hour', true) > ECART_MAX_JOURS * 24) {
            return `L'écart entre le début et la fin ne peut pas dépasser ${ECART_MAX_JOURS} jours`;
        }
    }
    return undefined;
};

/** Phrase de traçabilité affichée sous le temps passé, vide si les horaires n'ont jamais été corrigés. */
export const libelleCorrection = (tache: TacheHoraires): string | undefined => {
    if (!tache.dateCorrectionHoraires) return undefined;
    return `Horaires corrigés le ${formatHeure(tache.dateCorrectionHoraires)} `
        + `(d'origine : ${formatHeure(tache.dateDebutOriginale)} → ${formatHeure(tache.dateFinOriginale)})`;
};

interface Props {
    tache: TacheHoraires;
    onCorriges: (tache: any) => void;
}

/**
 * Corrige l'heure de début et/ou de fin d'une tâche démarrée ou terminée en retard : la durée réelle est
 * recalculée par le portail et la correction est tracée (visible du bureau).
 */
export function BoutonCorrigerHoraires({ tache, onCorriges }: Props) {
    const [ouvert, setOuvert] = useState(false);
    const [debut, setDebut] = useState<dayjs.Dayjs | null>(null);
    const [fin, setFin] = useState<dayjs.Dayjs | null>(null);
    const [enCours, setEnCours] = useState(false);

    const ouvrir = () => {
        setDebut(lireDate(tache.dateDebut) ?? null);
        setFin(lireDate(tache.dateFin) ?? null);
        setOuvert(true);
    };

    const enregistrer = async () => {
        const erreur = erreurHoraires(debut, fin);
        if (erreur) {
            message.warning(erreur);
            return;
        }
        setEnCours(true);
        try {
            const type = tache.itemType === 'forfait' ? 'forfaits' : 'services';
            const res = await api.put(`/technicien-portal/${type}/${tache.itemId}`, {
                corrigerHoraires: true,
                dateDebut: debut!.format('YYYY-MM-DDTHH:mm:ss'),
                dateFin: fin ? fin.format('YYYY-MM-DDTHH:mm:ss') : undefined,
                dureeReelle: tache.dureeReelle || 0,
            });
            message.success('Horaires corrigés');
            setOuvert(false);
            onCorriges(res.data);
        } catch (e) {
            message.error(messageErreur(e, 'Erreur lors de la correction des horaires'));
        } finally {
            setEnCours(false);
        }
    };

    const correction = libelleCorrection(tache);

    return (
        <div style={{ marginBottom: 12 }}>
            <Button size="small" icon={<EditOutlined />} onClick={ouvrir}>
                Corriger les horaires
            </Button>
            {correction && (
                <Typography.Text type="warning" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                    {correction}
                </Typography.Text>
            )}
            <Modal
                open={ouvert}
                title="Corriger les horaires"
                okText="Enregistrer"
                cancelText="Annuler"
                confirmLoading={enCours}
                onOk={enregistrer}
                onCancel={() => setOuvert(false)}
                destroyOnHidden
            >
                <p style={{ marginTop: 0 }}>
                    Si vous avez oublié de démarrer ou de terminer la tâche, indiquez les heures réelles :
                    le temps passé est recalculé et la correction est signalée au bureau.
                </p>
                <div style={{ marginBottom: 12 }}>
                    <div>Début</div>
                    <DatePicker
                        showTime={{ format: 'HH:mm' }}
                        format="DD/MM/YYYY HH:mm"
                        value={debut}
                        onChange={setDebut}
                        disabledDate={(d) => d.isAfter(dayjs(), 'day')}
                        style={{ width: '100%' }}
                        data-testid="horaires-debut"
                    />
                </div>
                <div>
                    <div>Fin{tache.itemStatus === 'TERMINEE' ? '' : ' (laisser vide si la tâche est en cours)'}</div>
                    <DatePicker
                        showTime={{ format: 'HH:mm' }}
                        format="DD/MM/YYYY HH:mm"
                        value={fin}
                        onChange={setFin}
                        disabledDate={(d) => d.isAfter(dayjs(), 'day')}
                        style={{ width: '100%' }}
                        data-testid="horaires-fin"
                    />
                </div>
            </Modal>
        </div>
    );
}
