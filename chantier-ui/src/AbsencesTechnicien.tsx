import React, { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Input, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from './api.ts';
import { TYPES_ABSENCE, libelleTypeAbsence } from './capacite-technicien.ts';

interface Absence {
    id: number;
    dateDebut: string;
    dateFin: string;
    type?: string;
    motif?: string;
}

const couleurType: Record<string, string> = { CONGES: 'blue', MALADIE: 'red', FORMATION: 'purple' };

/**
 * Absences d'un technicien (congés, maladie, formation...) : ses jours travaillés pendant une absence sont déduits
 * de ses heures disponibles (KPIs atelier). Chaque ajout ou suppression est enregistré aussitôt.
 */
const AbsencesTechnicien: React.FC<{ technicienId: number }> = ({ technicienId }) => {
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [loading, setLoading] = useState(false);
    const [periode, setPeriode] = useState<[Dayjs | null, Dayjs | null] | null>(null);
    const [type, setType] = useState('CONGES');
    const [motif, setMotif] = useState('');

    const charger = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/techniciens/${technicienId}/absences`);
            setAbsences(res.data);
        } catch {
            message.error('Erreur lors du chargement des absences.');
        }
        setLoading(false);
    }, [technicienId]);

    useEffect(() => { charger(); }, [charger]);

    const ajouter = async () => {
        if (!periode?.[0] || !periode?.[1]) {
            message.warning("Choisissez les dates de début et de fin de l'absence.");
            return;
        }
        try {
            await api.post(`/techniciens/${technicienId}/absences`, {
                dateDebut: periode[0].format('YYYY-MM-DD'),
                dateFin: periode[1].format('YYYY-MM-DD'),
                type,
                motif: motif.trim() || undefined,
            });
            setPeriode(null);
            setMotif('');
            charger();
        } catch {
            message.error("Erreur lors de l'ajout de l'absence.");
        }
    };

    const supprimer = async (id: number) => {
        try {
            await api.delete(`/techniciens/${technicienId}/absences/${id}`);
            charger();
        } catch {
            message.error("Erreur lors de la suppression de l'absence.");
        }
    };

    const colonnes = [
        { title: 'Du', dataIndex: 'dateDebut', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
        { title: 'Au', dataIndex: 'dateFin', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
        { title: 'Type', dataIndex: 'type', render: (v?: string) => <Tag color={couleurType[v || '']}>{libelleTypeAbsence(v)}</Tag> },
        { title: 'Motif', dataIndex: 'motif', render: (v?: string) => v || '—' },
        {
            title: '', key: 'actions', width: 50,
            render: (_: unknown, a: Absence) => (
                <Popconfirm title="Supprimer cette absence ?" onConfirm={() => supprimer(a.id)} okText="Oui" cancelText="Non">
                    <Button danger size="small" icon={<DeleteOutlined />} title="Supprimer l'absence" />
                </Popconfirm>
            ),
        },
    ];

    return (
        <Space orientation="vertical" style={{ width: '100%' }}>
            <Space wrap>
                <DatePicker.RangePicker
                    format="DD/MM/YYYY"
                    value={periode}
                    onChange={(v) => setPeriode(v)}
                    placeholder={['Premier jour', 'Dernier jour']}
                />
                <Select value={type} onChange={setType} options={TYPES_ABSENCE} style={{ width: 120 }} aria-label="Type d'absence" />
                <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (facultatif)" style={{ width: 180 }} />
                <Button icon={<PlusOutlined />} onClick={ajouter}>Ajouter</Button>
            </Space>
            <Table<Absence>
                rowKey="id"
                size="small"
                columns={colonnes}
                dataSource={absences}
                loading={loading}
                pagination={false}
                locale={{ emptyText: 'Aucune absence' }}
            />
            <Typography.Text type="secondary">
                Les jours travaillés compris dans une absence (jours fériés exclus) sont déduits des heures disponibles.
            </Typography.Text>
        </Space>
    );
};

export default AbsencesTechnicien;
