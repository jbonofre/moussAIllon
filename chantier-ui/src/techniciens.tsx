import React, { useEffect, useState } from 'react';
import { Space, Table, Button, Input, Form, Modal, Card, Row, Col, Popconfirm, message, Drawer, Statistic, Progress, Divider, Spin, Checkbox, ColorPicker } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined, UserOutlined, BarChartOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, WarningOutlined, EuroCircleOutlined, KeyOutlined, MailOutlined } from '@ant-design/icons';
import api from './api.ts';

// --- Types ---

interface TechnicienEntity {
    id?: number;
    nom: string;
    prenom: string;
    motDePasse?: string;
    email: string;
    telephone?: string;
    couleur?: string;
}

interface TechnicienKpi {
    totalTaches: number;
    tachesTerminees: number;
    tachesEnCours: number;
    tachesEnAttente: number;
    tachesIncident: number;
    tachesAnnulees: number;
    tauxCompletion: number;
    tauxIncident: number;
    heuresReelles: number;
    tachesMois: number;
    tachesTermineesMois: number;
    heuresReellesMois: number;
    retards48h: number;
    tachesEnRetard: number;
    tachesDepassement: number;
    chiffreAffaireMainOeuvre: number;
    chiffreAffaireMainOeuvreMois: number;
}

interface TechnicienFormValues {
    nom: string;
    prenom: string;
    motDePasse?: string;
    email: string;
    telephone?: string;
    couleur?: string;
}

const defaultTechnicien: TechnicienFormValues = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    couleur: '#1677ff'
};

// --- Component ---

const Techniciens: React.FC = () => {
    const [techniciens, setTechniciens] = useState<TechnicienEntity[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [currentTechnicien, setCurrentTechnicien] = useState<TechnicienEntity | null>(null);
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [kpiDrawerVisible, setKpiDrawerVisible] = useState<boolean>(false);
    const [kpiLoading, setKpiLoading] = useState<boolean>(false);
    const [kpiData, setKpiData] = useState<TechnicienKpi | null>(null);
    const [kpiTechnicien, setKpiTechnicien] = useState<TechnicienEntity | null>(null);

    // Get all techniciens
    const fetchTechniciens = async (query: string = '') => {
        setLoading(true);
        try {
            const url = query ? `/techniciens/search?q=${encodeURIComponent(query)}` : '/techniciens';
            const res = await api.get(url);
            setTechniciens(res.data);
        } catch {
            message.error('Erreur lors du chargement des techniciens.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTechniciens();
    }, []);

    const openModal = (technicien?: TechnicienEntity) => {
        if (technicien) {
            setIsEdit(true);
            setCurrentTechnicien(technicien);
            form.setFieldsValue({
                ...defaultTechnicien,
                ...technicien,
            });
        } else {
            setIsEdit(false);
            setCurrentTechnicien(null);
            form.resetFields();
            const randomColor = '#' + Array.from(crypto.getRandomValues(new Uint8Array(3)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            form.setFieldsValue({ ...defaultTechnicien, couleur: randomColor });
        }
        setFormDirty(false);
        setModalVisible(true);
    };

    const handleModalCancel = () => {
        if (formDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setFormDirty(false);
                    setModalVisible(false);
                },
            });
        } else {
            setModalVisible(false);
        }
    };

    const handleModalOk = async () => {
        try {
            const { confirmMotDePasse, ...values } = await form.validateFields();
            const payload = {
                ...values,
                couleur: values.couleur || defaultTechnicien.couleur
            };

            if (isEdit && currentTechnicien && currentTechnicien.id) {
                const res = await api.put(`/techniciens/${currentTechnicien.id}`, { ...currentTechnicien, ...payload });
                message.success('Technicien modifié avec succès');
                setFormDirty(false);
                setCurrentTechnicien(res.data);
                form.setFieldsValue(res.data);
            } else {
                const res = await api.post('/techniciens', payload);
                message.success('Technicien ajouté avec succès');
                setFormDirty(false);
                setIsEdit(true);
                setCurrentTechnicien(res.data);
                form.setFieldsValue(res.data);
            }
            fetchTechniciens(searchQuery);
        } catch (err) {
            // form validation error
        }
    };

    const handleDelete = async (id: number | undefined) => {
        if (!id) return;
        try {
            await api.delete(`/techniciens/${id}`);
            message.success('Technicien supprimé avec succès');
            fetchTechniciens(searchQuery);
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    const handleSearch = (value: string) => {
        setSearchQuery(value);
        fetchTechniciens(value);
    };

    const handleSendPassword = async (technicien: TechnicienEntity) => {
        if (!technicien.email) {
            message.warning("Ce technicien n'a pas d'adresse email.");
            return;
        }
        const password = form.getFieldValue("motDePasse");
        if (!password) {
            message.warning("Veuillez saisir un mot de passe avant de l'envoyer.");
            return;
        }
        try {
            await api.post(`/techniciens/${technicien.id}/send-password`, { password });
            message.success(`Mot de passe envoyé à ${technicien.email}`);
        } catch {
            message.error("Erreur lors de l'envoi du mot de passe");
        }
    };

    const openKpiDrawer = async (technicien: TechnicienEntity) => {
        setKpiTechnicien(technicien);
        setKpiDrawerVisible(true);
        setKpiLoading(true);
        try {
            const res = await api.get(`/techniciens/${technicien.id}/kpi`);
            setKpiData(res.data);
        } catch {
            message.error('Erreur lors du chargement des KPI.');
        }
        setKpiLoading(false);
    };

    // Columns
    const columns = [
        {
            title: '',
            dataIndex: '',
            key: 'avatar',
            width: 50,
            render: (_: unknown, record: TechnicienEntity) => (
                <UserOutlined style={{ fontSize: 20, color: record.couleur || defaultTechnicien.couleur }} />
            )
        },
        {
            title: 'Nom',
            dataIndex: 'nom',
            key: 'nom',
            sorter: (a: TechnicienEntity, b: TechnicienEntity) => (a.nom || '').localeCompare(b.nom || ''),
        },
        {
            title: 'Prénom',
            dataIndex: 'prenom',
            key: 'prenom',
            sorter: (a: TechnicienEntity, b: TechnicienEntity) => (a.prenom || '').localeCompare(b.prenom || ''),
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            sorter: (a: TechnicienEntity, b: TechnicienEntity) => (a.email || '').localeCompare(b.email || ''),
        },
        {
            title: 'Téléphone',
            dataIndex: 'telephone',
            key: 'telephone',
        },
        {
            title: 'Couleur',
            dataIndex: 'couleur',
            key: 'couleur',
            render: (couleur?: string) => {
                const color = couleur || defaultTechnicien.couleur;
                return (
                    <Space size={8}>
                        <span
                            style={{
                                display: 'inline-block',
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: color,
                                border: '1px solid #d9d9d9'
                            }}
                        />
                    </Space>
                );
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: TechnicienEntity) => (
                <Space>
                    <Button onClick={() => openKpiDrawer(record)} icon={<BarChartOutlined/>} title="KPI" />
                    <Button onClick={() => openModal(record)} icon={<EditOutlined/>} />
                    <Popconfirm
                        title="Supprimer ce technicien ?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Oui"
                        cancelText="Non"
                    >
                        <Button danger icon={<DeleteOutlined/>} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // --- UI Render ---

    return (
        <>
            <Card title="Équipe">
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Space>
                            <Input.Search
                                placeholder="Rechercher un technicien (nom, prénom, email, téléphone)"
                                enterButton
                                allowClear
                                style={{ width: 600 }}
                                onSearch={handleSearch}
                                onChange={(e) => {
                                    if (!e.target.value) {
                                        setSearchQuery('');
                                        fetchTechniciens('');
                                    }
                                }}
                            />
                            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                        </Space>
                    </Col>
                </Row>
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col span={24}>
                        <Table
                            rowKey="id"
                            columns={columns}
                            dataSource={techniciens}
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                            bordered
                        />
                        <Modal
                            title={isEdit ? 'Modifier un technicien' : 'Ajouter un technicien'}
                            open={modalVisible}
                            onOk={handleModalOk}
                            onCancel={handleModalCancel}
                            maskClosable={false}
                            width={1024}
                            okText="Enregistrer"
                            cancelText="Fermer"
                            destroyOnClose
                        >
                            <Form
                                form={form}
                                layout="vertical"
                                initialValues={defaultTechnicien}
                                onValuesChange={() => setFormDirty(true)}
                            >
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="prenom"
                                            label="Prénom"
                                            rules={[{ required: true, message: "Le prénom est requis" }]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            name="nom"
                                            label="Nom"
                                            rules={[{ required: true, message: "Le nom est requis" }]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item 
                                            name="email" 
                                            label="Email" 
                                            rules={[
                                                { required: true, message: "L'email est requis" },
                                                { type: "email", message: "Email invalide" }
                                            ]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item 
                                            name="telephone" 
                                            label="Téléphone"
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            name="motDePasse"
                                            label="Mot de passe"
                                            rules={
                                                isEdit
                                                    ? []
                                                    : [{ required: true, message: "Le mot de passe est requis" }]
                                            }
                                        >
                                            <Input.Password autoComplete="new-password" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            name="confirmMotDePasse"
                                            label="Confirmer le mot de passe"
                                            dependencies={["motDePasse"]}
                                            rules={[
                                                ({ getFieldValue }) => ({
                                                    validator(_, value) {
                                                        if (!value && !getFieldValue("motDePasse")) {
                                                            return Promise.resolve();
                                                        }
                                                        if (value === getFieldValue("motDePasse")) {
                                                            return Promise.resolve();
                                                        }
                                                        return Promise.reject(new Error("Les mots de passe ne correspondent pas"));
                                                    },
                                                }),
                                            ]}
                                        >
                                            <Input.Password autoComplete="new-password" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col>
                                        <Space>
                                            <Button
                                                icon={<KeyOutlined />}
                                                size="small"
                                                onClick={() => {
                                                    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";
                                                    const generated = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                                                        .map((b) => chars[b % chars.length])
                                                        .join("");
                                                    form.setFieldsValue({ motDePasse: generated, confirmMotDePasse: generated });
                                                }}
                                            >
                                                Générer un mot de passe
                                            </Button>
                                            {isEdit && currentTechnicien && currentTechnicien.id && (
                                                <Popconfirm
                                                    title="Envoyer le mot de passe par email ?"
                                                    onConfirm={() => handleSendPassword(currentTechnicien)}
                                                    disabled={!currentTechnicien.email}
                                                >
                                                    <Button
                                                        icon={<MailOutlined />}
                                                        disabled={!currentTechnicien.email}
                                                        size="small"
                                                    >
                                                        Envoyer le mot de passe par email
                                                    </Button>
                                                </Popconfirm>
                                            )}
                                        </Space>
                                    </Col>
                                </Row>
                                <Form.Item
                                    name="couleur"
                                    label="Couleur"
                                    getValueFromEvent={(color) => color?.toHexString?.() ?? color}
                                >
                                    <ColorPicker format="hex" />
                                </Form.Item>
                            </Form>
                        </Modal>
                    </Col>
                </Row>
            </Card>
            <Drawer
                title={kpiTechnicien ? `KPI — ${kpiTechnicien.prenom} ${kpiTechnicien.nom}` : 'KPI'}
                open={kpiDrawerVisible}
                onClose={() => { setKpiDrawerVisible(false); setKpiData(null); }}
                width={520}
            >
                {kpiLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
                ) : kpiData ? (
                    <>
                        <Divider orientation="left">Chiffre d'affaire Main d'œuvre</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Statistic title="Cumulé" value={kpiData.chiffreAffaireMainOeuvre} precision={2} suffix="€" valueStyle={{ color: '#3f8600' }} prefix={<EuroCircleOutlined />} />
                            </Col>
                            <Col span={12}>
                                <Statistic title="Ce mois" value={kpiData.chiffreAffaireMainOeuvreMois} precision={2} suffix="€" valueStyle={{ color: '#3f8600' }} prefix={<EuroCircleOutlined />} />
                            </Col>
                        </Row>

                        <Divider orientation="left">Vue globale</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Statistic title="Total tâches" value={kpiData.totalTaches} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Terminées" value={kpiData.tachesTerminees} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="En cours" value={kpiData.tachesEnCours} valueStyle={{ color: '#1677ff' }} prefix={<ClockCircleOutlined />} />
                            </Col>
                        </Row>
                        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col span={8}>
                                <Statistic title="En attente" value={kpiData.tachesEnAttente} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Incidents" value={kpiData.tachesIncident} valueStyle={{ color: '#ff4d4f' }} prefix={<ExclamationCircleOutlined />} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Annulées" value={kpiData.tachesAnnulees} valueStyle={{ color: '#999' }} />
                            </Col>
                        </Row>

                        <Divider orientation="left">Taux</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <div style={{ textAlign: 'center' }}>
                                    <Progress type="circle" percent={kpiData.tauxCompletion} size={80} strokeColor="#52c41a" />
                                    <div style={{ marginTop: 8 }}>Complétion</div>
                                </div>
                            </Col>
                            <Col span={8}>
                                <div style={{ textAlign: 'center' }}>
                                    <Progress type="circle" percent={kpiData.tauxIncident} size={80} strokeColor="#ff4d4f" />
                                    <div style={{ marginTop: 8 }}>Incidents</div>
                                </div>
                            </Col>
                        </Row>

                        <Divider orientation="left">Heures</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Statistic title="Réelles" value={kpiData.heuresReelles} suffix="h" precision={1} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Retards > 48h" value={kpiData.retards48h} valueStyle={kpiData.retards48h > 0 ? { color: '#ff4d4f' } : {}} prefix={kpiData.retards48h > 0 ? <WarningOutlined /> : undefined} />
                            </Col>
                        </Row>

                        <Divider orientation="left">Alertes</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Statistic title="Tâches en retard" value={kpiData.tachesEnRetard} valueStyle={kpiData.tachesEnRetard > 0 ? { color: '#fa541c' } : {}} prefix={kpiData.tachesEnRetard > 0 ? <WarningOutlined /> : undefined} />
                            </Col>
                            <Col span={12}>
                                <Statistic title="Dépassement durée" value={kpiData.tachesDepassement} valueStyle={kpiData.tachesDepassement > 0 ? { color: '#d48806' } : {}} prefix={kpiData.tachesDepassement > 0 ? <WarningOutlined /> : undefined} />
                            </Col>
                        </Row>

                        <Divider orientation="left">Ce mois</Divider>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Statistic title="Tâches" value={kpiData.tachesMois} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Terminées" value={kpiData.tachesTermineesMois} valueStyle={{ color: '#52c41a' }} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Heures réelles" value={kpiData.heuresReellesMois} suffix="h" precision={1} />
                            </Col>
                        </Row>
                    </>
                ) : null}
            </Drawer>
        </>
    );
};

export default Techniciens;

