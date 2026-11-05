import React from 'react';
import { Table, Tag, Typography } from 'antd';
import { paginationConfig } from './pagination.ts';

const { Text } = Typography;

export type TypeMouvement = 'VENTE' | 'AJUSTEMENT_MANUEL' | 'RECEPTION' | 'INVENTAIRE';

export type MotifAjustement = 'CASSE' | 'PERTE' | 'USAGE_INTERNE' | 'CORRECTION' | 'RETOUR_FOURNISSEUR' | 'AUTRE';

export type Mouvement = {
    id: number;
    type: TypeMouvement;
    quantite: number;
    stockApres: number;
    prixUnitaireHT?: number;
    venteId?: number;
    commandeFournisseurId?: number;
    commandeFournisseurReference?: string;
    inventaireId?: number;
    inventaireReference?: string;
    motif?: MotifAjustement | null;
    commentaire?: string | null;
    utilisateur?: string | null;
    date?: string;
};

const TYPE_LABEL: Record<TypeMouvement, string> = {
    VENTE: 'Vente',
    AJUSTEMENT_MANUEL: 'Ajustement manuel',
    RECEPTION: 'Réception',
    INVENTAIRE: 'Inventaire',
};

const TYPE_COULEUR: Record<TypeMouvement, string> = {
    VENTE: 'blue',
    AJUSTEMENT_MANUEL: 'orange',
    RECEPTION: 'green',
    INVENTAIRE: 'purple',
};

export const MOTIF_LABEL: Record<MotifAjustement, string> = {
    CASSE: 'Casse',
    PERTE: 'Perte / vol',
    USAGE_INTERNE: 'Usage interne',
    CORRECTION: 'Correction',
    RETOUR_FOURNISSEUR: 'Retour fournisseur',
    AUTRE: 'Autre',
};

// Origine du mouvement : la vente, la commande fournisseur ou l'inventaire, sinon le motif de l'ajustement
const origine = (mouvement: Mouvement) => {
    if (mouvement.venteId) return `Vente #${mouvement.venteId}`;
    if (mouvement.commandeFournisseurId) return `Commande ${mouvement.commandeFournisseurReference || '#' + mouvement.commandeFournisseurId}`;
    if (mouvement.inventaireId) return `Inventaire ${mouvement.inventaireReference || '#' + mouvement.inventaireId}`;
    if (mouvement.motif) return MOTIF_LABEL[mouvement.motif] || mouvement.motif;
    return '-';
};

// Historique des mouvements de stock d'un article, du plus récent au plus ancien
const MouvementsStock = ({ mouvements, loading }: { mouvements: Mouvement[]; loading?: boolean }) => {
    const columns = [
        {
            title: 'Date',
            dataIndex: 'date',
            render: (value?: string) => (value ? new Date(value).toLocaleString('fr-FR') : '-'),
            sorter: (a: Mouvement, b: Mouvement) => (a.date || '').localeCompare(b.date || ''),
            defaultSortOrder: 'descend' as const,
        },
        {
            title: 'Type',
            dataIndex: 'type',
            render: (value: TypeMouvement) => <Tag color={TYPE_COULEUR[value]}>{TYPE_LABEL[value] || value}</Tag>,
        },
        {
            title: 'Quantité',
            dataIndex: 'quantite',
            render: (value: number, mouvement: Mouvement) => {
                // Une vente sort la quantité du stock : elle est affichée en négatif
                const variation = mouvement.type === 'VENTE' ? -value : value;
                return variation > 0 ? `+${variation}` : variation;
            },
        },
        {
            title: 'Stock après',
            dataIndex: 'stockApres',
        },
        {
            title: 'Coût unitaire HT',
            dataIndex: 'prixUnitaireHT',
            render: (value?: number) => (value != null ? `${value.toFixed(2)} €` : '-'),
        },
        {
            title: 'Origine',
            key: 'origine',
            render: (_: unknown, mouvement: Mouvement) => (
                <>
                    <div>{origine(mouvement)}</div>
                    {mouvement.commentaire && <Text type="secondary" style={{ fontSize: 12 }}>{mouvement.commentaire}</Text>}
                </>
            ),
        },
        {
            title: 'Par',
            dataIndex: 'utilisateur',
            render: (value?: string | null) => value || '-',
        },
    ];

    return (
        <Table
            rowKey="id"
            columns={columns}
            dataSource={mouvements}
            loading={loading}
            bordered
            size="small"
            pagination={paginationConfig()}
        />
    );
};

export default MouvementsStock;
