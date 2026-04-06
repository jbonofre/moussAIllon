import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Space, Input, Button, Table, Modal, Form, InputNumber, Popconfirm, message } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from './api.ts';

interface MainOeuvreEntity {
    id?: number;
    nom: string;
    description?: string;
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

interface MainOeuvreFormValues {
    nom: string;
    description?: string;
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

const defaultMainOeuvre: MainOeuvreFormValues = {
    nom: '',
    description: '',
    prixHT: 0,
    tva: 20,
    montantTVA: 0,
    prixTTC: 0
};

export default function MainOeuvres() {
    const [mainOeuvres, setMainOeuvres] = useState<MainOeuvreEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentMainOeuvre, setCurrentMainOeuvre] = useState<MainOeuvreEntity | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);

    const fetchMainOeuvres = async (query?: string) => {
        setLoading(true);
        try {
            let url = '/main-oeuvres';
            if (query && query.trim()) {
                url = '/main-oeuvres/search';
            }
            const response = await api.get(url, { params: query && query.trim() ? { q: query } : {} });
            setMainOeuvres(response.data);
        } catch {
            message.error("Erreur lors du chargement des main d'oeuvres.");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchMainOeuvres();
    }, []);

    const openModal = (mainOeuvre?: MainOeuvreEntity) => {
        if (mainOeuvre) {
            setIsEdit(true);
            setCurrentMainOeuvre(mainOeuvre);
            form.setFieldsValue({
                ...defaultMainOeuvre,
                ...mainOeuvre
            });
        } else {
            setIsEdit(false);
            setCurrentMainOeuvre(null);
            form.resetFields();
            form.setFieldsValue(defaultMainOeuvre);
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

    const handleDelete = async (id?: number) => {
        if (!id) {
            return;
        }
        try {
            await api.delete(`/main-oeuvres/${id}`);
            message.success("Main d'oeuvre supprimée avec succès");
            fetchMainOeuvres(searchQuery);
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const payload = { ...values };
            if (isEdit && currentMainOeuvre?.id) {
                const res = await api.put(`/main-oeuvres/${currentMainOeuvre.id}`, { ...currentMainOeuvre, ...payload });
                message.success("Main d'oeuvre modifiée avec succès");
                setCurrentMainOeuvre(res.data);
                form.setFieldsValue(res.data);
            } else {
                const res = await api.post('/main-oeuvres', payload);
                message.success("Main d'oeuvre ajoutée avec succès");
                setIsEdit(true);
                setCurrentMainOeuvre(res.data);
                form.setFieldsValue(res.data);
            }
            setFormDirty(false);
            fetchMainOeuvres(searchQuery);
        } catch {
            // Validation errors are handled by form rules.
        }
    };

    const onValuesChange = (changedValues: Record<string, unknown>) => {
        if (changedValues.prixHT !== undefined || changedValues.tva !== undefined) {
            const prixHT = form.getFieldValue('prixHT') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            const prixTTC = Math.round(((prixHT + montantTVA) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixTTC', prixTTC);
        }

        if (changedValues.prixTTC !== undefined) {
            const prixTTC = form.getFieldValue('prixTTC') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            const prixHT = Math.round(((prixTTC - montantTVA) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixHT', prixHT);
        }
    };

    const columns = [
        {
            title: 'Nom',
            dataIndex: 'nom',
            sorter: (a: MainOeuvreEntity, b: MainOeuvreEntity) => (a.nom || '').localeCompare(b.nom || '')
        },
        {
            title: 'Description',
            dataIndex: 'description',
            render: (value: string) => value || '-'
        },
        {
            title: 'Prix TTC',
            dataIndex: 'prixTTC',
            sorter: (a: MainOeuvreEntity, b: MainOeuvreEntity) => (a.prixTTC || 0) - (b.prixTTC || 0),
            render: (value: number) => `${(value || 0).toFixed(2)} €`
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: MainOeuvreEntity) => (
                <Space>
                    <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm
                        title="Supprimer cette main d'oeuvre ?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Oui"
                        cancelText="Non"
                    >
                        <Button danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Card title="Main d'Oeuvres">
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Space>
                        <Input.Search
                            placeholder="Recherche"
                            enterButton
                            allowClear
                            style={{ width: 600 }}
                            onSearch={(value) => {
                                setSearchQuery(value);
                                fetchMainOeuvres(value);
                            }}
                            onChange={(e) => {
                                if (!e.target.value) {
                                    setSearchQuery('');
                                    fetchMainOeuvres();
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
                        dataSource={mainOeuvres}
                        columns={columns}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        bordered
                    />
                </Col>
            </Row>
            <Modal
                title={isEdit ? "Modifier une main d'oeuvre" : "Ajouter une main d'oeuvre"}
                open={modalVisible}
                onOk={handleModalOk}
                onCancel={handleModalCancel}
                okText="Enregistrer"
                cancelText="Fermer"
                maskClosable={false}
                destroyOnHidden
                width={900}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={defaultMainOeuvre}
                    onValuesChange={(...args) => { setFormDirty(true); onValuesChange(...args); }}
                >
                    <Form.Item
                        name="nom"
                        label="Nom"
                        rules={[{ required: true, message: 'Le nom est requis' }]}
                    >
                        <Input allowClear />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={3} allowClear />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="prixHT" label="Prix HT">
                                <InputNumber
                                    addonAfter="€"
                                    min={0}
                                    step={0.01}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="tva" label="TVA (%)">
                                <InputNumber
                                    addonAfter="%"
                                    min={0}
                                    max={100}
                                    step={0.01}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="montantTVA" label="Montant TVA">
                                <InputNumber
                                    addonAfter="€"
                                    min={0}
                                    step={0.01}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="prixTTC" label="Prix TTC">
                                <InputNumber
                                    addonAfter="€"
                                    min={0}
                                    step={0.01}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </Card>
    );
}
