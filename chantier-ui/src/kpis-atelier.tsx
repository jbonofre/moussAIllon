import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Empty, Row, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Column, Line } from '@ant-design/charts';
import dayjs from 'dayjs';
import { fetchWithAuth } from './api.ts';
import { paginationConfig } from './pagination.ts';
import { EcartPoints, Evolution, formatEuro, formatMois, formatTaux } from './kpis-commun.tsx';

const { Text, Paragraph } = Typography;

interface Indicateurs {
    heuresDisponibles: number;
    heuresPrevues: number;
    heuresRealisees: number;
    heuresFacturees: number;
    heuresSav: number;
    caMainOeuvreHT: number;
    caPiecesHT: number;
    interventions: number;
    interventionsSav: number;
    tauxProductivite?: number | null;
    tauxEfficience?: number | null;
    tauxValorisation?: number | null;
    tauxSav?: number | null;
}

interface MoisKpi {
    mois: string;
    n: Indicateurs;
    n1: Indicateurs;
}

interface TechnicienKpi {
    technicienId?: number | null;
    nom: string;
    heuresHebdomadaires?: number | null;
    heuresContrat: number;
    heuresFeries: number;
    heuresAbsence: number;
    joursAbsence: number;
    n: Indicateurs;
    tauxValorisationN1?: number | null;
}

interface PrestationKpi {
    cle: string;
    type: string;
    nom: string;
    n: Indicateurs;
}

export interface KpisAtelier {
    debut: string;
    fin: string;
    n: Indicateurs;
    n1: Indicateurs;
    mois: MoisKpi[];
    techniciens: TechnicienKpi[];
    prestations: PrestationKpi[];
    techniciensSansHoraire: string[];
    prestationsSansDureeReelle: number;
}

export const formatHeures = (v?: number | null) => `${(v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;

// Dépassement des heures réalisées sur les heures prévues, en %, null sans heures prévues
export const depassement = (prevues: number, realisees: number) =>
    prevues > 0 ? Math.round(((realisees - prevues) / prevues) * 1000) / 10 : null;

const Depassement = ({ prevues, realisees }: { prevues: number; realisees: number }) => {
    const pct = depassement(prevues, realisees);
    if (pct === null) return <Text type="secondary">—</Text>;
    return <Tag color={pct > 0 ? 'red' : 'green'}>{pct > 0 ? '+' : ''}{pct.toLocaleString('fr-FR')} %</Tag>;
};

const Titre = ({ libelle, aide }: { libelle: string; aide: string }) => (
    <Space size={4}>{libelle}<Tooltip title={aide}><InfoCircleOutlined /></Tooltip></Space>
);

const AIDE_DISPONIBLES = 'Durée hebdomadaire des techniciens répartie sur leurs jours travaillés, jusqu\'à aujourd\'hui, moins les jours fériés et les absences (Atelier > Équipe).';
const AIDE_REALISEES = 'Durée réelle des prestations terminées, à leur date de fin. Une prestation à plusieurs techniciens est partagée entre eux à parts égales.';
const AIDE_FACTUREES = 'Heures de main d\'œuvre des prestations facturées, à la date d\'émission de la facture (à défaut de main d\'œuvre horaire, la durée estimée de la prestation), hors SAV et prestations annulées.';

export default function KpisAtelier() {
    const [fin, setFin] = useState(dayjs().startOf('month'));
    const [kpis, setKpis] = useState<KpisAtelier | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        fetchWithAuth(`./kpis-atelier?fin=${fin.format('YYYY-MM')}`)
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setKpis)
            .catch((e) => message.error('Erreur lors du chargement des KPIs atelier : ' + e.message))
            .finally(() => setLoading(false));
    }, [fin]);

    useEffect(() => { load(); }, [load]);

    const heuresMensuelles = useMemo(() => (kpis?.mois ?? []).flatMap((m) => [
        { mois: formatMois(m.mois), type: 'Disponibles', heures: m.n.heuresDisponibles },
        { mois: formatMois(m.mois), type: 'Réalisées', heures: m.n.heuresRealisees },
        { mois: formatMois(m.mois), type: 'Facturées', heures: m.n.heuresFacturees },
    ]), [kpis]);

    const valorisationMensuelle = useMemo(() => (kpis?.mois ?? []).flatMap((m) => [
        ...(m.n.tauxValorisation != null ? [{ mois: formatMois(m.mois), periode: 'N', taux: m.n.tauxValorisation }] : []),
        ...(m.n1.tauxValorisation != null ? [{ mois: formatMois(m.mois), periode: 'N-1', taux: m.n1.tauxValorisation }] : []),
    ]), [kpis]);

    if (!kpis) {
        return (
            <div>
                <Typography.Title level={3}>KPIs atelier</Typography.Title>
                {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : <Empty description="Aucune donnée" />}
            </div>
        );
    }

    const { n, n1 } = kpis;

    const colonnesHeures = [
        { title: 'Interventions', key: 'interventions', align: 'right' as const, render: (_: unknown, l: { n: Indicateurs }) => (
            l.n.interventionsSav > 0 ? <Tooltip title={`dont ${l.n.interventionsSav} SAV`}>{l.n.interventions}</Tooltip> : l.n.interventions
        ) },
        { title: 'Prévues', key: 'prevues', align: 'right' as const, render: (_: unknown, l: { n: Indicateurs }) => formatHeures(l.n.heuresPrevues) },
        {
            title: 'Réalisées', key: 'realisees', align: 'right' as const,
            sorter: (a: { n: Indicateurs }, b: { n: Indicateurs }) => a.n.heuresRealisees - b.n.heuresRealisees,
            render: (_: unknown, l: { n: Indicateurs }) => formatHeures(l.n.heuresRealisees),
        },
        { title: 'Dépassement', key: 'depassement', align: 'center' as const, render: (_: unknown, l: { n: Indicateurs }) => <Depassement prevues={l.n.heuresPrevues} realisees={l.n.heuresRealisees} /> },
        {
            title: 'Facturées', key: 'facturees', align: 'right' as const,
            sorter: (a: { n: Indicateurs }, b: { n: Indicateurs }) => a.n.heuresFacturees - b.n.heuresFacturees,
            render: (_: unknown, l: { n: Indicateurs }) => formatHeures(l.n.heuresFacturees),
        },
        { title: 'SAV', key: 'sav', align: 'right' as const, render: (_: unknown, l: { n: Indicateurs }) => (l.n.heuresSav > 0 ? <Text type="warning">{formatHeures(l.n.heuresSav)}</Text> : formatHeures(0)) },
        { title: 'Efficience', key: 'efficience', align: 'right' as const, render: (_: unknown, l: { n: Indicateurs }) => formatTaux(l.n.tauxEfficience) },
    ];
    const colonnesCa = [
        {
            title: 'CA main d\'œuvre HT', key: 'caMainOeuvre', align: 'right' as const,
            sorter: (a: { n: Indicateurs }, b: { n: Indicateurs }) => a.n.caMainOeuvreHT - b.n.caMainOeuvreHT,
            render: (_: unknown, l: { n: Indicateurs }) => formatEuro(l.n.caMainOeuvreHT),
        },
        {
            title: 'CA pièces HT', key: 'caPieces', align: 'right' as const,
            sorter: (a: { n: Indicateurs }, b: { n: Indicateurs }) => a.n.caPiecesHT - b.n.caPiecesHT,
            render: (_: unknown, l: { n: Indicateurs }) => formatEuro(l.n.caPiecesHT),
        },
    ];

    const colonnesTechniciens = [
        { title: 'Technicien', dataIndex: 'nom', render: (v: string, t: TechnicienKpi) => (t.technicienId == null ? <Text type="secondary">{v}</Text> : v) },
        {
            title: 'Hebdo', dataIndex: 'heuresHebdomadaires', align: 'right' as const,
            render: (v: number | null | undefined, t: TechnicienKpi) => (t.technicienId == null ? '' : v ? formatHeures(v) : <Tag color="orange">Non renseigné</Tag>),
        },
        {
            title: 'Disponibles', key: 'disponibles', align: 'right' as const,
            render: (_: unknown, t: TechnicienKpi) => (t.technicienId == null ? '' : (
                <Tooltip title={`Contrat : ${formatHeures(t.heuresContrat)} · fériés : ${formatHeures(t.heuresFeries)} · absences : ${formatHeures(t.heuresAbsence)} (${t.joursAbsence} j)`}>
                    {formatHeures(t.n.heuresDisponibles)}
                </Tooltip>
            )),
        },
        ...colonnesHeures,
        { title: 'Productivité', key: 'productivite', align: 'right' as const, render: (_: unknown, t: TechnicienKpi) => formatTaux(t.n.tauxProductivite) },
        {
            title: 'Valorisation', key: 'valorisation', align: 'right' as const,
            render: (_: unknown, t: TechnicienKpi) => (
                <Space size={4}>{formatTaux(t.n.tauxValorisation)}{t.n.tauxValorisation != null && <EcartPoints taux={t.n.tauxValorisation} tauxN1={t.tauxValorisationN1} />}</Space>
            ),
        },
        ...colonnesCa,
    ];

    const colonnesPrestations = [
        { title: 'Prestation', dataIndex: 'nom', render: (v: string, p: PrestationKpi) => <Space size={4}><Tag color={p.type === 'Forfait' ? 'blue' : 'green'}>{p.type}</Tag>{v}</Space> },
        ...colonnesHeures,
        ...colonnesCa,
    ];

    return (
        <div>
            <Row justify="space-between" align="middle" gutter={[12, 12]} style={{ marginBottom: 8 }}>
                <Col>
                    <Typography.Title level={3} style={{ marginBottom: 0 }}>KPIs atelier</Typography.Title>
                    <Text type="secondary">
                        12 mois glissants de {formatMois(kpis.debut)} à {formatMois(kpis.fin)}, comparés aux 12 mois précédents (N-1).
                        Heures disponibles jusqu'à aujourd'hui.
                    </Text>
                </Col>
                <Col>
                    <Space>
                        <DatePicker
                            picker="month"
                            format="MM/YYYY"
                            allowClear={false}
                            value={fin}
                            onChange={(v) => v && setFin(v.startOf('month'))}
                            aria-label="Dernier mois de la période"
                        />
                        <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={load} />
                    </Space>
                </Col>
            </Row>

            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                {kpis.techniciensSansHoraire.length > 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        title={`${kpis.techniciensSansHoraire.length} technicien${kpis.techniciensSansHoraire.length > 1 ? 's' : ''} sans durée hebdomadaire`}
                        description={`${kpis.techniciensSansHoraire.join(', ')} : leurs heures disponibles ne sont pas comptées, la productivité et la valorisation sont surestimées. Renseignez leur durée hebdomadaire et leurs jours travaillés (Atelier > Équipe).`}
                    />
                )}
                {kpis.prestationsSansDureeReelle > 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        title={`${kpis.prestationsSansDureeReelle} prestation${kpis.prestationsSansDureeReelle > 1 ? 's' : ''} terminée${kpis.prestationsSansDureeReelle > 1 ? 's' : ''} sans durée réelle`}
                        description="Leur temps n'est pas compté dans les heures réalisées : l'efficience est surestimée."
                    />
                )}

                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #8c8c8c', height: '100%' }}>
                            <Statistic title={<Titre libelle="Heures disponibles" aide={AIDE_DISPONIBLES} />} value={formatHeures(n.heuresDisponibles)} styles={{ content: { fontWeight: 700 } }} />
                            <Space size={4}><Evolution n={n.heuresDisponibles} n1={n1.heuresDisponibles} /><Text type="secondary">N-1 : {formatHeures(n1.heuresDisponibles)}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #1677ff', height: '100%' }}>
                            <Statistic title={<Titre libelle="Heures réalisées" aide={AIDE_REALISEES} />} value={formatHeures(n.heuresRealisees)} styles={{ content: { color: '#1677ff', fontWeight: 700 } }} />
                            <Space size={4} wrap>
                                <Evolution n={n.heuresRealisees} n1={n1.heuresRealisees} />
                                <Text type={n.heuresSav > 0 ? 'warning' : 'secondary'}>dont {formatHeures(n.heuresSav)} SAV ({formatTaux(n.tauxSav ?? 0)})</Text>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #52c41a', height: '100%' }}>
                            <Statistic title={<Titre libelle="Heures facturées" aide={AIDE_FACTUREES} />} value={formatHeures(n.heuresFacturees)} styles={{ content: { color: '#3f8600', fontWeight: 700 } }} />
                            <Space size={4}><Evolution n={n.heuresFacturees} n1={n1.heuresFacturees} /><Text type="secondary">N-1 : {formatHeures(n1.heuresFacturees)}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #722ed1', height: '100%' }}>
                            <Statistic
                                title={<Titre libelle="Taux de valorisation" aide="Heures facturées / heures disponibles : productivité × efficience." />}
                                value={formatTaux(n.tauxValorisation)}
                                styles={{ content: { color: '#722ed1', fontWeight: 700 } }}
                            />
                            <Space size={4}><EcartPoints taux={n.tauxValorisation} tauxN1={n1.tauxValorisation} /><Text type="secondary">N-1 : {formatTaux(n1.tauxValorisation)}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ height: '100%' }}>
                            <Statistic title={<Titre libelle="Productivité" aide="Heures réalisées / heures disponibles : part du temps de présence passée sur les prestations." />} value={formatTaux(n.tauxProductivite)} />
                            <Space size={4}><EcartPoints taux={n.tauxProductivite} tauxN1={n1.tauxProductivite} /><Text type="secondary">N-1 : {formatTaux(n1.tauxProductivite)}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ height: '100%' }}>
                            <Statistic title={<Titre libelle="Efficience" aide="Heures facturées / heures réalisées : au-delà de 100 %, les prestations prennent moins de temps que celui vendu." />} value={formatTaux(n.tauxEfficience)} />
                            <Space size={4}><EcartPoints taux={n.tauxEfficience} tauxN1={n1.tauxEfficience} /><Text type="secondary">N-1 : {formatTaux(n1.tauxEfficience)}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ height: '100%' }}>
                            <Statistic
                                title={<Titre libelle="CA main d'œuvre HT" aide="Part main d'œuvre du CA HT des prestations facturées (avoirs non déduits)." />}
                                value={formatEuro(n.caMainOeuvreHT, 0)}
                            />
                            <Space size={4}><Evolution n={n.caMainOeuvreHT} n1={n1.caMainOeuvreHT} /><Text type="secondary">N-1 : {formatEuro(n1.caMainOeuvreHT, 0)}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ height: '100%' }}>
                            <Statistic
                                title={<Titre libelle="CA pièces HT" aide="Pièces des prestations facturées et pièces vendues sur les mêmes factures (hors hivernage et gardiennage)." />}
                                value={formatEuro(n.caPiecesHT, 0)}
                            />
                            <Space size={4}><Evolution n={n.caPiecesHT} n1={n1.caPiecesHT} /><Text type="secondary">N-1 : {formatEuro(n1.caPiecesHT, 0)}</Text></Space>
                        </Card>
                    </Col>
                </Row>

                <Row gutter={[16, 16]}>
                    <Col xs={24} xl={12}>
                        <Card title="Heures mensuelles" style={{ height: '100%' }}>
                            {heuresMensuelles.length > 0 ? (
                                <Column
                                    data={heuresMensuelles}
                                    xField="mois"
                                    yField="heures"
                                    colorField="type"
                                    group
                                    height={300}
                                    axis={{ y: { labelFormatter: (v: number) => formatHeures(v) } }}
                                    tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatHeures(v) }] }}
                                />
                            ) : <Empty description="Aucune donnée" />}
                        </Card>
                    </Col>
                    <Col xs={24} xl={12}>
                        <Card title="Taux de valorisation mensuel" style={{ height: '100%' }}>
                            {valorisationMensuelle.length > 0 ? (
                                <Line
                                    data={valorisationMensuelle}
                                    xField="mois"
                                    yField="taux"
                                    colorField="periode"
                                    height={300}
                                    point={{ shapeField: 'circle', sizeField: 3 }}
                                    axis={{ y: { labelFormatter: (v: number) => formatTaux(v) } }}
                                    tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatTaux(v) }] }}
                                />
                            ) : <Empty description="Renseignez la durée hebdomadaire des techniciens" />}
                        </Card>
                    </Col>
                </Row>

                <Card title="Productivité par technicien">
                    <Table<TechnicienKpi>
                        rowKey={(t) => String(t.technicienId ?? 'non-affecte')}
                        size="small"
                        columns={colonnesTechniciens}
                        dataSource={kpis.techniciens}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucune activité sur la période' }}
                        summary={() => kpis.techniciens.length > 0 && (
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0}><Text strong>Atelier</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} />
                                <Table.Summary.Cell index={2} align="right"><Text strong>{formatHeures(n.heuresDisponibles)}</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right">{n.interventions}</Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right">{formatHeures(n.heuresPrevues)}</Table.Summary.Cell>
                                <Table.Summary.Cell index={5} align="right"><Text strong>{formatHeures(n.heuresRealisees)}</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={6} align="center"><Depassement prevues={n.heuresPrevues} realisees={n.heuresRealisees} /></Table.Summary.Cell>
                                <Table.Summary.Cell index={7} align="right"><Text strong>{formatHeures(n.heuresFacturees)}</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={8} align="right">{formatHeures(n.heuresSav)}</Table.Summary.Cell>
                                <Table.Summary.Cell index={9} align="right">{formatTaux(n.tauxEfficience)}</Table.Summary.Cell>
                                <Table.Summary.Cell index={10} align="right">{formatTaux(n.tauxProductivite)}</Table.Summary.Cell>
                                <Table.Summary.Cell index={11} align="right"><Text strong>{formatTaux(n.tauxValorisation)}</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={12} align="right">{formatEuro(n.caMainOeuvreHT)}</Table.Summary.Cell>
                                <Table.Summary.Cell index={13} align="right">{formatEuro(n.caPiecesHT)}</Table.Summary.Cell>
                            </Table.Summary.Row>
                        )}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                        Une prestation confiée à plusieurs techniciens est partagée entre eux à parts égales (heures et CA).
                        Les pièces vendues sur une facture de prestations vont à ses techniciens au prorata de leur temps.
                        Valorisation : écart en points avec N-1.
                    </Paragraph>
                </Card>

                <Card title="Productivité par forfait et service">
                    <Table<PrestationKpi>
                        rowKey="cle"
                        size="small"
                        columns={colonnesPrestations}
                        dataSource={kpis.prestations}
                        pagination={paginationConfig(10)}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucune prestation sur la période' }}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                        Heures prévues : durée estimée du forfait ou du service. Le temps SAV compte les prestations marquées SAV / garantie
                        sur la vente ; il est réalisé mais pas facturé.
                    </Paragraph>
                </Card>
            </Space>
        </div>
    );
}
