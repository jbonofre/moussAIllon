import React, { useEffect, useState } from 'react';
import {
    Alert, Button, Card, Checkbox, Descriptions, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag,
    Typography, message,
} from 'antd';
import { DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import api, {
    ChantierVue, FORMAT_CODE, MESSAGE_FORMAT_CODE, MODULES, MODULE_PARAMETRAGE, Paiement, formatDate, formatMontant, lienEspace,
    messageErreur, statutAbonnement,
} from './api.ts';

interface ChantierDetailProps {
    vue: ChantierVue;
    onChange: (vue: ChantierVue) => void;
    // Code changé : la vue porte le nouveau code.
    onRename: (ancienCode: string, vue: ChantierVue) => void;
    onDelete: (code: string) => void;
}

const TYPES_PAIEMENT = [
    { value: 'MENSUEL', label: 'Mensuel (prochain mois)' },
    { value: 'ANNUEL', label: 'Annuel (12 mois)' },
];

const MODES_PAIEMENT = [
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'CARTE', label: 'Carte' },
    { value: 'STRIPE', label: 'Stripe' },
    { value: 'PAYPLUG', label: 'PayPlug' },
];

export default function ChantierDetail({ vue, onChange, onRename, onDelete }: ChantierDetailProps) {
    const { chantier, societe } = vue;
    const code = chantier.code;
    const [enCours, setEnCours] = useState<string | null>(null);
    const [modules, setModules] = useState<string[]>(societe?.modules || []);
    const [typePaiement, setTypePaiement] = useState('MENSUEL');
    const [modePaiement, setModePaiement] = useState('VIREMENT');
    const [suppressionOuverte, setSuppressionOuverte] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const [changementCodeOuvert, setChangementCodeOuvert] = useState(false);
    const [form] = Form.useForm();
    const [formCode] = Form.useForm();

    useEffect(() => {
        setModules(societe?.modules || []);
    }, [societe?.modules]);

    useEffect(() => {
        form.setFieldsValue({ nom: chantier.nom, email: chantier.email });
    }, [form, chantier.nom, chantier.email]);

    /** Exécute une action d'administration et met à jour le chantier avec sa réponse. */
    const executer = async (action: string, requete: () => Promise<{ data: ChantierVue }>, succes: string) => {
        setEnCours(action);
        try {
            const res = await requete();
            onChange(res.data);
            message.success(succes);
        } catch (error) {
            message.error(messageErreur(error, "Erreur lors de l'opération."));
        } finally {
            setEnCours(null);
        }
    };

    const modifier = (modification: Record<string, unknown>, succes: string) =>
        executer('modifier', () => api.put(`/admin/chantiers/${code}`, modification), succes);

    const changerCode = async ({ nouveauCode }: { nouveauCode: string }) => {
        setEnCours('code');
        try {
            const res = await api.put<ChantierVue>(`/admin/chantiers/${code}/code`, { code: nouveauCode });
            setChangementCodeOuvert(false);
            onRename(code, res.data);
            message.success(`Code du chantier changé en ${res.data.chantier.code}`);
        } catch (error) {
            message.error(messageErreur(error, 'Erreur lors du changement de code du chantier.'));
        } finally {
            setEnCours(null);
        }
    };

    const supprimer = async () => {
        setEnCours('supprimer');
        try {
            await api.delete(`/admin/chantiers/${code}`, { params: { confirmation } });
            message.success(`Chantier ${code} supprimé`);
            setSuppressionOuverte(false);
            onDelete(code);
        } catch (error) {
            message.error(messageErreur(error, 'Erreur lors de la suppression du chantier.'));
        } finally {
            setEnCours(null);
        }
    };

    const statut = statutAbonnement(vue);
    const montantPaiement = societe
        ? (typePaiement === 'ANNUEL' ? societe.abonnementMontantAnnuel || 0 : societe.abonnementProchainPaiementMontant || 0)
            + (societe.abonnementActif ? 0 : societe.abonnementActivationMontant || 0)
        : 0;

    return (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Card size="small" title="Chantier">
                <Form form={form} name="chantier" layout="vertical" onFinish={(values) => modifier(values, 'Chantier modifié')}>
                    <Form.Item name="nom" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est requis' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label="Email du chantier" rules={[{ type: 'email', message: "Format d'email invalide" }]}>
                        <Input />
                    </Form.Item>
                    <Button htmlType="submit" icon={<SaveOutlined />} loading={enCours === 'modifier'}>
                        Enregistrer
                    </Button>
                </Form>
                <Descriptions column={1} size="small" style={{ marginTop: 16 }}>
                    <Descriptions.Item label="Code">
                        <Space>
                            <Typography.Text strong>{code}</Typography.Text>
                            <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => { formCode.resetFields(); setChangementCodeOuvert(true); }}
                            >
                                Modifier le code
                            </Button>
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Créé le">{formatDate(chantier.dateCreation)}</Descriptions.Item>
                    <Descriptions.Item label="Espace chantier">
                        <Typography.Text copyable>{lienEspace('chantier', code)}</Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Portail client">
                        <Typography.Text copyable>{lienEspace('client', code)}</Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Espace technicien">
                        <Typography.Text copyable>{lienEspace('technicien', code)}</Typography.Text>
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            <Card size="small" title="Accès">
                {chantier.accesSuspendu && (
                    <Alert
                        type="error"
                        showIcon
                        style={{ marginBottom: 12 }}
                        title={`Accès suspendu depuis le ${formatDate(chantier.accesSuspenduDate)}`}
                        description="Personne ne peut se connecter (chantier, clients, techniciens) et aucun envoi automatique n'est fait. Les données sont conservées."
                    />
                )}
                {chantier.accesSuspendu ? (
                    <Button
                        type="primary"
                        loading={enCours === 'modifier'}
                        onClick={() => modifier({ accesSuspendu: false }, 'Accès rétabli')}
                    >
                        Rétablir l'accès
                    </Button>
                ) : (
                    <Popconfirm
                        title="Couper l'accès au chantier ?"
                        description="Ses utilisateurs, clients et techniciens sont déconnectés immédiatement."
                        okText="Couper l'accès"
                        cancelText="Annuler"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => modifier({ accesSuspendu: true }, 'Accès suspendu')}
                    >
                        <Button danger loading={enCours === 'modifier'}>Couper l'accès</Button>
                    </Popconfirm>
                )}
            </Card>

            <Card size="small" title="Abonnement" extra={<Tag color={statut.color}>{statut.label}</Tag>}>
                <Space style={{ marginBottom: 16 }}>
                    <Switch
                        checked={chantier.gratuit}
                        loading={enCours === 'modifier'}
                        aria-label="Abonnement gratuit"
                        onChange={(gratuit) => modifier({ gratuit }, gratuit ? 'Abonnement gratuit accordé' : 'Abonnement gratuit retiré')}
                    />
                    <span>Abonnement gratuit : accès jamais bloqués, modules ajoutés sans paiement</span>
                </Space>
                {!societe ? (
                    <Alert type="warning" showIcon title="La société de ce chantier n'existe pas : son abonnement ne se gère pas." />
                ) : (
                    <>
                        <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label="Activation">
                                {societe.abonnementActif
                                    ? formatDate(societe.abonnementActivationDate)
                                    : `Au premier paiement (${formatMontant(societe.abonnementActivationMontant)})`}
                            </Descriptions.Item>
                            {chantier.essaiFin && (
                                <Descriptions.Item label="Essai gratuit">
                                    {societe.enEssai
                                        ? `Jusqu'au ${formatDate(chantier.essaiFin)} (inscrit depuis l'espace chantier)`
                                        : `Jusqu'au ${formatDate(chantier.essaiFin)}, terminé`}
                                </Descriptions.Item>
                            )}
                            <Descriptions.Item label="Prochaine échéance">
                                {societe.abonnementActif ? formatDate(societe.abonnementProchainPaiementDate) : '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Montant mensuel">{formatMontant(societe.abonnementProchainPaiementMontant)}</Descriptions.Item>
                            <Descriptions.Item label="Montant annuel">{formatMontant(societe.abonnementMontantAnnuel)}</Descriptions.Item>
                            <Descriptions.Item label="Utilisateurs">{societe.abonnementNombreUtilisateurs}</Descriptions.Item>
                            <Descriptions.Item label="Techniciens">{societe.abonnementNombreTechniciens}</Descriptions.Item>
                            <Descriptions.Item label="Clients du portail">{societe.abonnementNombreClients}</Descriptions.Item>
                            {societe.abonnementResilie && (
                                <Descriptions.Item label="Résiliation">
                                    Le {formatDate(societe.abonnementResiliationDate)}
                                    {societe.abonnementBlocageDate && `, accès bloqué à partir du ${formatDate(societe.abonnementBlocageDate)}`}
                                </Descriptions.Item>
                            )}
                        </Descriptions>

                        <Typography.Title level={5} style={{ marginTop: 16 }}>Modules souscrits</Typography.Title>
                        <Checkbox.Group
                            value={modules}
                            onChange={(valeurs) => setModules(valeurs as string[])}
                            options={MODULES.map((m) => ({ ...m, disabled: m.value === MODULE_PARAMETRAGE }))}
                        />
                        <div style={{ marginTop: 8 }}>
                            <Button
                                icon={<SaveOutlined />}
                                loading={enCours === 'modules'}
                                onClick={() => executer('modules', () => api.put(`/admin/chantiers/${code}/modules`, modules), 'Modules enregistrés')}
                            >
                                Enregistrer les modules
                            </Button>
                            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                                Sans paiement ; les utilisateurs perdent les modules retirés.
                            </Typography.Text>
                        </div>

                        <Typography.Title level={5} style={{ marginTop: 16 }}>Paiement reçu</Typography.Title>
                        <Space wrap>
                            <Select aria-label="Type de paiement" value={typePaiement} onChange={setTypePaiement} options={TYPES_PAIEMENT} style={{ width: 220 }} />
                            <Select aria-label="Mode de paiement" value={modePaiement} onChange={setModePaiement} options={MODES_PAIEMENT} style={{ width: 140 }} />
                            <Popconfirm
                                title="Enregistrer ce paiement ?"
                                description={`${formatMontant(montantPaiement)}${societe.abonnementActif ? '' : ', activation comprise'}`}
                                okText="Enregistrer"
                                cancelText="Annuler"
                                disabled={societe.abonnementResilie}
                                onConfirm={() => executer('paiement',
                                    () => api.post(`/admin/chantiers/${code}/paiements`, { type: typePaiement, mode: modePaiement }),
                                    'Paiement enregistré')}
                            >
                                <Button type="primary" loading={enCours === 'paiement'} disabled={societe.abonnementResilie}>
                                    Enregistrer le paiement
                                </Button>
                            </Popconfirm>
                        </Space>

                        <div style={{ marginTop: 16 }}>
                            {societe.abonnementResilie ? (
                                <Button
                                    loading={enCours === 'resiliation'}
                                    onClick={() => executer('resiliation', () => api.post(`/admin/chantiers/${code}/reactiver`), 'Abonnement réactivé')}
                                >
                                    Réactiver l'abonnement
                                </Button>
                            ) : (
                                <Popconfirm
                                    title="Résilier l'abonnement ?"
                                    description="L'accès est bloqué après le délai de rétractation de 14 jours (sauf abonnement gratuit)."
                                    okText="Résilier"
                                    cancelText="Annuler"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={() => executer('resiliation', () => api.post(`/admin/chantiers/${code}/resilier`), 'Abonnement résilié')}
                                >
                                    <Button danger loading={enCours === 'resiliation'}>Résilier l'abonnement</Button>
                                </Popconfirm>
                            )}
                        </div>
                    </>
                )}
            </Card>

            {societe && (
                <Card size="small" title="Paiements de l'abonnement">
                    <Table<Paiement>
                        size="small"
                        rowKey="id"
                        dataSource={societe.paiements}
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                        locale={{ emptyText: 'Aucun paiement' }}
                        columns={[
                            { title: 'Date', dataIndex: 'date', render: (date: string) => formatDate(date) },
                            { title: 'Type', dataIndex: 'type' },
                            { title: 'Mode', dataIndex: 'mode' },
                            {
                                title: 'Période',
                                key: 'periode',
                                render: (_: unknown, p: Paiement) => p.periodeDebut ? `${formatDate(p.periodeDebut)} → ${formatDate(p.periodeFin)}` : '—',
                            },
                            { title: 'Montant', dataIndex: 'montant', align: 'right', render: (montant: number) => formatMontant(montant) },
                        ]}
                    />
                </Card>
            )}

            <Card size="small" title="Suppression" styles={{ header: { color: '#cf1322' } }}>
                <Typography.Paragraph type="secondary">
                    Supprime le chantier et toutes ses données (société, utilisateurs, clients, ventes...). Irréversible.
                </Typography.Paragraph>
                <Button danger icon={<DeleteOutlined />} onClick={() => { setConfirmation(''); setSuppressionOuverte(true); }}>
                    Supprimer le chantier
                </Button>
            </Card>

            <Modal
                title={`Modifier le code du chantier ${code}`}
                open={changementCodeOuvert}
                onCancel={() => setChangementCodeOuvert(false)}
                onOk={() => formCode.submit()}
                okText="Modifier le code"
                cancelText="Annuler"
                confirmLoading={enCours === 'code'}
                forceRender
            >
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title="Les utilisateurs, clients et techniciens du chantier sont déconnectés"
                    description="Ils se reconnectent avec le nouveau code, sans changer de mot de passe. Les liens transmis avec l'ancien code ne fonctionnent plus : transmettez les nouveaux."
                />
                <Form form={formCode} name="code-chantier" layout="vertical" onFinish={changerCode}>
                    <Form.Item
                        name="nouveauCode"
                        label="Nouveau code chantier"
                        normalize={(valeur: string) => (valeur || '').toLowerCase()}
                        rules={[
                            { required: true, message: 'Le nouveau code est requis' },
                            { pattern: FORMAT_CODE, message: MESSAGE_FORMAT_CODE },
                            {
                                validator: (_, valeur) => valeur === code
                                    ? Promise.reject(new Error('Le code est inchangé'))
                                    : Promise.resolve(),
                            },
                        ]}
                    >
                        <Input placeholder={code} autoCapitalize="none" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`Supprimer le chantier ${code} ?`}
                open={suppressionOuverte}
                onCancel={() => setSuppressionOuverte(false)}
                onOk={supprimer}
                okText="Supprimer définitivement"
                cancelText="Annuler"
                okButtonProps={{ danger: true, disabled: confirmation.trim().toLowerCase() !== code }}
                confirmLoading={enCours === 'supprimer'}
                destroyOnHidden
            >
                <Typography.Paragraph>
                    Toutes les données du chantier seront supprimées. Saisissez son code (<Typography.Text strong>{code}</Typography.Text>) pour confirmer.
                </Typography.Paragraph>
                <Input aria-label="Code du chantier à supprimer" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={code} />
            </Modal>
        </Space>
    );
}
