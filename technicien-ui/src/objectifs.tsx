import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Progress, Row, Spin, Statistic, message } from 'antd';
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

interface Objectif {
    cibleInterventions?: number | null;
    cibleHeures?: number | null;
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

const pct = (value: number, target: number) => (target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0);

export default function Objectifs({ technicienId }: ObjectifsProps) {
    const [items, setItems] = useState<PlanningItem[]>([]);
    const [objectif, setObjectif] = useState<Objectif>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [tachesRes, objectifRes] = await Promise.all([
                    api.get(`/technicien-portal/techniciens/${technicienId}/taches`),
                    api.get(`/technicien-portal/techniciens/${technicienId}/objectif`),
                ]);
                if (mounted) {
                    setItems(tachesRes.data || []);
                    setObjectif(objectifRes.data || {});
                }
            } catch {
                message.error('Erreur lors du chargement des objectifs');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchData();
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
        };
    }, [items]);

    const cibleInterventions = objectif.cibleInterventions ?? undefined;
    const cibleHeures = objectif.cibleHeures ?? undefined;
    const hasCible = (cibleInterventions != null && cibleInterventions > 0)
        || (cibleHeures != null && cibleHeures > 0);

    // Interventions : progression vers la cible si définie, sinon part du mois réalisée.
    const interventionsSuffix = cibleInterventions ? `/ ${cibleInterventions}` : `/ ${stats.total}`;
    const interventionsPct = cibleInterventions
        ? pct(stats.done, cibleInterventions)
        : stats.completionPct;

    // Heures : progression vers la cible si définie, sinon vs estimé du mois.
    const heuresPct = cibleHeures
        ? pct(stats.heuresRealisees, cibleHeures)
        : pct(stats.heuresRealisees, stats.heuresEstimees);
    const heuresHint = cibleHeures
        ? `Objectif : ${cibleHeures} h`
        : `Estimé : ${stats.heuresEstimees} h`;

    return (
        <Spin spinning={loading}>
            <Card title={`Mes objectifs — ${stats.monthLabel}`}>
                {!hasCible && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="Aucun objectif n'a encore été défini par votre responsable. Les indicateurs ci-dessous reflètent votre activité du mois."
                    />
                )}
                {stats.total === 0 && (
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="Aucune intervention ne vous est assignée ce mois-ci pour le moment."
                    />
                )}
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic
                                title="Interventions terminées"
                                value={stats.done}
                                suffix={interventionsSuffix}
                                prefix={<CheckCircleOutlined />}
                            />
                            <Progress percent={interventionsPct} status="active" />
                        </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Card>
                            <Statistic
                                title="Heures réalisées"
                                value={stats.heuresRealisees}
                                suffix={cibleHeures ? `/ ${cibleHeures} h` : 'h'}
                                prefix={<ClockCircleOutlined />}
                            />
                            <Progress percent={heuresPct} />
                            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{heuresHint}</div>
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
            </Card>
        </Spin>
    );
}
