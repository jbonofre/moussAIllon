import React, { useEffect, useState } from 'react';
import { Image, Table, Rate, Row, Col, Card, Button, Input, Space, Popconfirm, message } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from './api.ts';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import ProduitFormModal from './ProduitFormModal.tsx';
import type { ProduitCatalogueEntity } from './ProduitFormModal.tsx';
import ImportCsvButton from './ImportCsvButton.tsx';

// --- Component ---

const CatalogueProduits: React.FC = () => {
    const CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [currentProduit, setCurrentProduit] = useState<ProduitCatalogueEntity | null>(null);

    // Get all produits
    const fetchProduits = async () => {
        setLoading(true);
        try {
            const res = await api.get('/catalogue/produits');
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
        setCurrentProduit(produit || null);
        setModalVisible(true);
    };

    const handleDelete = async (id: number | undefined) => {
        if (!id) return;
        try {
            await api.delete(`/catalogue/produits/${id}`);
            message.success('Produit supprimé avec succès');
            fetchProduits();
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    // Columns
    const columns = [
        {
            title: 'Désignation',
            dataIndex: 'designation',
            render: (_: string, record: ProduitCatalogueEntity) => (
                <Space>
                    {record.images && record.images[0] && (
                        <Image src={record.images[0]} width={40} />
                    )}
                    {record.designation}
                </Space>
            ),
            sorter: (a: ProduitCatalogueEntity, b: ProduitCatalogueEntity) => a.designation.localeCompare(b.designation),
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
                                        const r = await api.get('/catalogue/produits/search', { params: { q: value } });
                                        setProduits(r.data);
                                    } catch {
                                        message.error('Erreur lors de la recherche');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            />
                            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                            <ImportCsvButton endpoint="/catalogue/produits/import" label="Importer des produits (CSV)" onImported={fetchProduits} />
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
                            onRow={(record) => ({
                                onClick: (e) => {
                                    if ((e.target as HTMLElement).closest('button, .ant-btn, [role="button"]')) return;
                                    openModal(record);
                                },
                                style: { cursor: 'pointer' },
                            })}
                        />
                        <ProduitFormModal
                            open={modalVisible}
                            produit={currentProduit}
                            onClose={() => setModalVisible(false)}
                            onSaved={fetchProduits}
                        />
                    </Col>
                </Row>
            </Card>
        </>
    );
};

export default CatalogueProduits;
