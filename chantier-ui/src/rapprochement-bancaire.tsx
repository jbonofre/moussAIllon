import React, { useCallback, useEffect, useState } from 'react';
import MosaicTable from "./MosaicTable.tsx";
import { Alert, Button, Empty, List, Modal, Space, Tag, Typography, Upload, message } from 'antd';
import { BankOutlined, ReloadOutlined, SettingOutlined, SyncOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchWithAuth } from './api.ts';
import { Connecteur } from './connecteurs.tsx';
import { useNavigation } from './navigation-context.tsx';
import { paginationConfig } from './pagination.ts';

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

// Rapprochement des règlements avec les écritures des comptes bancaires configurés dans Paramétrage > Connecteurs
export default function RapprochementBancaire() {
    const [connecteurs, setConnecteurs] = useState<Connecteur[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncTarget, setSyncTarget] = useState<Connecteur | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);
    const { navigate } = useNavigation();

    const load = useCallback(() => {
        setLoading(true);
        fetchWithAuth('./connecteurs')
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setConnecteurs)
            .catch((e) => message.error('Erreur : ' + e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

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

    const configurer = () => navigate('/connecteurs');

    const columns = [
        {
            title: 'Compte',
            dataIndex: 'nom',
            key: 'nom',
            render: (v: string, c: Connecteur) => <Space><BankOutlined />{v}{c.banque && <Typography.Text type="secondary">({c.banque})</Typography.Text>}</Space>,
        },
        { title: 'Mode', dataIndex: 'fournisseur', key: 'fournisseur', render: (v?: string, c?: Connecteur) => v === 'POWENS'
            ? <Tag color={c?.powensConnecte ? 'green' : 'orange'}>Powens{c?.powensConnecte ? ' — connecté' : ' — à connecter'}</Tag>
            : <Tag>Import CSV</Tag> },
        {
            title: 'Dernier rapprochement',
            key: 'dernier',
            render: (_: any, c: Connecteur) => c.dernierRapprochement
                ? `${dayjs(c.dernierRapprochement).format('DD/MM/YYYY HH:mm')} (${c.dernierNbRapproches ?? 0} règlement(s))`
                : '—',
        },
        {
            title: 'Action',
            key: 'actions',
            render: (_: any, c: Connecteur) => {
                if (!c.actif) {
                    return <Tag>Désactivé</Tag>;
                }
                if (c.fournisseur !== 'POWENS') {
                    return <Button icon={<UploadOutlined />} onClick={() => setSyncTarget(c)}>Importer un relevé</Button>;
                }
                if (!c.powensConnecte) {
                    // La connexion à la banque fait partie de la configuration du connecteur
                    return <Button icon={<SettingOutlined />} onClick={configurer}>Connecter la banque</Button>;
                }
                return <Button type="primary" icon={<SyncOutlined />} loading={syncing && syncTarget?.id === c.id} onClick={() => synchroniser(c)}>Synchroniser</Button>;
            },
        },
    ];

    return (
        <div>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
                <Typography.Title level={3} style={{ margin: 0 }}>Rapprochement bancaire</Typography.Title>
                <Space>
                    <Button icon={<SettingOutlined />} onClick={configurer}>Configurer les comptes</Button>
                    <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
                </Space>
            </Space>
            <Typography.Paragraph type="secondary">
                Les écritures du compte sont comparées aux règlements non pointés : même montant, à moins de 7 jours
                d'écart ; un numéro de facture dans le libellé est prioritaire. Les règlements reconnus sont cochés
                comme rapprochés dans Règlements.
            </Typography.Paragraph>
            <MosaicTable
                rowKey="id"
                loading={loading}
                dataSource={connecteurs}
                columns={columns}
                pagination={paginationConfig()}
                bordered
                locale={{
                    emptyText: <Empty description="Aucun compte bancaire configuré" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
                }}
            />

            <Modal
                open={!!syncTarget && (syncTarget.fournisseur !== 'POWENS' || !!syncResult)}
                title={`Rapprochement — ${syncTarget?.nom ?? ''}`}
                footer={(
                    <Space>
                        {syncResult && <Button onClick={() => navigate('/reglements')}>Voir les règlements</Button>}
                        <Button onClick={closeSync}>Fermer</Button>
                    </Space>
                )}
                onCancel={closeSync}
                destroyOnHidden
            >
                {syncTarget?.fournisseur !== 'POWENS' && <>
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Importez le relevé du compte (CSV : date;libellé;montant)."
                />
                <Upload
                    accept=".csv,.txt"
                    showUploadList={false}
                    beforeUpload={(file) => { importReleve(file); return false; }}
                >
                    <Button icon={<UploadOutlined />} loading={syncing}>Importer un relevé</Button>
                </Upload>
                </>}
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
