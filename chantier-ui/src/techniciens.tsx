import React, { useEffect, useState } from 'react';
import { Space, Table, Button, Input, Form, Modal, Card, Row, Col, Popconfirm, message } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';

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
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Get all techniciens
    const fetchTechniciens = async (query: string = '') => {
        setLoading(true);
        try {
            const url = query ? `/techniciens/search?q=${encodeURIComponent(query)}` : '/techniciens';
            const res = await axios.get(url);
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
            form.setFieldsValue(defaultTechnicien);
        }
        setModalVisible(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                ...values,
                couleur: values.couleur || defaultTechnicien.couleur
            };

            if (isEdit && currentTechnicien && currentTechnicien.id) {
                const res = await axios.put(`/techniciens/${currentTechnicien.id}`, { ...currentTechnicien, ...payload });
                message.success('Technicien modifié avec succès');
                setCurrentTechnicien(res.data);
                form.setFieldsValue(res.data);
            } else {
                const res = await axios.post('/techniciens', payload);
                message.success('Technicien ajouté avec succès');
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
            await axios.delete(`/techniciens/${id}`);
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
                            onCancel={() => setModalVisible(false)}
                            maskClosable={false}
                            width={1024}
                            okText="Enregistrer"
                            cancelText="Annuler"
                            destroyOnClose
                        >
                            <Form
                                form={form}
                                layout="vertical"
                                initialValues={defaultTechnicien}
                            >
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item 
                                            name="nom" 
                                            label="Nom" 
                                            rules={[{ required: true, message: "Le nom est requis" }]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item 
                                            name="prenom" 
                                            label="Prénom" 
                                            rules={[{ required: true, message: "Le prénom est requis" }]}
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
                                <Form.Item
                                    name="couleur"
                                    label="Couleur"
                                    rules={[
                                        { pattern: /^#[0-9A-Fa-f]{6}$/, message: 'Format attendu: #RRGGBB' }
                                    ]}
                                >
                                    <Input type="color" />
                                </Form.Item>
                            </Form>
                        </Modal>
                    </Col>
                </Row>
            </Card>
        </>
    );
};

export default Techniciens;

