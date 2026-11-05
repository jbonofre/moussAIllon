import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Modal, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import { PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { fetchWithAuth } from './api.ts';
import { paginationConfig } from './pagination.ts';
import { useNavigation } from './navigation-context.tsx';
import { formatDate, formatEuro } from './kpis-commun.tsx';
import SuspensionRelancesModal from './SuspensionRelancesModal.tsx';

const { Text, Title } = Typography;

interface Relance {
    venteId: number;
    // Relance d'un devis/OR en attente de signature, sinon relance de paiement d'une facture
    devis: boolean;
    ordreDeReparation: boolean;
    numero: string;
    clientId: number;
    client: string;
    email: string;
    // Échéance de la facture (ou sa date d'émission à défaut), ou date du devis
    dateDepart: string;
    joursEcoules: number;
    niveau: number;
    // Solde dû de la facture, ou montant TTC du devis
    montant: number;
}

interface VenteSuspendue {
    venteId: number;
    devis: boolean;
    ordreDeReparation: boolean;
    numero: string;
    client?: string;
    depuis: string;
    jusquau?: string | null;
    motif?: string | null;
}

interface ClientSuspendu {
    clientId: number;
    client: string;
    motif?: string | null;
}

interface Journal {
    relancesAutomatiques: boolean;
    relances: Relance[];
    ventesSuspendues: VenteSuspendue[];
    clientsSuspendus: ClientSuspendu[];
}

// Couleur du tag de la relance (1 à 3)
const RELANCE_COULEURS: Record<number, string> = { 1: 'gold', 2: 'orange', 3: 'red' };

const typeVente = (v: { devis: boolean; ordreDeReparation: boolean }) =>
    v.devis ? <Tag color="blue">{v.ordreDeReparation ? 'OR' : 'Devis'}</Tag> : <Tag color="purple">Paiement</Tag>;

export default function Relances() {
    const { navigate } = useNavigation();
    const [journal, setJournal] = useState<Journal | null>(null);
    const [loading, setLoading] = useState(false);
    // Relances décochées : elles restent dans le journal sans être envoyées
    const [decochees, setDecochees] = useState<Set<number>>(new Set());
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const [aIgnorer, setAIgnorer] = useState<Relance | null>(null);
    const [motifIgnore, setMotifIgnore] = useState('');
    const [aSuspendre, setASuspendre] = useState<Relance | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        fetchWithAuth('./relances')
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setJournal)
            .catch((e) => message.error('Erreur lors du chargement des relances : ' + e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const relances = useMemo(() => journal?.relances ?? [], [journal]);
    const selection = relances.filter((r) => !decochees.has(r.venteId)).map((r) => r.venteId);

    const requete = async (url: string, method: string, corps?: object) => {
        const r = await fetchWithAuth(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: corps ? JSON.stringify(corps) : undefined,
        });
        if (!r.ok) throw new Error((await r.text()) || 'Erreur ' + r.status);
        return r;
    };

    const envoyer = async () => {
        setEnvoiEnCours(true);
        try {
            const resultat = await (await requete('./relances/envoyer', 'POST', { ventes: selection })).json();
            if (resultat.envoyees > 0) {
                message.success(resultat.envoyees > 1 ? `${resultat.envoyees} relances envoyées` : '1 relance envoyée');
            }
            if (resultat.erreurs?.length) {
                Modal.error({
                    title: "Certaines relances n'ont pas pu être envoyées",
                    content: <ul>{resultat.erreurs.map((e: string) => <li key={e}>{e}</li>)}</ul>,
                });
            }
        } catch (e: any) {
            message.error("Erreur lors de l'envoi des relances : " + e.message);
        } finally {
            setEnvoiEnCours(false);
            load();
        }
    };

    const ignorer = async () => {
        if (!aIgnorer) return;
        try {
            await requete(`./relances/${aIgnorer.venteId}/ignorer`, 'POST', { motif: motifIgnore });
            message.success(`Relance ${aIgnorer.niveau} de ${aIgnorer.numero} ignorée`);
            setAIgnorer(null);
            load();
        } catch (e: any) {
            message.error("Erreur lors de l'abandon de la relance : " + e.message);
        }
    };

    const reprendre = async (url: string, libelle: string) => {
        try {
            await requete(url, 'DELETE');
            message.success(`Relances reprises pour ${libelle}`);
            load();
        } catch (e: any) {
            message.error('Erreur lors de la reprise des relances : ' + e.message);
        }
    };

    const lienVente = (venteId: number, numero: string) => (
        <a onClick={() => navigate('/prestations', { venteId })}>{numero}</a>
    );

    const colonnes = [
        { title: 'Type', key: 'type', render: (_: unknown, r: Relance) => typeVente(r) },
        { title: 'N°', dataIndex: 'numero', key: 'numero', render: (v: string, r: Relance) => lienVente(r.venteId, v) },
        { title: 'Client', dataIndex: 'client', key: 'client' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        {
            title: 'Depuis',
            key: 'dateDepart',
            render: (_: unknown, r: Relance) => (
                <Space orientation="vertical" size={0}>
                    <span>{r.devis ? 'Devis du ' : 'Échéance '}{formatDate(r.dateDepart)}</span>
                    <Text type="secondary" style={{ fontSize: 12 }}>{r.joursEcoules} jours</Text>
                </Space>
            ),
        },
        {
            title: 'Relance',
            dataIndex: 'niveau',
            key: 'niveau',
            render: (v: number) => <Tag color={RELANCE_COULEURS[v]}>Relance {v}</Tag>,
        },
        {
            title: 'Montant',
            key: 'montant',
            align: 'right' as const,
            render: (_: unknown, r: Relance) => (
                <Space orientation="vertical" size={0} style={{ alignItems: 'flex-end' }}>
                    <span>{formatEuro(r.montant)}</span>
                    <Text type="secondary" style={{ fontSize: 12 }}>{r.devis ? 'TTC' : 'solde dû'}</Text>
                </Space>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, r: Relance) => (
                <Space>
                    <Button size="small" icon={<StopOutlined />} onClick={() => { setMotifIgnore(''); setAIgnorer(r); }}>Ignorer</Button>
                    <Button size="small" icon={<PauseCircleOutlined />} onClick={() => setASuspendre(r)}>Suspendre</Button>
                </Space>
            ),
        },
    ];

    const ventesSuspendues = journal?.ventesSuspendues ?? [];
    const clientsSuspendus = journal?.clientsSuspendus ?? [];

    return (
        <div>
            <Title level={3}>Relances</Title>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                {journal && (journal.relancesAutomatiques ? (
                    <Alert
                        type="info"
                        showIcon
                        title="Envoi automatique activé"
                        description={'Les relances dues sont envoyées chaque matin à 8h (Paramétrage > Société). '
                            + 'Ignorez ou suspendez avant ce moment celles qui ne doivent pas partir.'}
                    />
                ) : (
                    <Alert
                        type="info"
                        showIcon
                        title="Relances à valider"
                        description={'Décochez les relances qui ne doivent pas partir aujourd\'hui, puis envoyez la sélection : '
                            + 'une relance décochée reste dans le journal. Pour l\'écarter, ignorez-la (la suivante reste prévue) '
                            + 'ou suspendez les relances de la vente ou du client.'}
                    />
                ))}
                <Card
                    title={`À envoyer (${relances.length})`}
                    extra={(
                        <Space>
                            <Popconfirm
                                title={selection.length > 1 ? `Envoyer ${selection.length} relances par email ?` : 'Envoyer 1 relance par email ?'}
                                onConfirm={envoyer}
                                okText="Envoyer"
                                cancelText="Annuler"
                                disabled={selection.length === 0}
                            >
                                <Button type="primary" icon={<SendOutlined />} loading={envoiEnCours} disabled={selection.length === 0}>
                                    Envoyer la sélection ({selection.length})
                                </Button>
                            </Popconfirm>
                            <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
                        </Space>
                    )}
                >
                    <Table
                        rowKey="venteId"
                        loading={loading}
                        dataSource={relances}
                        columns={colonnes}
                        pagination={paginationConfig(50)}
                        locale={{ emptyText: <Empty description="Aucune relance à envoyer aujourd'hui" /> }}
                        rowSelection={{
                            selectedRowKeys: selection,
                            onChange: (keys) => {
                                const cochees = new Set(keys as number[]);
                                setDecochees(new Set(relances.filter((r) => !cochees.has(r.venteId)).map((r) => r.venteId)));
                            },
                        }}
                        size="small"
                    />
                </Card>
                <Card title="Relances suspendues">
                    {ventesSuspendues.length === 0 && clientsSuspendus.length === 0 ? (
                        <Empty description="Aucune relance suspendue" />
                    ) : (
                        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                            {ventesSuspendues.length > 0 && (
                                <Table
                                    rowKey="venteId"
                                    dataSource={ventesSuspendues}
                                    pagination={false}
                                    size="small"
                                    columns={[
                                        { title: 'Type', key: 'type', render: (_: unknown, v: VenteSuspendue) => typeVente(v) },
                                        { title: 'N°', dataIndex: 'numero', key: 'numero', render: (n: string, v: VenteSuspendue) => lienVente(v.venteId, n) },
                                        { title: 'Client', dataIndex: 'client', key: 'client' },
                                        { title: 'Depuis le', dataIndex: 'depuis', key: 'depuis', render: formatDate },
                                        {
                                            title: "Jusqu'au",
                                            dataIndex: 'jusquau',
                                            key: 'jusquau',
                                            render: (v?: string | null) => (v ? formatDate(v) : <Text type="secondary">Jusqu'à la reprise</Text>),
                                        },
                                        { title: 'Motif', dataIndex: 'motif', key: 'motif', render: (v?: string | null) => v || '—' },
                                        {
                                            title: 'Actions',
                                            key: 'actions',
                                            render: (_: unknown, v: VenteSuspendue) => (
                                                <Button size="small" icon={<PlayCircleOutlined />}
                                                    onClick={() => reprendre(`./relances/ventes/${v.venteId}/suspension`, v.numero)}>
                                                    Reprendre
                                                </Button>
                                            ),
                                        },
                                    ]}
                                />
                            )}
                            {clientsSuspendus.length > 0 && (
                                <Table
                                    rowKey="clientId"
                                    dataSource={clientsSuspendus}
                                    pagination={false}
                                    size="small"
                                    columns={[
                                        { title: 'Client (toutes ses ventes)', dataIndex: 'client', key: 'client' },
                                        { title: 'Motif', dataIndex: 'motif', key: 'motif', render: (v?: string | null) => v || '—' },
                                        {
                                            title: 'Actions',
                                            key: 'actions',
                                            render: (_: unknown, c: ClientSuspendu) => (
                                                <Button size="small" icon={<PlayCircleOutlined />}
                                                    onClick={() => reprendre(`./relances/clients/${c.clientId}/suspension`, c.client)}>
                                                    Reprendre
                                                </Button>
                                            ),
                                        },
                                    ]}
                                />
                            )}
                        </Space>
                    )}
                </Card>
            </Space>

            <Modal
                title={aIgnorer ? `Ignorer la relance ${aIgnorer.niveau} de ${aIgnorer.numero}` : ''}
                open={!!aIgnorer}
                onOk={ignorer}
                okText="Ignorer"
                cancelText="Annuler"
                onCancel={() => setAIgnorer(null)}
                destroyOnHidden
            >
                <p>
                    Cette relance n'est pas envoyée et sort du journal. Elle est notée dans l'historique des relances de la
                    vente ; la relance suivante reste prévue.
                </p>
                <Input.TextArea
                    aria-label="Motif"
                    rows={3}
                    value={motifIgnore}
                    onChange={(e) => setMotifIgnore(e.target.value)}
                    placeholder="Motif (facultatif)"
                />
            </Modal>

            <SuspensionRelancesModal
                open={!!aSuspendre}
                venteId={aSuspendre?.venteId}
                numero={aSuspendre?.numero}
                client={aSuspendre ? { id: aSuspendre.clientId, nom: aSuspendre.client } : undefined}
                onClose={() => setASuspendre(null)}
                onSuspendu={() => { setASuspendre(null); load(); }}
            />
        </div>
    );
}
