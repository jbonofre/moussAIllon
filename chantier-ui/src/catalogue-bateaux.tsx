import React, { useEffect, useMemo, useState } from 'react';
import { Image, Table, Rate, Row, Col, Card, Button, Modal, Form, AutoComplete, Input, InputNumber, Select, Space, Popconfirm, message } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from './api.ts';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import FournisseurBateaux from './fournisseur-bateaux.tsx';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';

const style: React.CSSProperties = { padding: '8px 0' };
const { Option } = Select;
const { Search } = Input;
const { TextArea } = Input;


interface BateauCatalogueEntity {
    id?: number;
    modele: string;
    marque: string;
    annee: number;
    images: string[];
    type: string;
    longueurExterieure: number;
    longueurCoque: number;
    hauteur: number;
    largeur: number;
    tirantAir: number;
    tirantEau: number;
    poidsVide: number;
    poidsMoteurMax: number;
    chargeMax: number;
    longueurArbre: string;
    puissanceMax: string;
    reservoirEau: number;
    reservoirCarburant: number;
    nombrePassagersMax: number;
    categorieCe: string;
}

const defaultBateau: BateauCatalogueEntity = {
    modele: '',
    marque: '',
    annee: 2025,
    images: [],
    documents: [],
    type: '',
    longueurExterieure: 0,
    longueurCoque: 0,
    hauteur: 0,
    largeur: 0,
    tirantAir: 0,
    tirantEau: 0,
    poidsVide: 0,
    poidsMoteurMax: 0,
    chargeMax: 0,
    longueurArbre: '',
    puissanceMax: '',
    reservoirEau: 0,
    reservoirCarburant: 0,
    nombrePassagersMax: 0,
    categorieCe: '',
    tva: 20,
    montantTVA: 0,
    prixVenteTTC: 0,
    prixVenteHT: 0,
    tauxMarge: 0,
    tauxMarque: 0,
    prixPublic: 0,
    frais: 0,
    stock: 0,
    stockAlerte: 0,
    emplacement: '',
    evaluation: 0,
    description: ''
};

const CatalogueBateaux: React.FC = () => {
    const bateauTypes = useReferenceValeurs('TYPE_BATEAU');
    const [bateaux, setBateaux] = useState<BateauCatalogueEntity[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [currentBateau, setCurrentBateau] = useState<BateauCatalogueEntity | null>(null);
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);

    const marqueOptions = useMemo(() => {
        const uniqueMarques = Array.from(new Set(bateaux.map((bateau) => bateau.marque))).filter(Boolean) as string[];
        return uniqueMarques.map((marque) => ({ value: marque }));
    }, [bateaux]);

    const fetchBateaux = async () => {
        setLoading(true);
        try {
            const res = await api.get('/catalogue/bateaux');
            setBateaux(res.data);
        } catch {
            message.error('Erreur lors du chargement des bateaux.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBateaux();
    }, []);

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

    const openModal = (bateau?: BateauCatalogueEntity) => {
        if (bateau) {
            setIsEdit(true);
            setCurrentBateau(bateau);
            form.setFieldsValue(bateau);
        } else {
            setIsEdit(false);
            setCurrentBateau(null);
            form.resetFields();
        }
        setFormDirty(false);
        setModalVisible(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const bateauToSave = values;

            if (isEdit && currentBateau && currentBateau.id) {
                const res = await api.put(`/catalogue/bateaux/${currentBateau.id}`, bateauToSave);
                message.success('Bateau modifié avec succès');
                setCurrentBateau(res.data);
                form.setFieldsValue(res.data);
            } else {
                const res = await api.post('/catalogue/bateaux', bateauToSave);
                message.success('Bateau ajouté avec succès');
                setIsEdit(true);
                setCurrentBateau(res.data);
                form.setFieldsValue(res.data);
            }
            setFormDirty(false);
            fetchBateaux();
        } catch (err) {
            // Validation error already shown by Form.Item
        }
    };

    const handleDelete = async (id: number | undefined) => {
        if (!id) return;
        try {
            await api.delete(`/catalogue/bateaux/${id}`);
            message.success('Bateau supprimé avec succès');
            fetchBateaux();
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    const columns = [
        {
            title: 'Marque',
            dataIndex: 'marque',
            sorter: (a,b) => a.marque.localeCompare(b.marque),
        },
        {
            title: 'Modèle',
            dataIndex: 'modele',
            render: (_,record) => (
                <Space>
                    {record.images && record.images[0] && (
                        <Image width={50} src={record.images[0]} />
                    )}
                    {record.modele}
                </Space>
            ),
            sorter: (a,b) => a.modele.localeCompare(b.modele),
        },
        {
            title: 'Type',
            dataIndex: 'type',
            sorter: (a,b) => a.type.localeCompare(b.type),
            filters: bateauTypes,
            onFilter: (value, record) => record.type === value,
        },
        {
            title: 'Evaluation',
            dataIndex: 'evaluation',
            render: (_,record) => ( <Rate defaultValue={record.evaluation} disabled={true} /> )
        },
        {
            title: 'Stock',
            dataIndex: 'stock',
            sorter: (a,b) => a.stock - b.stock,
        },
        { title: 'Prix TTC', dataIndex: 'prixVenteTTC', key: 'prixVenteTTC',
            sorter: (a, b) => a.prixVenteTTC - b.prixVenteTTC,
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: BateauCatalogueEntity) => (
                <Space>
                    <Button onClick={() => openModal(record)}>
                        <EditOutlined/> 
                    </Button>
                    <Popconfirm
                        title="Supprimer ce bateau?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Oui"
                        cancelText="Non"
                    >
                        <Button danger>
                            <DeleteOutlined/>
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const onValuesChange = (changedValues, allValues) => {
        setFormDirty(true);
        if (changedValues.prixVenteHT || changedValues.tva) {
            const prixVenteHT = form.getFieldValue('prixVenteHT');
            const tva = form.getFieldValue('tva');
            const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTVA', montantTVA);
            const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('prixVenteTTC', prixVenteTTC);
        }
        if (changedValues.prixVenteTTC) {
            const prixVenteTTC = form.getFieldValue('prixVenteTTC');
            const tva = form.getFieldValue('tva');
            const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTVA', montantTVA);
            const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('prixVenteHT', prixVenteHT);
        }
    };

    return (
        <>
            <Card title="Catalogue Bateaux">
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <div style={style}>
                        <Space>
                            <Search
                                placeholder="Recherche"
                                enterButton
                                style={{ width: 600 }}
                                allowClear={true}
                                onSearch={async (value) => {
                                    setLoading(true);
                                    try {
                                        const response = await api.get('/catalogue/bateaux/search', { params: { q: value } });
                                        setBateaux(response.data);
                                    } catch (error) {
                                        message.error('Erreur lors de la recherche');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            />
                            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                        </Space>
                    </div>
                </Col>
            </Row>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={bateaux}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        bordered
                    />
                    <Modal
                        title={isEdit ? 'Modifier un bateau' : 'Ajouter un bateau'}
                        open={modalVisible}
                        onOk={handleModalOk}
                        onCancel={handleModalCancel}
                        maskClosable={false}
                        width={1024}
                        okText="Enregistrer"
                        cancelText="Fermer"
                        destroyOnHidden
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            initialValues={defaultBateau}
                            onValuesChange={onValuesChange}
                        >
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="marque" label="Marque" rules={[{ required: true }]}>
                                        <AutoComplete
                                            allowClear
                                            options={marqueOptions}
                                            placeholder="Saisir ou sélectionner une marque"
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="modele" label="Modèle" rules={[{ required: true }]}>
                                        <Input />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                                        <Select options={bateauTypes} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="annee" label="Année">
                                        <InputNumber min={1900} max={new Date().getFullYear()} step={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="description" label="Description">
                                <Input.TextArea rows={3} placeholder="Description du bateau" />
                            </Form.Item>
                            <Form.Item name="evaluation" label="Évaluation">
                                <Rate allowHalf />
                            </Form.Item>
                            <Form.Item name="images" label="Images">
                                <ImageUpload />
                            </Form.Item>
                            <Form.Item name="documents" label="Documents">
                                <DocumentUpload />
                            </Form.Item>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="longueurExterieure" label="Longueur extérieure">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="longueurCoque" label="Longueur coque">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="hauteur" label="Hauteur">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="largeur" label="Largeur">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="tirantAir" label="Tirant d'air">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="tirantEau" label="Tirant d'eau">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="poidsVide" label="Poids à vide">
                                        <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="poidsMoteurMax" label="Poids moteur max">
                                        <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="chargeMax" label="Charge max">
                                        <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="longueurArbre" label="Longueur arbre">
                                        <Input />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="puissanceMax" label="Puissance max">
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="reservoirEau" label="Réservoir eau">
                                        <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="l" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="reservoirCarburant" label="Réservoir carburant">
                                        <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="l" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="nombrePassagersMax" label="Nombre passagers max">
                                        <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="categorieCe" label="Catégorie CE">
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="stock" label="Stock">
                                        <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="stockAlerte" label="Stock alerte">
                                        <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="emplacement" label="Emplacement">
                                        <TextArea rows={3} placeholder="Emplacement du stock bateau" allowClear={true} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="prixPublic" label="Prix public">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="frais" label="Frais">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="tauxMarge" label="Taux de marge">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="tauxMarque" label="Taux de marque">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="prixVenteHT" label="Prix de vente HT">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="tva" label="TVA">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="montantTVA" label="Montant TVA">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="prixVenteTTC" label="Prix de vente TTC">
                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        {/* Affiche la liste des fournisseurs pour ce bateau quand en modification */}
                        {isEdit && currentBateau && currentBateau.id && (
                            <FournisseurBateaux bateauId={currentBateau.id} />
                        )}
                        </Form>
                    </Modal>
                </Col>
            </Row>
            </Card>
        </>
    );
};

export default CatalogueBateaux;


