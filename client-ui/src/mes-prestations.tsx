import React, { useEffect, useState } from 'react';
import { Card, Checkbox, Collapse, Empty, Modal, Progress, Spin, Steps, Table, Tag, message } from 'antd';
import {
    ClockCircleOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    SyncOutlined,
    CalendarOutlined,
    StopOutlined,
} from '@ant-design/icons';
import api from './api.ts';

interface ChecklistItem {
    id: number;
    nom: string;
    description?: string;
    done: boolean;
}

interface VenteForfaitEntity {
    id: number;
    forfait: { id: number; nom: string; prixTTC: number };
    quantite: number;
    technicien?: { id: number; prenom?: string; nom: string };
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    status: string;
    statusDate?: string;
    dureeReelle?: number;
    incidentDate?: string;
    incidentDetails?: string;
    notes?: string;
    taches?: ChecklistItem[];
}

interface VenteServiceEntity {
    id: number;
    service: { id: number; nom: string; prixTTC: number };
    quantite: number;
    technicien?: { id: number; prenom?: string; nom: string };
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    status: string;
    statusDate?: string;
    dureeReelle?: number;
    incidentDate?: string;
    incidentDetails?: string;
    notes?: string;
    taches?: ChecklistItem[];
}

type PlanningItem = (VenteForfaitEntity | VenteServiceEntity) & { _type: 'forfait' | 'service'; _nom: string };

interface VenteEntity {
    id: number;
    status: string;
    bonPourAccord?: boolean;
    date?: string;
    bateau?: { name?: string; immatriculation?: string };
    moteur?: { numeroSerie?: string; modele?: { designation?: string } };
    remorque?: { immatriculation?: string };
    venteForfaits?: VenteForfaitEntity[];
    venteServices?: VenteServiceEntity[];
}

interface MesPrestationsProps {
    clientId: number;
}

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR');
};

const taskStatusColor: Record<string, string> = {
    EN_ATTENTE: 'orange',
    PLANIFIEE: 'cyan',
    EN_COURS: 'blue',
    TERMINEE: 'green',
    INCIDENT: 'red',
    ANNULEE: 'default',
};

const taskStatusLabel: Record<string, string> = {
    EN_ATTENTE: 'En attente',
    PLANIFIEE: 'Planifiee',
    EN_COURS: 'En cours',
    TERMINEE: 'Terminee',
    INCIDENT: 'Incident',
    ANNULEE: 'Annulee',
};

const taskStatusIcon: Record<string, React.ReactNode> = {
    EN_ATTENTE: <ClockCircleOutlined />,
    PLANIFIEE: <CalendarOutlined />,
    EN_COURS: <SyncOutlined spin />,
    TERMINEE: <CheckCircleOutlined />,
    INCIDENT: <ExclamationCircleOutlined />,
    ANNULEE: <StopOutlined />,
};

const statusLabel: Record<string, string> = {
    DEVIS: 'Devis',
    FACTURE_EN_ATTENTE: 'Facture en attente',
    FACTURE_PRETE: 'Facture prête',
    FACTURE_PAYEE: 'Facture payée',
};

const statusOrder = ['EN_ATTENTE', 'PLANIFIEE', 'EN_COURS', 'TERMINEE'];

function getPlanningItems(vente: VenteEntity): PlanningItem[] {
    const forfaits: PlanningItem[] = (vente.venteForfaits || []).map((vf) => ({
        ...vf,
        _type: 'forfait' as const,
        _nom: vf.forfait?.nom || `Forfait #${vf.id}`,
    }));
    const services: PlanningItem[] = (vente.venteServices || []).map((vs) => ({
        ...vs,
        _type: 'service' as const,
        _nom: vs.service?.nom || `Service #${vs.id}`,
    }));
    return [...forfaits, ...services];
}

function computeProgress(items: PlanningItem[]): number {
    if (items.length === 0) return 0;
    const done = items.filter((t) => t.status === 'TERMINEE').length;
    return Math.round((done / items.length) * 100);
}

function stepIndex(status: string): number {
    const idx = statusOrder.indexOf(status);
    return idx >= 0 ? idx : 0;
}

function assetLabel(vente: VenteEntity): string {
    if (vente.bateau) return vente.bateau.name || vente.bateau.immatriculation || '';
    if (vente.moteur) {
        const m = vente.moteur;
        return m.modele?.designation || m.numeroSerie || '';
    }
    if (vente.remorque) return vente.remorque.immatriculation || '';
    return '';
}

export default function MesPrestations({ clientId }: MesPrestationsProps) {
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [detailItem, setDetailItem] = useState<PlanningItem | null>(null);

    useEffect(() => {
        setLoading(true);
        api.get(`/portal/clients/${clientId}/ventes`)
            .then((res) => setVentes((res.data || []).filter((v: VenteEntity) => getPlanningItems(v).length > 0)))
            .catch(() => message.error('Erreur lors du chargement des prestations'))
            .finally(() => setLoading(false));
    }, [clientId]);

    const allItems = ventes.flatMap((v) => getPlanningItems(v));
    const enCours = allItems.filter((t) => t.status === 'EN_COURS').length;
    const terminees = allItems.filter((t) => t.status === 'TERMINEE').length;
    const incidents = allItems.filter((t) => t.status === 'INCIDENT').length;
    const globalProgress = allItems.length > 0 ? Math.round((terminees / allItems.length) * 100) : 0;

    const columns = [
        {
            title: 'Prestation',
            dataIndex: '_nom',
            key: '_nom',
            render: (val: string, record: PlanningItem) => (
                <a onClick={() => setDetailItem(record)}>
                    {val}
                    <Tag style={{ marginLeft: 8 }} color={record._type === 'forfait' ? 'purple' : 'geekblue'}>
                        {record._type === 'forfait' ? 'Forfait' : 'Service'}
                    </Tag>
                </a>
            ),
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            key: 'status',
            render: (val: string) => (
                <Tag icon={taskStatusIcon[val]} color={taskStatusColor[val]}>
                    {taskStatusLabel[val] || val}
                </Tag>
            ),
        },
        {
            title: 'Debut',
            dataIndex: 'dateDebut',
            key: 'dateDebut',
            render: (val: string) => formatDate(val),
        },
        {
            title: 'Fin',
            dataIndex: 'dateFin',
            key: 'dateFin',
            render: (val: string) => formatDate(val),
        },
        {
            title: 'Technicien',
            dataIndex: 'technicien',
            key: 'technicien',
            render: (tech: PlanningItem['technicien']) =>
                tech ? `${tech.prenom || ''} ${tech.nom}`.trim() : '-',
        },
    ];

    return (
        <Card title="Suivi des interventions">
            <Spin spinning={loading}>
                {/* Summary cards */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                    <Card size="small" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{allItems.length}</div>
                        <div>Total prestations</div>
                    </Card>
                    <Card size="small" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{enCours}</div>
                        <div>En cours</div>
                    </Card>
                    <Card size="small" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{terminees}</div>
                        <div>Terminees</div>
                    </Card>
                    {incidents > 0 && (
                        <Card size="small" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{incidents}</div>
                            <div>Incidents</div>
                        </Card>
                    )}
                    <Card size="small" style={{ flex: 1, minWidth: 180, textAlign: 'center' }}>
                        <Progress type="circle" percent={globalProgress} size={60} />
                        <div style={{ marginTop: 4 }}>Avancement global</div>
                    </Card>
                </div>

                {ventes.length === 0 && !loading && (
                    <Empty description="Aucune prestation en cours" />
                )}

                {/* Ventes with planning items */}
                <Collapse
                    defaultActiveKey={ventes.filter((v) => getPlanningItems(v).some((t) => t.status !== 'TERMINEE' && t.status !== 'ANNULEE')).map((v) => String(v.id))}
                    items={ventes.map((vente) => {
                        const items = getPlanningItems(vente);
                        const progress = computeProgress(items);
                        const asset = assetLabel(vente);
                        const title = `${statusLabel[vente.status] || vente.status} #${vente.id}${asset ? ` - ${asset}` : ''} (${formatDate(vente.date)})`;

                        return {
                            key: String(vente.id),
                            label: (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <span>{title}</span>
                                    <Progress percent={progress} size="small" style={{ width: 120, marginLeft: 16 }} />
                                </div>
                            ),
                            children: (
                                <Table
                                    rowKey="id"
                                    dataSource={items}
                                    columns={columns}
                                    pagination={false}
                                    size="small"
                                    bordered
                                />
                            ),
                        };
                    })}
                />
            </Spin>

            {/* Planning item detail modal */}
            <Modal
                title={detailItem ? detailItem._nom : ''}
                open={!!detailItem}
                onCancel={() => setDetailItem(null)}
                footer={null}
                width={600}
            >
                {detailItem && (
                    <div>
                        <Steps
                            current={stepIndex(detailItem.status)}
                            status={detailItem.status === 'INCIDENT' ? 'error' : undefined}
                            size="small"
                            style={{ marginBottom: 24 }}
                            items={[
                                { title: 'En attente' },
                                { title: 'Planifiee' },
                                { title: 'En cours' },
                                { title: 'Terminee' },
                            ]}
                        />

                        <p><strong>Type :</strong>{' '}
                            <Tag color={detailItem._type === 'forfait' ? 'purple' : 'geekblue'}>
                                {detailItem._type === 'forfait' ? 'Forfait' : 'Service'}
                            </Tag>
                        </p>
                        <p><strong>Statut :</strong>{' '}
                            <Tag icon={taskStatusIcon[detailItem.status]} color={taskStatusColor[detailItem.status]}>
                                {taskStatusLabel[detailItem.status] || detailItem.status}
                            </Tag>
                        </p>
                        <p><strong>Date de planification :</strong> {formatDate(detailItem.datePlanification)}</p>
                        <p><strong>Date de debut :</strong> {formatDate(detailItem.dateDebut)}</p>
                        <p><strong>Date de fin :</strong> {formatDate(detailItem.dateFin)}</p>
                        <p><strong>Technicien :</strong>{' '}
                            {detailItem.technicien
                                ? `${detailItem.technicien.prenom || ''} ${detailItem.technicien.nom}`.trim()
                                : 'Non assigne'}
                        </p>
                        <p><strong>Duree reelle :</strong> {detailItem.dureeReelle != null ? `${detailItem.dureeReelle}h` : '-'}</p>
                        {detailItem.notes && (
                            <p><strong>Notes :</strong> {detailItem.notes}</p>
                        )}

                        {detailItem.status === 'INCIDENT' && (
                            <Card size="small" style={{ background: '#fff2f0', borderColor: '#ffccc7', marginTop: 12 }}>
                                <p style={{ color: '#ff4d4f', fontWeight: 'bold', marginBottom: 4 }}>
                                    <ExclamationCircleOutlined /> Incident signale
                                </p>
                                <p><strong>Date :</strong> {formatDate(detailItem.incidentDate)}</p>
                                <p style={{ margin: 0 }}>{detailItem.incidentDetails || 'Aucun detail'}</p>
                            </Card>
                        )}

                        {(detailItem.taches || []).length > 0 && (
                            <Card size="small" title="Checklist" style={{ marginTop: 12 }}>
                                {(detailItem.taches || []).map((tache) => (
                                    <div key={tache.id} style={{ marginBottom: 4 }}>
                                        <Checkbox checked={tache.done} disabled>
                                            {tache.nom}
                                        </Checkbox>
                                        {tache.description && (
                                            <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{tache.description}</span>
                                        )}
                                    </div>
                                ))}
                            </Card>
                        )}

                        {detailItem.statusDate && (
                            <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
                                Derniere mise a jour : {new Date(detailItem.statusDate).toLocaleString('fr-FR')}
                            </p>
                        )}
                    </div>
                )}
            </Modal>
        </Card>
    );
}
