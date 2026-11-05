import React, { useEffect, useState } from 'react';
import { DatePicker, Form, Input, Modal, Radio, Space, message } from 'antd';
import dayjs from 'dayjs';
import { fetchWithAuth } from './api.ts';

interface Props {
    open: boolean;
    venteId?: number;
    // Numéro de la facture ou du devis, pour les libellés
    numero?: string;
    // Client de la vente : proposé pour suspendre toutes ses relances (accord particulier)
    client?: { id: number; nom: string };
    onClose: () => void;
    onSuspendu: () => void;
}

/**
 * Suspension des relances d'une vente, jusqu'à une date incluse ou jusqu'à leur reprise, ou de toutes les relances du
 * client.
 */
export default function SuspensionRelancesModal({ open, venteId, numero, client, onClose, onSuspendu }: Props) {
    const [portee, setPortee] = useState<'vente' | 'client'>('vente');
    const [jusquau, setJusquau] = useState<dayjs.Dayjs | null>(null);
    const [motif, setMotif] = useState('');
    const [enCours, setEnCours] = useState(false);

    useEffect(() => {
        if (open) {
            setPortee('vente');
            setJusquau(null);
            setMotif('');
        }
    }, [open]);

    const suspendre = async () => {
        const pourClient = portee === 'client' && !!client;
        setEnCours(true);
        try {
            const r = await fetchWithAuth(
                pourClient ? `./relances/clients/${client!.id}/suspension` : `./relances/ventes/${venteId}/suspension`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pourClient ? { motif } : { motif, jusquau: jusquau ? jusquau.format('YYYY-MM-DD') : null }),
                },
            );
            if (!r.ok) throw new Error((await r.text()) || 'Erreur ' + r.status);
            message.success(pourClient ? `Relances suspendues pour ${client!.nom}` : `Relances suspendues pour ${numero}`);
            onSuspendu();
        } catch (e: any) {
            message.error('Erreur lors de la suspension des relances : ' + e.message);
        } finally {
            setEnCours(false);
        }
    };

    return (
        <Modal
            title="Suspendre les relances"
            open={open}
            onOk={suspendre}
            okText="Suspendre"
            cancelText="Annuler"
            confirmLoading={enCours}
            onCancel={onClose}
            destroyOnHidden
        >
            <Form layout="vertical">
                {client && (
                    <Form.Item label="Relances à suspendre">
                        <Radio.Group value={portee} onChange={(e) => setPortee(e.target.value)}>
                            <Space orientation="vertical">
                                <Radio value="vente">Celles de {numero}</Radio>
                                <Radio value="client">Toutes celles de {client.nom} (accord particulier)</Radio>
                            </Space>
                        </Radio.Group>
                    </Form.Item>
                )}
                {portee === 'vente' && (
                    <Form.Item label="Jusqu'au (inclus)" htmlFor="fin-suspension" extra="Laisser vide pour suspendre jusqu'à la reprise des relances.">
                        <DatePicker
                            id="fin-suspension"
                            format="DD/MM/YYYY"
                            value={jusquau}
                            onChange={setJusquau}
                            disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                        />
                    </Form.Item>
                )}
                <Form.Item label="Motif" htmlFor="motif-suspension">
                    <Input.TextArea
                        id="motif-suspension"
                        rows={3}
                        value={motif}
                        onChange={(e) => setMotif(e.target.value)}
                        placeholder="Accord de paiement en plusieurs fois, client de confiance… (facultatif)"
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
