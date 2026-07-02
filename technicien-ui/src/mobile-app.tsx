import React, { useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Checkbox,
    DatePicker,
    Form,
    Input,
    InputNumber,
    List,
    Modal,
    Segmented,
    Select,
    Space,
    Spin,
    Tag,
    message,
} from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    DeleteOutlined,
    ExclamationCircleOutlined,
    FileOutlined,
    KeyOutlined,
    LogoutOutlined,
    PictureOutlined,
    PlusOutlined,
    ReloadOutlined,
    ScheduleOutlined,
    ShoppingOutlined,
    UnorderedListOutlined,
    UserOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from './api.ts';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';

interface Technicien {
    id: number;
    prenom?: string;
    nom: string;
}

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

interface MobileAppProps {
    user: Technicien;
    onLogout: () => void;
    onChangePassword: () => void;
}

type Tab = 'today' | 'all' | 'incidents';

const taskStatusOptions: Array<{ value: TaskStatus; label: string }> = [
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'PLANIFIEE', label: 'Planifiee' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'TERMINEE', label: 'Terminee' },
    { value: 'INCIDENT', label: 'Incident' },
    { value: 'ANNULEE', label: 'Annulee' },
];

const statusColor: Record<string, string> = {
    EN_ATTENTE: 'orange', PLANIFIEE: 'cyan', EN_COURS: 'blue', TERMINEE: 'green', INCIDENT: 'red', ANNULEE: 'default',
};
const statusLabel: Record<string, string> = {
    EN_ATTENTE: 'En attente', PLANIFIEE: 'Planifiee', EN_COURS: 'En cours', TERMINEE: 'Terminee', INCIDENT: 'Incident', ANNULEE: 'Annulee',
};

const todayIso = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('fr-FR');
};

export default function MobileApp({ user, onLogout, onChangePassword }: MobileAppProps) {
    const [items, setItems] = useState<PlanningItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<Tab>('today');
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

    const technicienName = `${user.prenom || ''} ${user.nom}`.trim();

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/technicien-portal/techniciens/${user.id}/taches`);
            setItems(res.data || []);
        } catch {
            message.error('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, [user.id]);

    const todayItems = items.filter((t) => t.statusDate && t.statusDate.startsWith(todayIso()));
    const incidentItems = items.filter((t) => t.itemStatus === 'INCIDENT');
    const pendingCount = items.filter((t) => t.itemStatus === 'EN_ATTENTE' || t.itemStatus === 'PLANIFIEE' || t.itemStatus === 'EN_COURS').length;

    const displayedItems = tab === 'today' ? todayItems : tab === 'incidents' ? incidentItems : items;

    const openModal = (item: PlanningItem, presetStatus?: TaskStatus) => {
        setCurrentItem(item);
        setChecklist((item.taches || []).map((t) => ({ ...t })));
        setProduitsExtra((item.produitsExtra || []).map((p) => ({ ...p })));
        setImages(item.images || []);
        setDocuments(item.documents || []);
        form.setFieldsValue({
            status: presetStatus || item.itemStatus || 'EN_COURS',
            dureeReelle: item.dureeReelle || 0,
            notes: item.notes || '',
            incidentDate: item.incidentDate ? dayjs(item.incidentDate) : dayjs(),
            incidentDetails: item.incidentDetails || '',
        });
        setModalVisible(true);
    };

    const handleChecklistChange = (index: number, done: boolean) => {
        setChecklist((prev) => prev.map((c, i) => i === index ? { ...c, done } : c));
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

    const renderItemCard = (item: PlanningItem) => (
        <Card size="small" style={{ marginBottom: 8 }} key={item.itemId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 'bold', fontSize: 14 }}>{item.itemNom || 'Tache'}</span>
                <Space size={4}>
                    {item.itemType && <Tag>{item.itemType}</Tag>}
                    <Tag color={statusColor[item.itemStatus || '']}>{statusLabel[item.itemStatus || ''] || item.itemStatus}</Tag>
                </Space>
            </div>
            <p style={{ margin: '2px 0', color: '#666' }}>{item.clientNom || '-'} {item.bateauNom ? `/ ${item.bateauNom}` : ''}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                <span>Reelle: {item.dureeReelle ? `${item.dureeReelle}h` : '-'}</span>
                {item.dureeEstimee != null && item.dureeEstimee > 0 && <span>Estimee: {item.dureeEstimee}h</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: 12 }}>
                {item.dateDebut && <span>Debut: {formatDate(item.dateDebut)}</span>}
                {item.dateFin && <span>Fin: {formatDate(item.dateFin)}</span>}
            </div>
            {item.statusDate && <p style={{ margin: '2px 0', fontSize: 12 }}>Planifiee: {formatDate(item.statusDate)}</p>}
            {item.taches && item.taches.length > 0 && (
                <div style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                    Checklist: {item.taches.filter((t) => t.done).length}/{item.taches.length}
                </div>
            )}
            {item.itemStatus === 'INCIDENT' && item.incidentDetails && (
                <Card size="small" style={{ background: '#fff2f0', borderColor: '#ffccc7', marginTop: 4 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#cf1322' }}>
                        <WarningOutlined /> {item.incidentDetails}
                    </p>
                    {item.incidentDate && <p style={{ margin: 0, fontSize: 11, color: '#999' }}>Le {formatDate(item.incidentDate)}</p>}
                </Card>
            )}
            <Space style={{ marginTop: 8 }} wrap>
                {(item.itemStatus === 'EN_ATTENTE' || item.itemStatus === 'PLANIFIEE') && (
                    <Button size="small" type="primary" icon={<ClockCircleOutlined />} onClick={() => openModal(item, 'EN_COURS')}>
                        Demarrer
                    </Button>
                )}
                {item.itemStatus !== 'ANNULEE' && item.itemStatus !== 'TERMINEE' && (
                    <Button size="small" danger icon={<ExclamationCircleOutlined />} onClick={() => openModal(item, 'INCIDENT')}>
                        Incident
                    </Button>
                )}
                {item.itemStatus === 'EN_COURS' && (
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => openModal(item, 'TERMINEE')}>
                        Terminer
                    </Button>
                )}
            </Space>
        </Card>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ background: '#001529', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}><UserOutlined /> {technicienName}</span>
                <span>
                    <Button size="small" icon={<KeyOutlined />} onClick={onChangePassword} ghost style={{ marginRight: 8 }} />
                    <Button size="small" icon={<LogoutOutlined />} onClick={onLogout} ghost>Quitter</Button>
                </span>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                <span><Badge status="processing" /> Aujourd'hui: <strong>{todayItems.length}</strong></span>
                <span><Badge status="warning" /> A faire: <strong>{pendingCount}</strong></span>
                <span><Badge status="error" /> Incidents: <strong>{incidentItems.length}</strong></span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: 12, background: '#f5f5f5', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>
                        {tab === 'today' && `Aujourd'hui (${todayIso()})`}
                        {tab === 'all' && 'Toutes les taches'}
                        {tab === 'incidents' && 'Incidents'}
                    </h3>
                    <Button size="small" icon={<ReloadOutlined />} onClick={fetchItems} />
                </div>
                <Spin spinning={loading}>
                    {displayedItems.length > 0 ? (
                        <List dataSource={displayedItems} renderItem={renderItemCard} />
                    ) : (
                        <Card style={{ textAlign: 'center', color: '#999' }}>Aucune tache</Card>
                    )}
                </Spin>
            </div>

            {/* Bottom tab bar */}
            <div style={{ borderTop: '1px solid #e8e8e8', background: '#fff', padding: '4px 0', position: 'sticky', bottom: 0 }}>
                <Segmented
                    block
                    value={tab}
                    onChange={(val) => setTab(val as Tab)}
                    options={[
                        { value: 'today', icon: <ScheduleOutlined />, label: "Aujourd'hui" },
                        { value: 'all', icon: <UnorderedListOutlined />, label: 'Toutes' },
                        { value: 'incidents', icon: <ExclamationCircleOutlined />, label: 'Incidents' },
                    ]}
                    style={{ borderRadius: 0 }}
                />
            </div>

            {/* Add product modal */}
            <Modal
                open={addProduitVisible}
                title="Ajouter un produit"
                onOk={handleAddProduit}
                okText="Ajouter"
                cancelText="Annuler"
                onCancel={() => setAddProduitVisible(false)}
                okButtonProps={{ disabled: !selectedProduitId }}
                destroyOnHidden
                width="90vw"
            >
                <Spin spinning={catalogueLoading}>
                    <Form layout="vertical">
                        <Form.Item label="Produit" required>
                            <Select
                                showSearch
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
                </Spin>
            </Modal>

            {/* Update modal */}
            <Modal
                open={modalVisible}
                title={currentItem?.itemNom || 'Mise a jour'}
                onOk={handleSave}
                okText="Enregistrer"
                cancelText="Annuler"
                confirmLoading={saving}
                onCancel={() => { setModalVisible(false); setCurrentItem(null); setChecklist([]); setProduitsExtra([]); setImages([]); setDocuments([]); form.resetFields(); }}
                destroyOnHidden
                width="95vw"
                style={{ top: 20 }}
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
                    <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
                        <p style={{ margin: '2px 0' }}><strong>Client:</strong> {currentItem.clientNom || '-'}</p>
                        <p style={{ margin: '2px 0' }}><strong>Bateau:</strong> {currentItem.bateauNom || '-'}</p>
                        <p style={{ margin: '2px 0' }}><strong>Type:</strong> {currentItem.itemType || '-'}</p>
                        {currentItem.quantite != null && currentItem.quantite > 0 && (
                            <p style={{ margin: '2px 0' }}><strong>Quantite:</strong> {currentItem.quantite}</p>
                        )}
                        {currentItem.dureeEstimee != null && currentItem.dureeEstimee > 0 && (
                            <p style={{ margin: '2px 0' }}><strong>Duree estimee:</strong> {currentItem.dureeEstimee}h</p>
                        )}
                    </Card>
                )}
                <Form form={form} layout="vertical">
                    <Form.Item name="status" label="Statut" rules={[{ required: true }]}>
                        <Select options={taskStatusOptions} />
                    </Form.Item>
                    <Form.Item name="dureeReelle" label="Temps passe (heures)">
                        <InputNumber min={0} step={0.25} precision={2} style={{ width: '100%' }} addonAfter="h" />
                    </Form.Item>
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
                        <Card size="small" title={<><ShoppingOutlined /> Produits du forfait/service</>} style={{ marginBottom: 12 }}>
                            {currentItem.produits.map((p) => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{p.nom || '-'}</div>
                                        <div style={{ fontSize: 11, color: '#888' }}>
                                            {p.ref && <span>Ref: {p.ref}</span>}
                                            {p.ref && p.marque && <span> - </span>}
                                            {p.marque && <span>{p.marque}</span>}
                                        </div>
                                        {p.emplacement && <div style={{ fontSize: 11, color: '#888' }}>Emplacement: {p.emplacement}</div>}
                                    </div>
                                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>x{p.quantite ?? 0}</div>
                                </div>
                            ))}
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
                                    <Form.Item name="incidentDate" label="Date de l'incident" rules={[{ required: true, message: 'Requise' }]}>
                                        <DatePicker showTime style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item name="incidentDetails" label="Details" rules={[{ required: true, message: 'Requis' }]}>
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
