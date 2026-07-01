import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Progress, Row, Spin, Statistic, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, AimOutlined } from '@ant-design/icons';
import api from './api.ts';

type TaskStatus = 'EN_ATTENTE' | 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'INCIDENT' | 'ANNULEE';

interface PlanningItem {
    itemStatus?: TaskStatus;
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    statusDate?: string;
    dureeReelle?: number;
    dureeEstimee?: number;
}

interface ObjectifsProps {
    technicienId: number;
}

const MONTH_LABELS = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const isSameMonth = (value: string | undefined, year: number, month: number): boolean => {
    if (!value) return false;
    const d = new Date(value);
    if (isNaN(d.getTime())) return false;
    return d.getFullYear() === year && d.getMonth() === month;
};

// Date de référence servant à rattacher une intervention à un mois :
// la date de fin si terminée, sinon la date planifiée / de début.
const referenceDate = (t: PlanningItem) => t.dateFin || t.statusDate || t.datePlanification || t.dateDebut;

export default function Objectifs({ technicienId }: ObjectifsProps) {
    const [items, setItems] = useState<PlanningItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        const fetchItems = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/technicien-portal/techniciens/${technicienId}/taches`);
                if (mounted) setItems(res.data || []);
            } catch {
                message.error('Erreur lors du chargement des objectifs');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchItems();
        return () => { mounted = false; };
    }, [technicienId]);

    const stats = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const monthTasks = items.filter((t) =>
            t.itemStatus !== 'ANNULEE' && isSameMonth(referenceDate(t), year, month)
        );
        const completed = monthTasks.filter((t) => t.itemStatus === 'TERMINEE');
        const heuresRealisees = completed.reduce((sum, t) => sum + (t.dureeReelle || 0), 0);
        const heuresEstimees = monthTasks.reduce((sum, t) => sum + (t.dureeEstimee || 0), 0);
        const total = monthTasks.length;
        const done = completed.length;
        return {
            monthLabel: MONTH_LABELS[month],
            total,
            done,
            completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
            heuresRealisees: Math.round(heuresRealisees * 100) / 100,
            heuresEstimees: Math.round(heuresEstimees * 100) / 100,
            heuresPct: heuresEstimees > 0 ? Math.min(100, Math.round((heuresRealisees / heuresEstimees) * 100)) : 0,
        };
    }, [items]);

    return (
        <Spin spinning={loading}>
            <Card title={`Mes objectifs — ${stats.monthLabel}`}>
                {stats.total === 0 ? (
                    <Empty description="Aucune intervention ce mois-ci" />
                ) : (
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic
                                    title="Interventions terminées"
                                    value={stats.done}
                                    suffix={`/ ${stats.total}`}
                                    prefix={<CheckCircleOutlined />}
                                />
                                <Progress percent={stats.completionPct} status="active" />
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic
                                    title="Heures réalisées"
                                    value={stats.heuresRealisees}
                                    suffix="h"
                                    prefix={<ClockCircleOutlined />}
                                />
                                <Progress percent={stats.heuresPct} />
                                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                                    Estimé : {stats.heuresEstimees} h
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card>
                                <Statistic
                                    title="Taux de complétion"
                                    value={stats.completionPct}
                                    suffix="%"
                                    prefix={<AimOutlined />}
                                />
                                <Progress percent={stats.completionPct} />
                            </Card>
                        </Col>
                    </Row>
                )}
            </Card>
        </Spin>
    );
}
