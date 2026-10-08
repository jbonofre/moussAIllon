import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusCircleOutlined } from '@ant-design/icons';
import api from './api.ts';
import {
    ArticlePackage,
    PackageEntity,
    TYPES_ARTICLE_PACKAGE,
    TypeArticlePackage,
    articlesDuPackage,
    totalPackageTTC,
} from './package-lignes.ts';

interface TypeArticleConfig {
    label: string;
    pluriel: string;
    endpoint: string;
    color: string;
}

const TYPES_ARTICLE: Record<TypeArticlePackage, TypeArticleConfig> = {
    produit: { label: 'Article', pluriel: 'Articles', endpoint: '/catalogue/produits', color: 'orange' },
    bateau: { label: 'Bateau', pluriel: 'Bateaux', endpoint: '/catalogue/bateaux', color: 'cyan' },
    moteur: { label: 'Moteur', pluriel: 'Moteurs', endpoint: '/catalogue/moteurs', color: 'purple' },
    helice: { label: 'Hélice', pluriel: 'Hélices', endpoint: '/catalogue/helices', color: 'blue' },
    remorque: { label: 'Remorque', pluriel: 'Remorques', endpoint: '/catalogue/remorques', color: 'gold' },
};

// Une ligne du formulaire désigne son article par une référence « type:id »
interface PackageLigneForm {
    articleRef?: string;
    quantite?: number;
}

interface PackageFormValues {
    designation: string;
    ref?: string;
    description?: string;
    lignes: PackageLigneForm[];
}

const defaultPackage: PackageFormValues = {
    designation: '',
    ref: '',
    description: '',
    lignes: [{}],
};

// Largeurs des colonnes d'une ligne de package : l'article occupe le reste de la largeur
const COLONNES = { type: 100, quantite: 110, prixUnitaire: 160, total: 170, action: 32 };

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} €`;

const parseArticleRef = (articleRef?: string): { type: TypeArticlePackage; id: number } | null => {
    const [type, idStr] = (articleRef || '').split(':');
    const id = parseInt(idStr, 10);
    if (!TYPES_ARTICLE_PACKAGE.includes(type as TypeArticlePackage) || isNaN(id)) return null;
    return { type: type as TypeArticlePackage, id };
};

export default function Packages() {
    const [packages, setPackages] = useState<PackageEntity[]>([]);
    const [catalogue, setCatalogue] = useState<Record<TypeArticlePackage, ArticlePackage[]>>({
        produit: [],
        bateau: [],
        moteur: [],
        helice: [],
        remorque: [],
    });
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [currentPackage, setCurrentPackage] = useState<PackageEntity | null>(null);
    const [form] = Form.useForm<PackageFormValues>();
    const [formDirty, setFormDirty] = useState(false);

    const isEdit = !!currentPackage?.id;

    const fetchPackages = async (query?: string) => {
        setLoading(true);
        try {
            const recherche = query && query.trim();
            const response = await api.get(recherche ? '/catalogue/packages/search' : '/catalogue/packages', { params: recherche ? { q: recherche } : {} });
            setPackages(response.data || []);
        } catch {
            message.error('Erreur lors du chargement des packages.');
        } finally {
            setLoading(false);
        }
    };

    const fetchCatalogue = async () => {
        try {
            const reponses = await Promise.all(TYPES_ARTICLE_PACKAGE.map((type) => api.get(TYPES_ARTICLE[type].endpoint)));
            setCatalogue({
                produit: reponses[0].data || [],
                bateau: reponses[1].data || [],
                moteur: reponses[2].data || [],
                helice: reponses[3].data || [],
                remorque: reponses[4].data || [],
            });
        } catch {
            message.error('Erreur lors du chargement du catalogue.');
        }
    };

    useEffect(() => {
        fetchPackages();
        fetchCatalogue();
    }, []);

    const articleOptions = useMemo(
        () => TYPES_ARTICLE_PACKAGE
            .filter((type) => catalogue[type].length > 0)
            .map((type) => ({
                label: TYPES_ARTICLE[type].pluriel,
                options: catalogue[type].map((article) => ({
                    value: `${type}:${article.id}`,
                    label: article.ref ? `${article.ref} - ${article.designation}` : article.designation,
                    searchText: `${article.ref || ''} ${article.designation}`.toLowerCase(),
                })),
            })),
        [catalogue]
    );

    const getArticle = (articleRef?: string): ArticlePackage | undefined => {
        const parsed = parseArticleRef(articleRef);
        return parsed ? catalogue[parsed.type].find((article) => article.id === parsed.id) : undefined;
    };

    const getTotalFormulaire = (): number =>
        (form.getFieldValue('lignes') || []).reduce((total: number, ligne: PackageLigneForm) => (
            total + (getArticle(ligne?.articleRef)?.prixVenteTTC || 0) * Math.max(1, Math.floor(ligne?.quantite || 1))
        ), 0);

    const openModal = (pack?: PackageEntity) => {
        form.resetFields();
        if (pack) {
            setCurrentPackage(pack);
            form.setFieldsValue({
                designation: pack.designation,
                ref: pack.ref,
                description: pack.description,
                lignes: [...articlesDuPackage(pack).map(({ type, article, quantite }) => ({ articleRef: `${type}:${article.id}`, quantite })), {}],
            });
        } else {
            setCurrentPackage(null);
            form.setFieldsValue(defaultPackage);
        }
        setFormDirty(false);
        setModalVisible(true);
    };

    const onValuesChange = (changedValues: Partial<PackageFormValues>, allValues: PackageFormValues) => {
        setFormDirty(true);
        if (changedValues.lignes === undefined) return;
        // La quantité est pré-remplie à 1 au choix de l'article, et la saisie se poursuit sur une ligne vide en fin de liste
        const lignes = (allValues.lignes || []).map((ligne, index) => (
            changedValues.lignes?.[index]?.articleRef && !ligne.quantite ? { ...ligne, quantite: 1 } : ligne
        ));
        const derniere = lignes[lignes.length - 1];
        form.setFieldValue('lignes', !derniere || derniere.articleRef ? [...lignes, {}] : lignes);
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

    const toPayload = (values: PackageFormValues): PackageEntity => ({
        designation: values.designation,
        ref: values.ref,
        description: values.description,
        lignes: (values.lignes || []).flatMap((ligne) => {
            const parsed = parseArticleRef(ligne?.articleRef);
            return parsed ? [{ [parsed.type]: { id: parsed.id }, quantite: Math.max(1, Math.floor(ligne.quantite || 1)) }] : [];
        }),
    });

    const handleSave = async () => {
        let values: PackageFormValues;
        try {
            values = await form.validateFields();
        } catch {
            // Les erreurs de validation sont affichées dans le formulaire.
            return;
        }
        const payload = toPayload(values);
        if ((payload.lignes || []).length === 0) {
            message.warning('Ajoutez au moins un article au package.');
            return;
        }
        try {
            const res = isEdit
                ? await api.put(`/catalogue/packages/${currentPackage!.id}`, payload)
                : await api.post('/catalogue/packages', payload);
            message.success(isEdit ? 'Package modifié avec succès' : 'Package ajouté avec succès');
            setCurrentPackage(res.data);
            setFormDirty(false);
            fetchPackages();
        } catch {
            message.error("Erreur lors de l'enregistrement du package.");
        }
    };

    const handleDelete = async (id?: number) => {
        if (!id) return;
        try {
            await api.delete(`/catalogue/packages/${id}`);
            message.success('Package supprimé avec succès');
            fetchPackages();
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    const columns = [
        {
            title: 'Désignation',
            dataIndex: 'designation',
            sorter: (a: PackageEntity, b: PackageEntity) => (a.designation || '').localeCompare(b.designation || ''),
        },
        {
            title: 'Référence',
            dataIndex: 'ref',
            sorter: (a: PackageEntity, b: PackageEntity) => (a.ref || '').localeCompare(b.ref || ''),
        },
        {
            title: 'Contenu',
            key: 'contenu',
            render: (_: unknown, record: PackageEntity) => (
                <Space size={[0, 4]} wrap>
                    {articlesDuPackage(record).map(({ type, article, quantite }, index) => (
                        <Tag key={index} color={TYPES_ARTICLE[type].color}>
                            {quantite > 1 ? `${quantite} × ` : ''}{article.designation}
                        </Tag>
                    ))}
                </Space>
            ),
        },
        {
            title: 'Prix TTC',
            key: 'prixTTC',
            render: (_: unknown, record: PackageEntity) => formatEuro(totalPackageTTC(record)),
            sorter: (a: PackageEntity, b: PackageEntity) => totalPackageTTC(a) - totalPackageTTC(b),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: PackageEntity) => (
                <Space>
                    <Button onClick={() => openModal(record)} icon={<EditOutlined />} />
                    <Popconfirm
                        title="Supprimer ce package ?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Oui"
                        cancelText="Non"
                    >
                        <Button danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card title="Packages">
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Space>
                        <Input.Search
                            placeholder="Recherche"
                            enterButton
                            allowClear
                            style={{ width: 600 }}
                            onSearch={(value) => fetchPackages(value)}
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
                        dataSource={packages}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        bordered
                        onRow={(record) => ({
                            onClick: (e) => {
                                if ((e.target as HTMLElement).closest('button, .ant-btn, [role="button"]')) return;
                                openModal(record);
                            },
                            style: { cursor: 'pointer' },
                        })}
                    />
                </Col>
            </Row>
            <Modal
                title={isEdit ? 'Modifier un package' : 'Ajouter un package'}
                open={modalVisible}
                onOk={handleSave}
                onCancel={handleModalCancel}
                okText="Enregistrer"
                cancelText="Fermer"
                maskClosable={false}
                destroyOnHidden
                width="95vw"
            >
                <Form form={form} layout="vertical" initialValues={defaultPackage} onValuesChange={onValuesChange}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="designation" label="Désignation" rules={[{ required: true, whitespace: true, message: 'La désignation est requise' }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="ref" label="Référence interne">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={3} placeholder="Description" allowClear />
                    </Form.Item>
                    <Form.Item label="Contenu du package" extra="Ces lignes sont recopiées dans la vente comptoir ou la transaction qui utilise le package, au prix catalogue du moment.">
                        <div style={{ display: 'flex', gap: 8, marginBottom: 4, color: '#8c8c8c' }}>
                            <div style={{ flex: 1 }}>Article</div>
                            <div style={{ width: COLONNES.type }}>Type</div>
                            <div style={{ width: COLONNES.quantite }}>Quantité</div>
                            <div style={{ width: COLONNES.prixUnitaire }}>P.U. TTC</div>
                            <div style={{ width: COLONNES.total }}>Total TTC</div>
                            <div style={{ width: COLONNES.action }} />
                        </div>
                        <Form.List name="lignes">
                            {(fields, { remove }) => (
                                <>
                                    {fields.map((field) => (
                                        <Form.Item key={field.key} shouldUpdate noStyle>
                                            {() => {
                                                const ligne: PackageLigneForm = form.getFieldValue(['lignes', field.name]) || {};
                                                const parsed = parseArticleRef(ligne.articleRef);
                                                const prixUnitaire = getArticle(ligne.articleRef)?.prixVenteTTC;
                                                const total = prixUnitaire !== undefined
                                                    ? Math.round((prixUnitaire * Math.max(1, Math.floor(ligne.quantite || 1)) + Number.EPSILON) * 100) / 100
                                                    : undefined;
                                                return (
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                        <Form.Item name={[field.name, 'articleRef']} style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
                                                            <Select
                                                                allowClear
                                                                showSearch
                                                                options={articleOptions}
                                                                filterOption={(input, option) =>
                                                                    ((option as { searchText?: string } | undefined)?.searchText || '').includes(input.toLowerCase())
                                                                }
                                                                placeholder="Rechercher produit, bateau, moteur, hélice ou remorque"
                                                            />
                                                        </Form.Item>
                                                        <div style={{ width: COLONNES.type }}>
                                                            {parsed && <Tag color={TYPES_ARTICLE[parsed.type].color}>{TYPES_ARTICLE[parsed.type].label}</Tag>}
                                                        </div>
                                                        <Form.Item name={[field.name, 'quantite']} style={{ width: COLONNES.quantite, marginBottom: 0 }}>
                                                            <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                        </Form.Item>
                                                        <Form.Item style={{ width: COLONNES.prixUnitaire, marginBottom: 0 }}>
                                                            <InputNumber addonAfter="€" value={prixUnitaire} disabled style={{ width: '100%' }} placeholder="P.U." />
                                                        </Form.Item>
                                                        <Form.Item style={{ width: COLONNES.total, marginBottom: 0 }}>
                                                            <InputNumber addonAfter="€" value={total} disabled style={{ width: '100%' }} placeholder="Total" />
                                                        </Form.Item>
                                                        {/* La ligne de saisie vide en fin de liste n'a rien à retirer */}
                                                        <div style={{ width: COLONNES.action }}>
                                                            {(parsed || field.name < fields.length - 1) && (
                                                                <Button danger icon={<DeleteOutlined />} title="Retirer du package" onClick={() => remove(field.name)} />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </Form.Item>
                                    ))}
                                </>
                            )}
                        </Form.List>
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate>
                        {() => (
                            <div style={{ textAlign: 'right' }}>
                                Total TTC du package : <strong>{formatEuro(getTotalFormulaire())}</strong>
                            </div>
                        )}
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
}
