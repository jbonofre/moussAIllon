import React, { useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Checkbox,
    Col,
    Empty,
    Form,
    DatePicker,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Space,
    Table,
    Tag,
    message,
} from 'antd';
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, ExclamationCircleOutlined, FileOutlined, PictureOutlined, PlusOutlined, ReloadOutlined, ShoppingOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from './api.ts';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';

type TaskStatus = 'EN_ATTENTE' | 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'INCIDENT' | 'ANNULEE';

interface ChecklistItem {
    id?: number;
    nom?: string;
    description?: string;
    done?: boolean;
}

interface ProduitItem {
    id?: number;
    nom?: string;
    marque?: string;
    categorie?: string;
    ref?: string;
    emplacement?: string;
    quantite?: number;
}

interface PlanningItem {
    itemId?: number;
    venteId?: number;
    itemType?: string;
    itemNom?: string;
    itemStatus?: TaskStatus;
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    statusDate?: string;
    notes?: string;
    dureeReelle?: number;
    dureeEstimee?: number;
    incidentDate?: string;
    incidentDetails?: string;
    clientNom?: string;
    venteType?: string;
    bateauNom?: string;
    quantite?: number;
    taches?: ChecklistItem[];
    produits?: ProduitItem[];
    produitsExtra?: ProduitItem[];
    images?: string[];
    documents?: string[];
}

interface PlanningProps {
    technicienId: number;
}

const taskStatusOptions: Array<{ value: TaskStatus; label: string }> = [
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'PLANIFIEE', label: 'Planifiee' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'TERMINEE', label: 'Terminee' },
    { value: 'INCIDENT', label: 'Incident' },
    { value: 'ANNULEE', label: 'Annulee' },
];

const statusColor: Record<string, string> = {
    EN_ATTENTE: 'orange',
    PLANIFIEE: 'cyan',
    EN_COURS: 'blue',
    TERMINEE: 'green',
    INCIDENT: 'red',
    ANNULEE: 'default',
};

const statusLabel: Record<string, string> = {
    EN_ATTENTE: 'En attente',
    PLANIFIEE: 'Planifiee',
    EN_COURS: 'En cours',
    TERMINEE: 'Terminee',
    INCIDENT: 'Incident',
    ANNULEE: 'Annulee',
};

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('fr-FR');
};

const todayIso = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

export default function Planning({ technicienId }: PlanningProps) {
    const [items, setItems] = useState<PlanningItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState<TaskStatus | undefined>(undefined);
    const [modalVisible, setModalVisible] = useState(false);
    const [currentItem, setCurrentItem] = useState<PlanningItem | null>(null);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [produitsExtra, setProduitsExtra] = useState<ProduitItem[]>([]);
    const [images, setImages] = useState<string[]>([]);
    const [documents, setDocuments] = useState<string[]>([]);
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const [addProduitVisible, setAddProduitVisible] = useState(false);
    const [catalogue, setCatalogue] = useState<ProduitItem[]>([]);
    const [catalogueLoading, setCatalogueLoading] = useState(false);
    const [selectedProduitId, setSelectedProduitId] = useState<number | undefined>(undefined);
    const [addQuantite, setAddQuantite] = useState(1);

    const [nonAffectees, setNonAffectees] = useState<PlanningItem[]>([]);
    const [loadingNonAffectees, setLoadingNonAffectees] = useState(false);
    const [selfAssignItem, setSelfAssignItem] = useState<PlanningItem | null>(null);
    const [selfAssignDate, setSelfAssignDate] = useState<any>(null);
    const [selfAssigning, setSelfAssigning] = useState(false);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/technicien-portal/techniciens/${technicienId}/taches`);
            setItems(res.data || []);
        } catch {
            message.error('Erreur lors du chargement des taches');
        } finally {
            setLoading(false);
        }
    };

    const fetchNonAffectees = async () => {
        setLoadingNonAffectees(true);
        try {
            const res = await api.get('/technicien-portal/taches-non-affectees');
            setNonAffectees(res.data || []);
        } catch {
            message.error('Erreur lors du chargement des taches disponibles');
        } finally {
            setLoadingNonAffectees(false);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchNonAffectees();
    }, [technicienId]);

    const filteredItems = filterStatus
        ? items.filter((t) => t.itemStatus === filterStatus)
        : items;

    const todayItems = filteredItems.filter((t) => {
        if (!t.statusDate) return false;
        return t.statusDate.startsWith(todayIso());
    });

    const pendingItems = filteredItems.filter((t) => t.itemStatus === 'EN_ATTENTE' || t.itemStatus === 'PLANIFIEE' || t.itemStatus === 'EN_COURS');
    const incidentItems = filteredItems.filter((t) => t.itemStatus === 'INCIDENT');

    const openUpdateModal = (item: PlanningItem) => {
        setCurrentItem(item);
        setChecklist((item.taches || []).map((t) => ({ ...t })));
        setProduitsExtra((item.produitsExtra || []).map((p) => ({ ...p })));
        setImages(item.images || []);
        setDocuments(item.documents || []);
        form.setFieldsValue({
            status: item.itemStatus || 'EN_COURS',
            dureeReelle: item.dureeReelle || 0,
            notes: item.notes || '',
            incidentDate: item.incidentDate ? dayjs(item.incidentDate) : dayjs(),
            incidentDetails: item.incidentDetails || '',
        });
        setModalVisible(true);
    };

    const nowIso = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 19);
    };

    const handleStart = async (item: PlanningItem) => {
        try {
            const endpoint = item.itemType === 'forfait'
                ? `/technicien-portal/forfaits/${item.itemId}`
                : `/technicien-portal/services/${item.itemId}`;
            const res = await api.put(endpoint, {
                status: 'EN_COURS',
                dateDebut: nowIso(),
                dureeReelle: item.dureeReelle || 0,
                notes: item.notes || '',
            });
            message.success('Intervention demarrée');
            const updated = res.data;
            setCurrentItem({ ...item, ...updated, itemStatus: updated.itemStatus || 'EN_COURS' });
            setChecklist((updated.taches || item.taches || []).map((t: ChecklistItem) => ({ ...t })));
            setProduitsExtra((updated.produitsExtra || item.produitsExtra || []).map((p: ProduitItem) => ({ ...p })));
            setImages(updated.images || item.images || []);
            setDocuments(updated.documents || item.documents || []);
            form.setFieldsValue({
                status: 'EN_COURS',
                dureeReelle: updated.dureeReelle ?? item.dureeReelle ?? 0,
                notes: updated.notes ?? item.notes ?? '',
                incidentDate: dayjs(),
                incidentDetails: '',
            });
            setModalVisible(true);
            fetchItems();
        } catch {
            message.error('Erreur lors du demarrage');
        }
    };

    const handleChecklistChange = (index: number, done: boolean) => {
        setChecklist((prev) => {
            const updated = prev.map((c, i) => i === index ? { ...c, done } : c);
            // If all checked, auto-set status to TERMINEE and dateFin, compute dureeReelle
            if (updated.length > 0 && updated.every((c) => c.done)) {
                const finIso = nowIso();
                let dureeReelle = 0;
                if (currentItem?.dateDebut) {
                    const debut = new Date(currentItem.dateDebut).getTime();
                    const fin = new Date(finIso).getTime();
                    if (!isNaN(debut) && !isNaN(fin) && fin > debut) {
                        dureeReelle = Math.round(((fin - debut) / 3600000) * 100) / 100;
                    }
                }
                form.setFieldsValue({ status: 'TERMINEE', dureeReelle });
                // Auto-save with dateFin
                const saveComplete = async () => {
                    if (!currentItem) return;
                    try {
                        setSaving(true);
                        const values = form.getFieldsValue();
                        const endpoint = currentItem.itemType === 'forfait'
                            ? `/technicien-portal/forfaits/${currentItem.itemId}`
                            : `/technicien-portal/services/${currentItem.itemId}`;
                        await api.put(endpoint, {
                            status: 'TERMINEE',
                            dateFin: finIso,
                            dureeReelle,
                            notes: values.notes || '',
                            taches: updated.map((c) => ({ taskId: c.id, done: c.done })),
                            images,
                            documents,
                        });
                        message.success('Intervention terminée');
                        fetchItems();
                    } catch {
                        message.error('Erreur lors de la cloture');
                    } finally {
                        setSaving(false);
                    }
                };
                saveComplete();
            }
            return updated;
        });
    };

    const handleSave = async () => {
        if (!currentItem) return;
        try {
            const values = await form.validateFields();
            setSaving(true);
            const endpoint = currentItem.itemType === 'forfait'
                ? `/technicien-portal/forfaits/${currentItem.itemId}`
                : `/technicien-portal/services/${currentItem.itemId}`;
            const res = await api.put(endpoint, {
                status: values.status,
                dureeReelle: values.dureeReelle || 0,
                dateFin: values.status === 'TERMINEE' ? nowIso() : undefined,
                notes: values.notes || '',
                incidentDate: values.status === 'INCIDENT' ? (dayjs.isDayjs(values.incidentDate) ? values.incidentDate.format('YYYY-MM-DDTHH:mm:ss') : values.incidentDate) : null,
                incidentDetails: values.status === 'INCIDENT' ? values.incidentDetails : null,
                taches: checklist.map((c) => ({ taskId: c.id, done: c.done })),
                images,
                documents,
            });
            message.success('Tache mise a jour');
            const updated = res.data;
            setCurrentItem({ ...currentItem, ...updated, itemStatus: updated.itemStatus || values.status });
            if (updated.taches) {
                setChecklist(updated.taches.map((t: ChecklistItem) => ({ ...t })));
            }
            if (updated.produitsExtra) {
                setProduitsExtra(updated.produitsExtra.map((p: ProduitItem) => ({ ...p })));
            }
            if (updated.images) {
                setImages(updated.images);
            }
            if (updated.documents) {
                setDocuments(updated.documents);
            }
            form.setFieldsValue({
                status: updated.itemStatus || values.status,
                dureeReelle: updated.dureeReelle ?? values.dureeReelle,
                notes: updated.notes ?? values.notes,
                incidentDate: updated.incidentDate ? dayjs(updated.incidentDate) : values.incidentDate,
                incidentDetails: updated.incidentDetails || values.incidentDetails,
            });
            fetchItems();
        } catch {
            message.error('Erreur lors de la mise a jour');
        } finally {
            setSaving(false);
        }
    };

    const openAddProduit = async () => {
        setAddProduitVisible(true);
        setSelectedProduitId(undefined);
        setAddQuantite(1);
        if (catalogue.length === 0) {
            setCatalogueLoading(true);
            try {
                const res = await api.get('/technicien-portal/produits');
                setCatalogue(res.data || []);
            } catch {
                message.error('Impossible de charger le catalogue');
            } finally {
                setCatalogueLoading(false);
            }
        }
    };

    const handleAddProduit = async () => {
        if (!currentItem || !selectedProduitId) return;
        const endpoint = currentItem.itemType === 'forfait'
            ? `/technicien-portal/forfaits/${currentItem.itemId}/produits`
            : `/technicien-portal/services/${currentItem.itemId}/produits`;
        try {
            const res = await api.post(endpoint, { produitId: selectedProduitId, quantite: addQuantite });
            const updated = res.data;
            setCurrentItem({ ...currentItem, ...updated });
            setProduitsExtra((updated.produitsExtra || []).map((p: ProduitItem) => ({ ...p })));
            setAddProduitVisible(false);
            message.success('Produit ajoute');
        } catch {
            message.error("Erreur lors de l'ajout du produit");
        }
    };

    const handleRemoveProduit = async (produitExtraId: number) => {
        if (!currentItem) return;
        const endpoint = currentItem.itemType === 'forfait'
            ? `/technicien-portal/forfaits/${currentItem.itemId}/produits/${produitExtraId}`
            : `/technicien-portal/services/${currentItem.itemId}/produits/${produitExtraId}`;
        try {
            const res = await api.delete(endpoint);
            const updated = res.data;
            setCurrentItem({ ...currentItem, ...updated });
            setProduitsExtra((updated.produitsExtra || []).map((p: ProduitItem) => ({ ...p })));
            message.success('Produit retire');
        } catch {
            message.error('Erreur lors de la suppression du produit');
        }
    };

    const columns = [
        {
            title: 'Tache',
            dataIndex: 'itemNom',
            key: 'itemNom',
            render: (val: string) => val || '-',
        },
        {
            title: 'Type',
            dataIndex: 'itemType',
            key: 'itemType',
            render: (val: string) => val ? <Tag>{val}</Tag> : '-',
        },
        {
            title: 'Client',
            dataIndex: 'clientNom',
            key: 'clientNom',
            render: (val: string) => val || '-',
        },
        {
            title: 'Bateau',
            dataIndex: 'bateauNom',
            key: 'bateauNom',
            render: (val: string) => val || '-',
        },
        {
            title: 'Statut',
            dataIndex: 'itemStatus',
            key: 'itemStatus',
            render: (val: string) => <Tag color={statusColor[val]}>{statusLabel[val] || val}</Tag>,
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
            title: 'Date planifiee',
            dataIndex: 'statusDate',
            key: 'statusDate',
            render: (val: string) => formatDate(val),
        },
        {
            title: 'Estimee',
            dataIndex: 'dureeEstimee',
            key: 'dureeEstimee',
            render: (val: number) => val ? `${val}h` : '-',
        },
        {
            title: 'Reelle',
            dataIndex: 'dureeReelle',
            key: 'dureeReelle',
            render: (val: number) => val ? `${val}h` : '-',
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: PlanningItem) => {
                if (record.itemStatus === 'TERMINEE') return null;
                return (
                    <Space>
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openUpdateModal(record)}
                        >
                            Editer
                        </Button>
                        {(record.itemStatus === 'EN_ATTENTE' || record.itemStatus === 'PLANIFIEE') && (
                            <Button
                                size="small"
                                icon={<ClockCircleOutlined />}
                                onClick={() => handleStart(record)}
                            >
                                Demarrer
                            </Button>
                        )}
                        {record.itemStatus !== 'ANNULEE' && (
                            <Button
                                size="small"
                                danger
                                icon={<ExclamationCircleOutlined />}
                                onClick={() => {
                                    setCurrentItem(record);
                                    setChecklist((record.taches || []).map((t) => ({ ...t })));
                                    setProduitsExtra((record.produitsExtra || []).map((p) => ({ ...p })));
                                    setImages(record.images || []);
                                    setDocuments(record.documents || []);
                                    form.setFieldsValue({
                                        status: 'INCIDENT',
                                        dureeReelle: record.dureeReelle || 0,
                                        notes: record.notes || '',
                                        incidentDate: record.incidentDate ? dayjs(record.incidentDate) : dayjs(),
                                        incidentDetails: record.incidentDetails || '',
                                    });
                                    setModalVisible(true);
                                }}
                            >
                                Incident
                            </Button>
                        )}
                        {(record.itemStatus === 'PLANIFIEE' || record.itemStatus === 'EN_COURS') && (
                            <Button
                                size="small"
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={() => {
                                    let dureeReelle = record.dureeReelle || 0;
                                    if (record.dateDebut) {
                                        const debut = new Date(record.dateDebut).getTime();
                                        const fin = Date.now();
                                        if (!isNaN(debut) && fin > debut) {
                                            dureeReelle = Math.round(((fin - debut) / 3600000) * 100) / 100;
                                        }
                                    }
                                    setCurrentItem(record);
                                    setChecklist((record.taches || []).map((t) => ({ ...t })));
                                    setProduitsExtra((record.produitsExtra || []).map((p) => ({ ...p })));
                                    setImages(record.images || []);
                                    setDocuments(record.documents || []);
                                    form.setFieldsValue({
                                        status: 'TERMINEE',
                                        dureeReelle,
                                        notes: record.notes || '',
                                        incidentDate: dayjs(),
                                        incidentDetails: '',
                                    });
                                    setModalVisible(true);
                                }}
                            >
                                Terminer
                            </Button>
                        )}
                    </Space>
                );
            },
        },
    ];

    const handleSelfAssign = async () => {
        if (!selfAssignItem) return;
        setSelfAssigning(true);
        try {
            const endpoint = selfAssignItem.itemType === 'forfait'
                ? `/technicien-portal/forfaits/${selfAssignItem.itemId}/s-affecter`
                : `/technicien-portal/services/${selfAssignItem.itemId}/s-affecter`;
            await api.post(endpoint, {
                technicienId,
                datePlanification: selfAssignDate ? selfAssignDate.format('YYYY-MM-DD') : undefined,
            });
            message.success('Tache affectee et planifiee');
            setSelfAssignItem(null);
            setSelfAssignDate(null);
            fetchItems();
            fetchNonAffectees();
        } catch {
            message.error("Erreur lors de l'affectation");
        } finally {
            setSelfAssigning(false);
        }
    };

    const nonAffecteesColumns = [
        {
            title: 'Opération',
            key: 'nom',
            render: (_: unknown, record: PlanningItem) => (
                <Space>
                    <Tag color={record.itemType === 'forfait' ? 'blue' : 'purple'}>
                        {record.itemType === 'forfait' ? 'Forfait' : 'Service'}
                    </Tag>
                    {record.itemNom}
                </Space>
            ),
        },
        {
            title: 'Client',
            dataIndex: 'clientNom',
            key: 'clientNom',
            render: (val: string) => val || '-',
        },
        {
            title: 'Bateau',
            dataIndex: 'bateauNom',
            key: 'bateauNom',
            render: (val: string) => val || '-',
        },
        {
            title: 'Durée estimée',
            dataIndex: 'dureeEstimee',
            key: 'dureeEstimee',
            render: (val: number) => val ? `${val}h` : '-',
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: unknown, record: PlanningItem) => (
                <Button
                    size="small"
                    type="primary"
                    icon={<UserAddOutlined />}
                    onClick={() => { setSelfAssignItem(record); setSelfAssignDate(null); }}
                >
                    S'affecter
                </Button>
            ),
        },
    ];

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={8} lg={6}>
                    <Card>
                        <Badge status="processing" /> Aujourd'hui: <strong>{todayItems.length}</strong> tache(s)
                    </Card>
                </Col>
                <Col xs={24} sm={8} lg={6}>
                    <Card>
                        <Badge status="warning" /> A faire: <strong>{pendingItems.length}</strong>
                    </Card>
                </Col>
                <Col xs={24} sm={8} lg={6}>
                    <Card>
                        <Badge status="error" /> Incidents: <strong>{incidentItems.length}</strong>
                    </Card>
                </Col>
                <Col xs={24} sm={8} lg={6}>
                    <Card>
                        <Space>
                            <Select
                                allowClear
                                options={taskStatusOptions}
                                placeholder="Filtrer par statut"
                                value={filterStatus}
                                onChange={(val) => setFilterStatus(val)}
                                style={{ width: 180 }}
                            />
                            <Button icon={<ReloadOutlined />} onClick={fetchItems} />
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Card title={`Taches du jour (${todayIso()})`} style={{ marginBottom: 16 }}>
                {todayItems.length > 0 ? (
                    <Table
                        rowKey="itemId"
                        dataSource={todayItems}
                        columns={columns}
                        loading={loading}
                        pagination={false}
                        bordered
                    />
                ) : (
                    <Empty description="Aucune tache planifiee aujourd'hui" />
                )}
            </Card>

            <Card title="Toutes mes taches">
                <Table
                    rowKey="itemId"
                    dataSource={filteredItems}
                    columns={columns}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    bordered
                />
            </Card>

            <Card
                title={
                    <Space>
                        <CalendarOutlined />
                        Taches disponibles (non affectees)
                        <Tag>{nonAffectees.length}</Tag>
                    </Space>
                }
                style={{ marginTop: 16 }}
                extra={<Button icon={<ReloadOutlined />} size="small" onClick={fetchNonAffectees} />}
            >
                {nonAffectees.length === 0 ? (
                    <Empty description="Aucune tache disponible" />
                ) : (
                    <Table
                        rowKey="itemId"
                        dataSource={nonAffectees}
                        columns={nonAffecteesColumns}
                        loading={loadingNonAffectees}
                        pagination={{ pageSize: 10 }}
                        bordered
                    />
                )}
            </Card>

            <Modal
                open={!!selfAssignItem}
                title="S'affecter cette tache"
                onCancel={() => { setSelfAssignItem(null); setSelfAssignDate(null); }}
                onOk={handleSelfAssign}
                okText="Confirmer"
                cancelText="Annuler"
                confirmLoading={selfAssigning}
                destroyOnHidden
            >
                {selfAssignItem && (
                    <div style={{ marginBottom: 16 }}>
                        <p>
                            <strong>{selfAssignItem.itemNom}</strong>
                            {selfAssignItem.clientNom && <> — {selfAssignItem.clientNom}</>}
                            {selfAssignItem.bateauNom && <> ({selfAssignItem.bateauNom})</>}
                        </p>
                        <p style={{ color: '#888', fontSize: 13 }}>
                            En confirmant, vous vous affectez cette tache et son statut passe a <strong>Planifiee</strong>.
                        </p>
                    </div>
                )}
                <Form layout="vertical">
                    <Form.Item label="Date de planification (optionnel)">
                        <DatePicker
                            style={{ width: '100%' }}
                            value={selfAssignDate}
                            onChange={(date) => setSelfAssignDate(date)}
                            placeholder="Choisir une date"
                        />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={addProduitVisible}
                title="Ajouter un produit"
                onOk={handleAddProduit}
                okText="Ajouter"
                cancelText="Annuler"
                onCancel={() => setAddProduitVisible(false)}
                okButtonProps={{ disabled: !selectedProduitId }}
                destroyOnHidden
            >
                <Form layout="vertical">
                    <Form.Item label="Produit" required>
                        <Select
                            showSearch
                            loading={catalogueLoading}
                            placeholder="Rechercher un produit"
                            value={selectedProduitId}
                            onChange={setSelectedProduitId}
                            filterOption={(input, option) =>
                                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={catalogue.map((p) => ({
                                value: p.id,
                                label: `${p.nom || ''}${p.marque ? ` - ${p.marque}` : ''}${p.ref ? ` (${p.ref})` : ''}`,
                            }))}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                    <Form.Item label="Quantite">
                        <InputNumber min={1} value={addQuantite} onChange={(v) => setAddQuantite(v ?? 1)} style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={modalVisible}
                title={currentItem ? `Mise a jour: ${currentItem.itemNom || 'Tache'}` : 'Mise a jour'}
                onOk={handleSave}
                okText="Enregistrer"
                cancelText="Annuler"
                confirmLoading={saving}
                onCancel={() => {
                    setModalVisible(false);
                    setCurrentItem(null);
                    setChecklist([]);
                    setProduitsExtra([]);
                    setImages([]);
                    setDocuments([]);
                    form.resetFields();
                }}
                destroyOnHidden
                width={1000}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            {currentItem && currentItem.itemStatus !== 'INCIDENT' && currentItem.itemStatus !== 'TERMINEE' && currentItem.itemStatus !== 'ANNULEE' && (
                                <Button danger icon={<ExclamationCircleOutlined />} onClick={() => form.setFieldsValue({ status: 'INCIDENT' })}>
                                    Incident
                                </Button>
                            )}
                        </div>
                        <Space>
                            <Button onClick={() => { setModalVisible(false); setCurrentItem(null); setChecklist([]); setProduitsExtra([]); setImages([]); setDocuments([]); form.resetFields(); }}>
                                Annuler
                            </Button>
                            <Button type="primary" loading={saving} onClick={handleSave}>
                                Enregistrer
                            </Button>
                        </Space>
                    </div>
                }
            >
                {currentItem && (
                    <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                        <p><strong>Nom:</strong> {currentItem.itemNom || '-'}</p>
                        <p><strong>Client:</strong> {currentItem.clientNom || '-'}</p>
                        <p><strong>Bateau:</strong> {currentItem.bateauNom || '-'}</p>
                        {currentItem.dureeEstimee != null && currentItem.dureeEstimee > 0 && (
                            <p><strong>Duree estimee:</strong> {currentItem.dureeEstimee}h</p>
                        )}
                    </Card>
                )}
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="status"
                                label="Statut"
                                rules={[{ required: true, message: 'Le statut est requis' }]}
                            >
                                <Select options={taskStatusOptions} disabled />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dureeReelle" label="Temps passe (heures)">
                                <InputNumber min={0} step={0.25} precision={2} style={{ width: '100%' }} addonAfter="h" disabled />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="notes" label="Notes">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    {checklist.length > 0 && (
                        <Card size="small" title="Checklist" style={{ marginBottom: 12 }}>
                            {checklist.map((item, index) => (
                                <div key={item.id || index} style={{ marginBottom: 4 }}>
                                    <Checkbox
                                        checked={item.done}
                                        onChange={(e) => handleChecklistChange(index, e.target.checked)}
                                    >
                                        <span style={{ fontWeight: 500 }}>{item.nom || `Tache ${index + 1}`}</span>
                                    </Checkbox>
                                    {item.description && (
                                        <p style={{ margin: '0 0 0 24px', fontSize: 12, color: '#999' }}>{item.description}</p>
                                    )}
                                </div>
                            ))}
                        </Card>
                    )}
                    {currentItem?.produits && currentItem.produits.length > 0 && (
                        <Card size="small" title={<><ShoppingOutlined /> Produits</>} style={{ marginBottom: 12 }}>
                            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #f0f0f0', textAlign: 'left' }}>
                                        <th style={{ padding: '4px 8px' }}>Produit</th>
                                        <th style={{ padding: '4px 8px' }}>Ref</th>
                                        <th style={{ padding: '4px 8px' }}>Marque</th>
                                        <th style={{ padding: '4px 8px' }}>Emplacement</th>
                                        <th style={{ padding: '4px 8px', textAlign: 'right' }}>Qte</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentItem.produits.map((p) => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: '4px 8px' }}>{p.nom || '-'}</td>
                                            <td style={{ padding: '4px 8px', color: '#888' }}>{p.ref || '-'}</td>
                                            <td style={{ padding: '4px 8px', color: '#888' }}>{p.marque || '-'}</td>
                                            <td style={{ padding: '4px 8px', color: '#888' }}>{p.emplacement || '-'}</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 500 }}>{p.quantite ?? 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    )}
                    <Card
                        size="small"
                        title={<><ShoppingOutlined /> Produits supplementaires</>}
                        style={{ marginBottom: 12 }}
                        extra={<Button size="small" icon={<PlusOutlined />} onClick={openAddProduit}>Ajouter</Button>}
                    >
                        {produitsExtra.length === 0 ? (
                            <div style={{ color: '#999', fontSize: 13 }}>Aucun produit supplementaire</div>
                        ) : (
                            produitsExtra.map((p) => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{p.nom || '-'}</div>
                                        <div style={{ fontSize: 11, color: '#888' }}>
                                            {p.ref && <span>Ref: {p.ref}</span>}
                                            {p.ref && p.marque && <span> - </span>}
                                            {p.marque && <span>{p.marque}</span>}
                                        </div>
                                        {p.emplacement && <div style={{ fontSize: 11, color: '#888' }}>Emplacement: {p.emplacement}</div>}
                                    </div>
                                    <Space>
                                        <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>x{p.quantite ?? 0}</span>
                                        <Button
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => p.id && handleRemoveProduit(p.id)}
                                        />
                                    </Space>
                                </div>
                            ))
                        )}
                    </Card>
                    <Card size="small" title={<><PictureOutlined /> Images</>} style={{ marginBottom: 12 }}>
                        <ImageUpload value={images} onChange={setImages} />
                    </Card>
                    <Card size="small" title={<><FileOutlined /> Documents</>} style={{ marginBottom: 12 }}>
                        <DocumentUpload value={documents} onChange={setDocuments} />
                    </Card>
                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.status !== cur?.status}>
                        {({ getFieldValue }) => {
                            if (getFieldValue('status') !== 'INCIDENT') return null;
                            return (
                                <Card size="small" title="Incident" style={{ marginBottom: 12, borderColor: '#ff4d4f' }}>
                                    <Form.Item
                                        name="incidentDate"
                                        label="Date de l'incident"
                                        rules={[{ required: true, message: "La date de l'incident est requise" }]}
                                    >
                                        <DatePicker showTime style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item
                                        name="incidentDetails"
                                        label="Details de l'incident"
                                        rules={[{ required: true, message: "Les details de l'incident sont requis" }]}
                                    >
                                        <Input.TextArea rows={3} />
                                    </Form.Item>
                                </Card>
                            );
                        }}
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
