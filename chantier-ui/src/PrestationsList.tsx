import React, { useCallback, useEffect, useState } from 'react';
import { Table, Tag, Spin, Button, message } from 'antd';
import { EyeOutlined, PlusCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import api from './api.ts';
import { useNavigation } from './navigation-context.tsx';
import PretRecuperationTag from './PretRecuperationTag.tsx';
import { paginationConfig } from './pagination.ts';
import ProgressionVente from './ProgressionVente.tsx';

interface Vente {
    id: number;
    reference?: string;
    dateDevis?: string;
    status: string;
    datePretRecuperation?: string | null;
    montantTTC: number;
    venteForfaits?: Array<{ taches?: Array<{ done?: boolean; nonFait?: boolean }> }>;
    venteServices?: Array<{ taches?: Array<{ done?: boolean; nonFait?: boolean }> }>;
    client?: { id: number; nom?: string };
}

interface PrestationsListProps {
    clientId?: number;
    bateauId?: number;
    moteurId?: number;
    remorqueId?: number;
}

const statusColor: Record<string, string> = {
    DEVIS: 'default',
    FACTURE_EN_ATTENTE: 'orange',
    FACTURE_PRETE: 'blue',
    FACTURE_PAYEE: 'green',
};

const statusLabel: Record<string, string> = {
    DEVIS: 'Devis / OR',
    FACTURE_EN_ATTENTE: 'En cours',
    FACTURE_PRETE: 'Terminé',
    FACTURE_PAYEE: 'Payé',
};

export default function PrestationsList({ clientId, bateauId, moteurId, remorqueId }: PrestationsListProps) {
    const [ventes, setVentes] = useState<Vente[]>([]);
    const [loading, setLoading] = useState(false);
    const { navigate } = useNavigation();

    const load = useCallback(() => {
        if (!clientId && !bateauId && !moteurId && !remorqueId) return;
        const params = new URLSearchParams();
        if (clientId) params.append('clientId', String(clientId));
        if (bateauId) params.append('bateauId', String(bateauId));
        if (moteurId) params.append('moteurId', String(moteurId));
        if (remorqueId) params.append('remorqueId', String(remorqueId));
        setLoading(true);
        api.get(`/ventes/search?${params.toString()}`)
            .then((res) => setVentes(res.data || []))
            .catch(() => message.error('Erreur lors du chargement des prestations'))
            .finally(() => setLoading(false));
    }, [clientId, bateauId, moteurId, remorqueId]);

    useEffect(() => { load(); }, [load]);

    const creerPrestation = async () => {
        let client = clientId;
        if (!client && bateauId) {
            try {
                const res = await api.get(`/bateaux/${bateauId}`);
                client = res.data?.proprietaires?.[0]?.id;
            } catch { /* on ouvre quand même la prestation */ }
        }
        navigate('/prestations', { clientId: client, bateauId });
    };

    const columns = [
        {
            title: 'Référence',
            dataIndex: 'reference',
            key: 'reference',
            render: (v: string) => v || '-',
        },
        {
            title: 'Date',
            dataIndex: 'dateDevis',
            key: 'dateDevis',
            render: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '-',
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            key: 'status',
            render: (s: string, record: Vente) => (
                <>
                    <Tag color={statusColor[s] || 'default'}>{statusLabel[s] || s}</Tag>
                    {s === 'FACTURE_EN_ATTENTE' && <ProgressionVente vente={record} width={120} />}
                </>
            ),
        },
        {
            title: 'Retrait',
            key: 'pretRecuperation',
            render: (_: unknown, record: Vente) => (
                <PretRecuperationTag datePret={record.datePretRecuperation} basePath="/ventes" id={record.id} onChange={load} />
            ),
        },
        {
            title: 'Montant TTC',
            dataIndex: 'montantTTC',
            key: 'montantTTC',
            align: 'right' as const,
            render: (v: number) =>
                v != null
                    ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                    : '-',
        },
        {
            title: '',
            key: 'actions',
            width: 60,
            render: (_: unknown, record: Vente) => (
                <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => navigate('/prestations', { clientId: record.client?.id })}
                    title="Voir les prestations"
                />
            ),
        },
    ];

    return (
        <div>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button size="small" title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
                <Button
                    type="primary"
                    size="small"
                    icon={<PlusCircleOutlined />}
                    onClick={creerPrestation}
                >
                    Créer une prestation
                </Button>
            </div>
            <Spin spinning={loading}>
                <Table
                    rowKey="id"
                    dataSource={ventes}
                    columns={columns}
                    size="small"
                    pagination={ventes.length > 10 ? paginationConfig(10) : false}
                    locale={{ emptyText: 'Aucune prestation' }}
                />
            </Spin>
        </div>
    );
}
