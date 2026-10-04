import React, { useEffect, useState } from 'react';
import { Rate, Row, Col, Button, Modal, Form, Input, InputNumber, Select, Space, Spin, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import api from './api.ts';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import FournisseurProduits from './fournisseur-produits.tsx';
import ProduitHistorique from './produit-historique.tsx';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';

// --- Types ---

export interface ProduitCatalogueEntity {
    id?: number;
    designation: string;
    categorie: string;
    ref: string;
    refs?: string[];
    images?: string[];
    documents?: string[];
    description?: string;
    anneeDebut?: number;
    anneeFin?: number;
    evaluation?: number;
    stock?: number;
    stockMini?: number;
    emplacement?: string;
    emplacementMagasin?: string;
    prixVenteHT?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
}

const defaultProduit: ProduitCatalogueEntity = {
    designation: '',
    categorie: '',
    ref: '',
    refs: [],
    images: [],
    documents: [],
    description: '',
    anneeDebut: new Date().getFullYear(),
    anneeFin: new Date().getFullYear(),
    evaluation: 0,
    stock: 0,
    stockMini: 0,
    emplacement: '',
    emplacementMagasin: '',
    prixVenteHT: 0,
    tva: 20,
    montantTVA: 0,
    prixVenteTTC: 0
};

export interface ProduitFormModalProps {
    open: boolean;
    // Produit à modifier ; absent pour une création
    produit?: ProduitCatalogueEntity | null;
    onClose: () => void;
    onSaved?: (produit: ProduitCatalogueEntity) => void;
}

// --- Component ---

export default function ProduitFormModal({ open, produit, onClose, onSaved }: ProduitFormModalProps) {
    const CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');
    const [currentProduit, setCurrentProduit] = useState<ProduitCatalogueEntity | null>(produit || null);
    const [wasOpen, setWasOpen] = useState<boolean>(open);
    const [loading, setLoading] = useState<boolean>(false);
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);

    // À l'ouverture, on repart du produit demandé dès le premier rendu
    // (sinon les fournisseurs du produit précédent seraient chargés avant d'être remplacés)
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setCurrentProduit(produit || null);
    }

    const isEdit = !!(currentProduit && currentProduit.id);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setFormDirty(false);
        form.resetFields();
        form.setFieldsValue({ ...defaultProduit, ...produit, images: produit?.images || [] });
        if (produit?.id) {
            // Recharge le produit pour ne pas écraser le stock avec une valeur périmée
            setLoading(true);
            api.get(`/catalogue/produits/${produit.id}`)
                .then((res) => {
                    if (cancelled || !res.data) return;
                    setCurrentProduit(res.data);
                    form.setFieldsValue({ ...defaultProduit, ...res.data, images: res.data.images || [] });
                })
                .catch(() => {
                    // on garde les données déjà chargées
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }
        return () => {
            cancelled = true;
            setLoading(false);
        };
        // eslint-disable-next-line
    }, [open]);

    const handleModalCancel = () => {
        if (formDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setFormDirty(false);
                    onClose();
                },
            });
        } else {
            onClose();
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            values.images = values.images || [];
            values.documents = values.documents || [];
            let res;
            if (isEdit) {
                res = await api.put(`/catalogue/produits/${currentProduit.id}`, { ...currentProduit, ...values });
                message.success('Produit modifié avec succès');
            } else {
                res = await api.post('/catalogue/produits', values);
                message.success('Produit ajouté avec succès');
            }
            setCurrentProduit(res.data);
            form.setFieldsValue({ ...defaultProduit, ...res.data, images: res.data.images || [] });
            setFormDirty(false);
            onSaved?.(res.data);
        } catch (err) {
            // form validation error
        }
    };

    // prix/tva calculation autocalc
    const onValuesChange = (changedValues) => {
        setFormDirty(true);
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

    return (
        <Modal
            title={isEdit ? 'Modifier un produit' : 'Ajouter un produit'}
            open={open}
            onOk={handleModalOk}
            onCancel={handleModalCancel}
            maskClosable={false}
            width="95vw"
            okText="Enregistrer"
            cancelText="Fermer"
            okButtonProps={{ disabled: loading }}
            destroyOnHidden
        >
            <Spin spinning={loading}>
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={defaultProduit}
                    onValuesChange={onValuesChange}
                >
                    <Form.Item name="designation" label="Désignation" rules={[{ required: true, message: "La désignation est requise" }]}>
                        <Input />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="categorie" label="Catégorie" rules={[{ required: true, message: "La catégorie est requise" }]}>
                                <Select options={CATEGORIES} placeholder="Choisir une catégorie" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="ref" label="Référence interne">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Années">
                                <Row gutter={8}>
                                    <Col span={12}>
                                        <Form.Item name="anneeDebut" noStyle>
                                            <InputNumber min={1900} max={new Date().getFullYear() + 10} step={1} style={{ width: '100%' }} placeholder="Début" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="anneeFin" noStyle>
                                            <InputNumber min={1900} max={new Date().getFullYear() + 10} step={1} style={{ width: '100%' }} placeholder="Fin" />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="images" label="Images">
                        <ImageUpload />
                    </Form.Item>
                    <Form.Item name="documents" label="Documents">
                        <DocumentUpload />
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
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="emplacement" label="Emplacement atelier">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="emplacementMagasin" label="Emplacement magasin">
                                <Input />
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
            </Spin>
            {isEdit && (
                <>
                    <FournisseurProduits produitId={currentProduit.id} />
                    <ProduitHistorique produitId={currentProduit.id} />
                </>
            )}
        </Modal>
    );
}
