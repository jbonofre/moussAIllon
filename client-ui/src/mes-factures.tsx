import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Divider, Modal, Space, Table, Tag, Spin, message } from 'antd';
import { CheckCircleOutlined, CreditCardOutlined, EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import api from './api.ts';

interface ForfaitRef { id: number; nom: string; reference?: string; prixTTC?: number }
interface ProduitRef { id: number; nom: string; marque?: string; prixVenteTTC?: number }
interface ServiceRef { id: number; nom: string; prixTTC?: number }

interface VenteForfaitEntry {
    id?: number;
    forfait?: ForfaitRef;
    quantite?: number;
}

interface VenteServiceEntry {
    id?: number;
    service?: ServiceRef;
    quantite?: number;
}

interface VenteEntity {
    id: number;
    status: string;
    bonPourAccord?: boolean;
    ordreDeReparation?: boolean;
    comptoir?: boolean;
    date?: string;
    montantHT?: number;
    montantTTC?: number;
    montantTVA?: number;
    remise?: number;
    prixVenteTTC?: number;
    modePaiement?: string;
    venteForfaits?: VenteForfaitEntry[];
    venteServices?: VenteServiceEntry[];
    produits?: ProduitRef[];
    forfaits?: ForfaitRef[];
    services?: ServiceRef[];
}

interface MesFacturesProps {
    clientId: number;
}

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR') + ' ' + parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} EUR`;

const escapeHtml = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const statusColor: Record<string, string> = {
    DEVIS: 'default',
    FACTURE_EN_ATTENTE: 'orange',
    FACTURE_PRETE: 'blue',
    FACTURE_PAYEE: 'green',
};

const statusLabel: Record<string, string> = {
    DEVIS: 'Devis',
    FACTURE_EN_ATTENTE: 'Facture en attente',
    FACTURE_PRETE: 'Facture complète',
    FACTURE_PAYEE: 'Facture payée',
};

type DocType = 'devis' | 'ordre_reparation' | 'facture';

const getDocType = (vente: VenteEntity): DocType => {
    if (vente.status === 'DEVIS') {
        return vente.ordreDeReparation ? 'ordre_reparation' : 'devis';
    }
    return 'facture';
};

const getDocTitle = (docType: DocType) => {
    switch (docType) {
        case 'devis': return 'Devis';
        case 'ordre_reparation': return 'Ordre de Réparation';
        case 'facture': return 'Facture';
    }
};

interface DocLine {
    key: string;
    type: string;
    designation: string;
    quantite: number;
    prixUnitaire: number;
    totalTTC: number;
}

const buildLines = (vente: VenteEntity): DocLine[] => {
    const lines: DocLine[] = [];

    // venteForfaits (prestation-style)
    (vente.venteForfaits || []).forEach((vf) => {
        if (!vf.forfait) return;
        const pu = vf.forfait.prixTTC || 0;
        const qty = vf.quantite || 1;
        lines.push({ key: `vf-${vf.id}`, type: 'Forfait', designation: vf.forfait.nom, quantite: qty, prixUnitaire: pu, totalTTC: pu * qty });
    });

    // venteServices (prestation-style)
    (vente.venteServices || []).forEach((vs) => {
        if (!vs.service) return;
        const pu = vs.service.prixTTC || 0;
        const qty = vs.quantite || 1;
        lines.push({ key: `vs-${vs.id}`, type: 'Service', designation: vs.service.nom, quantite: qty, prixUnitaire: pu, totalTTC: pu * qty });
    });

    // flat forfaits (comptoir-style)
    (vente.forfaits || []).forEach((f, i) => {
        lines.push({ key: `f-${f.id}-${i}`, type: 'Forfait', designation: f.reference ? `${f.reference} - ${f.nom}` : f.nom, quantite: 1, prixUnitaire: f.prixTTC || 0, totalTTC: f.prixTTC || 0 });
    });

    // flat services (comptoir-style)
    (vente.services || []).forEach((s, i) => {
        lines.push({ key: `s-${s.id}-${i}`, type: 'Service', designation: s.nom, quantite: 1, prixUnitaire: s.prixTTC || 0, totalTTC: s.prixTTC || 0 });
    });

    // produits (grouped by id)
    const produitMap = new Map<number, { produit: ProduitRef; quantite: number }>();
    (vente.produits || []).forEach((p) => {
        const existing = produitMap.get(p.id);
        if (existing) { existing.quantite += 1; } else { produitMap.set(p.id, { produit: p, quantite: 1 }); }
    });
    produitMap.forEach(({ produit, quantite }, id) => {
        const pu = produit.prixVenteTTC || 0;
        lines.push({ key: `p-${id}`, type: 'Produit', designation: produit.marque ? `${produit.nom} (${produit.marque})` : produit.nom, quantite, prixUnitaire: pu, totalTTC: pu * quantite });
    });

    return lines;
};

export default function MesFactures({ clientId }: MesFacturesProps) {
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [detailVente, setDetailVente] = useState<VenteEntity | null>(null);
    const [bpaModalVente, setBpaModalVente] = useState<VenteEntity | null>(null);
    const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signatureDrawingRef = useRef(false);

    const fetchVentes = useCallback(() => {
        setLoading(true);
        api.get(`/portal/clients/${clientId}/ventes`)
            .then((res) => setVentes(res.data || []))
            .catch(() => message.error('Erreur lors du chargement des factures'))
            .finally(() => setLoading(false));
    }, [clientId]);

    useEffect(() => { fetchVentes(); }, [fetchVentes]);

    const initSignatureCanvas = useCallback(() => {
        setTimeout(() => {
            const canvas = signatureCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            let drawing = false;
            const getPos = (e: MouseEvent | TouchEvent) => {
                const rect = canvas.getBoundingClientRect();
                if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
                return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
            };
            const onStart = (e: MouseEvent | TouchEvent) => { e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); signatureDrawingRef.current = true; };
            const onMove = (e: MouseEvent | TouchEvent) => { if (!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
            const onEnd = () => { drawing = false; };

            canvas.addEventListener('mousedown', onStart);
            canvas.addEventListener('mousemove', onMove);
            canvas.addEventListener('mouseup', onEnd);
            canvas.addEventListener('mouseleave', onEnd);
            canvas.addEventListener('touchstart', onStart, { passive: false });
            canvas.addEventListener('touchmove', onMove, { passive: false });
            canvas.addEventListener('touchend', onEnd);
        }, 100);
    }, []);

    const openBpaModal = (vente: VenteEntity) => {
        signatureDrawingRef.current = false;
        setBpaModalVente(vente);
        initSignatureCanvas();
    };

    const clearSignatureCanvas = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        signatureDrawingRef.current = false;
    };

    const handleBpaConfirm = async () => {
        if (!signatureDrawingRef.current) {
            message.warning('La signature est requise pour valider le bon pour accord');
            return;
        }
        if (!bpaModalVente) return;
        const canvas = signatureCanvasRef.current;
        const signatureData = canvas ? canvas.toDataURL('image/png') : undefined;
        try {
            await api.put(`/portal/ventes/${bpaModalVente.id}/bon-pour-accord`, { signature: signatureData });
            message.success('Bon pour accord signé avec succès');
            setBpaModalVente(null);
            setDetailVente(null);
            fetchVentes();
        } catch {
            message.error('Erreur lors de la signature du bon pour accord');
        }
    };

    const handlePayment = async (vente: VenteEntity, provider: 'stripe' | 'payplug') => {
        try {
            const res = await api.post(`/ventes/${vente.id}/payment-link/${provider}`);
            window.open(res.data.url, '_blank', 'noopener,noreferrer');
        } catch {
            message.error('Erreur lors de la creation du lien de paiement');
        }
    };

    const handlePrint = (vente: VenteEntity) => {
        const docType = getDocType(vente);
        const showPrices = docType !== 'ordre_reparation';
        const title = `${getDocTitle(docType)} #${vente.id}`;
        const lines = buildLines(vente);

        const priceHeaders = showPrices ? '<th style="text-align:right;">P.U. TTC</th><th style="text-align:right;">Total TTC</th>' : '';
        const tableRows = lines.map((line) => {
            const priceCells = showPrices
                ? `<td style="text-align:right;">${escapeHtml(formatEuro(line.prixUnitaire))}</td><td style="text-align:right;">${escapeHtml(formatEuro(line.totalTTC))}</td>`
                : '';
            return `<tr><td>${escapeHtml(line.type)}</td><td>${escapeHtml(line.designation)}</td><td style="text-align:center;">${line.quantite}</td>${priceCells}</tr>`;
        }).join('');

        const totalsHtml = showPrices ? `
            <div style="margin-top:16px;">
                <p><strong>Montant HT :</strong> ${escapeHtml(formatEuro(vente.montantHT))}</p>
                <p><strong>TVA :</strong> ${escapeHtml(formatEuro(vente.montantTVA))}</p>
                <p><strong>Montant TTC :</strong> ${escapeHtml(formatEuro(vente.montantTTC))}</p>
                ${(vente.remise || 0) > 0 ? `<p><strong>Remise :</strong> ${escapeHtml(formatEuro(vente.remise))}</p>` : ''}
                <p style="font-size:16px;"><strong>Total à payer : ${escapeHtml(formatEuro(vente.prixVenteTTC))}</strong></p>
            </div>` : '';

        const paymentHtml = docType === 'facture' && vente.modePaiement
            ? `<p><strong>Mode de paiement :</strong> ${escapeHtml(vente.modePaiement)}</p>` : '';

        const signatureHtml = docType === 'devis' && vente.signatureBonPourAccord
            ? `<div style="margin-top:24px;"><p><strong>Bon pour accord &mdash; Signature client :</strong></p><img src="${vente.signatureBonPourAccord}" style="max-width:300px;border:1px solid #d9d9d9;border-radius:4px;" /></div>`
            : '';

        const colSpan = showPrices ? 5 : 3;
        const html = `<html><head><title>${escapeHtml(title)}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 24px; color: #1f1f1f; }
                h1 { margin-bottom: 8px; }
                .meta { margin-bottom: 16px; color: #595959; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { border: 1px solid #d9d9d9; padding: 6px 8px; }
                th { background: #fafafa; text-align: left; }
            </style></head><body>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">Date : ${escapeHtml(formatDate(vente.date))}</div>
            ${paymentHtml}
            <table>
                <thead><tr><th>Type</th><th>Désignation</th><th style="text-align:center;">Qté</th>${priceHeaders}</tr></thead>
                <tbody>${tableRows || `<tr><td colspan="${colSpan}">Aucun élément</td></tr>`}</tbody>
            </table>
            ${totalsHtml}
            ${signatureHtml}
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
            render: (val: number) => `#${val}`,
        },
        {
            title: 'Date',
            dataIndex: 'date',
            render: (val: string) => formatDate(val),
        },
        {
            title: 'Document',
            key: 'docType',
            render: (_: unknown, record: VenteEntity) => {
                const docType = getDocType(record);
                const color = docType === 'devis' ? 'blue' : docType === 'ordre_reparation' ? 'cyan' : 'default';
                return <Tag color={color}>{getDocTitle(docType)}</Tag>;
            },
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            render: (val: string, record: VenteEntity) => {
                const label = val === 'DEVIS' && record.bonPourAccord ? 'Bon pour accord' : statusLabel[val] || val;
                const color = val === 'DEVIS' && record.bonPourAccord ? 'cyan' : statusColor[val] || 'default';
                return <Tag color={color}>{label}</Tag>;
            },
        },
        {
            title: 'Total TTC',
            dataIndex: 'prixVenteTTC',
            render: (val: number, record: VenteEntity) => {
                if (record.status === 'DEVIS' && record.ordreDeReparation) return '-';
                return formatEuro(val);
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: VenteEntity) => (
                <Space size="small">
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailVente(record)}>
                        Détail
                    </Button>
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>
                        Imprimer
                    </Button>
                    {record.status === 'DEVIS' && !record.bonPourAccord && (
                        <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openBpaModal(record)}>
                            Signer
                        </Button>
                    )}
                    {record.status === 'FACTURE_PRETE' && (
                        <>
                            <Button size="small" icon={<CreditCardOutlined />} onClick={() => handlePayment(record, 'stripe')}>
                                Stripe
                            </Button>
                            <Button size="small" icon={<CreditCardOutlined />} onClick={() => handlePayment(record, 'payplug')}>
                                PayPlug
                            </Button>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    const detailDocType = detailVente ? getDocType(detailVente) : 'facture';
    const detailShowPrices = detailDocType !== 'ordre_reparation';
    const detailLines = detailVente ? buildLines(detailVente) : [];

    const detailColumns = [
        { title: 'Type', dataIndex: 'type', width: 100 },
        { title: 'Désignation', dataIndex: 'designation' },
        { title: 'Qté', dataIndex: 'quantite', width: 60, align: 'center' as const },
        ...(detailShowPrices ? [
            { title: 'P.U. TTC', dataIndex: 'prixUnitaire', width: 110, align: 'right' as const, render: (v: number) => formatEuro(v) },
            { title: 'Total TTC', dataIndex: 'totalTTC', width: 110, align: 'right' as const, render: (v: number) => formatEuro(v) },
        ] : []),
    ];

    return (
        <Card title="Mes ventes & prestations">
            <Spin spinning={loading}>
                <Table
                    rowKey="id"
                    dataSource={ventes}
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                    bordered
                />
            </Spin>

            <Modal
                title={detailVente ? `${getDocTitle(detailDocType)} #${detailVente.id}` : ''}
                open={!!detailVente}
                onCancel={() => setDetailVente(null)}
                width={750}
                footer={detailVente ? [
                    <Button key="print" icon={<PrinterOutlined />} onClick={() => handlePrint(detailVente)}>
                        Imprimer
                    </Button>,
                    ...(detailVente.status === 'DEVIS' && !detailVente.bonPourAccord ? [
                        <Button key="sign" type="primary" icon={<CheckCircleOutlined />} onClick={() => openBpaModal(detailVente)}>
                            Signer le bon pour accord
                        </Button>,
                    ] : []),
                    ...(detailVente.status === 'FACTURE_PRETE' ? [
                        <Button key="stripe" icon={<CreditCardOutlined />} onClick={() => handlePayment(detailVente, 'stripe')}>
                            Payer via Stripe
                        </Button>,
                        <Button key="payplug" icon={<CreditCardOutlined />} onClick={() => handlePayment(detailVente, 'payplug')}>
                            Payer via PayPlug
                        </Button>,
                    ] : []),
                    <Button key="close" onClick={() => setDetailVente(null)}>Fermer</Button>,
                ] : null}
            >
                {detailVente && (
                    <div>
                        <p><strong>Date :</strong> {formatDate(detailVente.date)}</p>
                        <p><strong>Statut :</strong> <Tag color={detailVente.status === 'DEVIS' && detailVente.bonPourAccord ? 'cyan' : statusColor[detailVente.status]}>
                            {detailVente.status === 'DEVIS' && detailVente.bonPourAccord ? 'Bon pour accord' : statusLabel[detailVente.status] || detailVente.status}
                        </Tag></p>
                        {detailDocType === 'facture' && detailVente.modePaiement && (
                            <p><strong>Mode de paiement :</strong> {detailVente.modePaiement}</p>
                        )}

                        <Divider />

                        <Table
                            dataSource={detailLines}
                            columns={detailColumns}
                            pagination={false}
                            size="small"
                            bordered
                            style={{ marginBottom: 16 }}
                        />

                        {detailShowPrices && (
                            <>
                                <p><strong>Montant HT :</strong> {formatEuro(detailVente.montantHT)}</p>
                                <p><strong>TVA :</strong> {formatEuro(detailVente.montantTVA)}</p>
                                <p><strong>Montant TTC :</strong> {formatEuro(detailVente.montantTTC)}</p>
                                {(detailVente.remise || 0) > 0 && (
                                    <p><strong>Remise :</strong> {formatEuro(detailVente.remise)}</p>
                                )}
                                <p style={{ fontSize: 16 }}><strong>Total à payer : {formatEuro(detailVente.prixVenteTTC)}</strong></p>
                            </>
                        )}
                    </div>
                )}
            </Modal>

            <Modal
                title="Bon pour accord — Signature"
                open={!!bpaModalVente}
                onCancel={() => setBpaModalVente(null)}
                width={700}
                maskClosable={false}
                destroyOnHidden
                footer={[
                    <Button key="clear" onClick={clearSignatureCanvas}>
                        Effacer la signature
                    </Button>,
                    <Button key="cancel" onClick={() => setBpaModalVente(null)}>
                        Fermer
                    </Button>,
                    <Button key="confirm" type="primary" onClick={handleBpaConfirm}>
                        Valider le bon pour accord
                    </Button>,
                ]}
            >
                {bpaModalVente && (
                    <>
                        <Table
                            size="small"
                            pagination={false}
                            dataSource={buildLines(bpaModalVente)}
                            rowKey="key"
                            columns={[
                                { title: 'Type', dataIndex: 'type', width: 100 },
                                { title: 'Désignation', dataIndex: 'designation' },
                                { title: 'Qté', dataIndex: 'quantite', width: 60, align: 'center' as const },
                                ...(getDocType(bpaModalVente) !== 'ordre_reparation' ? [
                                    { title: 'P.U. TTC', dataIndex: 'prixUnitaire', width: 110, align: 'right' as const, render: (v: number) => formatEuro(v) },
                                    { title: 'Total TTC', dataIndex: 'totalTTC', width: 110, align: 'right' as const, render: (v: number) => formatEuro(v) },
                                ] : []),
                            ]}
                            summary={getDocType(bpaModalVente) !== 'ordre_reparation' ? (data) => {
                                const total = data.reduce((sum, row) => sum + row.totalTTC, 0);
                                const remise = bpaModalVente.remise || 0;
                                const prixVente = Math.round(((total - remise) + Number.EPSILON) * 100) / 100;
                                return (
                                    <>
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={4} align="right"><strong>Total TTC</strong></Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right"><strong>{formatEuro(total)}</strong></Table.Summary.Cell>
                                        </Table.Summary.Row>
                                        {remise > 0 && (
                                            <Table.Summary.Row>
                                                <Table.Summary.Cell index={0} colSpan={4} align="right">Remise</Table.Summary.Cell>
                                                <Table.Summary.Cell index={1} align="right">-{formatEuro(remise)}</Table.Summary.Cell>
                                            </Table.Summary.Row>
                                        )}
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={4} align="right"><strong>Prix vente TTC</strong></Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right"><strong>{formatEuro(prixVente)}</strong></Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    </>
                                );
                            } : undefined}
                            style={{ marginBottom: 16 }}
                        />
                        <Divider />
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>Signature :</div>
                        <canvas
                            ref={signatureCanvasRef}
                            style={{
                                width: '100%',
                                height: 200,
                                border: '1px solid #d9d9d9',
                                borderRadius: 6,
                                cursor: 'crosshair',
                                touchAction: 'none',
                            }}
                        />
                    </>
                )}
            </Modal>
        </Card>
    );
}
