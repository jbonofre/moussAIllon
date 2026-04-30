import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Divider, Modal, Space, Spin, Table, Tag, message } from 'antd';
import { EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import api from './api.ts';

interface ClientRef { id: number; prenom?: string; nom: string }
interface VenteRef { id: number; status?: string }

interface AvoirLigne {
    id?: number;
    designation: string;
    quantite: number;
    prixUnitaireHT: number;
    tva: number;
    montantTVA: number;
    totalTTC: number;
}

interface AvoirEntity {
    id: number;
    status: string;
    client?: ClientRef;
    vente?: VenteRef;
    motif?: string;
    notes?: string;
    dateEmission?: string;
    dateRemboursement?: string;
    montantHT?: number;
    tva?: number;
    montantTVA?: number;
    montantTTC?: number;
    montantUtilise?: number;
    modeRemboursement?: string;
    lignes?: AvoirLigne[];
}

interface MesAvoirsProps {
    clientId: number;
}

const STATUS_LABEL: Record<string, string> = {
    BROUILLON: 'Brouillon',
    EMIS: 'Émis',
    REMBOURSE: 'Remboursé',
    ANNULE: 'Annulé',
};

const STATUS_COLOR: Record<string, string> = {
    BROUILLON: 'default',
    EMIS: 'blue',
    REMBOURSE: 'green',
    ANNULE: 'red',
};

const MODE_LABELS: Record<string, string> = {
    CHEQUE: 'Chèque',
    VIREMENT: 'Virement',
    CARTE: 'Carte',
    'ESPÈCES': 'Espèces',
};

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR');
};

const formatEuro = (value?: number) => `${(value ?? 0).toFixed(2)} EUR`;

const escapeHtml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

export default function MesAvoirs({ clientId }: MesAvoirsProps) {
    const [avoirs, setAvoirs] = useState<AvoirEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [detailAvoir, setDetailAvoir] = useState<AvoirEntity | null>(null);

    const fetchAvoirs = useCallback(() => {
        setLoading(true);
        api.get(`/portal/clients/${clientId}/avoirs`)
            .then((res) => setAvoirs(res.data || []))
            .catch(() => message.error('Erreur lors du chargement des avoirs'))
            .finally(() => setLoading(false));
    }, [clientId]);

    useEffect(() => { fetchAvoirs(); }, [fetchAvoirs]);

    const handlePrint = (avoir: AvoirEntity) => {
        const title = `Avoir #${avoir.id}`;
        const tableRows = (avoir.lignes ?? []).map((ligne) =>
            `<tr>
                <td>${escapeHtml(ligne.designation)}</td>
                <td style="text-align:center;">${ligne.quantite}</td>
                <td style="text-align:right;">${escapeHtml(formatEuro(ligne.prixUnitaireHT))}</td>
                <td style="text-align:right;">${escapeHtml(formatEuro(ligne.totalTTC))}</td>
            </tr>`
        ).join('');

        const html = `<html><head><title>${escapeHtml(title)}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 24px; color: #1f1f1f; }
                h1 { margin-bottom: 8px; }
                .meta p { margin: 4px 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { border: 1px solid #d9d9d9; padding: 6px 8px; }
                th { background: #fafafa; text-align: left; }
                .totals { margin-top: 16px; text-align: right; }
                .totals p { margin: 4px 0; }
            </style></head><body>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
                <p><strong>Date d'émission :</strong> ${escapeHtml(formatDate(avoir.dateEmission))}</p>
                <p><strong>Motif :</strong> ${escapeHtml(avoir.motif ?? '-')}</p>
                ${avoir.vente ? `<p><strong>Facture d'origine :</strong> #${avoir.vente.id}</p>` : ''}
                ${avoir.modeRemboursement ? `<p><strong>Mode de remboursement :</strong> ${escapeHtml(MODE_LABELS[avoir.modeRemboursement] ?? avoir.modeRemboursement)}</p>` : ''}
            </div>
            <table>
                <thead><tr>
                    <th>Désignation</th>
                    <th style="text-align:center;">Qté</th>
                    <th style="text-align:right;">P.U. HT</th>
                    <th style="text-align:right;">Total TTC</th>
                </tr></thead>
                <tbody>${tableRows || '<tr><td colspan="4">Aucun élément</td></tr>'}</tbody>
            </table>
            <div class="totals">
                <p>Montant HT : ${escapeHtml(formatEuro(avoir.montantHT))}</p>
                <p>TVA : ${escapeHtml(formatEuro(avoir.montantTVA))}</p>
                <p><strong style="font-size:16px;">Total TTC : ${escapeHtml(formatEuro(avoir.montantTTC))}</strong></p>
            </div>
        </body></html>`;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        document.body.appendChild(iframe);
        const win = iframe.contentWindow;
        if (!win) { iframe.remove(); return; }
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
        setTimeout(() => iframe.remove(), 1000);
    };

    const columns = [
        {
            title: '#',
            dataIndex: 'id',
            width: 60,
            render: (v: number) => `#${v}`,
        },
        {
            title: 'Date d\'émission',
            dataIndex: 'dateEmission',
            render: (v: string) => formatDate(v),
        },
        {
            title: 'Facture liée',
            key: 'vente',
            width: 110,
            render: (_: unknown, r: AvoirEntity) => r.vente ? `#${r.vente.id}` : '-',
        },
        {
            title: 'Motif',
            dataIndex: 'motif',
            ellipsis: true,
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            width: 120,
            render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>,
        },
        {
            title: 'Montant TTC',
            dataIndex: 'montantTTC',
            width: 120,
            align: 'right' as const,
            render: (v: number) => formatEuro(v),
        },
        {
            title: 'Solde restant',
            key: 'solde',
            width: 120,
            align: 'right' as const,
            render: (_: unknown, r: AvoirEntity) => {
                const restant = Math.round(((r.montantTTC ?? 0) - (r.montantUtilise ?? 0)) * 100) / 100;
                const color = restant <= 0.005 ? '#8c8c8c' : restant < (r.montantTTC ?? 0) ? '#faad14' : '#52c41a';
                return <span style={{ color }}>{formatEuro(restant)}</span>;
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, r: AvoirEntity) => (
                <Space size="small">
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailAvoir(r)}>
                        Détail
                    </Button>
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(r)}>
                        Imprimer
                    </Button>
                </Space>
            ),
        },
    ];

    const detailColumns = [
        { title: 'Désignation', dataIndex: 'designation' },
        { title: 'Qté', dataIndex: 'quantite', width: 60, align: 'center' as const },
        { title: 'P.U. HT', dataIndex: 'prixUnitaireHT', width: 110, align: 'right' as const, render: (v: number) => formatEuro(v) },
        { title: 'TVA', dataIndex: 'tva', width: 70, align: 'center' as const, render: (v: number) => `${v}%` },
        { title: 'Total TTC', dataIndex: 'totalTTC', width: 110, align: 'right' as const, render: (v: number) => formatEuro(v) },
    ];

    return (
        <Card title="Mes avoirs">
            <Spin spinning={loading}>
                <Table
                    rowKey="id"
                    dataSource={avoirs}
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                    bordered
                    locale={{ emptyText: 'Aucun avoir à afficher' }}
                />
            </Spin>

            <Modal
                title={detailAvoir ? `Avoir #${detailAvoir.id}` : ''}
                open={!!detailAvoir}
                onCancel={() => setDetailAvoir(null)}
                width={750}
                footer={detailAvoir ? [
                    <Button key="print" icon={<PrinterOutlined />} onClick={() => handlePrint(detailAvoir)}>
                        Imprimer
                    </Button>,
                    <Button key="close" onClick={() => setDetailAvoir(null)}>Fermer</Button>,
                ] : null}
            >
                {detailAvoir && (
                    <div>
                        <p><strong>Statut :</strong>{' '}
                            <Tag color={STATUS_COLOR[detailAvoir.status]}>
                                {STATUS_LABEL[detailAvoir.status] ?? detailAvoir.status}
                            </Tag>
                        </p>
                        <p><strong>Date d'émission :</strong> {formatDate(detailAvoir.dateEmission)}</p>
                        {detailAvoir.dateRemboursement && (
                            <p><strong>Date de remboursement :</strong> {formatDate(detailAvoir.dateRemboursement)}</p>
                        )}
                        {detailAvoir.vente && (
                            <p><strong>Facture d'origine :</strong> #{detailAvoir.vente.id}</p>
                        )}
                        <p><strong>Motif :</strong> {detailAvoir.motif ?? '-'}</p>
                        {detailAvoir.modeRemboursement && (
                            <p><strong>Mode de remboursement :</strong>{' '}
                                {MODE_LABELS[detailAvoir.modeRemboursement] ?? detailAvoir.modeRemboursement}
                            </p>
                        )}

                        <Divider />

                        <Table
                            dataSource={detailAvoir.lignes ?? []}
                            columns={detailColumns}
                            rowKey={(_, i) => String(i)}
                            pagination={false}
                            size="small"
                            bordered
                            style={{ marginBottom: 16 }}
                        />

                        <p><strong>Montant HT :</strong> {formatEuro(detailAvoir.montantHT)}</p>
                        <p><strong>TVA :</strong> {formatEuro(detailAvoir.montantTVA)}</p>
                        <p style={{ fontSize: 16 }}><strong>Total TTC : {formatEuro(detailAvoir.montantTTC)}</strong></p>
                    </div>
                )}
            </Modal>
        </Card>
    );
}
