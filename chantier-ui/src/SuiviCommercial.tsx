import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, Popconfirm, Space, Table, Typography, message } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, MessageOutlined, ReloadOutlined, ScheduleOutlined } from '@ant-design/icons';
import { fetchWithAuth } from './api.ts';
import { EcheanceTag, Interaction, StatutInteraction, TypeInteractionTag, formatDateHeure } from './crm.tsx';
import { InteractionModal, TerminerActionModal } from './InteractionModal.tsx';

const { Text } = Typography;

/** Suivi commercial d'un client (onglet de sa fiche) : actions à faire et échanges. */
export default function SuiviCommercial({ clientId }: { clientId: number }) {
    const [suivi, setSuivi] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(false);
    // Saisie : nouvel échange ou nouvelle action (statut), ou modification (interaction)
    const [saisie, setSaisie] = useState<{ statut: StatutInteraction; interaction?: Interaction } | null>(null);
    const [aTerminer, setATerminer] = useState<Interaction | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        fetchWithAuth(`./interactions?clientId=${clientId}`)
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then((data) => setSuivi(Array.isArray(data) ? data : []))
            .catch((e) => message.error('Erreur lors du chargement du suivi commercial : ' + e.message))
            .finally(() => setLoading(false));
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    const supprimer = async (interaction: Interaction) => {
        try {
            const r = await fetchWithAuth(`./interactions/${interaction.id}`, { method: 'DELETE' });
            if (!r.ok) throw new Error((await r.text()) || 'Erreur ' + r.status);
            message.success('Supprimé');
            load();
        } catch (e: any) {
            message.error('Erreur lors de la suppression : ' + e.message);
        }
    };

    const boutonsEdition = (i: Interaction) => (
        <>
            <Button size="small" title="Modifier" icon={<EditOutlined />} onClick={() => setSaisie({ statut: i.statut, interaction: i })} />
            <Popconfirm title="Supprimer ?" onConfirm={() => supprimer(i)} okText="Supprimer" cancelText="Annuler">
                <Button size="small" title="Supprimer" danger icon={<DeleteOutlined />} />
            </Popconfirm>
        </>
    );

    const aFaire = suivi.filter((i) => i.statut === 'A_FAIRE');
    const echanges = suivi.filter((i) => i.statut === 'FAITE');

    return (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
                <Button icon={<MessageOutlined />} onClick={() => setSaisie({ statut: 'FAITE' })}>Noter un échange</Button>
                <Button icon={<ScheduleOutlined />} onClick={() => setSaisie({ statut: 'A_FAIRE' })}>Planifier une action</Button>
                <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
            </Space>
            <Card size="small" title={`Actions à faire (${aFaire.length})`}>
                <Table
                    rowKey="id"
                    size="small"
                    loading={loading}
                    dataSource={aFaire}
                    pagination={false}
                    locale={{ emptyText: <Empty description="Aucune action prévue" /> }}
                    columns={[
                        {
                            title: 'Échéance',
                            key: 'date',
                            render: (_: unknown, i: Interaction) => (
                                <Space orientation="vertical" size={0}>
                                    <span>{formatDateHeure(i.date)}</span>
                                    <EcheanceTag date={i.date} />
                                </Space>
                            ),
                        },
                        { title: 'Type', key: 'type', render: (_: unknown, i: Interaction) => <TypeInteractionTag type={i.type} /> },
                        {
                            title: 'Action',
                            key: 'sujet',
                            render: (_: unknown, i: Interaction) => (
                                <Space orientation="vertical" size={0}>
                                    <span>{i.sujet}</span>
                                    {i.compteRendu && <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-line' }}>{i.compteRendu}</Text>}
                                </Space>
                            ),
                        },
                        { title: 'Responsable', dataIndex: 'utilisateur', key: 'utilisateur', render: (u?: string) => u || '—' },
                        {
                            title: 'Actions',
                            key: 'actions',
                            render: (_: unknown, i: Interaction) => (
                                <Space>
                                    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => setATerminer(i)}>Fait</Button>
                                    {boutonsEdition(i)}
                                </Space>
                            ),
                        },
                    ]}
                />
            </Card>
            <Card size="small" title={`Échanges (${echanges.length})`}>
                <Table
                    rowKey="id"
                    size="small"
                    loading={loading}
                    dataSource={echanges}
                    pagination={{ pageSize: 10, hideOnSinglePage: true }}
                    locale={{ emptyText: <Empty description="Aucun échange noté" /> }}
                    columns={[
                        { title: 'Date', key: 'date', render: (_: unknown, i: Interaction) => formatDateHeure(i.dateRealisation ?? i.date) },
                        { title: 'Type', key: 'type', render: (_: unknown, i: Interaction) => <TypeInteractionTag type={i.type} /> },
                        {
                            title: 'Sujet',
                            key: 'sujet',
                            render: (_: unknown, i: Interaction) => (
                                <Space orientation="vertical" size={0}>
                                    <span>{i.sujet}</span>
                                    {i.compteRendu && <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-line' }}>{i.compteRendu}</Text>}
                                </Space>
                            ),
                        },
                        { title: 'Par', dataIndex: 'utilisateur', key: 'utilisateur', render: (u?: string) => u || '—' },
                        { title: 'Actions', key: 'actions', render: (_: unknown, i: Interaction) => <Space>{boutonsEdition(i)}</Space> },
                    ]}
                />
            </Card>
            <InteractionModal
                open={!!saisie}
                statut={saisie?.statut}
                interaction={saisie?.interaction}
                clientId={clientId}
                onClose={() => setSaisie(null)}
                onSaved={() => { setSaisie(null); load(); }}
            />
            <TerminerActionModal
                action={aTerminer}
                onClose={() => setATerminer(null)}
                onDone={() => { setATerminer(null); load(); }}
            />
        </Space>
    );
}
