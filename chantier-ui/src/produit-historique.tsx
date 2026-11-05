import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Spin, Statistic, message } from 'antd';
import api from './api.ts';
import MouvementsStock, { Mouvement } from './MouvementsStock.tsx';

type Statistiques = {
    quantiteVendue30j: number;
    quantiteVendue90j: number;
    quantiteVendueTotal: number;
    chiffreAffaires30j: number;
    chiffreAffaires90j: number;
    chiffreAffairesTotal: number;
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
                <MouvementsStock mouvements={mouvements} />
            </Spin>
        </Card>
    );
};

export default ProduitHistorique;
