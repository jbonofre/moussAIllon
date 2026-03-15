import React, { useEffect, useMemo, useState } from 'react';
import { Image, Table, Rate, Row, Col, Card, Button, Modal, Form, AutoComplete, Input, InputNumber, Select, Space, Popconfirm, message } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import FournisseurProduits from './fournisseur-produits.tsx';

// --- Types ---

interface ProduitCatalogueEntity {
    id?: number;
    nom: string;
    marque: string;
    categorie: string;
    ref: string;
    refs?: string[];
    images?: string[];
    description?: string;
    evaluation?: number;
    stock?: number;
    stockMini?: number;
    emplacement?: string;
    prixPublic?: number;
    frais?: number;
    tauxMarge?: number;
    tauxMarque?: number;
    prixVenteHT?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
}

const defaultProduit: ProduitCatalogueEntity = {
    nom: '',
    marque: '',
    categorie: '',
    ref: '',
    refs: [],
    images: [],
    description: '',
    evaluation: 0,
    stock: 0,
    stockMini: 0,
    emplacement: '',
    prixPublic: 0,
    frais: 0,
    tauxMarge: 0,
    tauxMarque: 0,
    prixVenteHT: 0,
    tva: 20,
    montantTVA: 0,
    prixVenteTTC: 0
};

const CATEGORIES = [
    { text: 'Pièces Moteur', value: 'Pièces Moteur', label: 'Pièces Moteur' },
    { text: 'Pièces Remorque', value: 'Pièces Remorque', label: 'Pièces Remorque' },
    { text: 'Electronique', value: 'Electronique', label: 'Electronique' },
    { text: 'Sécurité', value: 'Sécurité', label: 'Sécurité' },
    { text: 'Equipement & Accessoires', value: 'Equipement & Accessoires', label: 'Equipement & Accessoires' },
    { text: 'Loisirs', value: 'Loisirs', label: 'Loisirs' },
];

// --- Component ---

const CatalogueProduits: React.FC = () => {
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [currentProduit, setCurrentProduit] = useState<ProduitCatalogueEntity | null>(null);
    const [form] = Form.useForm();

    // Unique marque options
    const marqueOptions = useMemo(() => {
        const unique = Array.from(new Set(produits.map(p => p.marque))).filter(Boolean) as string[];
        return unique.map(marque => ({ value: marque }));
    }, [produits]);

    // Get all produits
    const fetchProduits = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/catalogue/produits');
            setProduits(res.data);
        } catch {
            message.error('Erreur lors du chargement des produits.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchProduits();
    }, []);

    const openModal = (produit?: ProduitCatalogueEntity) => {
        if (produit) {
            setIsEdit(true);
            setCurrentProduit(produit);
            form.setFieldsValue({
                ...defaultProduit,
                ...produit,
                images: produit.images && produit.images.length > 0
                    ? produit.images
                    : [],
            });
        } else {
            setIsEdit(false);
            setCurrentProduit(null);
            form.resetFields();
            form.setFieldsValue(defaultProduit);
        }
        setModalVisible(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            values.images = values.images || [];
            if (isEdit && currentProduit && currentProduit.id) {
                const res = await axios.put(`/catalogue/produits/${currentProduit.id}`, { ...currentProduit, ...values });
                message.success('Produit modifié avec succès');
                setCurrentProduit(res.data);
                form.setFieldsValue({ ...defaultProduit, ...res.data, images: res.data.images || [] });
            } else {
                const res = await axios.post('/catalogue/produits', values);
                message.success('Produit ajouté avec succès');
                setIsEdit(true);
                setCurrentProduit(res.data);
                form.setFieldsValue({ ...defaultProduit, ...res.data, images: res.data.images || [] });
            }
            fetchProduits();
        } catch (err) {
            // form validation error
        }
    };

    const handleDelete = async (id: number | undefined) => {
        if (!id) return;
        try {
            await axios.delete(`/catalogue/produits/${id}`);
            message.success('Produit supprimé avec succès');
            fetchProduits();
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    // Columns
    const columns = [
        {
            title: 'Nom',
            dataIndex: 'nom',
            render: (_: string, record: ProduitCatalogueEntity) => (
                <Space>
                    {record.images && record.images[0] && (
                        <Image src={record.images[0]} width={40} />
                    )}
                    {record.nom}
                </Space>
            ),
            sorter: (a: ProduitCatalogueEntity, b: ProduitCatalogueEntity) => a.nom.localeCompare(b.nom),
        },
        {
            title: 'Marque',
            dataIndex: 'marque',
            sorter: (a: ProduitCatalogueEntity, b: ProduitCatalogueEntity) => (a.marque || '').localeCompare(b.marque || ''),
        },
        {
            title: 'Catégorie',
            dataIndex: 'categorie',
            filters: CATEGORIES,
            onFilter: (value, record) => record.categorie === value,
            sorter: (a: ProduitCatalogueEntity, b: ProduitCatalogueEntity) => (a.categorie || '').localeCompare(b.categorie || ''),
        },
        {
            title: 'Référence',
            dataIndex: 'ref',
            sorter: (a: ProduitCatalogueEntity, b: ProduitCatalogueEntity) => (a.ref || '').localeCompare(b.ref || ''),
        },
        {
            title: 'Evaluation',
            dataIndex: 'evaluation',
            render: (value: number) => <Rate defaultValue={value} disabled={true} />,
        },
        {
            title: 'Stock',
            dataIndex: 'stock',
            sorter: (a: ProduitCatalogueEntity, b: ProduitCatalogueEntity) => (a.stock || 0) - (b.stock || 0),
        },
        {
            title: 'Prix TTC',
            dataIndex: 'prixVenteTTC',
            key: 'prixVenteTTC',
            render: (value: number) => value ? value.toFixed(2) + " €" : "",
            sorter: (a: ProduitCatalogueEntity, b: ProduitCatalogueEntity) => (a.prixVenteTTC || 0) - (b.prixVenteTTC || 0),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: ProduitCatalogueEntity) => (
                <Space>
                    <Button onClick={() => openModal(record)} icon={<EditOutlined/>} />
                    <Popconfirm
                        title="Supprimer ce produit ?"
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

    // prix/tva calculation autocalc
    const onValuesChange = (changedValues, allValues) => {
        if (changedValues.prixVenteHT !== undefined || changedValues.tva !== undefined) {
            const prixVenteHT = form.getFieldValue('prixVenteHT') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTVA', montantTVA);
            const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('prixVenteTTC', prixVenteTTC);
        }
        if (changedValues.prixVenteTTC !== undefined) {
            const prixVenteTTC = form.getFieldValue('prixVenteTTC') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTVA', montantTVA);
            const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('prixVenteHT', prixVenteHT);
        }
    };

    // --- UI Render ---

    return (
        <>
            <Card title="Catalogue Produits">
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Space>
                            <Input.Search
                                placeholder="Recherche"
                                enterButton
                                allowClear
                                style={{ width: 600 }}
                                onSearch={async (value) => {
                                    setLoading(true);
                                    try {
                                        const r = await axios.get('/catalogue/produits/search', { params: { q: value } });
                                        setProduits(r.data);
                                    } catch {
                                        message.error('Erreur lors de la recherche');
                                    } finally {
                                        setLoading(false);
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
                            dataSource={produits}
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                            bordered
                        />
                        <Modal
                            title={isEdit ? 'Modifier un produit' : 'Ajouter un produit'}
                            open={modalVisible}
                            onOk={handleModalOk}
                            onCancel={() => setModalVisible(false)}
                            maskClosable={false}
                            width={1024}
                            okText="Enregistrer"
                            cancelText="Annuler"
                            destroyOnHidden
                        >
                            <Form
                                form={form}
                                layout="vertical"
                                initialValues={defaultProduit}
                                onValuesChange={onValuesChange}
                            >
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="nom" label="Nom" rules={[{ required: true, message: "Le nom est requis" }]}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="categorie" label="Catégorie" rules={[{ required: true, message: "La catégorie est requise" }]}>
                                            <Select options={CATEGORIES} placeholder="Choisir une catégorie" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="marque" label="Marque">
                                            <AutoComplete allowClear options={marqueOptions} placeholder="Saisir/select. une marque" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="ref" label="Référence interne">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item name="image" label="Image principale">
                                    <Input placeholder="URL de l'image (affichée en liste)" />
                                </Form.Item>
                                <Form.Item name="images" label="Images">
                                    <Form.List name="images">
                                        {(fields, { add, remove }) => (
                                            <>
                                                {fields.map((field, index) => (
                                                    <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                        <Form.Item
                                                            {...field}
                                                            name={[field.name]}
                                                            fieldKey={[field.fieldKey ?? field.key]}
                                                            rules={[{ required: true, message: 'Veuillez entrer une URL d\'image' }]}
                                                            style={{ flex: 1 }}
                                                        >
                                                            <Input placeholder="URL de l'image" style={{ width: '100%' }} />
                                                        </Form.Item>
                                                        <Button
                                                            icon={<DeleteOutlined />}
                                                            danger
                                                            onClick={() => remove(field.name)}
                                                        />
                                                        {form.getFieldValue(['images', index]) &&
                                                            <Image width={80} src={form.getFieldValue(['images', index])} />
                                                        }
                                                    </Space>
                                                ))}
                                                <Button type="dashed" onClick={() => add()} block icon={<PlusCircleOutlined />}>
                                                    Ajouter une image
                                                </Button>
                                            </>
                                        )}
                                    </Form.List>
                                </Form.Item>
                                <Form.Item name="refs" label="Références complémentaires">
                                    <Form.List name="refs">
                                        {(fields, { add, remove }) => (
                                            <>
                                                {fields.map((field, idx) => (
                                                    <Space key={field.key} align="baseline">
                                                        <Form.Item
                                                            {...field}
                                                            name={[field.name]}
                                                            fieldKey={[field.fieldKey ?? field.key]}
                                                            style={{ flex: 1 }}
                                                        >
                                                            <Input placeholder="Réf. complémentaire" style={{ width: 200 }} />
                                                        </Form.Item>
                                                        <Button icon={<DeleteOutlined />} danger onClick={() => remove(field.name)} />
                                                    </Space>
                                                ))}
                                                <Button type="dashed" onClick={() => add()} block style={{ marginTop: 8 }}>
                                                    Ajouter une référence
                                                </Button>
                                            </>
                                        )}
                                    </Form.List>
                                </Form.Item>
                                <Form.Item name="description" label="Description">
                                    <Input.TextArea rows={3} placeholder="Description du produit" allowClear />
                                </Form.Item>
                                <Form.Item name="evaluation" label="Évaluation">
                                    <Rate allowHalf />
                                </Form.Item>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="stock" label="Stock">
                                            <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="stockMini" label="Stock minimal d'alerte">
                                            <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item name="emplacement" label="Emplacement">
                                    <Input />
                                </Form.Item>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="prixPublic" label="Prix public">
                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="frais" label="Frais">
                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="tauxMarge" label="Taux de marge (%)">
                                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="tauxMarque" label="Taux de marque (%)">
                                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="prixVenteHT" label="Prix de vente HT">
                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="tva" label="TVA (%)">
                                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="montantTVA" label="Montant TVA">
                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="prixVenteTTC" label="Prix de vente TTC">
                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form>
                            {isEdit && currentProduit && currentProduit.id && (
                            <FournisseurProduits produitId={currentProduit?.id} />  
                            )}
                        </Modal>
                    </Col>
                </Row>
            </Card>
        </>
    );
};

export default CatalogueProduits;
