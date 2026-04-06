import React, { useEffect, useMemo, useState } from 'react';
import {
    Card, Row, Col, Space, Input, Button, Table, Modal, Form, InputNumber,
    Popconfirm, message, Tabs, Select, AutoComplete
} from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import api from './api.ts';

interface MainOeuvreEntity {
    id: number;
    nom: string;
    description?: string;
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

interface ProduitCatalogueEntity {
    id: number;
    nom: string;
    marque?: string;
    prixVenteHT?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
}

interface ServiceMainOeuvreEntity {
    id?: number;
    mainOeuvre?: MainOeuvreEntity;
    quantite: number;
}

interface ServiceProduitEntity {
    id?: number;
    produit?: ProduitCatalogueEntity;
    quantite: number;
}

interface ServiceEntity {
    id?: number;
    nom: string;
    description?: string;
    mainOeuvres: ServiceMainOeuvreEntity[];
    produits: ServiceProduitEntity[];
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

interface ServiceFormValues {
    nom: string;
    description?: string;
    mainOeuvres: Array<{ mainOeuvreId?: number; quantite?: number }>;
    produits: Array<{ produitId?: number; quantite?: number }>;
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

const defaultService: ServiceFormValues = {
    nom: '',
    description: '',
    mainOeuvres: [{}],
    produits: [{}],
    prixHT: 0,
    tva: 20,
    montantTVA: 0,
    prixTTC: 0
};

const defaultNewMainOeuvre = {
    nom: '', description: '', prixHT: 0, tva: 20, montantTVA: 0, prixTTC: 0,
};

const defaultNewProduit = {
    nom: '', marque: '', categorie: '', ref: '', refs: [], images: [], description: '',
    evaluation: 0, stock: 0, stockMini: 0, emplacement: '',
    prixPublic: 0, frais: 0, tauxMarge: 0, tauxMarque: 0,
    prixVenteHT: 0, tva: 20, montantTVA: 0, prixVenteTTC: 0,
};

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} €`;

export default function Services() {
    const [services, setServices] = useState<ServiceEntity[]>([]);
    const [allMainOeuvres, setAllMainOeuvres] = useState<MainOeuvreEntity[]>([]);
    const [allProduits, setAllProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentService, setCurrentService] = useState<ServiceEntity | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm<ServiceFormValues>();

    const [formDirty, setFormDirty] = useState(false);

    const [newMainOeuvreModalVisible, setNewMainOeuvreModalVisible] = useState(false);
    const [newMainOeuvreTargetLine, setNewMainOeuvreTargetLine] = useState<number | null>(null);
    const [newMainOeuvreForm] = Form.useForm();
    const [newMainOeuvreFormDirty, setNewMainOeuvreFormDirty] = useState(false);

    const [newProduitModalVisible, setNewProduitModalVisible] = useState(false);
    const [newProduitTargetLine, setNewProduitTargetLine] = useState<number | null>(null);
    const [newProduitForm] = Form.useForm();
    const [newProduitFormDirty, setNewProduitFormDirty] = useState(false);

    const mainOeuvreOptions = useMemo(
        () => allMainOeuvres.map((mo) => ({ value: mo.id, label: mo.nom })),
        [allMainOeuvres]
    );

    const produitOptions = useMemo(
        () => allProduits.map((p) => ({ value: p.id, label: `${p.nom}${p.marque ? ` (${p.marque})` : ''}` })),
        [allProduits]
    );

    const fetchServices = async (query?: string) => {
        setLoading(true);
        try {
            let url = '/services';
            if (query && query.trim()) {
                url = '/services/search';
            }
            const response = await api.get(url, { params: query && query.trim() ? { q: query } : {} });
            setServices(response.data);
        } catch {
            message.error('Erreur lors du chargement des services.');
        }
        setLoading(false);
    };

    const fetchOptions = async () => {
        try {
            const [moRes, prodRes] = await Promise.all([
                api.get('/main-oeuvres'),
                api.get('/catalogue/produits')
            ]);
            setAllMainOeuvres(moRes.data || []);
            setAllProduits(prodRes.data || []);
        } catch {
            message.error('Erreur lors du chargement des listes de référence.');
        }
    };

    useEffect(() => {
        fetchServices();
        fetchOptions();
    }, []);

    const openModal = (service?: ServiceEntity) => {
        if (service) {
            setIsEdit(true);
            setCurrentService(service);
            form.setFieldsValue({
                nom: service.nom || '',
                description: service.description || '',
                mainOeuvres: (service.mainOeuvres || [])
                    .filter((item) => item.mainOeuvre?.id)
                    .map((item) => ({ mainOeuvreId: item.mainOeuvre!.id, quantite: item.quantite || 1 }))
                    .concat({}),
                produits: (service.produits || [])
                    .filter((item) => item.produit?.id)
                    .map((item) => ({ produitId: item.produit!.id, quantite: item.quantite || 1 }))
                    .concat({}),
                prixHT: service.prixHT || 0,
                tva: service.tva || 0,
                montantTVA: service.montantTVA || 0,
                prixTTC: service.prixTTC || 0
            });
        } else {
            setIsEdit(false);
            setCurrentService(null);
            form.resetFields();
            form.setFieldsValue(defaultService);
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

    const handleNewMainOeuvreCancel = () => {
        if (newMainOeuvreFormDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setNewMainOeuvreFormDirty(false);
                    setNewMainOeuvreModalVisible(false);
                },
            });
        } else {
            setNewMainOeuvreModalVisible(false);
        }
    };

    const handleNewProduitCancel = () => {
        if (newProduitFormDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setNewProduitFormDirty(false);
                    setNewProduitModalVisible(false);
                },
            });
        } else {
            setNewProduitModalVisible(false);
        }
    };

    const toPayload = (values: ServiceFormValues): Partial<ServiceEntity> => ({
        nom: values.nom,
        description: values.description,
        mainOeuvres: (values.mainOeuvres || [])
            .filter((item) => item.mainOeuvreId)
            .map((item) => ({
                mainOeuvre: allMainOeuvres.find((mo) => mo.id === item.mainOeuvreId),
                quantite: item.quantite || 1
            })),
        produits: (values.produits || [])
            .filter((item) => item.produitId)
            .map((item) => ({
                produit: allProduits.find((p) => p.id === item.produitId),
                quantite: item.quantite || 1
            })),
        prixHT: values.prixHT || 0,
        tva: values.tva || 0,
        montantTVA: values.montantTVA || 0,
        prixTTC: values.prixTTC || 0
    });

    const handleDelete = async (id?: number) => {
        if (!id) {
            return;
        }
        try {
            await api.delete(`/services/${id}`);
            message.success('Service supprimé avec succès');
            fetchServices(searchQuery);
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const payload = toPayload(values);
            if (isEdit && currentService?.id) {
                const res = await api.put(`/services/${currentService.id}`, { ...currentService, ...payload });
                message.success('Service modifié avec succès');
                setCurrentService(res.data);
            } else {
                const res = await api.post('/services', payload);
                message.success('Service ajouté avec succès');
                setIsEdit(true);
                setCurrentService(res.data);
            }
            setFormDirty(false);
            fetchServices(searchQuery);
        } catch {
            // Validation errors are handled by form rules.
        }
    };

    const onValuesChange = (changedValues: Partial<ServiceFormValues>, allValues: ServiceFormValues) => {
        if (changedValues.mainOeuvres !== undefined) {
            const currentLines = allValues.mainOeuvres || [];
            if (currentLines.length === 0) {
                form.setFieldValue('mainOeuvres', [{}]);
                return;
            }
            const lastLine = currentLines[currentLines.length - 1];
            if (!!lastLine?.mainOeuvreId && (lastLine?.quantite || 0) > 0) {
                form.setFieldValue('mainOeuvres', [...currentLines, {}]);
            }
        }

        if (changedValues.produits !== undefined) {
            const currentLines = allValues.produits || [];
            if (currentLines.length === 0) {
                form.setFieldValue('produits', [{}]);
                return;
            }
            const lastLine = currentLines[currentLines.length - 1];
            if (!!lastLine?.produitId && (lastLine?.quantite || 0) > 0) {
                form.setFieldValue('produits', [...currentLines, {}]);
            }
        }

        // Recalculate totals when lines change
        if (changedValues.mainOeuvres !== undefined || changedValues.produits !== undefined) {
            const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
            const moValues = form.getFieldValue('mainOeuvres') || [];
            const prodValues = form.getFieldValue('produits') || [];

            const totalMoTTC = moValues.reduce((total: number, item: { mainOeuvreId?: number; quantite?: number }) => {
                const prixUnitaireTTC = allMainOeuvres.find((mo) => mo.id === item.mainOeuvreId)?.prixTTC || 0;
                return total + (prixUnitaireTTC * (item.quantite || 0));
            }, 0);

            const totalProdTTC = prodValues.reduce((total: number, item: { produitId?: number; quantite?: number }) => {
                const prixUnitaireTTC = allProduits.find((p) => p.id === item.produitId)?.prixVenteTTC || 0;
                return total + (prixUnitaireTTC * (item.quantite || 0));
            }, 0);

            const prixTTC = round2(totalMoTTC + totalProdTTC);
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = round2((prixTTC / (100 + tva)) * tva);
            const prixHT = round2(prixTTC - montantTVA);

            form.setFieldValue('prixTTC', prixTTC);
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixHT', prixHT);
        }

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

    // New Main d'Oeuvre inline creation
    const openNewMainOeuvreModal = (lineIndex: number) => {
        setNewMainOeuvreTargetLine(lineIndex);
        newMainOeuvreForm.resetFields();
        newMainOeuvreForm.setFieldsValue(defaultNewMainOeuvre);
        setNewMainOeuvreFormDirty(false);
        setNewMainOeuvreModalVisible(true);
    };

    const handleNewMainOeuvreSave = async () => {
        try {
            const values = await newMainOeuvreForm.validateFields();
            const res = await api.post('/main-oeuvres', values);
            const created = res.data as MainOeuvreEntity;
            message.success("Main d'oeuvre ajoutée avec succès");
            setAllMainOeuvres((prev) => [...prev, created]);
            if (newMainOeuvreTargetLine !== null && created.id) {
                const currentLines = form.getFieldValue('mainOeuvres') || [];
                const updated = [...currentLines];
                updated[newMainOeuvreTargetLine] = { ...updated[newMainOeuvreTargetLine], mainOeuvreId: created.id };
                form.setFieldValue('mainOeuvres', updated);
            }
            setNewMainOeuvreFormDirty(false);
            setNewMainOeuvreModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const onNewMainOeuvreValuesChange = (changedValues: Record<string, unknown>) => {
        if (changedValues.prixHT !== undefined || changedValues.tva !== undefined) {
            const prixHT = newMainOeuvreForm.getFieldValue('prixHT') || 0;
            const tva = newMainOeuvreForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            newMainOeuvreForm.setFieldValue('montantTVA', montantTVA);
            newMainOeuvreForm.setFieldValue('prixTTC', Math.round(((prixHT + montantTVA) + Number.EPSILON) * 100) / 100);
        }
        if (changedValues.prixTTC !== undefined) {
            const prixTTC = newMainOeuvreForm.getFieldValue('prixTTC') || 0;
            const tva = newMainOeuvreForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            newMainOeuvreForm.setFieldValue('montantTVA', montantTVA);
            newMainOeuvreForm.setFieldValue('prixHT', Math.round(((prixTTC - montantTVA) + Number.EPSILON) * 100) / 100);
        }
    };

    // New Produit inline creation
    const openNewProduitModal = (lineIndex: number) => {
        setNewProduitTargetLine(lineIndex);
        newProduitForm.resetFields();
        newProduitForm.setFieldsValue(defaultNewProduit);
        setNewProduitFormDirty(false);
        setNewProduitModalVisible(true);
    };

    const handleNewProduitSave = async () => {
        try {
            const values = await newProduitForm.validateFields();
            values.images = values.images || [];
            const res = await api.post('/catalogue/produits', values);
            const created = res.data as ProduitCatalogueEntity;
            message.success('Produit ajouté avec succès');
            setAllProduits((prev) => [...prev, created]);
            if (newProduitTargetLine !== null && created.id) {
                const currentLines = form.getFieldValue('produits') || [];
                const updated = [...currentLines];
                updated[newProduitTargetLine] = { ...updated[newProduitTargetLine], produitId: created.id };
                form.setFieldValue('produits', updated);
            }
            setNewProduitFormDirty(false);
            setNewProduitModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const onNewProduitValuesChange = (changedValues: Record<string, unknown>) => {
        if (changedValues.prixVenteHT !== undefined || changedValues.tva !== undefined) {
            const prixVenteHT = newProduitForm.getFieldValue('prixVenteHT') || 0;
            const tva = newProduitForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            newProduitForm.setFieldValue('montantTVA', montantTVA);
            newProduitForm.setFieldValue('prixVenteTTC', Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100);
        }
        if (changedValues.prixVenteTTC !== undefined) {
            const prixVenteTTC = newProduitForm.getFieldValue('prixVenteTTC') || 0;
            const tva = newProduitForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            newProduitForm.setFieldValue('montantTVA', montantTVA);
            newProduitForm.setFieldValue('prixVenteHT', Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100);
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
            title: "Main d'Oeuvres",
            dataIndex: 'mainOeuvres',
            render: (values: ServiceMainOeuvreEntity[]) => values?.length || 0
        },
        {
            title: 'Produits',
            dataIndex: 'produits',
            render: (values: ServiceProduitEntity[]) => values?.length || 0
        },
        {
            title: 'Prix TTC',
            dataIndex: 'prixTTC',
            sorter: (a: ServiceEntity, b: ServiceEntity) => (a.prixTTC || 0) - (b.prixTTC || 0),
            render: (value: number) => formatEuro(value)
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
        <Card title="Services">
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
                onCancel={handleModalCancel}
                okText="Enregistrer"
                cancelText="Fermer"
                maskClosable={false}
                destroyOnHidden
                width={1000}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={defaultService}
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
                        <Input.TextArea rows={2} allowClear />
                    </Form.Item>

                    <Tabs
                        defaultActiveKey="mainOeuvres"
                        items={[
                            {
                                key: 'mainOeuvres',
                                label: "Main d'Oeuvres",
                                children: (
                                    <Form.List name="mainOeuvres">
                                        {(fields, { remove }) => (
                                            <>
                                                {fields.map((field, index) => (
                                                    <Row gutter={8} key={field.key} align="middle">
                                                        <Col span={14}>
                                                            <Form.Item
                                                                {...field}
                                                                name={[field.name, 'mainOeuvreId']}
                                                                label={index === 0 ? "Main d'Oeuvre" : undefined}
                                                            >
                                                                <Select
                                                                    showSearch
                                                                    allowClear
                                                                    placeholder="Sélectionner une main d'oeuvre"
                                                                    options={mainOeuvreOptions}
                                                                    filterOption={(input, option) =>
                                                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                                    }
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={5}>
                                                            <Form.Item
                                                                {...field}
                                                                name={[field.name, 'quantite']}
                                                                label={index === 0 ? 'Quantité' : undefined}
                                                            >
                                                                <InputNumber min={0.25} step={0.25} style={{ width: '100%' }} />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={3}>
                                                            <Form.Item label={index === 0 ? ' ' : undefined}>
                                                                <Button
                                                                    icon={<PlusOutlined />}
                                                                    onClick={() => openNewMainOeuvreModal(index)}
                                                                    title="Créer une main d'oeuvre"
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={2}>
                                                            <Form.Item label={index === 0 ? ' ' : undefined}>
                                                                {fields.length > 1 && (
                                                                    <Button
                                                                        danger
                                                                        icon={<DeleteOutlined />}
                                                                        onClick={() => remove(field.name)}
                                                                    />
                                                                )}
                                                            </Form.Item>
                                                        </Col>
                                                    </Row>
                                                ))}
                                            </>
                                        )}
                                    </Form.List>
                                )
                            },
                            {
                                key: 'produits',
                                label: 'Produits',
                                children: (
                                    <Form.List name="produits">
                                        {(fields, { remove }) => (
                                            <>
                                                {fields.map((field, index) => (
                                                    <Row gutter={8} key={field.key} align="middle">
                                                        <Col span={14}>
                                                            <Form.Item
                                                                {...field}
                                                                name={[field.name, 'produitId']}
                                                                label={index === 0 ? 'Produit' : undefined}
                                                            >
                                                                <Select
                                                                    showSearch
                                                                    allowClear
                                                                    placeholder="Sélectionner un produit"
                                                                    options={produitOptions}
                                                                    filterOption={(input, option) =>
                                                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                                    }
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={5}>
                                                            <Form.Item
                                                                {...field}
                                                                name={[field.name, 'quantite']}
                                                                label={index === 0 ? 'Quantité' : undefined}
                                                            >
                                                                <InputNumber min={1} style={{ width: '100%' }} />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={3}>
                                                            <Form.Item label={index === 0 ? ' ' : undefined}>
                                                                <Button
                                                                    icon={<PlusOutlined />}
                                                                    onClick={() => openNewProduitModal(index)}
                                                                    title="Créer un produit"
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={2}>
                                                            <Form.Item label={index === 0 ? ' ' : undefined}>
                                                                {fields.length > 1 && (
                                                                    <Button
                                                                        danger
                                                                        icon={<DeleteOutlined />}
                                                                        onClick={() => remove(field.name)}
                                                                    />
                                                                )}
                                                            </Form.Item>
                                                        </Col>
                                                    </Row>
                                                ))}
                                            </>
                                        )}
                                    </Form.List>
                                )
                            }
                        ]}
                    />

                    <Row gutter={16} style={{ marginTop: 16 }}>
                        <Col span={6}>
                            <Form.Item name="prixHT" label="Prix HT">
                                <InputNumber
                                    addonAfter="€"
                                    min={0}
                                    step={0.01}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
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
                        <Col span={6}>
                            <Form.Item name="montantTVA" label="Montant TVA">
                                <InputNumber
                                    addonAfter="€"
                                    min={0}
                                    step={0.01}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
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

            {/* Modal création Main d'Oeuvre */}
            <Modal
                title="Créer une Main d'Oeuvre"
                open={newMainOeuvreModalVisible}
                onOk={handleNewMainOeuvreSave}
                onCancel={handleNewMainOeuvreCancel}
                okText="Enregistrer"
                cancelText="Fermer"
                maskClosable={false}
                destroyOnHidden
                width={700}
            >
                <Form form={newMainOeuvreForm} layout="vertical" initialValues={defaultNewMainOeuvre} onValuesChange={(...args) => { setNewMainOeuvreFormDirty(true); onNewMainOeuvreValuesChange(...args); }}>
                    <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                        <Input allowClear />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={2} allowClear />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item name="prixHT" label="Prix HT">
                                <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="tva" label="TVA (%)">
                                <InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="montantTVA" label="Montant TVA">
                                <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="prixTTC" label="Prix TTC">
                                <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* Modal création Produit */}
            <Modal
                title="Créer un Produit"
                open={newProduitModalVisible}
                onOk={handleNewProduitSave}
                onCancel={handleNewProduitCancel}
                okText="Enregistrer"
                cancelText="Fermer"
                maskClosable={false}
                destroyOnHidden
                width={700}
            >
                <Form form={newProduitForm} layout="vertical" initialValues={defaultNewProduit} onValuesChange={(...args) => { setNewProduitFormDirty(true); onNewProduitValuesChange(...args); }}>
                    <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                        <Input allowClear />
                    </Form.Item>
                    <Form.Item name="marque" label="Marque">
                        <Input allowClear />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={2} allowClear />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item name="prixVenteHT" label="Prix Vente HT">
                                <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="tva" label="TVA (%)">
                                <InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="montantTVA" label="Montant TVA">
                                <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="prixVenteTTC" label="Prix Vente TTC">
                                <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </Card>
    );
}
