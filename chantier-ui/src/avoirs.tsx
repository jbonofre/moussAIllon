import React, { useCallback, useEffect, useState } from 'react';
import {
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Row,
    Select,
    Space,
    Table,
    Tag,
    message,
} from 'antd';
import {
    CheckOutlined,
    DeleteOutlined,
    EditOutlined,
    LinkOutlined,
    MailOutlined,
    MinusCircleOutlined,
    PlusCircleOutlined,
    RollbackOutlined,
    StopOutlined,
} from '@ant-design/icons';
import { fetchWithAuth } from './api.ts';

const { TextArea } = Input;

interface ClientRef {
    id: number;
    prenom?: string;
    nom: string;
    email?: string;
}

interface VenteRef {
    id: number;
    status?: string;
    montantTTC?: number;
    prixVenteTTC?: number;
}

interface AvoirLigne {
    id?: number;
    designation: string;
    quantite: number;
    prixUnitaireHT: number;
    tva: number;
    montantTVA: number;
    totalTTC: number;
}

interface AvoirEntity {
    id?: number;
    status?: string;
    client?: ClientRef;
    vente?: VenteRef;
    motif?: string;
    notes?: string;
    dateCreation?: string;
    dateEmission?: string;
    dateRemboursement?: string;
    montantHT?: number;
    tva?: number;
    montantTVA?: number;
    montantTTC?: number;
    montantUtilise?: number;
    modeRemboursement?: string;
    lignes?: AvoirLigne[];
}

const STATUS_LABEL: Record<string, string> = {
    BROUILLON: 'Brouillon',
    EMIS: 'Émis',
    REMBOURSE: 'Remboursé',
    ANNULE: 'Annulé',
};

const STATUS_COLOR: Record<string, string> = {
    BROUILLON: 'default',
    EMIS: 'blue',
    REMBOURSE: 'green',
    ANNULE: 'red',
};

const MODE_REMBOURSEMENT_OPTIONS = [
    { value: 'CHEQUE', label: 'Chèque' },
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'CARTE', label: 'Carte' },
    { value: 'ESPÈCES', label: 'Espèces' },
];

const TVA_OPTIONS = [
    { value: 0, label: '0%' },
    { value: 5.5, label: '5,5%' },
    { value: 10, label: '10%' },
    { value: 20, label: '20%' },
];

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR');
};

const formatEuro = (value?: number) => `${(value ?? 0).toFixed(2)} EUR`;

function computeLigneTotals(ligne: Partial<AvoirLigne>): Partial<AvoirLigne> {
    const prixUnitaireHT = ligne.prixUnitaireHT ?? 0;
    const quantite = ligne.quantite ?? 1;
    const tva = ligne.tva ?? 0;
    const totalHT = prixUnitaireHT * quantite;
    const montantTVA = Math.round(totalHT * (tva / 100) * 100) / 100;
    const totalTTC = Math.round((totalHT + montantTVA) * 100) / 100;
    return { ...ligne, montantTVA, totalTTC };
}

function computeAvoirTotals(lignes: AvoirLigne[], tauxTva: number): Pick<AvoirEntity, 'montantHT' | 'tva' | 'montantTVA' | 'montantTTC'> {
    const montantHT = lignes.reduce((sum, l) => sum + (l.prixUnitaireHT ?? 0) * (l.quantite ?? 1), 0);
    const montantTVA = lignes.reduce((sum, l) => sum + (l.montantTVA ?? 0), 0);
    const montantTTC = lignes.reduce((sum, l) => sum + (l.totalTTC ?? 0), 0);
    return {
        montantHT: Math.round(montantHT * 100) / 100,
        tva: tauxTva,
        montantTVA: Math.round(montantTVA * 100) / 100,
        montantTTC: Math.round(montantTTC * 100) / 100,
    };
}

const defaultLigne = (): AvoirLigne => ({
    designation: '',
    quantite: 1,
    prixUnitaireHT: 0,
    tva: 20,
    montantTVA: 0,
    totalTTC: 0,
});

export default function Avoirs() {
    const [avoirs, setAvoirs] = useState<AvoirEntity[]>([]);
    const [clients, setClients] = useState<ClientRef[]>([]);
    const [ventes, setVentes] = useState<VenteRef[]>([]);
    const [loading, setLoading] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingAvoir, setEditingAvoir] = useState<AvoirEntity | null>(null);
    const [formClientId, setFormClientId] = useState<number | null>(null);
    const [formVenteId, setFormVenteId] = useState<number | null>(null);
    const [formMotif, setFormMotif] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formModeRemboursement, setFormModeRemboursement] = useState<string | null>(null);
    const [formLignes, setFormLignes] = useState<AvoirLigne[]>([defaultLigne()]);
    const [saving, setSaving] = useState(false);

    const [filterClientId, setFilterClientId] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [clientSearchTimeout, setClientSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

    const mergeClientsById = (prev: ClientRef[], next: ClientRef[]): ClientRef[] => {
        const map = new Map<number, ClientRef>();
        prev.forEach((c) => { if (c?.id !== undefined) map.set(c.id, c); });
        next.forEach((c) => { if (c?.id !== undefined) map.set(c.id, c); });
        return Array.from(map.values());
    };

    const handleClientSearch = (value: string) => {
        if (clientSearchTimeout) clearTimeout(clientSearchTimeout);
        if (!value || value.trim() === '') return;
        const timeout = setTimeout(async () => {
            try {
                const res = await fetchWithAuth(`./clients/search?q=${encodeURIComponent(value)}`);
                const data = await res.json();
                setClients((prev) => mergeClientsById(prev, Array.isArray(data) ? data : []));
            } catch {
                // ignore
            }
        }, 300);
        setClientSearchTimeout(timeout);
    };

    // Modal "Appliquer un avoir à une facture"
    const [appliquerModalOpen, setAppliquerModalOpen] = useState(false);
    const [appliquerAvoir, setAppliquerAvoir] = useState<AvoirEntity | null>(null);
    const [appliquerVentes, setAppliquerVentes] = useState<VenteRef[]>([]);
    const [appliquerVenteId, setAppliquerVenteId] = useState<number | null>(null);
    const [appliquerMontant, setAppliquerMontant] = useState<number>(0);
    const [appliquerNotes, setAppliquerNotes] = useState('');
    const [applying, setApplying] = useState(false);

    const fetchAvoirs = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterClientId) params.set('clientId', String(filterClientId));
        if (filterStatus) params.set('status', filterStatus);
        const url = './avoirs/search?' + params.toString();
        fetchWithAuth(url)
            .then((res) => res.json())
            .then((data) => setAvoirs(Array.isArray(data) ? data : []))
            .catch(() => message.error('Erreur lors du chargement des avoirs'))
            .finally(() => setLoading(false));
    }, [filterClientId, filterStatus]);

    const fetchClients = useCallback(() => {
        fetchWithAuth('./clients')
            .then((res) => res.json())
            .then((data) => setClients(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    const fetchVentesForClient = useCallback((clientId: number) => {
        fetchWithAuth(`./ventes/search?clientId=${clientId}`)
            .then((res) => res.json())
            .then((data) => setVentes(Array.isArray(data) ? data : []))
            .catch(() => setVentes([]));
    }, []);

    useEffect(() => {
        fetchAvoirs();
    }, [fetchAvoirs]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const openCreate = () => {
        setEditingAvoir(null);
        setFormClientId(null);
        setFormVenteId(null);
        setFormMotif('');
        setFormNotes('');
        setFormModeRemboursement(null);
        setFormLignes([defaultLigne()]);
        setVentes([]);
        setModalOpen(true);
    };

    const openEdit = (avoir: AvoirEntity) => {
        setEditingAvoir(avoir);
        setFormClientId(avoir.client?.id ?? null);
        setFormVenteId(avoir.vente?.id ?? null);
        setFormMotif(avoir.motif ?? '');
        setFormNotes(avoir.notes ?? '');
        setFormModeRemboursement(avoir.modeRemboursement ?? null);
        setFormLignes(avoir.lignes && avoir.lignes.length > 0 ? [...avoir.lignes] : [defaultLigne()]);
        if (avoir.client?.id) fetchVentesForClient(avoir.client.id);
        setModalOpen(true);
    };

    const handleClientChange = (clientId: number) => {
        setFormClientId(clientId);
        setFormVenteId(null);
        fetchVentesForClient(clientId);
    };

    const updateLigne = (index: number, field: keyof AvoirLigne, value: number | string) => {
        setFormLignes((prev) => {
            const updated = [...prev];
            const ligne = { ...updated[index], [field]: value };
            updated[index] = computeLigneTotals(ligne) as AvoirLigne;
            return updated;
        });
    };

    const addLigne = () => setFormLignes((prev) => [...prev, defaultLigne()]);

    const removeLigne = (index: number) =>
        setFormLignes((prev) => prev.filter((_, i) => i !== index));

    const handleSave = async () => {
        if (!formClientId) { message.warning('Veuillez sélectionner un client'); return; }
        if (!formMotif.trim()) { message.warning('Le motif est requis'); return; }
        if (formLignes.length === 0) { message.warning('Au moins une ligne est requise'); return; }
        for (const l of formLignes) {
            if (!l.designation.trim()) { message.warning('Toutes les lignes doivent avoir une désignation'); return; }
        }

        const tauxTva = formLignes[0]?.tva ?? 20;
        const totals = computeAvoirTotals(formLignes, tauxTva);

        const payload: AvoirEntity = {
            client: { id: formClientId } as ClientRef,
            vente: formVenteId ? { id: formVenteId } as VenteRef : undefined,
            motif: formMotif,
            notes: formNotes,
            modeRemboursement: formModeRemboursement ?? undefined,
            lignes: formLignes,
            ...totals,
        };

        setSaving(true);
        try {
            if (editingAvoir?.id) {
                await fetchWithAuth(`./avoirs/${editingAvoir.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                message.success('Avoir mis à jour');
            } else {
                await fetchWithAuth('./avoirs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                message.success('Avoir créé');
            }
            setModalOpen(false);
            fetchAvoirs();
        } catch {
            message.error("Erreur lors de l'enregistrement de l'avoir");
        } finally {
            setSaving(false);
        }
    };

    const handleEmettre = async (id: number) => {
        try {
            await fetchWithAuth(`./avoirs/${id}/emettre`, { method: 'POST' });
            message.success('Avoir émis');
            fetchAvoirs();
        } catch {
            message.error("Erreur lors de l'émission de l'avoir");
        }
    };

    const handleRembourser = async (id: number) => {
        try {
            await fetchWithAuth(`./avoirs/${id}/rembourser`, { method: 'POST' });
            message.success('Avoir marqué comme remboursé');
            fetchAvoirs();
        } catch {
            message.error("Erreur lors du remboursement de l'avoir");
        }
    };

    const handleAnnuler = async (id: number) => {
        try {
            await fetchWithAuth(`./avoirs/${id}/annuler`, { method: 'POST' });
            message.success('Avoir annulé');
            fetchAvoirs();
        } catch {
            message.error("Erreur lors de l'annulation de l'avoir");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await fetchWithAuth(`./avoirs/${id}`, { method: 'DELETE' });
            message.success('Avoir supprimé');
            fetchAvoirs();
        } catch {
            message.error("Erreur lors de la suppression de l'avoir");
        }
    };

    const handleEmail = async (id: number) => {
        try {
            await fetchWithAuth(`./avoirs/${id}/email`, { method: 'POST' });
            message.success('Email envoyé');
        } catch {
            message.error("Erreur lors de l'envoi de l'email");
        }
    };

    const openAppliquerModal = async (avoir: AvoirEntity) => {
        setAppliquerAvoir(avoir);
        setAppliquerVenteId(null);
        setAppliquerNotes('');
        const restant = Math.round(((avoir.montantTTC ?? 0) - (avoir.montantUtilise ?? 0)) * 100) / 100;
        setAppliquerMontant(restant);
        // Charger les ventes FACTURE_PRETE du client
        try {
            const res = await fetchWithAuth(`./ventes/search?clientId=${avoir.client?.id}&status=FACTURE_PRETE`);
            const data = await res.json();
            setAppliquerVentes(Array.isArray(data) ? data : []);
        } catch {
            setAppliquerVentes([]);
        }
        setAppliquerModalOpen(true);
    };

    const handleAppliquer = async () => {
        if (!appliquerAvoir?.id || !appliquerVenteId) { message.warning('Veuillez sélectionner une facture'); return; }
        if (appliquerMontant <= 0) { message.warning('Le montant doit être supérieur à zéro'); return; }
        setApplying(true);
        try {
            const res = await fetchWithAuth(`./ventes/${appliquerVenteId}/paiements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'AVOIR',
                    montant: appliquerMontant,
                    notes: appliquerNotes || undefined,
                    avoirId: appliquerAvoir.id,
                }),
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(err);
            }
            message.success('Avoir appliqué à la facture');
            setAppliquerModalOpen(false);
            fetchAvoirs();
        } catch (err: unknown) {
            message.error((err as Error).message || "Erreur lors de l'application de l'avoir");
        } finally {
            setApplying(false);
        }
    };

    const totauxFormLignes = computeAvoirTotals(formLignes, formLignes[0]?.tva ?? 20);

    const filteredAvoirs = (() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return avoirs;
        return avoirs.filter((a) => {
            const clientLabel = a.client ? `${a.client.prenom ?? ''} ${a.client.nom ?? ''}`.toLowerCase() : '';
            const motif = (a.motif ?? '').toLowerCase();
            const idStr = a.id !== undefined ? `#${a.id}` : '';
            const venteStr = a.vente ? `#${a.vente.id}` : '';
            return (
                clientLabel.includes(q) ||
                motif.includes(q) ||
                idStr.includes(q) ||
                venteStr.includes(q)
            );
        });
    })();

    const clientFilters = Array.from(
        new Map(avoirs.filter((a) => a.client).map((a) => [a.client!.id, a.client!])).values()
    ).map((c) => ({ text: `${c.prenom ?? ''} ${c.nom}`.trim(), value: c.id }));

    const columns = [
        {
            title: '#',
            dataIndex: 'id',
            width: 60,
            sorter: (a: AvoirEntity, b: AvoirEntity) => (a.id || 0) - (b.id || 0),
            render: (v: number) => `#${v}`,
        },
        {
            title: 'Client',
            key: 'client',
            sorter: (a: AvoirEntity, b: AvoirEntity) => (a.client?.nom || '').localeCompare(b.client?.nom || ''),
            filters: clientFilters,
            filterSearch: true,
            onFilter: (value: unknown, r: AvoirEntity) => r.client?.id === value,
            render: (_: unknown, r: AvoirEntity) =>
                r.client ? `${r.client.prenom ?? ''} ${r.client.nom}`.trim() : '-',
        },
        {
            title: 'Facture liée',
            key: 'vente',
            width: 110,
            sorter: (a: AvoirEntity, b: AvoirEntity) => (a.vente?.id || 0) - (b.vente?.id || 0),
            render: (_: unknown, r: AvoirEntity) => r.vente ? `#${r.vente.id}` : '-',
        },
        {
            title: 'Motif',
            dataIndex: 'motif',
            ellipsis: true,
            sorter: (a: AvoirEntity, b: AvoirEntity) => (a.motif || '').localeCompare(b.motif || ''),
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            width: 120,
            sorter: (a: AvoirEntity, b: AvoirEntity) => (a.status || '').localeCompare(b.status || ''),
            filters: Object.entries(STATUS_LABEL).map(([k, v]) => ({ text: v, value: k })),
            onFilter: (value: unknown, r: AvoirEntity) => r.status === value,
            render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>,
        },
        {
            title: 'Montant TTC',
            dataIndex: 'montantTTC',
            width: 130,
            align: 'right' as const,
            sorter: (a: AvoirEntity, b: AvoirEntity) => (a.montantTTC || 0) - (b.montantTTC || 0),
            render: (v: number) => formatEuro(v),
        },
        {
            title: 'Solde restant',
            key: 'solde',
            width: 130,
            align: 'right' as const,
            sorter: (a: AvoirEntity, b: AvoirEntity) => ((a.montantTTC ?? 0) - (a.montantUtilise ?? 0)) - ((b.montantTTC ?? 0) - (b.montantUtilise ?? 0)),
            render: (_: unknown, r: AvoirEntity) => {
                const restant = Math.round(((r.montantTTC ?? 0) - (r.montantUtilise ?? 0)) * 100) / 100;
                const color = restant <= 0.005 ? '#8c8c8c' : restant < (r.montantTTC ?? 0) ? '#faad14' : undefined;
                return <span style={{ color }}>{formatEuro(restant)}</span>;
            },
        },
        {
            title: 'Date émission',
            dataIndex: 'dateEmission',
            width: 120,
            sorter: (a: AvoirEntity, b: AvoirEntity) => (a.dateEmission || '').localeCompare(b.dateEmission || ''),
            render: (v: string) => formatDate(v),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 280,
            render: (_: unknown, r: AvoirEntity) => (
                <Space size="small" wrap>
                    {r.status === 'BROUILLON' && (
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                            Modifier
                        </Button>
                    )}
                    {r.status === 'BROUILLON' && (
                        <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleEmettre(r.id!)}>
                            Émettre
                        </Button>
                    )}
                    {r.status === 'EMIS' && (
                        <Button size="small" icon={<RollbackOutlined />} onClick={() => handleRembourser(r.id!)}>
                            Rembourser
                        </Button>
                    )}
                    {r.status === 'EMIS' && (() => {
                        const restant = Math.round(((r.montantTTC ?? 0) - (r.montantUtilise ?? 0)) * 100) / 100;
                        return restant > 0.005 ? (
                            <Button size="small" icon={<LinkOutlined />} onClick={() => openAppliquerModal(r)}>
                                Appliquer
                            </Button>
                        ) : null;
                    })()}
                    {r.status === 'EMIS' && r.client?.email && (
                        <Button size="small" icon={<MailOutlined />} onClick={() => handleEmail(r.id!)}>
                            Email
                        </Button>
                    )}
                    {(r.status === 'BROUILLON' || r.status === 'EMIS') && (
                        <Popconfirm
                            title="Annuler cet avoir ?"
                            onConfirm={() => handleAnnuler(r.id!)}
                            okText="Confirmer"
                            cancelText="Non"
                        >
                            <Button size="small" icon={<StopOutlined />} danger>
                                Annuler
                            </Button>
                        </Popconfirm>
                    )}
                    {r.status === 'BROUILLON' && (
                        <Popconfirm
                            title="Supprimer définitivement cet avoir ?"
                            onConfirm={() => handleDelete(r.id!)}
                            okText="Supprimer"
                            cancelText="Non"
                        >
                            <Button size="small" icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const lignesColumns = [
        {
            title: 'Désignation',
            key: 'designation',
            render: (_: unknown, _r: AvoirLigne, index: number) => (
                <Input
                    value={formLignes[index].designation}
                    onChange={(e) => updateLigne(index, 'designation', e.target.value)}
                    placeholder="Désignation"
                />
            ),
        },
        {
            title: 'Qté',
            key: 'quantite',
            width: 80,
            render: (_: unknown, _r: AvoirLigne, index: number) => (
                <InputNumber
                    min={1}
                    value={formLignes[index].quantite}
                    onChange={(v) => updateLigne(index, 'quantite', v ?? 1)}
                    style={{ width: '100%' }}
                />
            ),
        },
        {
            title: 'P.U. HT',
            key: 'prixUnitaireHT',
            width: 110,
            render: (_: unknown, _r: AvoirLigne, index: number) => (
                <InputNumber
                    min={0}
                    precision={2}
                    value={formLignes[index].prixUnitaireHT}
                    onChange={(v) => updateLigne(index, 'prixUnitaireHT', v ?? 0)}
                    style={{ width: '100%' }}
                    addonAfter="€"
                />
            ),
        },
        {
            title: 'TVA',
            key: 'tva',
            width: 90,
            render: (_: unknown, _r: AvoirLigne, index: number) => (
                <Select
                    value={formLignes[index].tva}
                    onChange={(v) => updateLigne(index, 'tva', v)}
                    options={TVA_OPTIONS}
                    style={{ width: '100%' }}
                />
            ),
        },
        {
            title: 'Total TTC',
            key: 'totalTTC',
            width: 110,
            align: 'right' as const,
            render: (_: unknown, _r: AvoirLigne, index: number) =>
                formatEuro(formLignes[index].totalTTC),
        },
        {
            title: '',
            key: 'remove',
            width: 40,
            render: (_: unknown, _r: AvoirLigne, index: number) => (
                <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => removeLigne(index)}
                    disabled={formLignes.length <= 1}
                />
            ),
        },
    ];

    return (
        <Card title="Gestion des avoirs">
            <Space style={{ marginBottom: 16 }}>
                <Input.Search
                    placeholder="Recherche"
                    enterButton
                    allowClear
                    style={{ width: 600 }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onSearch={(value) => setSearchQuery(value)}
                />
                <Button type="primary" icon={<PlusCircleOutlined />} onClick={openCreate} />
            </Space>

            {/* Filtres */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                    <Select
                        allowClear
                        showSearch
                        placeholder="Filtrer par client"
                        style={{ width: '100%' }}
                        value={filterClientId ?? undefined}
                        onChange={(v) => setFilterClientId(v ?? null)}
                        filterOption={(input, opt) =>
                            (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={clients.map((c) => ({
                            value: c.id,
                            label: `${c.prenom ?? ''} ${c.nom}`.trim(),
                        }))}
                    />
                </Col>
                <Col span={6}>
                    <Select
                        allowClear
                        placeholder="Filtrer par statut"
                        style={{ width: '100%' }}
                        value={filterStatus ?? undefined}
                        onChange={(v) => setFilterStatus(v ?? null)}
                        options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
                    />
                </Col>
            </Row>

            <Table
                rowKey="id"
                loading={loading}
                dataSource={filteredAvoirs}
                columns={columns}
                pagination={{ pageSize: 15 }}
                bordered
                onRow={(record) => ({
                    onClick: (e) => {
                        if ((e.target as HTMLElement).closest('button, .ant-btn, [role="button"]')) return;
                        openEdit(record);
                    },
                    style: { cursor: 'pointer' },
                })}
            />

            {/* Modal création / édition */}
            <Modal
                title={editingAvoir ? `Modifier l'avoir #${editingAvoir.id}` : 'Nouvel avoir'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText={editingAvoir ? 'Enregistrer' : 'Créer'}
                confirmLoading={saving}
                width={860}
                destroyOnHidden
            >
                <Form layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Client" required>
                                <Select
                                    showSearch
                                    placeholder="Rechercher un client par prénom ou nom"
                                    value={formClientId ?? undefined}
                                    onChange={handleClientChange}
                                    filterOption={false}
                                    onSearch={handleClientSearch}
                                    notFoundContent={null}
                                    options={clients.map((c) => ({
                                        value: c.id,
                                        label: `${c.prenom ?? ''} ${c.nom}`.trim(),
                                    }))}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Facture liée (optionnel)">
                                <Select
                                    allowClear
                                    placeholder="Sélectionner une facture"
                                    value={formVenteId ?? undefined}
                                    onChange={(v) => setFormVenteId(v ?? null)}
                                    disabled={!formClientId}
                                    options={ventes.map((v) => ({
                                        value: v.id,
                                        label: `#${v.id} — ${v.status ?? ''} — ${formatEuro(v.prixVenteTTC ?? v.montantTTC)}`,
                                    }))}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Motif" required>
                        <Input
                            value={formMotif}
                            onChange={(e) => setFormMotif(e.target.value)}
                            placeholder="Motif de l'avoir"
                        />
                    </Form.Item>

                    <Form.Item label="Notes">
                        <TextArea
                            rows={2}
                            value={formNotes}
                            onChange={(e) => setFormNotes(e.target.value)}
                            placeholder="Notes internes"
                        />
                    </Form.Item>

                    <Form.Item label="Mode de remboursement">
                        <Select
                            allowClear
                            placeholder="Sélectionner un mode"
                            value={formModeRemboursement ?? undefined}
                            onChange={(v) => setFormModeRemboursement(v ?? null)}
                            options={MODE_REMBOURSEMENT_OPTIONS}
                            style={{ width: 200 }}
                        />
                    </Form.Item>

                    <Divider orientation="left">Lignes de l'avoir</Divider>

                    <Table
                        rowKey={(_, i) => String(i)}
                        dataSource={formLignes}
                        columns={lignesColumns}
                        pagination={false}
                        size="small"
                        bordered
                        style={{ marginBottom: 8 }}
                    />

                    <Button
                        type="dashed"
                        icon={<PlusCircleOutlined />}
                        onClick={addLigne}
                        style={{ marginBottom: 16 }}
                    >
                        Ajouter une ligne
                    </Button>

                    <Row justify="end">
                        <Col>
                            <Space direction="vertical" align="end">
                                <span>Montant HT : <strong>{formatEuro(totauxFormLignes.montantHT)}</strong></span>
                                <span>TVA : <strong>{formatEuro(totauxFormLignes.montantTVA)}</strong></span>
                                <span style={{ fontSize: 16 }}>
                                    Total TTC : <strong>{formatEuro(totauxFormLignes.montantTTC)}</strong>
                                </span>
                            </Space>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* Modal application d'un avoir à une facture */}
            <Modal
                title={appliquerAvoir ? `Appliquer l'avoir #${appliquerAvoir.id}` : 'Appliquer un avoir'}
                open={appliquerModalOpen}
                onCancel={() => setAppliquerModalOpen(false)}
                onOk={handleAppliquer}
                okText="Appliquer"
                confirmLoading={applying}
                destroyOnHidden
                width={500}
            >
                {appliquerAvoir && (
                    <Form layout="vertical">
                        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
                            <strong>Avoir #{appliquerAvoir.id}</strong> — {appliquerAvoir.motif}<br />
                            Solde disponible : <strong>{formatEuro(Math.round(((appliquerAvoir.montantTTC ?? 0) - (appliquerAvoir.montantUtilise ?? 0)) * 100) / 100)}</strong>
                        </div>

                        <Form.Item label="Facture à régler" required>
                            <Select
                                placeholder="Sélectionner une facture prête"
                                value={appliquerVenteId ?? undefined}
                                onChange={(v) => {
                                    setAppliquerVenteId(v);
                                    const vente = appliquerVentes.find((vt) => vt.id === v);
                                    if (vente) {
                                        const restantAvoir = Math.round(((appliquerAvoir.montantTTC ?? 0) - (appliquerAvoir.montantUtilise ?? 0)) * 100) / 100;
                                        const totalFacture = (vente as { prixVenteTTC?: number }).prixVenteTTC ?? 0;
                                        setAppliquerMontant(Math.min(restantAvoir, totalFacture));
                                    }
                                }}
                                notFoundContent="Aucune facture prête pour ce client"
                                options={appliquerVentes.map((v) => ({
                                    value: v.id,
                                    label: `Facture #${v.id} — ${formatEuro((v as { prixVenteTTC?: number }).prixVenteTTC ?? 0)}`,
                                }))}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>

                        <Form.Item label="Montant à imputer" required>
                            <InputNumber
                                min={0.01}
                                max={Math.round(((appliquerAvoir.montantTTC ?? 0) - (appliquerAvoir.montantUtilise ?? 0)) * 100) / 100}
                                precision={2}
                                value={appliquerMontant}
                                onChange={(v) => setAppliquerMontant(v ?? 0)}
                                addonAfter="€"
                                style={{ width: '100%' }}
                            />
                        </Form.Item>

                        <Form.Item label="Notes (optionnel)">
                            <Input
                                value={appliquerNotes}
                                onChange={(e) => setAppliquerNotes(e.target.value)}
                                placeholder="Ex: application partielle"
                            />
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </Card>
    );
}
