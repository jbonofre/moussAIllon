import React from 'react';
import { Popconfirm, Tag, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import api from './api.ts';

interface PretRecuperationTagProps {
    /** Date à laquelle le matériel est devenu prêt ; rien n'est affiché si elle est absente */
    datePret?: string | null;
    /** Chemin de la ressource, ex. "/bateaux" ; l'annulation appelle POST {basePath}/{id}/recupere */
    basePath: string;
    id?: number;
    /** Appelé après l'annulation pour recharger la liste */
    onChange?: () => void;
}

/**
 * Pastille « Prêt à récupérer » : indique que les travaux sont terminés. Un clic permet d'annuler le signal
 * lorsque le client est venu récupérer son matériel.
 */
export default function PretRecuperationTag({ datePret, basePath, id, onChange }: PretRecuperationTagProps) {
    if (!datePret || id === undefined) {
        return null;
    }
    const depuis = new Date(datePret).toLocaleDateString('fr-FR');
    const annuler = async () => {
        try {
            await api.post(`${basePath}/${id}/recupere`);
            message.success('Récupération enregistrée');
            onChange?.();
        } catch {
            message.error("Erreur lors de l'annulation");
        }
    };
    return (
        <Popconfirm
            title="Le client est venu récupérer son matériel ?"
            description="Le signal « Prêt à récupérer » sera retiré."
            okText="Oui"
            cancelText="Non"
            onConfirm={(e) => { e?.stopPropagation(); return annuler(); }}
            onCancel={(e) => e?.stopPropagation()}
        >
            <Tag
                color="orange"
                icon={<CheckCircleOutlined />}
                style={{ cursor: 'pointer' }}
                title={`Prêt depuis le ${depuis} — cliquer quand le client est venu le récupérer`}
                onClick={(e) => e.stopPropagation()}
            >
                Prêt à récupérer
            </Tag>
        </Popconfirm>
    );
}
