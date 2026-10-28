import React, { useCallback, useEffect, useState } from 'react';
import MosaicTable from "./MosaicTable.tsx";
import { Alert, Button, Form, Input, List, Modal, Popconfirm, Select, Space, Switch, Tag, Typography, Upload, message } from 'antd';
import { BankOutlined, DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined, SettingOutlined, SyncOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchWithAuth } from './api.ts';
import { useNavigation } from './navigation-context.tsx';
import { paginationConfig } from './pagination.ts';

interface Connecteur {
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

interface BanqueTransaction { date: string; libelle: string; montant: number }

const parseMontant = (raw: string) => parseFloat(raw.replace(/\s/g, '').replace(',', '.'));

const parseDate = (raw: string) => {
    const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : raw.trim();
};

// Relevé CSV : date;libellé;montant (séparateur ; ou , — une ligne d'en-tête éventuelle est ignorée)
function parseReleve(text: string): BanqueTransaction[] {
    const transactions: BanqueTransaction[] = [];
    text.split(/\r?\n/).forEach((line) => {
        if (!line.trim()) return;
        const sep = line.includes(';') ? ';' : ',';
        const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 3) return;
        const montant = parseMontant(cols[cols.length - 1]);
        const date = parseDate(cols[0]);
        if (Number.isNaN(montant) || !dayjs(date).isValid()) return;
        transactions.push({ date, libelle: cols.slice(1, -1).join(' '), montant });
    });
    return transactions;
}

export default function Connecteurs() {
    const [connecteurs, setConnecteurs] = useState<Connecteur[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Connecteur | null>(null);
    const [syncTarget, setSyncTarget] = useState<Connecteur | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);
    const [form] = Form.useForm();
    const [powensForm] = Form.useForm();
    const [powensTarget, setPowensTarget] = useState<Connecteur | null>(null);
    const { pageState, navigate } = useNavigation();

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

    const synchroniser = async (c: Connecteur) => {
        setSyncTarget(c);
        setSyncing(true);
        try {
            const r = await fetchWithAuth(`./connecteurs/${c.id}/synchronisation`, { method: 'POST' });
            if (!r.ok) throw new Error('Erreur ' + r.status);
            setSyncResult(await r.json());
            load();
        } catch (e: any) {
            message.error('Erreur : ' + e.message);
            setSyncTarget(null);
        } finally {
            setSyncing(false);
        }
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

    const importReleve = async (file: File) => {
        const transactions = parseReleve(await file.text());
        if (transactions.length === 0) {
            message.error("Aucune écriture reconnue. Format attendu : date;libellé;montant");
            return;
        }
        setSyncing(true);
        try {
            const r = await fetchWithAuth(`./connecteurs/${syncTarget!.id}/rapprochement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactions }),
            });
            if (!r.ok) throw new Error('Erreur ' + r.status);
            setSyncResult(await r.json());
            load();
        } catch (e: any) {
            message.error('Erreur : ' + e.message);
        } finally {
            setSyncing(false);
        }
    };

    const closeSync = () => { setSyncTarget(null); setSyncResult(null); };

    const columns = [
        { title: 'Nom', dataIndex: 'nom', key: 'nom', render: (v: string) => <Space><BankOutlined />{v}</Space> },
        { title: 'Banque', dataIndex: 'banque', key: 'banque', render: (v?: string) => v || '—' },
        { title: 'Mode', dataIndex: 'fournisseur', key: 'fournisseur', render: (v?: string, c?: Connecteur) => v === 'POWENS'
            ? <Tag color={c?.powensConnecte ? 'green' : 'orange'}>Powens{c?.powensConnecte ? ' — connecté' : ' — à connecter'}</Tag>
            : <Tag>Import CSV</Tag> },
        { title: 'IBAN', dataIndex: 'iban', key: 'iban', render: (v?: string) => v || '—' },
        { title: 'Actif', dataIndex: 'actif', key: 'actif', render: (v: boolean) => (v ? 'Oui' : 'Non') },
        {
            title: 'Dernier rapprochement',
            key: 'dernier',
            render: (_: any, c: Connecteur) => c.dernierRapprochement
                ? `${dayjs(c.dernierRapprochement).format('DD/MM/YYYY HH:mm')} (${c.dernierNbRapproches ?? 0} règlement(s))`
                : '—',
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, c: Connecteur) => (
                <Space>
                    {c.fournisseur === 'POWENS' ? (
                        <>
                            <Button icon={<SettingOutlined />} onClick={() => { setPowensTarget(c); powensForm.resetFields(); }} />
                            {c.powensConnecte
                                ? <Button icon={<SyncOutlined />} disabled={!c.actif} onClick={() => synchroniser(c)}>Synchroniser</Button>
                                : <Button icon={<LinkOutlined />} disabled={!c.actif || !c.powensConfigure} onClick={() => connecterBanque(c)}>Connecter la banque</Button>}
                        </>
                    ) : (
                        <Button icon={<SyncOutlined />} disabled={!c.actif} onClick={() => setSyncTarget(c)}>Rapprocher</Button>
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
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
                <Typography.Title level={3} style={{ margin: 0 }}>Connecteurs bancaires</Typography.Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>Ajouter un compte</Button>
            </Space>
            <MosaicTable rowKey="id" loading={loading} dataSource={connecteurs} columns={columns} pagination={paginationConfig()} bordered />

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

            <Modal
                open={!!syncTarget}
                title={`Rapprochement — ${syncTarget?.nom ?? ''}`}
                footer={<Button onClick={closeSync}>Fermer</Button>}
                onCancel={closeSync}
                destroyOnClose
            >
                {syncTarget?.fournisseur !== 'POWENS' && <>
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Importez le relevé du compte (CSV : date;libellé;montant). Les règlements de même montant, à moins de 7 jours d'écart, sont cochés automatiquement ; un numéro de facture dans le libellé est prioritaire."
                />
                <Upload
                    accept=".csv,.txt"
                    showUploadList={false}
                    beforeUpload={(file) => { importReleve(file); return false; }}
                >
                    <Button icon={<UploadOutlined />} loading={syncing}>Importer un relevé</Button>
                </Upload>
                </>}
                {syncTarget?.fournisseur === 'POWENS' && syncing && <Typography.Paragraph>Synchronisation en cours…</Typography.Paragraph>}
                {syncResult && (
                    <div style={{ marginTop: 16 }}>
                        <Typography.Paragraph>
                            <b>{syncResult.rapproches.length}</b> règlement(s) rapproché(s), <b>{syncResult.nonRapproches}</b> écriture(s) sans correspondance.
                        </Typography.Paragraph>
                        <List
                            size="small"
                            bordered
                            dataSource={syncResult.rapproches}
                            renderItem={(m: any) => (
                                <List.Item>{m.numeroFacture || `Règlement ${m.reglementId}`} — {m.montant} € — {m.libelle}</List.Item>
                            )}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
}
