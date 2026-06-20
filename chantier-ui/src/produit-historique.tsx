import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Spin, Statistic, Table, Tag, message } from 'antd';
import api from './api.ts';

type Mouvement = {
    id: number;
    type: 'VENTE' | 'AJUSTEMENT_MANUEL';
    quantite: number;
    stockApres: number;
    venteId?: number;
    date?: string;
};

type Statistiques = {
    quantiteVendue30j: number;
    quantiteVendue90j: number;
    quantiteVendueTotal: number;
    chiffreAffaires30j: number;
    chiffreAffaires90j: number;
    chiffreAffairesTotal: number;
};

const typeLabel: Record<Mouvement['type'], string> = {
    VENTE: 'Vente',
    AJUSTEMENT_MANUEL: 'Ajustement manuel',
};

const ProduitHistorique = ({ produitId }: { produitId?: number }) => {
    const [mouvements, setMouvements] = useState<Mouvement[]>([]);
    const [statistiques, setStatistiques] = useState<Statistiques | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!produitId) return;
        setLoading(true);
        Promise.all([
            api.get(`/catalogue/produits/${produitId}/mouvements`),
            api.get(`/catalogue/produits/${produitId}/statistiques`),
        ])
            .then(([mouvementsRes, statistiquesRes]) => {
                setMouvements(mouvementsRes.data);
                setStatistiques(statistiquesRes.data);
            })
            .catch(() => message.error("Erreur lors du chargement de l'historique du produit"))
            .finally(() => setLoading(false));
    }, [produitId]);

    const columns = [
        {
            title: 'Date',
            dataIndex: 'date',
            render: (value?: string) => (value ? new Date(value).toLocaleString('fr-FR') : '-'),
            sorter: (a: Mouvement, b: Mouvement) => (a.date || '').localeCompare(b.date || ''),
            defaultSortOrder: 'descend' as const,
        },
        {
            title: 'Type',
            dataIndex: 'type',
            render: (value: Mouvement['type']) => (
                <Tag color={value === 'VENTE' ? 'blue' : 'orange'}>{typeLabel[value] || value}</Tag>
            ),
        },
        {
            title: 'Quantité',
            dataIndex: 'quantite',
            render: (value: number) => (value > 0 ? `+${value}` : value),
        },
        {
            title: 'Stock après',
            dataIndex: 'stockApres',
        },
        {
            title: 'Vente liée',
            dataIndex: 'venteId',
            render: (value?: number) => (value ? `#${value}` : '-'),
        },
    ];

    return (
        <Card title="Historique et statistiques" style={{ marginTop: 24 }}>
            <Spin spinning={loading}>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                        <Statistic
                            title="Vendu sur 30 jours"
                            value={statistiques?.quantiteVendue30j ?? 0}
                            suffix={`/ ${(statistiques?.chiffreAffaires30j ?? 0).toFixed(2)} €`}
                        />
                    </Col>
                    <Col span={8}>
                        <Statistic
                            title="Vendu sur 90 jours"
                            value={statistiques?.quantiteVendue90j ?? 0}
                            suffix={`/ ${(statistiques?.chiffreAffaires90j ?? 0).toFixed(2)} €`}
                        />
                    </Col>
                    <Col span={8}>
                        <Statistic
                            title="Vendu au total"
                            value={statistiques?.quantiteVendueTotal ?? 0}
                            suffix={`/ ${(statistiques?.chiffreAffairesTotal ?? 0).toFixed(2)} €`}
                        />
                    </Col>
                </Row>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={mouvements}
                    bordered
                    pagination={{ pageSize: 10 }}
                />
            </Spin>
        </Card>
    );
};

export default ProduitHistorique;
