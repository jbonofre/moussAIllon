import React, { useEffect, useState } from 'react';
import { Button, Form, Select, Space, message } from 'antd';
import { PlusCircleOutlined } from '@ant-design/icons';
import api from './api.ts';
import ForfaitFormModal from './ForfaitFormModal.tsx';

interface ForfaitsAssociesProps {
    bateauId?: number;
    moteurId?: number;
}

// Gestion des forfaits directement depuis un bateau ou un moteur client.
export default function ForfaitsAssocies({ bateauId, moteurId }: ForfaitsAssociesProps) {
    const field = bateauId ? 'bateauxClientsAssocies' : 'moteursClientsAssocies';
    const targetId = bateauId ?? moteurId;

    const [forfaits, setForfaits] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const load = async () => {
        try {
            const res = await api.get('/forfaits');
            setForfaits(res.data || []);
        } catch {
            message.error('Erreur lors du chargement des forfaits.');
        }
    };

    useEffect(() => {
        load();
    }, [targetId]);

    const selectedIds = forfaits
        .filter((f) => (f[field] || []).some((item: any) => item.id === targetId))
        .map((f) => f.id);

    const handleChange = async (ids: number[]) => {
        const added = ids.filter((id) => !selectedIds.includes(id));
        const removed = selectedIds.filter((id) => !ids.includes(id));
        setSaving(true);
        try {
            for (const id of [...added, ...removed]) {
                const forfait = forfaits.find((f) => f.id === id);
                if (!forfait) continue;
                const others = (forfait[field] || []).filter((item: any) => item.id !== targetId);
                await api.put(`/forfaits/${id}`, {
                    ...forfait,
                    [field]: added.includes(id) ? [...others, { id: targetId }] : others,
                });
            }
            await load();
        } catch {
            message.error("Erreur lors de l'association des forfaits.");
        } finally {
            setSaving(false);
        }
    };

    const handleCreated = async (forfait: any) => {
        setModalVisible(false);
        await load();
        message.success(`Forfait "${forfait?.nom}" créé et associé`);
    };

    return (
        <>
            <Form.Item label="Forfaits associés">
                <Space.Compact style={{ width: '100%' }}>
                    <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        placeholder="Associer des forfaits"
                        allowClear
                        showSearch
                        loading={saving}
                        disabled={saving}
                        value={selectedIds}
                        onChange={handleChange}
                        optionFilterProp="label"
                        options={forfaits.map((f) => ({
                            value: f.id,
                            label: `${f.reference ? `${f.reference} - ` : ''}${f.nom}`,
                        }))}
                    />
                    <Button icon={<PlusCircleOutlined />} onClick={() => setModalVisible(true)} />
                </Space.Compact>
            </Form.Item>
            <ForfaitFormModal
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onCreated={handleCreated}
                preAssociatedBateauClientId={bateauId}
                preAssociatedMoteurClientId={moteurId}
            />
        </>
    );
}
