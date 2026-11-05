import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Empty, Row, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Column, Line } from '@ant-design/charts';
import dayjs from 'dayjs';
import { fetchWithAuth } from './api.ts';
import { paginationConfig } from './pagination.ts';
import { Evolution, formatDate, formatEuro, formatMois } from './kpis-commun.tsx';

const { Text, Paragraph } = Typography;

interface MoisKpi {
    mois: string;
    caHT: number;
    caHTN1: number;
    margeBruteHT: number;
    margeBruteHTN1: number;
    encaissementsTTC: number;
    encaissementsTTCN1: number;
    caHTParActivite: Record<string, number>;
}

interface ActiviteKpi {
    code: string;
    libelle: string;
    groupe: string;
    caHT: number;
    caHTN1: number;
    coutHT: number;
    margeBruteHT: number;
    margeBruteHTN1: number;
    tauxMarge?: number | null;
}

interface FactureEnRetard {
    venteId: number;
    numeroFacture?: string;
    client?: string;
    dateFacture?: string;
    dateEcheance?: string;
    montantTTC: number;
    soldeTTC: number;
    joursRetard: number;
    niveauRelance: number;
}

interface Creances {
    totalTTC: number;
    nombreFactures: number;
    nonEchuTTC: number;
    echuTTC: number;
    nombreFacturesEchues: number;
    retard1a30TTC: number;
    retard31a60TTC: number;
    retard61a90TTC: number;
    retardPlus90TTC: number;
    facturesEnRetard: FactureEnRetard[];
}

interface StockCategorie {
    categorie: string;
    quantite: number;
    valeurHT: number;
    valeur0a90: number;
    valeur91a180: number;
    valeur181a365: number;
    valeurPlus365: number;
    valeurNonDatee: number;
}

interface ArticleDormant {
    type: string;
    id: number;
    designation: string;
    categorie: string;
    stock: number;
    coutUnitaireHT: number;
    valeurHT: number;
    valeurDormanteHT: number;
    dateEntree?: string;
    joursEnStock: number;
}

interface Stock {
    valeurHT: number;
    valeurDormanteHT: number;
    valeurNonDateeHT: number;
    articlesSansCout: number;
    nombreArticlesDormants: number;
    categories: StockCategorie[];
    articlesDormants: ArticleDormant[];
}

export interface KpisFinanciers {
    debut: string;
    fin: string;
    caHT: number;
    caHTN1: number;
    margeBruteHT: number;
    margeBruteHTN1: number;
    tauxMargeBrute?: number | null;
    encaissementsTTC: number;
    encaissementsTTCN1: number;
    heuresSansCoutHoraire: number;
    mois: MoisKpi[];
    activites: ActiviteKpi[];
    creances: Creances;
    stock: Stock;
}

// Ligne du tableau des activités : un groupe (transactions, prestations...) et ses activités
interface LigneActivite extends ActiviteKpi {
    key: string;
    children?: LigneActivite[];
}

const ORDRE_GROUPES = ['Transactions', 'Prestations', 'Hivernage / gardiennage', 'Autres'];

// Somme des activités d'un groupe
const sommeActivites = (groupe: string, activites: ActiviteKpi[]): ActiviteKpi => {
    const somme = (champ: 'caHT' | 'caHTN1' | 'coutHT' | 'margeBruteHT' | 'margeBruteHTN1') =>
        Math.round(activites.reduce((s, a) => s + a[champ], 0) * 100) / 100;
    const caHT = somme('caHT');
    const margeBruteHT = somme('margeBruteHT');
    return {
        code: groupe, libelle: groupe, groupe,
        caHT, caHTN1: somme('caHTN1'), coutHT: somme('coutHT'), margeBruteHT, margeBruteHTN1: somme('margeBruteHTN1'),
        tauxMarge: Math.abs(caHT) >= 0.005 ? Math.round((margeBruteHT / caHT) * 1000) / 10 : null,
    };
};

/**
 * Activités regroupées : transactions (pièces, bateaux, moteurs...), prestations, hivernage / gardiennage, autres.
 * Hors transactions, un groupe d'une seule activité reste une ligne simple.
 */
export const lignesActivites = (activites: ActiviteKpi[]): LigneActivite[] =>
    ORDRE_GROUPES.flatMap((groupe) => {
        const membres = activites.filter((a) => a.groupe === groupe);
        if (membres.length === 0) return [];
        if (membres.length === 1 && groupe !== 'Transactions') {
            return [{ ...membres[0], key: membres[0].code }];
        }
        return [{
            ...sommeActivites(groupe, membres),
            key: groupe,
            children: membres.map((a) => ({ ...a, key: a.code })),
        }];
    });

export default function KpisFinanciers() {
    const [fin, setFin] = useState(dayjs().startOf('month'));
    const [kpis, setKpis] = useState<KpisFinanciers | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        fetchWithAuth(`./kpis-financiers?fin=${fin.format('YYYY-MM')}`)
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setKpis)
            .catch((e) => message.error('Erreur lors du chargement des KPIs financiers : ' + e.message))
            .finally(() => setLoading(false));
    }, [fin]);

    useEffect(() => { load(); }, [load]);

    const caMensuel = useMemo(() => (kpis?.mois ?? []).flatMap((m) => [
        { mois: formatMois(m.mois), periode: 'N', valeur: m.caHT },
        { mois: formatMois(m.mois), periode: 'N-1', valeur: m.caHTN1 },
    ]), [kpis]);

    const encaissementsMensuels = useMemo(() => (kpis?.mois ?? []).flatMap((m) => [
        { mois: formatMois(m.mois), periode: 'N', valeur: m.encaissementsTTC },
        { mois: formatMois(m.mois), periode: 'N-1', valeur: m.encaissementsTTCN1 },
    ]), [kpis]);

    const caParActivite = useMemo(() => {
        const libelles = Object.fromEntries((kpis?.activites ?? []).map((a) => [a.code, a.libelle]));
        return (kpis?.mois ?? []).flatMap((m) => Object.entries(m.caHTParActivite)
            .filter(([code]) => code !== 'AVOIRS')
            .map(([code, ca]) => ({ mois: formatMois(m.mois), activite: libelles[code] ?? code, ca })));
    }, [kpis]);

    const activites = useMemo(() => lignesActivites(kpis?.activites ?? []), [kpis]);

    if (!kpis) {
        return (
            <div>
                <Typography.Title level={3}>KPIs financiers</Typography.Title>
                {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : <Empty description="Aucune donnée" />}
            </div>
        );
    }

    const { creances, stock } = kpis;

    const colonnesActivites = [
        { title: 'Activité', dataIndex: 'libelle', render: (v: string, l: LigneActivite) => (l.children ? <Text strong>{v}</Text> : v) },
        { title: 'CA HT', dataIndex: 'caHT', align: 'right' as const, render: (v: number) => formatEuro(v) },
        { title: 'CA HT N-1', dataIndex: 'caHTN1', align: 'right' as const, render: (v: number) => formatEuro(v) },
        { title: 'Évolution', key: 'evolution', align: 'center' as const, render: (_: unknown, l: LigneActivite) => <Evolution n={l.caHT} n1={l.caHTN1} /> },
        { title: 'Coût des ventes HT', dataIndex: 'coutHT', align: 'right' as const, render: (v: number) => formatEuro(v) },
        { title: 'Marge brute HT', dataIndex: 'margeBruteHT', align: 'right' as const, render: (v: number) => <Text type={v < 0 ? 'danger' : undefined}>{formatEuro(v)}</Text> },
        { title: 'Taux de marge', dataIndex: 'tauxMarge', align: 'right' as const, render: (v?: number | null) => (v == null ? '—' : `${v.toLocaleString('fr-FR')} %`) },
    ];

    const colonnesCreances = [
        { title: 'Facture', dataIndex: 'numeroFacture', render: (v?: string, f?: FactureEnRetard) => v || `#${f?.venteId}` },
        { title: 'Client', dataIndex: 'client', render: (v?: string) => v || '—' },
        { title: 'Émise le', dataIndex: 'dateFacture', render: formatDate },
        { title: 'Échéance', dataIndex: 'dateEcheance', render: formatDate },
        {
            title: 'Retard', dataIndex: 'joursRetard', align: 'right' as const,
            sorter: (a: FactureEnRetard, b: FactureEnRetard) => a.joursRetard - b.joursRetard,
            render: (v: number) => <Tag color={v > 90 ? 'red' : v > 30 ? 'orange' : 'gold'}>{v} j</Tag>,
        },
        { title: 'Relances', dataIndex: 'niveauRelance', align: 'center' as const, render: (v: number) => (v > 0 ? `${v}/3` : '—') },
        { title: 'Montant TTC', dataIndex: 'montantTTC', align: 'right' as const, render: (v: number) => formatEuro(v) },
        {
            title: 'Reste dû TTC', dataIndex: 'soldeTTC', align: 'right' as const,
            sorter: (a: FactureEnRetard, b: FactureEnRetard) => a.soldeTTC - b.soldeTTC,
            render: (v: number) => <Text strong>{formatEuro(v)}</Text>,
        },
    ];

    const colonnesStock = [
        { title: 'Catégorie', dataIndex: 'categorie' },
        { title: 'Quantité', dataIndex: 'quantite', align: 'right' as const, render: (v: number) => v.toLocaleString('fr-FR') },
        { title: 'Valeur HT', dataIndex: 'valeurHT', align: 'right' as const, render: (v: number) => <Text strong>{formatEuro(v)}</Text> },
        { title: '0-90 j', dataIndex: 'valeur0a90', align: 'right' as const, render: (v: number) => formatEuro(v) },
        { title: '91-180 j', dataIndex: 'valeur91a180', align: 'right' as const, render: (v: number) => formatEuro(v) },
        { title: '181-365 j', dataIndex: 'valeur181a365', align: 'right' as const, render: (v: number) => (v > 0 ? <Text type="warning">{formatEuro(v)}</Text> : formatEuro(v)) },
        { title: '> 365 j', dataIndex: 'valeurPlus365', align: 'right' as const, render: (v: number) => (v > 0 ? <Text type="danger">{formatEuro(v)}</Text> : formatEuro(v)) },
        { title: 'Non daté', dataIndex: 'valeurNonDatee', align: 'right' as const, render: (v: number) => <Text type="secondary">{formatEuro(v)}</Text> },
    ];

    const colonnesDormants = [
        { title: 'Type', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> },
        { title: 'Désignation', dataIndex: 'designation' },
        { title: 'Catégorie', dataIndex: 'categorie' },
        { title: 'Stock', dataIndex: 'stock', align: 'right' as const, render: (v: number) => v.toLocaleString('fr-FR') },
        { title: 'Coût unitaire HT', dataIndex: 'coutUnitaireHT', align: 'right' as const, render: (v: number) => formatEuro(v) },
        { title: 'Valeur HT', dataIndex: 'valeurHT', align: 'right' as const, render: (v: number) => formatEuro(v) },
        { title: 'Dont dormant', dataIndex: 'valeurDormanteHT', align: 'right' as const, render: (v: number) => <Text type="danger">{formatEuro(v)}</Text> },
        { title: 'En stock depuis', dataIndex: 'dateEntree', render: (v: string | undefined, a: ArticleDormant) => `${formatDate(v)} (${a.joursEnStock} j)` },
    ];

    const totalStock = (champ: keyof Omit<StockCategorie, 'categorie'>) => stock.categories.reduce((s, c) => s + c[champ], 0);

    return (
        <div>
            <Row justify="space-between" align="middle" gutter={[12, 12]} style={{ marginBottom: 8 }}>
                <Col>
                    <Typography.Title level={3} style={{ marginBottom: 0 }}>KPIs financiers</Typography.Title>
                    <Text type="secondary">
                        12 mois glissants de {formatMois(kpis.debut)} à {formatMois(kpis.fin)}, comparés aux 12 mois précédents (N-1).
                        Créances et stock à ce jour.
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
                {kpis.heuresSansCoutHoraire > 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        title={`${kpis.heuresSansCoutHoraire.toLocaleString('fr-FR')} h de main d'œuvre sans coût horaire`}
                        description="Ces heures ne sont pas déduites de la marge des prestations : renseignez le coût horaire chargé des techniciens (Atelier > Équipe)."
                    />
                )}
                {stock.articlesSansCout > 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        title={`${stock.articlesSansCout} article${stock.articlesSansCout > 1 ? 's' : ''} en stock sans coût d'achat`}
                        description="Sans prix moyen pondéré (réception de commande fournisseur) ni prix d'achat fournisseur, ils sont valorisés à 0 dans le stock et la marge."
                    />
                )}

                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #52c41a', height: '100%' }}>
                            <Statistic
                                title={<Space size={4}>CA HT (facturation)<Tooltip title="Factures émises, à leur date d'émission, avoirs déduits."><InfoCircleOutlined /></Tooltip></Space>}
                                value={formatEuro(kpis.caHT, 0)}
                                styles={{ content: { color: '#3f8600', fontWeight: 700 } }}
                            />
                            <Space size={4}><Evolution n={kpis.caHT} n1={kpis.caHTN1} /><Text type="secondary">N-1 : {formatEuro(kpis.caHTN1, 0)}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #1677ff', height: '100%' }}>
                            <Statistic
                                title={<Space size={4}>Encaissements TTC<Tooltip title="Règlements reçus, à leur date (hors avoirs utilisés en règlement), remboursements d'avoirs déduits."><InfoCircleOutlined /></Tooltip></Space>}
                                value={formatEuro(kpis.encaissementsTTC, 0)}
                                styles={{ content: { color: '#1677ff', fontWeight: 700 } }}
                            />
                            <Space size={4}><Evolution n={kpis.encaissementsTTC} n1={kpis.encaissementsTTCN1} /><Text type="secondary">N-1 : {formatEuro(kpis.encaissementsTTCN1, 0)}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #722ed1', height: '100%' }}>
                            <Statistic
                                title={<Space size={4}>Marge brute HT<Tooltip title="CA HT moins le coût d'achat des articles vendus (prix moyen pondéré figé à leur sortie de stock) et, pour les prestations, la main d'œuvre au coût horaire des techniciens."><InfoCircleOutlined /></Tooltip></Space>}
                                value={formatEuro(kpis.margeBruteHT, 0)}
                                styles={{ content: { color: '#722ed1', fontWeight: 700 } }}
                            />
                            <Space size={4}>
                                <Evolution n={kpis.margeBruteHT} n1={kpis.margeBruteHTN1} />
                                <Text type="secondary">Taux : {kpis.tauxMargeBrute == null ? '—' : `${kpis.tauxMargeBrute.toLocaleString('fr-FR')} %`}</Text>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #fa8c16', height: '100%' }}>
                            <Statistic
                                title="Créances clients TTC"
                                value={formatEuro(creances.totalTTC, 0)}
                                styles={{ content: { color: '#d46b08', fontWeight: 700 } }}
                            />
                            <Text type={creances.echuTTC > 0 ? 'danger' : 'secondary'}>
                                dont {formatEuro(creances.echuTTC, 0)} échus ({creances.nombreFacturesEchues} facture{creances.nombreFacturesEchues > 1 ? 's' : ''})
                            </Text>
                        </Card>
                    </Col>
                </Row>

                <Row gutter={[16, 16]}>
                    <Col xs={24} xl={12}>
                        <Card title="Chiffre d'affaires HT mensuel" style={{ height: '100%' }}>
                            {caMensuel.length > 0 ? (
                                <Column
                                    data={caMensuel}
                                    xField="mois"
                                    yField="valeur"
                                    colorField="periode"
                                    group
                                    height={300}
                                    axis={{ y: { labelFormatter: (v: number) => formatEuro(v, 0) } }}
                                    tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatEuro(v) }] }}
                                />
                            ) : <Empty description="Aucune donnée" />}
                        </Card>
                    </Col>
                    <Col xs={24} xl={12}>
                        <Card title="Encaissements TTC mensuels" style={{ height: '100%' }}>
                            {encaissementsMensuels.length > 0 ? (
                                <Line
                                    data={encaissementsMensuels}
                                    xField="mois"
                                    yField="valeur"
                                    colorField="periode"
                                    height={300}
                                    point={{ shapeField: 'circle', sizeField: 3 }}
                                    axis={{ y: { labelFormatter: (v: number) => formatEuro(v, 0) } }}
                                    tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatEuro(v) }] }}
                                />
                            ) : <Empty description="Aucune donnée" />}
                        </Card>
                    </Col>
                </Row>

                <Card title="Chiffre d'affaires et marge brute par activité">
                    {caParActivite.length > 0 && (
                        <Column
                            data={caParActivite}
                            xField="mois"
                            yField="ca"
                            colorField="activite"
                            stack
                            height={300}
                            axis={{ y: { labelFormatter: (v: number) => formatEuro(v, 0) } }}
                            tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatEuro(v) }] }}
                        />
                    )}
                    <Table<LigneActivite>
                        rowKey="key"
                        size="small"
                        columns={colonnesActivites}
                        dataSource={activites}
                        pagination={false}
                        expandable={{ defaultExpandAllRows: true }}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucune facture sur la période' }}
                        summary={() => (
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right"><Text strong>{formatEuro(kpis.caHT)}</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right">{formatEuro(kpis.caHTN1)}</Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="center"><Evolution n={kpis.caHT} n1={kpis.caHTN1} /></Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right">{formatEuro(kpis.caHT - kpis.margeBruteHT)}</Table.Summary.Cell>
                                <Table.Summary.Cell index={5} align="right"><Text strong>{formatEuro(kpis.margeBruteHT)}</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={6} align="right">{kpis.tauxMargeBrute == null ? '—' : `${kpis.tauxMargeBrute.toLocaleString('fr-FR')} %`}</Table.Summary.Cell>
                            </Table.Summary.Row>
                        )}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                        L'hivernage et le gardiennage regroupent les produits des catégories qui portent ces noms.
                        Le CA de chaque facture est réparti entre ses lignes au prorata de leur montant HT, remise globale comprise.
                    </Paragraph>
                </Card>

                <Card title="Créances clients">
                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        <Col xs={12} md={4}><Statistic title="Non échues" value={formatEuro(creances.nonEchuTTC, 0)} /></Col>
                        <Col xs={12} md={5}><Statistic title="Retard 1 à 30 j" value={formatEuro(creances.retard1a30TTC, 0)} styles={{ content: { color: '#d4b106' } }} /></Col>
                        <Col xs={12} md={5}><Statistic title="Retard 31 à 60 j" value={formatEuro(creances.retard31a60TTC, 0)} styles={{ content: { color: '#d46b08' } }} /></Col>
                        <Col xs={12} md={5}><Statistic title="Retard 61 à 90 j" value={formatEuro(creances.retard61a90TTC, 0)} styles={{ content: { color: '#d4380d' } }} /></Col>
                        <Col xs={24} md={5}><Statistic title="Retard > 90 j" value={formatEuro(creances.retardPlus90TTC, 0)} styles={{ content: { color: '#cf1322' } }} /></Col>
                    </Row>
                    <Table<FactureEnRetard>
                        rowKey="venteId"
                        size="small"
                        columns={colonnesCreances}
                        dataSource={creances.facturesEnRetard}
                        pagination={paginationConfig(10)}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucune facture en retard' }}
                    />
                </Card>

                <Card
                    title="Valeur et ancienneté du stock"
                    extra={<Text strong>{formatEuro(stock.valeurHT, 0)} HT</Text>}
                >
                    <Paragraph type="secondary">
                        Au prix d'achat moyen pondéré (à défaut, au prix d'achat fournisseur). L'ancienneté suppose que les articles
                        les plus anciens sortent en premier ; le stock antérieur au suivi des réceptions est non daté
                        ({formatEuro(stock.valeurNonDateeHT, 0)}).
                    </Paragraph>
                    <Table<StockCategorie>
                        rowKey="categorie"
                        size="small"
                        columns={colonnesStock}
                        dataSource={stock.categories}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucun article en stock' }}
                        summary={() => stock.categories.length > 0 && (
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">{totalStock('quantite').toLocaleString('fr-FR')}</Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right"><Text strong>{formatEuro(totalStock('valeurHT'))}</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right">{formatEuro(totalStock('valeur0a90'))}</Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right">{formatEuro(totalStock('valeur91a180'))}</Table.Summary.Cell>
                                <Table.Summary.Cell index={5} align="right">{formatEuro(totalStock('valeur181a365'))}</Table.Summary.Cell>
                                <Table.Summary.Cell index={6} align="right">{formatEuro(totalStock('valeurPlus365'))}</Table.Summary.Cell>
                                <Table.Summary.Cell index={7} align="right">{formatEuro(totalStock('valeurNonDatee'))}</Table.Summary.Cell>
                            </Table.Summary.Row>
                        )}
                    />
                </Card>

                <Card
                    title="Stock dormant (plus de 180 jours)"
                    extra={<Text type="danger" strong>{formatEuro(stock.valeurDormanteHT, 0)} HT</Text>}
                >
                    {stock.nombreArticlesDormants > stock.articlesDormants.length && (
                        <Paragraph type="secondary">
                            Les {stock.articlesDormants.length} articles au stock dormant le plus élevé, sur {stock.nombreArticlesDormants}.
                        </Paragraph>
                    )}
                    <Table<ArticleDormant>
                        rowKey={(a) => `${a.type}-${a.id}`}
                        size="small"
                        columns={colonnesDormants}
                        dataSource={stock.articlesDormants}
                        pagination={paginationConfig(10)}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucun article dormant' }}
                    />
                </Card>
            </Space>
        </div>
    );
}
