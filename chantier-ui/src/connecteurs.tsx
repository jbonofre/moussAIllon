import React, { useCallback, useEffect, useState } from 'react';
import MosaicTable from "./MosaicTable.tsx";
import { Alert, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Tabs, Tag, Typography, message } from 'antd';
import { BankOutlined, DeleteOutlined, EditOutlined, LinkOutlined, NotificationOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { fetchWithAuth } from './api.ts';
import { useNavigation } from './navigation-context.tsx';
import { paginationConfig } from './pagination.ts';
import PlateformesAnnonces from './PlateformesAnnonces.tsx';

export interface Connecteur {
    id?: number;
    nom: string;
    banque?: string;
    iban?: string;
    bic?: string;
    notes?: string;
    actif: boolean;
    fournisseur?: string;
    powensConfigure?: boolean;
    powensConnecte?: boolean;
    dernierRapprochement?: string;
    dernierNbRapproches?: number;
}

// Configuration des comptes bancaires ; le rapprochement se lance depuis Comptabilité > Rapprochement bancaire
export default function Connecteurs() {
    const [connecteurs, setConnecteurs] = useState<Connecteur[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Connecteur | null>(null);
    const [form] = Form.useForm();
    const [powensForm] = Form.useForm();
    const [powensTarget, setPowensTarget] = useState<Connecteur | null>(null);
    const { pageState, navigate } = useNavigation();
    // Les petites annonces renvoient directement sur l'onglet des plateformes
    const [onglet, setOnglet] = useState<string>(pageState?.onglet === 'annonces' ? 'annonces' : 'banques');

    const load = useCallback(() => {
        setLoading(true);
        fetchWithAuth('./connecteurs')
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setConnecteurs)
            .catch((e) => message.error('Erreur : ' + e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    // Retour de Powens : enregistrement de la connexion bancaire
    useEffect(() => {
        if (!pageState?.powensConnecteur) return;
        const { powensConnecteur, connectionId, powensError } = pageState;
        navigate('/connecteurs');
        if (powensError || !connectionId) {
            message.error("La connexion bancaire n'a pas abouti");
            return;
        }
        fetchWithAuth(`./connecteurs/${powensConnecteur}/powens/connexion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId }),
        })
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); message.success('Compte bancaire connecté'); load(); })
            .catch((e) => message.error('Erreur : ' + e.message));
    }, [pageState, navigate, load]);

    const savePowens = async () => {
        const values = await powensForm.validateFields();
        const r = await fetchWithAuth(`./connecteurs/${powensTarget!.id}/powens`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });
        if (!r.ok) { message.error('Erreur ' + r.status); return; }
        message.success('Configuration Powens enregistrée');
        setPowensTarget(null);
        load();
    };

    const connecterBanque = async (c: Connecteur) => {
        const r = await fetchWithAuth(`./connecteurs/${c.id}/powens/connexion-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ redirectUri: `${window.location.origin}${window.location.pathname}?powens_connecteur=${c.id}` }),
        });
        if (!r.ok) { message.error('Erreur ' + r.status); return; }
        window.location.href = (await r.json()).url;
    };

    const openForm = (c?: Connecteur) => {
        const value = c ?? { nom: '', actif: true, fournisseur: 'MANUEL' };
        setEditing(value);
        form.setFieldsValue(value);
    };

    const save = async () => {
        const values = await form.validateFields();
        const isNew = !editing?.id;
        const r = await fetchWithAuth(isNew ? './connecteurs' : `./connecteurs/${editing!.id}`, {
            method: isNew ? 'POST' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, actif: !!values.actif }),
        });
        if (!r.ok) { message.error('Erreur ' + r.status); return; }
        message.success('Connecteur enregistré');
        setEditing(null);
        load();
    };

    const remove = (c: Connecteur) => {
        fetchWithAuth(`./connecteurs/${c.id}`, { method: 'DELETE' })
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); load(); })
            .catch((e) => message.error('Erreur : ' + e.message));
    };

    const columns = [
        { title: 'Nom', dataIndex: 'nom', key: 'nom', render: (v: string) => <Space><BankOutlined />{v}</Space> },
        { title: 'Banque', dataIndex: 'banque', key: 'banque', render: (v?: string) => v || '—' },
        { title: 'Mode', dataIndex: 'fournisseur', key: 'fournisseur', render: (v?: string, c?: Connecteur) => v === 'POWENS'
            ? <Tag color={c?.powensConnecte ? 'green' : 'orange'}>Powens{c?.powensConnecte ? ' — connecté' : ' — à connecter'}</Tag>
            : <Tag>Import CSV</Tag> },
        { title: 'IBAN', dataIndex: 'iban', key: 'iban', render: (v?: string) => v || '—' },
        { title: 'Actif', dataIndex: 'actif', key: 'actif', render: (v: boolean) => (v ? 'Oui' : 'Non') },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, c: Connecteur) => (
                <Space>
                    {c.fournisseur === 'POWENS' && (
                        <>
                            <Button title="Configuration Powens" icon={<SettingOutlined />} onClick={() => { setPowensTarget(c); powensForm.resetFields(); }} />
                            {!c.powensConnecte && (
                                <Button icon={<LinkOutlined />} disabled={!c.actif || !c.powensConfigure} onClick={() => connecterBanque(c)}>Connecter la banque</Button>
                            )}
                        </>
                    )}
                    <Button icon={<EditOutlined />} onClick={() => openForm(c)} />
                    <Popconfirm title="Supprimer ce connecteur ?" okText="Supprimer" cancelText="Annuler" onConfirm={() => remove(c)}>
                        <Button danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Typography.Title level={3} style={{ marginTop: 0 }}>Connecteurs</Typography.Title>
            <Tabs
                activeKey={onglet}
                onChange={setOnglet}
                items={[
                    {
                        key: 'banques',
                        label: 'Comptes bancaires',
                        icon: <BankOutlined />,
                        children: (
                            <>
                                <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>Ajouter un compte</Button>
                                    <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
                                </Space>
                                <MosaicTable rowKey="id" loading={loading} dataSource={connecteurs} columns={columns} pagination={paginationConfig()} bordered />
                            </>
                        ),
                    },
                    {
                        key: 'annonces',
                        label: "Plateformes d'annonces",
                        icon: <NotificationOutlined />,
                        children: <PlateformesAnnonces />,
                    },
                ]}
            />

            <Modal
                open={!!editing}
                title={editing?.id ? 'Modifier le connecteur' : 'Nouveau connecteur'}
                okText="Enregistrer"
                cancelText="Annuler"
                onOk={save}
                onCancel={() => setEditing(null)}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="nom" label="Nom du compte" rules={[{ required: true, message: 'Le nom est requis' }]}>
                        <Input placeholder="Compte courant principal" />
                    </Form.Item>
                    <Form.Item name="fournisseur" label="Mode de rapprochement">
                        <Select options={[
                            { value: 'MANUEL', label: 'Import de relevé CSV' },
                            { value: 'POWENS', label: 'Synchronisation automatique (Powens — Crédit Agricole et autres banques)' },
                        ]} />
                    </Form.Item>
                    <Form.Item name="banque" label="Banque"><Input placeholder="Crédit Agricole" /></Form.Item>
                    <Form.Item name="iban" label="IBAN"><Input /></Form.Item>
                    <Form.Item name="bic" label="BIC"><Input /></Form.Item>
                    <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
                    <Form.Item name="actif" label="Actif" valuePropName="checked"><Switch /></Form.Item>
                </Form>
            </Modal>

            <Modal
                open={!!powensTarget}
                title={`Configuration Powens — ${powensTarget?.nom ?? ''}`}
                okText="Enregistrer"
                cancelText="Annuler"
                onOk={savePowens}
                onCancel={() => setPowensTarget(null)}
                destroyOnClose
            >
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Créez une application sur la console Powens, puis renseignez son domaine, son client_id et son client_secret. Ajoutez l'URL de cette application dans les redirections autorisées. Le choix de Crédit Agricole et le consentement se font ensuite sur la fenêtre sécurisée Powens (« Connecter la banque »)."
                />
                <Form form={powensForm} layout="vertical">
                    <Form.Item name="domain" label="Domaine Powens" rules={[{ required: true, message: 'Requis' }]} extra="Ex. monentreprise (pour monentreprise.biapi.pro)"><Input /></Form.Item>
                    <Form.Item name="clientId" label="client_id" rules={[{ required: true, message: 'Requis' }]}><Input /></Form.Item>
                    <Form.Item name="clientSecret" label="client_secret" extra="Laisser vide pour conserver le secret existant"><Input.Password autoComplete="new-password" /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
