import { fetchWithAuth } from './api.ts';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Descriptions, Modal, Space, Spin, message } from 'antd';
import { CreditCardOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '—');

const formatMontant = (value) => (value != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
    : '—');

type PaiementType = 'MENSUEL' | 'ANNUEL';

export default function Facturation() {

    const [societe, setSociete] = useState<any>(null);
    const [paiementType, setPaiementType] = useState<PaiementType | null>(null);
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signatureDrawingRef = useRef(false);

    const fetchSociete = useCallback(() => {
        fetchWithAuth('./societe')
            .then((response) => {
                if (!response.ok) throw new Error('Erreur (code ' + response.status + ')');
                return response.json();
            })
            .then(data => setSociete(data))
            .catch((error) => message.error('Une erreur est survenue: ' + error.message));
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
                if ('touches' in e) {
                    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
                }
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

    const openPaiementModal = (type: PaiementType) => {
        setPaiementType(type);
        signatureDrawingRef.current = false;
        setSignatureModalOpen(true);
        initSignatureCanvas();
    };

    const handlePaiementConfirm = () => {
        if (!signatureDrawingRef.current) {
            message.warning('La signature est requise pour valider le paiement');
            return;
        }
        const canvas = signatureCanvasRef.current;
        const signature = canvas ? canvas.toDataURL('image/png') : '';

        setSubmitting(true);
        fetchWithAuth('./societe/paiement', {
            method: 'POST',
            body: JSON.stringify({ type: paiementType, signature }),
        })
            .then((response) => {
                if (!response.ok) throw new Error('Erreur (code ' + response.status + ')');
                return response.json();
            })
            .then((data) => {
                setSociete(data);
                setSignatureModalOpen(false);
                message.success('Paiement enregistré avec succès');
            })
            .catch((error) => message.error('Une erreur est survenue: ' + error.message))
            .finally(() => setSubmitting(false));
    };

    const montantPaiement = paiementType === 'ANNUEL' ? 1650 : 150;
    const labelPaiement = paiementType === 'ANNUEL'
        ? 'Paiement annuel — 1 650 EUR (1 mois offert)'
        : 'Paiement mensuel — 150 EUR';

    if (!societe) {
        return <Spin />;
    }

    return (
        <>
            <Card title={<Space><CreditCardOutlined /> Facturation</Space>}>
                <Descriptions
                    title="Abonnement"
                    column={1}
                    bordered
                    size="small"
                >
                    <Descriptions.Item label="Date d'activation (paiement one-shot)">
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
                    <Button
                        type="primary"
                        icon={<CreditCardOutlined />}
                        onClick={() => openPaiementModal('MENSUEL')}
                    >
                        Payer ce mois — 150 EUR
                    </Button>
                    <Button
                        icon={<CreditCardOutlined />}
                        onClick={() => openPaiementModal('ANNUEL')}
                    >
                        Payer l'année — 1 650 EUR (1 mois offert)
                    </Button>
                </Space>
            </Card>

            <Modal
                title={labelPaiement}
                open={signatureModalOpen}
                onCancel={() => setSignatureModalOpen(false)}
                width={520}
                footer={[
                    <Button key="clear" onClick={clearSignatureCanvas}>
                        Effacer la signature
                    </Button>,
                    <Button key="cancel" onClick={() => setSignatureModalOpen(false)}>
                        Annuler
                    </Button>,
                    <Button key="confirm" type="primary" loading={submitting} onClick={handlePaiementConfirm}>
                        Confirmer le paiement ({formatMontant(montantPaiement)})
                    </Button>,
                ]}
            >
                <p style={{ marginBottom: 8 }}>
                    Veuillez signer ci-dessous pour confirmer votre accord de paiement.
                </p>
                <canvas
                    ref={signatureCanvasRef}
                    style={{
                        width: '100%',
                        height: 160,
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        display: 'block',
                        cursor: 'crosshair',
                        touchAction: 'none',
                    }}
                />
            </Modal>
        </>
    );
}
