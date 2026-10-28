import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MosaicTable from "./MosaicTable.tsx";
import { Card, Checkbox, Col, DatePicker, Input, InputNumber, Row, Select, Space, Statistic, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { fetchWithAuth } from './api.ts';
import { paginationConfig } from './pagination.ts';

interface Reglement {
    id: number;
    venteId: number;
    numeroFacture?: string;
    clientId?: number;
    clientNom?: string;
    mode: string;
    montant: number;
    date?: string;
    notes?: string;
    rapproche: boolean;
    dateRapprochement?: string;
    sourceRapprochement?: string;
}

const MODE_LABEL: Record<string, string> = {
    CHEQUE: 'Chèque',
    VIREMENT: 'Virement',
    CARTE: 'Carte bancaire',
    'ESPÈCES': 'Espèces',
    AVOIR: 'Avoir',
};

const formatEuro = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0);
const formatDate = (v?: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—');

export default function Reglements() {
    const [reglements, setReglements] = useState<Reglement[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
    const [facture, setFacture] = useState('');
    const [client, setClient] = useState('');
    const [montantMin, setMontantMin] = useState<number | null>(null);
    const [montantMax, setMontantMax] = useState<number | null>(null);
    const [mode, setMode] = useState<string | null>(null);
    const [pointage, setPointage] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        fetchWithAuth('./reglements')
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setReglements)
            .catch((e) => message.error('Erreur : ' + e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleRapproche = (reglement: Reglement, rapproche: boolean) => {
        fetchWithAuth(`./reglements/${reglement.id}/rapprochement`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rapproche }),
        })
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then((updated: Reglement) => setReglements((list) => list.map((x) => (x.id === updated.id ? updated : x))))
            .catch((e) => message.error('Erreur : ' + e.message));
    };

    const filtered = useMemo(() => reglements.filter((r) => {
        if (dateRange?.[0] && (!r.date || dayjs(r.date).isBefore(dateRange[0].startOf('day')))) return false;
        if (dateRange?.[1] && (!r.date || dayjs(r.date).isAfter(dateRange[1].endOf('day')))) return false;
        if (facture && !(r.numeroFacture ?? '').toLowerCase().includes(facture.toLowerCase())) return false;
        if (client && !(r.clientNom ?? '').toLowerCase().includes(client.toLowerCase())) return false;
        if (montantMin != null && r.montant < montantMin) return false;
        if (montantMax != null && r.montant > montantMax) return false;
        if (mode && r.mode !== mode) return false;
        if (pointage === 'oui' && !r.rapproche) return false;
        if (pointage === 'non' && r.rapproche) return false;
        return true;
    }), [reglements, dateRange, facture, client, montantMin, montantMax, mode, pointage]);

    const total = filtered.reduce((s, r) => s + r.montant, 0);
    const totalNonRapproche = filtered.filter((r) => !r.rapproche).reduce((s, r) => s + r.montant, 0);

    const columns = [
        { title: 'Date', dataIndex: 'date', key: 'date', render: formatDate, sorter: (a: Reglement, b: Reglement) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf() },
        { title: 'Facture', dataIndex: 'numeroFacture', key: 'numeroFacture', render: (v?: string) => v || '—' },
        { title: 'Client', dataIndex: 'clientNom', key: 'clientNom', render: (v?: string) => v || '—' },
        { title: 'Type de paiement', dataIndex: 'mode', key: 'mode', render: (v: string) => MODE_LABEL[v] ?? v },
        { title: 'Montant', dataIndex: 'montant', key: 'montant', align: 'right' as const, render: formatEuro, sorter: (a: Reglement, b: Reglement) => a.montant - b.montant },
        {
            title: 'Sur le compte bancaire',
            key: 'rapproche',
            align: 'center' as const,
            render: (_: any, r: Reglement) => (
                <Space direction="vertical" size={0}>
                    <Checkbox checked={r.rapproche} onChange={(e) => toggleRapproche(r, e.target.checked)} />
                    {r.rapproche && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {formatDate(r.dateRapprochement)}{' '}
                            <Tag color={r.sourceRapprochement === 'MANUEL' ? 'default' : 'green'}>
                                {r.sourceRapprochement === 'MANUEL' ? 'Manuel' : r.sourceRapprochement}
                            </Tag>
                        </Typography.Text>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Typography.Title level={3}>Règlements</Typography.Title>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={6}><Card size="small"><Statistic title="Règlements affichés" value={filtered.length} /></Card></Col>
                <Col xs={24} md={9}><Card size="small"><Statistic title="Total" value={formatEuro(total)} /></Card></Col>
                <Col xs={24} md={9}><Card size="small"><Statistic title="Non retrouvé en banque" value={formatEuro(totalNonRapproche)} /></Card></Col>
            </Row>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={8}>
                    <DatePicker.RangePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        placeholder={['Du', 'Au']}
                        onChange={(v) => setDateRange(v as any)}
                    />
                </Col>
                <Col xs={12} md={4}><Input allowClear placeholder="N° de facture" value={facture} onChange={(e) => setFacture(e.target.value)} /></Col>
                <Col xs={12} md={4}><Input allowClear placeholder="Client" value={client} onChange={(e) => setClient(e.target.value)} /></Col>
                <Col xs={12} md={4}><InputNumber style={{ width: '100%' }} placeholder="Montant min" min={0} value={montantMin} onChange={setMontantMin} /></Col>
                <Col xs={12} md={4}><InputNumber style={{ width: '100%' }} placeholder="Montant max" min={0} value={montantMax} onChange={setMontantMax} /></Col>
                <Col xs={12} md={6}>
                    <Select
                        allowClear
                        placeholder="Type de paiement"
                        style={{ width: '100%' }}
                        value={mode ?? undefined}
                        onChange={(v) => setMode(v ?? null)}
                        options={Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label }))}
                    />
                </Col>
                <Col xs={12} md={6}>
                    <Select
                        allowClear
                        placeholder="Pointage bancaire"
                        style={{ width: '100%' }}
                        value={pointage ?? undefined}
                        onChange={(v) => setPointage(v ?? null)}
                        options={[{ value: 'oui', label: 'Retrouvés en banque' }, { value: 'non', label: 'Non retrouvés' }]}
                    />
                </Col>
            </Row>
            <MosaicTable
                rowKey="id"
                loading={loading}
                dataSource={filtered}
                columns={columns}
                pagination={paginationConfig()}
                bordered
            />
        </div>
    );
}
