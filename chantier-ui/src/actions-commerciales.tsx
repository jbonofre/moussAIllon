import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Popconfirm, Segmented, Space, Table, Tag, Typography, message } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, ReloadOutlined, ScheduleOutlined } from '@ant-design/icons';
import { fetchWithAuth } from './api.ts';
import { paginationConfig } from './pagination.ts';
import { useNavigation } from './navigation-context.tsx';
import {
    Echeance, EcheanceTag, Interaction, StatutClientTag, TypeInteractionTag, echeance, formatDateHeure, utilisateurConnecte,
} from './crm.tsx';
import { InteractionModal, TerminerActionModal } from './InteractionModal.tsx';

const { Text, Title } = Typography;

type Perimetre = 'MES_ACTIONS' | 'TOUTES';

/** Actions commerciales à faire (rappels, rendez-vous, envois d'offres...), de la plus en retard à la plus lointaine. */
export default function ActionsCommerciales() {
    const { navigate } = useNavigation();
    const utilisateur = utilisateurConnecte();
    const [perimetre, setPerimetre] = useState<Perimetre>(utilisateur ? 'MES_ACTIONS' : 'TOUTES');
    const [actions, setActions] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(false);
    // Saisie d'une nouvelle action (sans interaction) ou modification
    const [saisie, setSaisie] = useState<{ interaction?: Interaction } | null>(null);
    const [aTerminer, setATerminer] = useState<Interaction | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        const url = perimetre === 'MES_ACTIONS' && utilisateur
            ? `./interactions/a-faire?utilisateur=${encodeURIComponent(utilisateur)}`
            : './interactions/a-faire';
        fetchWithAuth(url)
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then((data) => setActions(Array.isArray(data) ? data : []))
            .catch((e) => message.error('Erreur lors du chargement des actions commerciales : ' + e.message))
            .finally(() => setLoading(false));
    }, [perimetre, utilisateur]);

    useEffect(() => { load(); }, [load]);

    const parEcheance = useMemo(() => {
        const compte: Record<Echeance, number> = { EN_RETARD: 0, AUJOURD_HUI: 0, A_VENIR: 0 };
        actions.forEach((a) => { compte[echeance(a.date)] += 1; });
        return compte;
    }, [actions]);

    const supprimer = async (action: Interaction) => {
        try {
            const r = await fetchWithAuth(`./interactions/${action.id}`, { method: 'DELETE' });
            if (!r.ok) throw new Error((await r.text()) || 'Erreur ' + r.status);
            message.success('Action supprimée');
            load();
        } catch (e: any) {
            message.error('Erreur lors de la suppression : ' + e.message);
        }
    };

    const colonnes = [
        {
            title: 'Échéance',
            key: 'date',
            filters: [
                { text: 'En retard', value: 'EN_RETARD' },
                { text: "Aujourd'hui", value: 'AUJOURD_HUI' },
                { text: 'À venir', value: 'A_VENIR' },
            ],
            onFilter: (value: any, a: Interaction) => echeance(a.date) === value,
            render: (_: unknown, a: Interaction) => (
                <Space orientation="vertical" size={0}>
                    <span>{formatDateHeure(a.date)}</span>
                    <EcheanceTag date={a.date} />
                </Space>
            ),
        },
        {
            title: 'Client',
            key: 'client',
            render: (_: unknown, a: Interaction) => (
                <Space orientation="vertical" size={0}>
                    <a onClick={() => navigate('/clients', { ouvrirClientId: a.clientId })}>{a.clientNom}</a>
                    <StatutClientTag statut={a.clientStatut} />
                </Space>
            ),
        },
        {
            title: 'Contact',
            key: 'contact',
            render: (_: unknown, a: Interaction) => (
                <Space orientation="vertical" size={0}>
                    {a.clientTelephone && <a href={`tel:${a.clientTelephone}`}>{a.clientTelephone}</a>}
                    {a.clientEmail && <a href={`mailto:${a.clientEmail}`}>{a.clientEmail}</a>}
                    {!a.clientTelephone && !a.clientEmail && <Text type="secondary">—</Text>}
                </Space>
            ),
        },
        { title: 'Type', key: 'type', render: (_: unknown, a: Interaction) => <TypeInteractionTag type={a.type} /> },
        {
            title: 'Action',
            key: 'sujet',
            render: (_: unknown, a: Interaction) => (
                <Space orientation="vertical" size={0}>
                    <span>{a.sujet}</span>
                    {a.compteRendu && <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-line' }}>{a.compteRendu}</Text>}
                </Space>
            ),
        },
        { title: 'Responsable', dataIndex: 'utilisateur', key: 'utilisateur', render: (u?: string) => u || '—' },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, a: Interaction) => (
                <Space>
                    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => setATerminer(a)}>Fait</Button>
                    <Button size="small" title="Modifier" icon={<EditOutlined />} onClick={() => setSaisie({ interaction: a })} />
                    <Popconfirm title="Supprimer cette action ?" onConfirm={() => supprimer(a)} okText="Supprimer" cancelText="Annuler">
                        <Button size="small" title="Supprimer" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Title level={3}>Actions commerciales</Title>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                {parEcheance.EN_RETARD > 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        title={parEcheance.EN_RETARD > 1 ? `${parEcheance.EN_RETARD} actions en retard` : '1 action en retard'}
                        description="Faites-les ou reportez leur échéance."
                    />
                )}
                <Card
                    title={(
                        <Space wrap>
                            <span>À faire ({actions.length})</span>
                            <Tag color="red">En retard : {parEcheance.EN_RETARD}</Tag>
                            <Tag color="orange">Aujourd'hui : {parEcheance.AUJOURD_HUI}</Tag>
                            <Tag color="blue">À venir : {parEcheance.A_VENIR}</Tag>
                        </Space>
                    )}
                    extra={(
                        <Space>
                            {utilisateur && (
                                <Segmented
                                    value={perimetre}
                                    onChange={(v) => setPerimetre(v as Perimetre)}
                                    options={[{ label: 'Mes actions', value: 'MES_ACTIONS' }, { label: 'Toutes', value: 'TOUTES' }]}
                                />
                            )}
                            <Button type="primary" icon={<ScheduleOutlined />} onClick={() => setSaisie({})}>Planifier une action</Button>
                            <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
                        </Space>
                    )}
                >
                    <Table
                        rowKey="id"
                        size="small"
                        loading={loading}
                        dataSource={actions}
                        columns={colonnes}
                        pagination={paginationConfig(50)}
                        locale={{ emptyText: <Empty description="Aucune action commerciale à faire" /> }}
                    />
                </Card>
            </Space>
            <InteractionModal
                open={!!saisie}
                statut="A_FAIRE"
                interaction={saisie?.interaction}
                clientId={saisie?.interaction?.clientId}
                onClose={() => setSaisie(null)}
                onSaved={() => { setSaisie(null); load(); }}
            />
            <TerminerActionModal
                action={aTerminer}
                onClose={() => setATerminer(null)}
                onDone={() => { setATerminer(null); load(); }}
            />
        </div>
    );
}
