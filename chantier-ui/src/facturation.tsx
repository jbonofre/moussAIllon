import { fetchWithAuth } from './api.ts';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Descriptions, Divider, Select, Space, Spin, Table, Tag, Tooltip, message } from 'antd';
import { CreditCardOutlined, DownloadOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';

const formatDate = (value: any) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');

const formatMontant = (value: any) => (value != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
    : '—');

type PaiementType = 'MENSUEL' | 'ANNUEL';
type PaiementMode = 'VIREMENT' | 'CARTE' | 'STRIPE' | 'PAYPLUG';

const MODE_LABEL: Record<string, string> = {
    VIREMENT: 'Virement bancaire',
    CARTE: 'Carte bancaire',
    STRIPE: 'Stripe',
    PAYPLUG: 'PayPlug',
};

const TYPE_LABEL: Record<string, string> = { MENSUEL: 'Mensuel', ANNUEL: 'Annuel' };
const TYPE_COLOR: Record<string, string> = { MENSUEL: 'blue', ANNUEL: 'gold' };

function downloadFacturePdf(paiement: any, societe: any) {
    const dateDebut = dayjs(paiement.date).format('DD/MM/YYYY');
    const dateFin = (paiement.type === 'ANNUEL'
        ? dayjs(paiement.date).add(12, 'month')
        : dayjs(paiement.date).add(1, 'month')
    ).format('DD/MM/YYYY');
    const nomSociete = societe?.nom ?? 'moussAIllon';
    const montantStr = formatMontant(paiement.montant);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const L = 20;   // left margin
    const R = pageW - 20; // right edge
    const lineH = 7;
    let y = 24;

    const sep = () => {
        doc.setDrawColor(210);
        doc.line(L, y, R, y);
        y += 8;
    };

    const row = (label: string, value: string, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(10);
        doc.text(label, L, y);
        doc.text(value, R, y, { align: 'right' });
        y += lineH;
    };

    // ── Titre ──────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text("Facture d'abonnement", L, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(nomSociete, L, y);
    doc.text(`N° ${paiement.id}`, R, y, { align: 'right' });
    y += 6;
    doc.text(`Émise le ${dayjs().format('DD/MM/YYYY')}`, R, y, { align: 'right' });
    doc.setTextColor(0);
    y += 12;

    sep();

    // ── Détail ─────────────────────────────────────────────
    row('Désignation', `Abonnement moussAIllon — ${TYPE_LABEL[paiement.type] ?? paiement.type}`);
    y += 2;
    row('Période couverte', \`\${dateDebut} au \${dateFin}\`);
    y += 2;
    row('Mode de paiement', MODE_LABEL[paiement.mode] ?? paiement.mode);
    y += 2;
    row('Date de paiement', formatDate(paiement.date));
    y += 6;

    sep();

    // ── Total ──────────────────────────────────────────────
    doc.setFillColor(245, 245, 245);
    doc.rect(L, y - 4, R - L, lineH + 4, 'F');
    row('Total TTC', montantStr, true);
    y += 4;

    sep();

    // ── Pied de page ───────────────────────────────────────
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Document généré automatiquement par moussAIllon le ${dayjs().format('DD/MM/YYYY')}`, L, y);

    doc.save(`facture-abonnement-${paiement.id}.pdf`);
}

export default function Facturation() {

    const [societe, setSociete] = useState<any>(null);
    const [paiementType, setPaiementType] = useState<PaiementType | null>(null);
    const [paiementMode, setPaiementMode] = useState<PaiementMode>('VIREMENT');
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signatureDrawingRef = useRef(false);

    const fetchSociete = useCallback(() => {
        fetchWithAuth('./societe')
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then(setSociete)
            .catch((e) => message.error('Erreur : ' + e.message));
    }, []);

    useEffect(() => { fetchSociete(); }, [fetchSociete]);

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

    const clearSignatureCanvas = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        signatureDrawingRef.current = false;
    };

    const isExternalMode = (mode: PaiementMode) => mode === 'STRIPE' || mode === 'PAYPLUG';

    const getPaymentLink = (type: PaiementType, mode: PaiementMode): string | undefined => {
        if (!societe) return undefined;
        if (mode === 'STRIPE') return type === 'ANNUEL' ? societe.stripePaymentLinkAnnuel : societe.stripePaymentLinkMensuel;
        if (mode === 'PAYPLUG') return type === 'ANNUEL' ? societe.payplugPaymentLinkAnnuel : societe.payplugPaymentLinkMensuel;
        return undefined;
    };

    const openPaiementModal = (type: PaiementType) => {
        setPaiementType(type);
        setPaiementMode('VIREMENT');
        signatureDrawingRef.current = false;
        setSignatureModalOpen(true);
        initSignatureCanvas();
    };

    const handleModeChange = (mode: PaiementMode) => {
        setPaiementMode(mode);
        if (!isExternalMode(mode)) {
            // Re-init canvas when switching back to a manual mode
            signatureDrawingRef.current = false;
            initSignatureCanvas();
        }
    };

    const handlePaiementConfirm = () => {
        if (!isExternalMode(paiementMode) && !signatureDrawingRef.current) {
            message.warning('La signature est requise pour valider le paiement');
            return;
        }
        const canvas = signatureCanvasRef.current;
        const signature = (!isExternalMode(paiementMode) && canvas)
            ? canvas.toDataURL('image/png')
            : 'external-payment';

        setSubmitting(true);
        fetchWithAuth('./societe/paiement', {
            method: 'POST',
            body: JSON.stringify({ type: paiementType, mode: paiementMode, signature }),
        })
            .then((r) => { if (!r.ok) throw new Error('Erreur ' + r.status); return r.json(); })
            .then((data) => {
                setSociete(data);
                setSignatureModalOpen(false);
                message.success('Paiement enregistré avec succès');
            })
            .catch((e) => message.error('Erreur : ' + e.message))
            .finally(() => setSubmitting(false));
    };

    const getModeOptions = (type: PaiementType): { value: string; label: string; disabled?: boolean }[] => [
        { value: 'VIREMENT', label: 'Virement bancaire' },
        { value: 'CARTE', label: 'Carte bancaire' },
        {
            value: 'STRIPE',
            label: 'Stripe',
            disabled: !getPaymentLink(type, 'STRIPE'),
        },
        {
            value: 'PAYPLUG',
            label: 'PayPlug',
            disabled: !getPaymentLink(type, 'PAYPLUG'),
        },
    ];

    const montantPaiement = paiementType === 'ANNUEL' ? 1650 : 150;
    const labelPaiement = paiementType === 'ANNUEL'
        ? 'Paiement annuel — 1 650 EUR (1 mois offert)'
        : 'Paiement mensuel — 150 EUR';

    const externalLink = paiementType ? getPaymentLink(paiementType, paiementMode) : undefined;

    const historiqueColumns = [
        {
            title: 'Date',
            dataIndex: 'date',
            width: 120,
            render: (v: string) => formatDate(v),
        },
        {
            title: 'Type',
            dataIndex: 'type',
            width: 100,
            render: (v: string) => <Tag color={TYPE_COLOR[v] ?? 'default'}>{TYPE_LABEL[v] ?? v}</Tag>,
        },
        {
            title: 'Mode',
            dataIndex: 'mode',
            width: 160,
            render: (v: string) => MODE_LABEL[v] ?? v,
        },
        {
            title: 'Montant',
            dataIndex: 'montant',
            align: 'right' as const,
            render: (v: number) => formatMontant(v),
        },
        {
            title: '',
            key: 'actions',
            width: 60,
            render: (_: unknown, record: any) => (
                <Tooltip title="Télécharger la facture">
                    <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => downloadFacturePdf(record, societe)}
                    />
                </Tooltip>
            ),
        },
    ];

    if (!societe) return <Spin />;

    return (
        <>
            <Card title={<Space><CreditCardOutlined /> Facturation</Space>}>
                <Descriptions title="Abonnement" column={1} bordered size="small">
                    <Descriptions.Item label="Date d'activation">
                        {formatDate(societe.abonnementActivationDate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Montant d'activation">
                        {formatMontant(societe.abonnementActivationMontant)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Prochaine échéance">
                        {formatDate(societe.abonnementProchainPaiementDate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Montant à payer">
                        {formatMontant(societe.abonnementProchainPaiementMontant)}
                    </Descriptions.Item>
                </Descriptions>

                <Space style={{ marginTop: 24 }}>
                    <Button type="primary" icon={<CreditCardOutlined />} onClick={() => openPaiementModal('MENSUEL')}>
                        Payer ce mois — 150 EUR
                    </Button>
                    <Button icon={<CreditCardOutlined />} onClick={() => openPaiementModal('ANNUEL')}>
                        Payer l'année — 1 650 EUR (1 mois offert)
                    </Button>
                </Space>

                <Divider>Historique des paiements</Divider>

                <Table
                    rowKey="id"
                    dataSource={societe.paiements ?? []}
                    columns={historiqueColumns}
                    pagination={false}
                    bordered
                    size="small"
                    locale={{ emptyText: 'Aucun paiement enregistré' }}
                />
            </Card>

            {signatureModalOpen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }}>
                    <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 540, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginTop: 0 }}>{labelPaiement}</h3>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                                Mode de paiement
                            </label>
                            <Select
                                value={paiementMode}
                                onChange={handleModeChange}
                                options={getModeOptions(paiementType!)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        {isExternalMode(paiementMode) ? (
                            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: 16, marginBottom: 16 }}>
                                <p style={{ margin: '0 0 12px' }}>
                                    Cliquez sur le bouton ci-dessous pour accéder à la page de paiement {MODE_LABEL[paiementMode]}.
                                    Une fois le paiement effectué, revenez ici et cliquez sur <strong>Confirmer</strong>.
                                </p>
                                {externalLink ? (
                                    <Button
                                        type="default"
                                        icon={<LinkOutlined />}
                                        href={externalLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Payer via {MODE_LABEL[paiementMode]} — {formatMontant(montantPaiement)}
                                    </Button>
                                ) : (
                                    <span style={{ color: '#ff4d4f' }}>
                                        Lien de paiement {MODE_LABEL[paiementMode]} non configuré.
                                    </span>
                                )}
                            </div>
                        ) : (
                            <>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                                    Signature
                                </label>
                                <canvas
                                    ref={signatureCanvasRef}
                                    style={{
                                        width: '100%', height: 160,
                                        border: '1px solid #d9d9d9', borderRadius: 4,
                                        display: 'block', cursor: 'crosshair', touchAction: 'none',
                                    }}
                                />
                            </>
                        )}

                        <Space style={{ marginTop: 16, justifyContent: 'flex-end', width: '100%' }}>
                            {!isExternalMode(paiementMode) && (
                                <Button onClick={clearSignatureCanvas}>Effacer la signature</Button>
                            )}
                            <Button onClick={() => setSignatureModalOpen(false)}>Annuler</Button>
                            <Button
                                type="primary"
                                loading={submitting}
                                onClick={handlePaiementConfirm}
                                disabled={isExternalMode(paiementMode) && !externalLink}
                            >
                                Confirmer — {formatMontant(montantPaiement)}
                            </Button>
                        </Space>
                    </div>
                </div>
            )}
        </>
    );
}
