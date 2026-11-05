import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Empty, Row, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, ScheduleOutlined, SendOutlined } from '@ant-design/icons';
import { Column, Line } from '@ant-design/charts';
import dayjs from 'dayjs';
import { fetchWithAuth } from './api.ts';
import { paginationConfig } from './pagination.ts';
import { useNavigation } from './navigation-context.tsx';
import { libelleCanalAcquisition } from './canal-acquisition.ts';
import { EcartPoints, Evolution, formatDate, formatEuro, formatMois, formatTaux } from './kpis-commun.tsx';
import { EcheanceTag, TYPES_INTERACTION } from './crm.tsx';

const { Text, Paragraph } = Typography;

interface MoisKpi {
    mois: string;
    leads: number;
    leadsN1: number;
    acceptes: number;
    acceptesN1: number;
    refuses: number;
    enAttente: number;
    montantLeadsHT: number;
    montantAccepteHT: number;
    tauxConversion?: number | null;
    tauxConversionN1?: number | null;
    leadsParCanal: Record<string, number>;
    echanges: number;
    echangesN1: number;
    echangesParType: Record<string, number>;
}

interface CanalKpi {
    code: string;
    leads: number;
    leadsN1: number;
    acceptes: number;
    refuses: number;
    enAttente: number;
    montantLeadsHT: number;
    montantAccepteHT: number;
    tauxConversion?: number | null;
}

interface MotifRefus {
    motif: string;
    nombre: number;
    montantHT: number;
}

interface DevisEnAttente {
    venteId: number;
    numero?: string;
    ordreDeReparation: boolean;
    clientId?: number | null;
    client?: string;
    canal: string;
    dateDevis?: string;
    joursAttente: number;
    montantHT: number;
    montantTTC: number;
    niveauRelance: number;
    derniereRelance?: string;
    emailClient: boolean;
    relanceAutomatique: boolean;
    aRelancer: boolean;
    dernierEchange?: string | null;
    prochaineAction?: string | null;
}

interface Pipeline {
    nombreDevis: number;
    montantHT: number;
    montantTTC: number;
    montant0a15HT: number;
    montant16a30HT: number;
    montant31a60HT: number;
    montantPlus60HT: number;
    nombreARelancer: number;
    montantARelancerHT: number;
    seuilRelanceJours: number;
    relanceAutomatique: boolean;
    devis: DevisEnAttente[];
}

interface UtilisateurKpi {
    utilisateur?: string | null;
    echanges: number;
    actionsFaites: number;
    actionsFaitesALEcheance: number;
    tauxRespectEcheances?: number | null;
    actionsAFaire: number;
    actionsEnRetard: number;
}

interface SuiviCommercial {
    echanges: number;
    echangesN1: number;
    actionsFaites: number;
    actionsFaitesALEcheance: number;
    tauxRespectEcheances?: number | null;
    actionsAFaire: number;
    actionsEnRetard: number;
    prospects: number;
    prospectsSansAction: number;
    prospectsConvertis: number;
    prospectsConvertisN1: number;
    delaiMoyenConversionJours?: number | null;
    utilisateurs: UtilisateurKpi[];
}

const libelleTypeInteraction = (type: string) => TYPES_INTERACTION.find((t) => t.value === type)?.label ?? type;

export interface KpisCommerciaux {
    debut: string;
    fin: string;
    leads: number;
    leadsN1: number;
    acceptes: number;
    acceptesN1: number;
    refuses: number;
    refusesN1: number;
    enAttente: number;
    montantLeadsHT: number;
    montantLeadsHTN1: number;
    montantAccepteHT: number;
    montantAccepteHTN1: number;
    tauxConversion?: number | null;
    tauxConversionN1?: number | null;
    delaiMoyenAcceptationJours?: number | null;
    mois: MoisKpi[];
    canaux: CanalKpi[];
    motifsRefus: MotifRefus[];
    pipeline: Pipeline;
    suivi: SuiviCommercial;
}

export default function KpisCommerciaux() {
    const { navigate } = useNavigation();
    const [fin, setFin] = useState(dayjs().startOf('month'));
    const [kpis, setKpis] = useState<KpisCommerciaux | null>(null);
    const [loading, setLoading] = useState(false);
    const [relanceEnCours, setRelanceEnCours] = useState<number | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        fetchWithAuth(`./kpis-commerciaux?fin=${fin.format('YYYY-MM')}`)
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setKpis)
            .catch((e) => message.error('Erreur lors du chargement des KPIs commerciaux : ' + e.message))
            .finally(() => setLoading(false));
    }, [fin]);

    useEffect(() => { load(); }, [load]);

    const relancer = async (devis: DevisEnAttente) => {
        setRelanceEnCours(devis.venteId);
        try {
            const r = await fetchWithAuth(`./ventes/${devis.venteId}/rappel`, { method: 'POST' });
            if (!r.ok) throw new Error((await r.text()) || 'Erreur ' + r.status);
            message.success(`Relance envoyée à ${devis.client || 'le client'}`);
            load();
        } catch (e: any) {
            message.error("Erreur lors de l'envoi de la relance : " + e.message);
        } finally {
            setRelanceEnCours(null);
        }
    };

    const leadsMensuels = useMemo(() => (kpis?.mois ?? []).flatMap((m) => [
        { mois: formatMois(m.mois), periode: 'N', valeur: m.leads },
        { mois: formatMois(m.mois), periode: 'N-1', valeur: m.leadsN1 },
    ]), [kpis]);

    const conversionMensuelle = useMemo(() => (kpis?.mois ?? []).flatMap((m) => [
        { mois: formatMois(m.mois), periode: 'N', valeur: m.tauxConversion },
        { mois: formatMois(m.mois), periode: 'N-1', valeur: m.tauxConversionN1 },
    ]).filter((p) => p.valeur != null), [kpis]);

    const leadsParOrigine = useMemo(() => (kpis?.mois ?? []).flatMap((m) => Object.entries(m.leadsParCanal)
        .map(([canal, leads]) => ({ mois: formatMois(m.mois), origine: libelleCanalAcquisition(canal), leads }))), [kpis]);

    const echangesParType = useMemo(() => (kpis?.mois ?? []).flatMap((m) => Object.entries(m.echangesParType ?? {})
        .map(([type, echanges]) => ({ mois: formatMois(m.mois), type: libelleTypeInteraction(type), echanges }))), [kpis]);

    if (!kpis) {
        return (
            <div>
                <Typography.Title level={3}>KPIs commerciaux</Typography.Title>
                {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : <Empty description="Aucune donnée" />}
            </div>
        );
    }

    const { pipeline, suivi } = kpis;

    const colonnesCanaux = [
        { title: 'Origine', dataIndex: 'code', render: (v: string) => libelleCanalAcquisition(v) },
        { title: 'Leads', dataIndex: 'leads', align: 'right' as const, sorter: (a: CanalKpi, b: CanalKpi) => a.leads - b.leads },
        { title: 'Leads N-1', dataIndex: 'leadsN1', align: 'right' as const },
        { title: 'Évolution', key: 'evolution', align: 'center' as const, render: (_: unknown, c: CanalKpi) => <Evolution n={c.leads} n1={c.leadsN1} /> },
        { title: 'Acceptés', dataIndex: 'acceptes', align: 'right' as const },
        { title: 'Refusés', dataIndex: 'refuses', align: 'right' as const },
        { title: 'En attente', dataIndex: 'enAttente', align: 'right' as const },
        { title: 'Taux de conversion', dataIndex: 'tauxConversion', align: 'right' as const, render: formatTaux },
        { title: 'Montant accepté HT', dataIndex: 'montantAccepteHT', align: 'right' as const, render: (v: number) => formatEuro(v) },
    ];

    const colonnesMotifs = [
        { title: 'Motif', dataIndex: 'motif' },
        { title: 'Devis/OR', dataIndex: 'nombre', align: 'right' as const },
        { title: 'Montant HT', dataIndex: 'montantHT', align: 'right' as const, render: (v: number) => formatEuro(v) },
    ];

    const colonnesPipeline = [
        {
            title: 'Devis/OR', dataIndex: 'numero',
            render: (v: string | undefined, d: DevisEnAttente) => (
                <Space size={4}>
                    <a onClick={() => navigate('/prestations', { venteId: d.venteId })}>{v || `#${d.venteId}`}</a>
                    {d.ordreDeReparation && <Tag>OR</Tag>}
                </Space>
            ),
        },
        {
            title: 'Client', dataIndex: 'client',
            render: (v: string | undefined, d: DevisEnAttente) => (d.clientId
                ? <a onClick={() => navigate('/clients', { ouvrirClientId: d.clientId })}>{v || `#${d.clientId}`}</a>
                : v || '—'),
        },
        { title: 'Origine', dataIndex: 'canal', render: (v: string) => libelleCanalAcquisition(v) },
        { title: 'Date', dataIndex: 'dateDevis', render: formatDate },
        {
            title: 'Attente', dataIndex: 'joursAttente', align: 'right' as const,
            sorter: (a: DevisEnAttente, b: DevisEnAttente) => a.joursAttente - b.joursAttente,
            render: (v: number) => <Tag color={v > 60 ? 'red' : v > 30 ? 'orange' : v > 15 ? 'gold' : 'default'}>{v} j</Tag>,
        },
        {
            title: 'Relances', key: 'relances',
            render: (_: unknown, d: DevisEnAttente) => (
                <Space orientation="vertical" size={0}>
                    <span>{d.niveauRelance > 0 ? `${d.niveauRelance}/3` : '—'}{d.derniereRelance && <Text type="secondary"> (dernière le {formatDate(d.derniereRelance)})</Text>}</span>
                    {!d.relanceAutomatique && <Text type="secondary" style={{ fontSize: 12 }}>{d.emailClient ? 'Sans relance automatique' : 'Client sans email'}</Text>}
                </Space>
            ),
        },
        {
            title: 'Suivi commercial', key: 'suivi',
            render: (_: unknown, d: DevisEnAttente) => (
                <Space orientation="vertical" size={0}>
                    {d.prochaineAction && (
                        <Space size={4}><span>Action le {formatDate(d.prochaineAction)}</span><EcheanceTag date={d.prochaineAction} /></Space>
                    )}
                    {d.dernierEchange && <Text type="secondary" style={{ fontSize: 12 }}>Dernier échange le {formatDate(d.dernierEchange)}</Text>}
                    {!d.prochaineAction && !d.dernierEchange && <Text type="secondary">—</Text>}
                </Space>
            ),
        },
        {
            title: 'Montant HT', dataIndex: 'montantHT', align: 'right' as const,
            sorter: (a: DevisEnAttente, b: DevisEnAttente) => a.montantHT - b.montantHT,
            render: (v: number) => formatEuro(v),
        },
        {
            title: 'À relancer', dataIndex: 'aRelancer', align: 'center' as const,
            filters: [{ text: 'À relancer', value: true }],
            onFilter: (value: unknown, d: DevisEnAttente) => d.aRelancer === value,
            render: (v: boolean) => (v ? <Tag color="volcano">À relancer</Tag> : null),
        },
        {
            title: 'Action', key: 'action',
            render: (_: unknown, d: DevisEnAttente) => (
                <Button
                    size="small"
                    icon={<SendOutlined />}
                    disabled={!d.emailClient}
                    loading={relanceEnCours === d.venteId}
                    title={d.emailClient ? 'Envoyer une relance par email' : "Le client n'a pas d'adresse email"}
                    onClick={() => relancer(d)}
                >
                    Relancer
                </Button>
            ),
        },
    ];

    const colonnesUtilisateurs = [
        { title: 'Utilisateur', dataIndex: 'utilisateur', render: (v?: string | null) => v || <Text type="secondary">Non attribué</Text> },
        { title: 'Échanges', dataIndex: 'echanges', align: 'right' as const, sorter: (a: UtilisateurKpi, b: UtilisateurKpi) => a.echanges - b.echanges },
        { title: 'Actions faites', dataIndex: 'actionsFaites', align: 'right' as const },
        { title: 'Échéances respectées', dataIndex: 'tauxRespectEcheances', align: 'right' as const, render: formatTaux },
        { title: 'Actions à faire', dataIndex: 'actionsAFaire', align: 'right' as const },
        {
            title: 'En retard', dataIndex: 'actionsEnRetard', align: 'right' as const,
            render: (v: number) => (v > 0 ? <Tag color="red">{v}</Tag> : v),
        },
    ];

    return (
        <div>
            <Row justify="space-between" align="middle" gutter={[12, 12]} style={{ marginBottom: 8 }}>
                <Col>
                    <Typography.Title level={3} style={{ marginBottom: 0 }}>KPIs commerciaux</Typography.Title>
                    <Text type="secondary">
                        Leads (devis/OR) et suivi commercial de {formatMois(kpis.debut)} à {formatMois(kpis.fin)}, comparés aux 12 mois précédents (N-1).
                        Pipeline, actions à faire et prospects à ce jour.
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
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #1677ff', height: '100%' }}>
                            <Statistic
                                title={<Space size={4}>Leads (devis/OR)<Tooltip title="Transactions/prestations hors comptoir, à la date de leur devis."><InfoCircleOutlined /></Tooltip></Space>}
                                value={kpis.leads}
                                styles={{ content: { color: '#1677ff', fontWeight: 700 } }}
                            />
                            <Space size={4}><Evolution n={kpis.leads} n1={kpis.leadsN1} /><Text type="secondary">N-1 : {kpis.leadsN1}</Text></Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #52c41a', height: '100%' }}>
                            <Statistic
                                title={<Space size={4}>Taux de conversion<Tooltip title="Leads acceptés (bon pour accord signé ou prestation lancée) sur leads émis."><InfoCircleOutlined /></Tooltip></Space>}
                                value={formatTaux(kpis.tauxConversion)}
                                styles={{ content: { color: '#3f8600', fontWeight: 700 } }}
                            />
                            <Space size={4} wrap>
                                <EcartPoints taux={kpis.tauxConversion} tauxN1={kpis.tauxConversionN1} />
                                <Text type="secondary">{kpis.acceptes} acceptés, {kpis.refuses} refusés, {kpis.enAttente} en attente</Text>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #722ed1', height: '100%' }}>
                            <Statistic
                                title="Montant accepté HT"
                                value={formatEuro(kpis.montantAccepteHT, 0)}
                                styles={{ content: { color: '#722ed1', fontWeight: 700 } }}
                            />
                            <Space size={4} wrap>
                                <Evolution n={kpis.montantAccepteHT} n1={kpis.montantAccepteHTN1} />
                                <Text type="secondary">
                                    sur {formatEuro(kpis.montantLeadsHT, 0)} proposés
                                    {kpis.delaiMoyenAcceptationJours != null && `, signés en ${kpis.delaiMoyenAcceptationJours.toLocaleString('fr-FR')} j en moyenne`}
                                </Text>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} xl={6}>
                        <Card style={{ borderTop: '3px solid #fa8c16', height: '100%' }}>
                            <Statistic
                                title={<Space size={4}>Pipeline HT<Tooltip title="Devis/OR en attente de signature à ce jour, ni acceptés ni refusés."><InfoCircleOutlined /></Tooltip></Space>}
                                value={formatEuro(pipeline.montantHT, 0)}
                                styles={{ content: { color: '#d46b08', fontWeight: 700 } }}
                            />
                            <Text type={pipeline.nombreARelancer > 0 ? 'danger' : 'secondary'}>
                                {pipeline.nombreDevis} devis/OR en attente, dont {pipeline.nombreARelancer} à relancer
                            </Text>
                        </Card>
                    </Col>
                </Row>

                <Row gutter={[16, 16]}>
                    <Col xs={24} xl={12}>
                        <Card title="Leads mensuels" style={{ height: '100%' }}>
                            {leadsMensuels.length > 0 ? (
                                <Column data={leadsMensuels} xField="mois" yField="valeur" colorField="periode" group height={300} />
                            ) : <Empty description="Aucune donnée" />}
                        </Card>
                    </Col>
                    <Col xs={24} xl={12}>
                        <Card title="Taux de conversion mensuel" style={{ height: '100%' }}>
                            {conversionMensuelle.length > 0 ? (
                                <Line
                                    data={conversionMensuelle}
                                    xField="mois"
                                    yField="valeur"
                                    colorField="periode"
                                    height={300}
                                    point={{ shapeField: 'circle', sizeField: 3 }}
                                    axis={{ y: { labelFormatter: (v: number) => `${v} %` } }}
                                    tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatTaux(v) }] }}
                                />
                            ) : <Empty description="Aucun lead sur la période" />}
                        </Card>
                    </Col>
                </Row>

                <Card title="Leads par origine">
                    {leadsParOrigine.length > 0 && (
                        <Column data={leadsParOrigine} xField="mois" yField="leads" colorField="origine" stack height={300} />
                    )}
                    <Table<CanalKpi>
                        rowKey="code"
                        size="small"
                        columns={colonnesCanaux}
                        dataSource={kpis.canaux}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucun lead sur la période' }}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                        L'origine d'un lead est le canal d'acquisition de son client (fiche client).
                    </Paragraph>
                </Card>

                <Card title="Pipeline commercial">
                    {!pipeline.relanceAutomatique && (
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            title="Relance automatique des devis désactivée"
                            description={`Paramétrez ses délais dans Paramétrage > Société pour relancer les clients par email. En attendant, un devis sans nouvelle depuis ${pipeline.seuilRelanceJours} jours est à relancer.`}
                        />
                    )}
                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        <Col xs={12} md={6}><Statistic title="Jusqu'à 15 j" value={formatEuro(pipeline.montant0a15HT, 0)} /></Col>
                        <Col xs={12} md={6}><Statistic title="16 à 30 j" value={formatEuro(pipeline.montant16a30HT, 0)} styles={{ content: { color: '#d4b106' } }} /></Col>
                        <Col xs={12} md={6}><Statistic title="31 à 60 j" value={formatEuro(pipeline.montant31a60HT, 0)} styles={{ content: { color: '#d46b08' } }} /></Col>
                        <Col xs={12} md={6}><Statistic title="Plus de 60 j" value={formatEuro(pipeline.montantPlus60HT, 0)} styles={{ content: { color: '#cf1322' } }} /></Col>
                    </Row>
                    <Table<DevisEnAttente>
                        rowKey="venteId"
                        size="small"
                        columns={colonnesPipeline}
                        dataSource={pipeline.devis}
                        pagination={paginationConfig(10)}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucun devis en attente' }}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                        Un échange avec le client (appel, email, visite, rendez-vous) compte comme une nouvelle du devis, au même titre qu'une relance.
                        Marquez les devis refusés depuis Transactions/Prestations : ils sortent du pipeline et leurs motifs sont suivis ci-dessous.
                    </Paragraph>
                </Card>

                <Card title="Motifs de refus">
                    <Table<MotifRefus>
                        rowKey="motif"
                        size="small"
                        columns={colonnesMotifs}
                        dataSource={kpis.motifsRefus}
                        pagination={false}
                        locale={{ emptyText: 'Aucun devis refusé sur la période' }}
                    />
                </Card>

                <Card
                    title="Suivi commercial"
                    extra={<Button size="small" icon={<ScheduleOutlined />} onClick={() => navigate('/actions-commerciales')}>Actions commerciales</Button>}
                >
                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        <Col xs={24} sm={12} xl={6}>
                            <Statistic
                                title={<Space size={4}>Échanges<Tooltip title="Appels, emails, visites et rendez-vous avec les clients et prospects (hors notes), à leur date."><InfoCircleOutlined /></Tooltip></Space>}
                                value={suivi.echanges}
                            />
                            <Space size={4}><Evolution n={suivi.echanges} n1={suivi.echangesN1} /><Text type="secondary">N-1 : {suivi.echangesN1}</Text></Space>
                        </Col>
                        <Col xs={24} sm={12} xl={6}>
                            <Statistic title="Actions à faire" value={suivi.actionsAFaire} />
                            <Text type={suivi.actionsEnRetard > 0 ? 'danger' : 'secondary'}>dont {suivi.actionsEnRetard} en retard</Text>
                        </Col>
                        <Col xs={24} sm={12} xl={6}>
                            <Statistic
                                title={<Space size={4}>Échéances respectées<Tooltip title="Actions faites sur la période au plus tard le jour de leur échéance."><InfoCircleOutlined /></Tooltip></Space>}
                                value={formatTaux(suivi.tauxRespectEcheances)}
                            />
                            <Text type="secondary">{suivi.actionsFaitesALEcheance} sur {suivi.actionsFaites} actions faites</Text>
                        </Col>
                        <Col xs={24} sm={12} xl={6}>
                            <Statistic
                                title={<Space size={4}>Prospects<Tooltip title="Prospects à ce jour, et prospects devenus clients sur la période (vente acceptée ou statut changé sur la fiche)."><InfoCircleOutlined /></Tooltip></Space>}
                                value={suivi.prospects}
                            />
                            <Space orientation="vertical" size={0}>
                                <Text type={suivi.prospectsSansAction > 0 ? 'warning' : 'secondary'}>dont {suivi.prospectsSansAction} sans action à faire</Text>
                                <Space size={4} wrap>
                                    <Evolution n={suivi.prospectsConvertis} n1={suivi.prospectsConvertisN1} />
                                    <Text type="secondary">
                                        {suivi.prospectsConvertis} devenus clients (N-1 : {suivi.prospectsConvertisN1})
                                        {suivi.delaiMoyenConversionJours != null && `, en ${suivi.delaiMoyenConversionJours.toLocaleString('fr-FR')} j en moyenne`}
                                    </Text>
                                </Space>
                            </Space>
                        </Col>
                    </Row>
                    {echangesParType.length > 0 && (
                        <Column data={echangesParType} xField="mois" yField="echanges" colorField="type" stack height={300} />
                    )}
                    <Table<UtilisateurKpi>
                        rowKey={(u) => u.utilisateur ?? ''}
                        size="small"
                        columns={colonnesUtilisateurs}
                        dataSource={suivi.utilisateurs}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: 'Aucun échange ni action commerciale' }}
                    />
                    <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                        Échanges et actions faites sur la période ; actions à faire à ce jour. Notez les échanges et planifiez les actions depuis l'onglet « Suivi commercial » de la fiche client.
                    </Paragraph>
                </Card>
            </Space>
        </div>
    );
}
