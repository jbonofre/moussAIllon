import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Button, Card, Checkbox, Col, Drawer, Form, Input, Modal, Row, Space, Statistic, Switch, Table, Tag, Tooltip,
    Typography, message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import api, {
    ChantierVue, FORMAT_CODE, MODULES, MODULE_PARAMETRAGE, Societe, formatDate, formatMontant, lienEspace, messageErreur,
    statutAbonnement,
} from './api.ts';
import ChantierDetail from './chantier-detail.tsx';

const effectifs = (societe?: Societe | null) => societe
    ? `${societe.abonnementNombreUtilisateurs} / ${societe.abonnementNombreTechniciens} / ${societe.abonnementNombreClients}`
    : '—';

export default function Chantiers() {
    const [vues, setVues] = useState<ChantierVue[]>([]);
    const [loading, setLoading] = useState(false);
    const [recherche, setRecherche] = useState('');
    const [creationOuverte, setCreationOuverte] = useState(false);
    const [creation, setCreation] = useState(false);
    const [selection, setSelection] = useState<string | null>(null);
    const [form] = Form.useForm();

    const charger = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<ChantierVue[]>('/admin/chantiers');
            setVues(res.data);
        } catch (error) {
            message.error(messageErreur(error, 'Erreur lors du chargement des chantiers.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        charger();
    }, [charger]);

    const filtrees = useMemo(() => {
        const terme = recherche.trim().toLowerCase();
        return terme
            ? vues.filter((v) => [v.chantier.code, v.chantier.nom, v.chantier.email].some((x) => x?.toLowerCase().includes(terme)))
            : vues;
    }, [vues, recherche]);

    const statistiques = useMemo(() => ({
        total: vues.length,
        suspendus: vues.filter((v) => v.chantier.accesSuspendu).length,
        gratuits: vues.filter((v) => v.chantier.gratuit).length,
        mensuel: vues
            .filter((v) => !v.chantier.gratuit && v.societe?.abonnementActif && !v.societe?.abonnementResilie)
            .reduce((total, v) => total + (v.societe?.abonnementProchainPaiementMontant || 0), 0),
    }), [vues]);

    const majVue = (vue: ChantierVue) => {
        setVues((precedentes) => precedentes.map((v) => (v.chantier.code === vue.chantier.code ? vue : v)));
    };

    const creer = async (values: any) => {
        setCreation(true);
        try {
            const res = await api.post<ChantierVue>('/admin/chantiers', {
                ...values,
                code: values.code.trim().toLowerCase(),
                modules: values.modules,
            });
            const code = res.data.chantier.code;
            setVues((precedentes) => [...precedentes, res.data].sort((a, b) => a.chantier.code.localeCompare(b.chantier.code)));
            setCreationOuverte(false);
            form.resetFields();
            Modal.success({
                title: `Chantier ${code} créé`,
                content: (
                    <Space orientation="vertical">
                        <span>Liens à transmettre au chantier (le code chantier y est pré-rempli) :</span>
                        <Typography.Text copyable>{lienEspace('chantier', code)}</Typography.Text>
                        <Typography.Text copyable>{lienEspace('client', code)}</Typography.Text>
                        <Typography.Text copyable>{lienEspace('technicien', code)}</Typography.Text>
                    </Space>
                ),
            });
        } catch (error) {
            message.error(messageErreur(error, 'Erreur lors de la création du chantier.'));
        } finally {
            setCreation(false);
        }
    };

    const colonnes = [
        {
            title: 'Code',
            dataIndex: ['chantier', 'code'],
            key: 'code',
            sorter: (a: ChantierVue, b: ChantierVue) => a.chantier.code.localeCompare(b.chantier.code),
            render: (code: string) => <Typography.Text strong>{code}</Typography.Text>,
        },
        {
            title: 'Nom',
            dataIndex: ['chantier', 'nom'],
            key: 'nom',
            sorter: (a: ChantierVue, b: ChantierVue) => a.chantier.nom.localeCompare(b.chantier.nom),
        },
        { title: 'Contact', dataIndex: ['chantier', 'email'], key: 'email' },
        {
            title: 'Création',
            dataIndex: ['chantier', 'dateCreation'],
            key: 'dateCreation',
            render: (date: string) => formatDate(date),
        },
        {
            title: 'Abonnement',
            key: 'abonnement',
            render: (_: unknown, vue: ChantierVue) => {
                const statut = statutAbonnement(vue);
                return <Tag color={statut.color}>{statut.label}</Tag>;
            },
        },
        {
            title: 'Mensuel',
            key: 'mensuel',
            align: 'right' as const,
            render: (_: unknown, vue: ChantierVue) => formatMontant(vue.societe?.abonnementProchainPaiementMontant),
        },
        {
            title: <Tooltip title="Utilisateurs / techniciens / clients du portail">Effectifs</Tooltip>,
            key: 'effectifs',
            render: (_: unknown, vue: ChantierVue) => effectifs(vue.societe),
        },
        {
            title: 'Accès',
            key: 'acces',
            render: (_: unknown, vue: ChantierVue) => vue.chantier.accesSuspendu
                ? <Tag color="red">Suspendu</Tag>
                : <Tag color="green">Ouvert</Tag>,
        },
        {
            title: '',
            key: 'actions',
            render: (_: unknown, vue: ChantierVue) => (
                <Button icon={<SettingOutlined />} onClick={() => setSelection(vue.chantier.code)}>
                    Gérer
                </Button>
            ),
        },
    ];

    const vueSelectionnee = vues.find((v) => v.chantier.code === selection);

    return (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={16}>
                <Col xs={12} md={6}><Card><Statistic title="Chantiers" value={statistiques.total} /></Card></Col>
                <Col xs={12} md={6}><Card><Statistic title="Accès suspendus" value={statistiques.suspendus} /></Card></Col>
                <Col xs={12} md={6}><Card><Statistic title="Abonnements gratuits" value={statistiques.gratuits} /></Card></Col>
                <Col xs={12} md={6}>
                    <Card>
                        <Statistic title="Abonnements mensuels actifs" value={formatMontant(statistiques.mensuel)} />
                    </Card>
                </Col>
            </Row>
            <Card
                title="Chantiers hébergés"
                extra={
                    <Space>
                        <Input
                            allowClear
                            prefix={<SearchOutlined />}
                            placeholder="Rechercher"
                            value={recherche}
                            onChange={(e) => setRecherche(e.target.value)}
                        />
                        <Tooltip title="Recharger">
                            <Button icon={<ReloadOutlined />} aria-label="Recharger" onClick={charger} />
                        </Tooltip>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreationOuverte(true)}>
                            Nouveau chantier
                        </Button>
                    </Space>
                }
            >
                <Table
                    rowKey={(vue) => vue.chantier.code}
                    columns={colonnes}
                    dataSource={filtrees}
                    loading={loading}
                    pagination={{ pageSize: 20, hideOnSinglePage: true }}
                    locale={{ emptyText: 'Aucun chantier' }}
                />
            </Card>

            <Modal
                title="Nouveau chantier"
                open={creationOuverte}
                onCancel={() => setCreationOuverte(false)}
                onOk={() => form.submit()}
                okText="Créer"
                cancelText="Annuler"
                confirmLoading={creation}
                destroyOnHidden
            >
                <Form
                    form={form}
                    name="creation"
                    layout="vertical"
                    onFinish={creer}
                    initialValues={{ utilisateur: 'admin', gratuit: false, modules: MODULES.map((m) => m.value) }}
                >
                    <Form.Item
                        name="code"
                        label="Code chantier"
                        extra="Saisi à la connexion. Lettres minuscules, chiffres et tirets ; il ne pourra plus changer."
                        normalize={(valeur: string) => (valeur || '').toLowerCase()}
                        rules={[
                            { required: true, message: 'Le code chantier est requis' },
                            { pattern: FORMAT_CODE, message: '2 à 40 caractères : lettres minuscules, chiffres et tirets, sans tiret au début' },
                        ]}
                    >
                        <Input placeholder="ms-plaisance" autoCapitalize="none" />
                    </Form.Item>
                    <Form.Item name="nom" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est requis' }]}>
                        <Input placeholder="MS Plaisance" />
                    </Form.Item>
                    <Form.Item
                        name="email"
                        label="Email du chantier"
                        rules={[{ required: true, message: "L'email est requis" }, { type: 'email', message: "Format d'email invalide" }]}
                    >
                        <Input placeholder="contact@chantier.fr" />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="utilisateur" label="Premier utilisateur" rules={[{ required: true, whitespace: true, message: "L'utilisateur est requis" }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="motDePasse" label="Mot de passe" rules={[{ required: true, message: 'Le mot de passe est requis' }]}>
                                <Input.Password autoComplete="new-password" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="modules" label="Modules souscrits">
                        <Checkbox.Group
                            options={MODULES.map((m) => ({ ...m, disabled: m.value === MODULE_PARAMETRAGE }))}
                        />
                    </Form.Item>
                    <Form.Item
                        name="gratuit"
                        label="Abonnement gratuit"
                        valuePropName="checked"
                        extra="Les accès ne sont jamais bloqués et les modules s'ajoutent sans paiement."
                    >
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>

            <Drawer
                title={vueSelectionnee ? `${vueSelectionnee.chantier.nom} (${vueSelectionnee.chantier.code})` : ''}
                open={!!vueSelectionnee}
                onClose={() => setSelection(null)}
                size="large"
                destroyOnHidden
            >
                {vueSelectionnee && (
                    <ChantierDetail
                        vue={vueSelectionnee}
                        onChange={majVue}
                        onDelete={(code) => {
                            setSelection(null);
                            setVues((precedentes) => precedentes.filter((v) => v.chantier.code !== code));
                        }}
                    />
                )}
            </Drawer>
        </Space>
    );
}
