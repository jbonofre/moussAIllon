import React, { useEffect, useState } from 'react';
import { Table, Tag, Spin, Button, message } from 'antd';
import { EyeOutlined, PlusCircleOutlined } from '@ant-design/icons';
import api from './api.ts';
import { useNavigation } from './navigation-context.tsx';

interface Vente {
    id: number;
    reference?: string;
    dateDevis?: string;
    status: string;
    montantTTC: number;
    client?: { id: number; prenom?: string; nom?: string };
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
    FACTURE_EN_ATTENTE: 'Facture en attente',
    FACTURE_PRETE: 'Facture prête',
    FACTURE_PAYEE: 'Facture payée',
};

export default function PrestationsList({ clientId, bateauId, moteurId, remorqueId }: PrestationsListProps) {
    const [ventes, setVentes] = useState<Vente[]>([]);
    const [loading, setLoading] = useState(false);
    const { navigate } = useNavigation();

    useEffect(() => {
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
            render: (s: string) => <Tag color={statusColor[s] || 'default'}>{statusLabel[s] || s}</Tag>,
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
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    type="primary"
                    size="small"
                    icon={<PlusCircleOutlined />}
                    onClick={() => navigate('/prestations', { clientId })}
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
                    pagination={{ pageSize: 5, hideOnSinglePage: true }}
                    locale={{ emptyText: 'Aucune prestation' }}
                />
            </Spin>
        </div>
    );
}
