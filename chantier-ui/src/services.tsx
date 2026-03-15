import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Space, Input, Button, Table, Modal, Form, InputNumber, Popconfirm, message } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

interface ServiceEntity {
    id?: number;
    nom: string;
    description?: string;
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

interface ServiceFormValues {
    nom: string;
    description?: string;
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

const defaultService: ServiceFormValues = {
    nom: '',
    description: '',
    prixHT: 0,
    tva: 20,
    montantTVA: 0,
    prixTTC: 0
};

export default function Services() {
    const [services, setServices] = useState<ServiceEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentService, setCurrentService] = useState<ServiceEntity | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm();

    const fetchServices = async (query?: string) => {
        setLoading(true);
        try {
            let url = '/services';
            if (query && query.trim()) {
                url = '/services/search';
            }
            const response = await axios.get(url, { params: query && query.trim() ? { q: query } : {} });
            setServices(response.data);
        } catch {
            message.error('Erreur lors du chargement des services.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const openModal = (service?: ServiceEntity) => {
        if (service) {
            setIsEdit(true);
            setCurrentService(service);
            form.setFieldsValue({
                ...defaultService,
                ...service
            });
        } else {
            setIsEdit(false);
            setCurrentService(null);
            form.resetFields();
            form.setFieldsValue(defaultService);
        }
        setModalVisible(true);
    };

    const handleDelete = async (id?: number) => {
        if (!id) {
            return;
        }
        try {
            await axios.delete(`/services/${id}`);
            message.success('Service supprimé avec succès');
            fetchServices(searchQuery);
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                ...values
            };
            if (isEdit && currentService?.id) {
                const res = await axios.put(`/services/${currentService.id}`, { ...currentService, ...payload });
                message.success('Service modifié avec succès');
                setCurrentService(res.data);
                form.setFieldsValue(res.data);
            } else {
                const res = await axios.post('/services', payload);
                message.success('Service ajouté avec succès');
                setIsEdit(true);
                setCurrentService(res.data);
                form.setFieldsValue(res.data);
            }
            fetchServices(searchQuery);
        } catch {
            // Validation errors are handled by form rules.
        }
    };

    const onValuesChange = (changedValues) => {
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
            sorter: (a: ServiceEntity, b: ServiceEntity) => (a.nom || '').localeCompare(b.nom || '')
        },
        {
            title: 'Description',
            dataIndex: 'description',
            render: (value: string) => value || '-'
        },
        {
            title: 'Prix TTC',
            dataIndex: 'prixTTC',
            sorter: (a: ServiceEntity, b: ServiceEntity) => (a.prixTTC || 0) - (b.prixTTC || 0),
            render: (value: number) => `${(value || 0).toFixed(2)} €`
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: ServiceEntity) => (
                <Space>
                    <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm
                        title="Supprimer ce service ?"
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
        <Card title="Service & Main d'Oeuvre">
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
                                fetchServices(value);
                            }}
                            onChange={(e) => {
                                if (!e.target.value) {
                                    setSearchQuery('');
                                    fetchServices();
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
                        dataSource={services}
                        columns={columns}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        bordered
                    />
                </Col>
            </Row>
            <Modal
                title={isEdit ? 'Modifier un service' : 'Ajouter un service'}
                open={modalVisible}
                onOk={handleModalOk}
                onCancel={() => setModalVisible(false)}
                okText="Enregistrer"
                cancelText="Annuler"
                maskClosable={false}
                destroyOnHidden
                width={900}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={defaultService}
                    onValuesChange={onValuesChange}
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
