import React, { useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Card,
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
    ExclamationCircleOutlined,
    LogoutOutlined,
    ReloadOutlined,
    ScheduleOutlined,
    UnorderedListOutlined,
    UserOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import axios from 'axios';

interface Technicien {
    id: number;
    prenom?: string;
    nom: string;
}

type TaskStatus = 'EN_ATTENTE' | 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'INCIDENT' | 'ANNULEE';

interface TaskWithVente {
    taskId: number;
    venteId: number;
    taskNom?: string;
    taskStatus?: TaskStatus;
    dateDebut?: string;
    dateFin?: string;
    statusDate?: string;
    description?: string;
    notes?: string;
    dureeEstimee?: number;
    dureeReelle?: number;
    incidentDate?: string;
    incidentDetails?: string;
    clientNom?: string;
    venteType?: string;
    bateauNom?: string;
}

interface MobileAppProps {
    user: Technicien;
    onLogout: () => void;
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
    return parsed.toLocaleDateString('fr-FR');
};

export default function MobileApp({ user, onLogout }: MobileAppProps) {
    const [tasks, setTasks] = useState<TaskWithVente[]>([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<Tab>('today');
    const [modalVisible, setModalVisible] = useState(false);
    const [currentTask, setCurrentTask] = useState<TaskWithVente | null>(null);
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);

    const technicienName = `${user.prenom || ''} ${user.nom}`.trim();

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/technicien-portal/techniciens/${user.id}/taches`);
            setTasks(res.data || []);
        } catch {
            message.error('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTasks(); }, [user.id]);

    const todayTasks = tasks.filter((t) => t.statusDate && t.statusDate.startsWith(todayIso()));
    const incidentTasks = tasks.filter((t) => t.taskStatus === 'INCIDENT');
    const pendingCount = tasks.filter((t) => t.taskStatus === 'EN_ATTENTE' || t.taskStatus === 'PLANIFIEE' || t.taskStatus === 'EN_COURS').length;

    const displayedTasks = tab === 'today' ? todayTasks : tab === 'incidents' ? incidentTasks : tasks;

    const openModal = (task: TaskWithVente, presetStatus?: TaskStatus) => {
        setCurrentTask(task);
        form.setFieldsValue({
            status: presetStatus || task.taskStatus || 'EN_COURS',
            dureeReelle: task.dureeReelle || 0,
            notes: task.notes || '',
            incidentDate: task.incidentDate || todayIso(),
            incidentDetails: task.incidentDetails || '',
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!currentTask) return;
        try {
            const values = await form.validateFields();
            setSaving(true);
            const res = await axios.put(`/technicien-portal/taches/${currentTask.taskId}`, {
                status: values.status,
                dureeReelle: values.dureeReelle || 0,
                notes: values.notes || '',
                incidentDate: values.status === 'INCIDENT' ? values.incidentDate : null,
                incidentDetails: values.status === 'INCIDENT' ? values.incidentDetails : null,
            });
            message.success('Tache mise a jour');
            const updated = res.data;
            setCurrentTask({ ...currentTask, ...updated, taskStatus: updated.taskStatus || values.status });
            form.setFieldsValue({
                status: updated.taskStatus || values.status,
                dureeReelle: updated.dureeReelle ?? values.dureeReelle,
                notes: updated.notes ?? values.notes,
                incidentDate: updated.incidentDate || values.incidentDate,
                incidentDetails: updated.incidentDetails || values.incidentDetails,
            });
            fetchTasks();
        } catch {
            message.error('Erreur lors de la mise a jour');
        } finally {
            setSaving(false);
        }
    };

    const renderTaskCard = (task: TaskWithVente) => (
        <Card size="small" style={{ marginBottom: 8 }} key={task.taskId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 'bold', fontSize: 14 }}>{task.taskNom || 'Tache'}</span>
                <Tag color={statusColor[task.taskStatus || '']}>{statusLabel[task.taskStatus || ''] || task.taskStatus}</Tag>
            </div>
            <p style={{ margin: '2px 0', color: '#666' }}>{task.clientNom || '-'} {task.bateauNom ? `/ ${task.bateauNom}` : ''}</p>
            {task.description && <p style={{ margin: '2px 0', fontSize: 12, color: '#999' }}>{task.description}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                <span>Estimee: {task.dureeEstimee ? `${task.dureeEstimee}h` : '-'}</span>
                <span>Reelle: {task.dureeReelle ? `${task.dureeReelle}h` : '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: 12 }}>
                {task.dateDebut && <span>Debut: {formatDate(task.dateDebut)}</span>}
                {task.dateFin && <span>Fin: {formatDate(task.dateFin)}</span>}
            </div>
            {task.statusDate && <p style={{ margin: '2px 0', fontSize: 12 }}>Planifiee: {formatDate(task.statusDate)}</p>}
            {task.taskStatus === 'INCIDENT' && task.incidentDetails && (
                <Card size="small" style={{ background: '#fff2f0', borderColor: '#ffccc7', marginTop: 4 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#cf1322' }}>
                        <WarningOutlined /> {task.incidentDetails}
                    </p>
                    {task.incidentDate && <p style={{ margin: 0, fontSize: 11, color: '#999' }}>Le {formatDate(task.incidentDate)}</p>}
                </Card>
            )}
            <Space style={{ marginTop: 8 }} wrap>
                {(task.taskStatus === 'EN_ATTENTE' || task.taskStatus === 'PLANIFIEE') && (
                    <Button size="small" type="primary" icon={<ClockCircleOutlined />} onClick={() => openModal(task, 'EN_COURS')}>
                        Demarrer
                    </Button>
                )}
                {task.taskStatus === 'EN_COURS' && (
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => openModal(task, 'TERMINEE')}>
                        Terminer
                    </Button>
                )}
                {task.taskStatus !== 'ANNULEE' && task.taskStatus !== 'TERMINEE' && (
                    <Button size="small" danger icon={<ExclamationCircleOutlined />} onClick={() => openModal(task, 'INCIDENT')}>
                        Incident
                    </Button>
                )}
                <Button size="small" onClick={() => openModal(task)}>Modifier</Button>
            </Space>
        </Card>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ background: '#001529', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}><UserOutlined /> {technicienName}</span>
                <Button size="small" icon={<LogoutOutlined />} onClick={onLogout} ghost>Quitter</Button>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                <span><Badge status="processing" /> Aujourd'hui: <strong>{todayTasks.length}</strong></span>
                <span><Badge status="warning" /> A faire: <strong>{pendingCount}</strong></span>
                <span><Badge status="error" /> Incidents: <strong>{incidentTasks.length}</strong></span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: 12, background: '#f5f5f5', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>
                        {tab === 'today' && `Aujourd'hui (${todayIso()})`}
                        {tab === 'all' && 'Toutes les taches'}
                        {tab === 'incidents' && 'Incidents'}
                    </h3>
                    <Button size="small" icon={<ReloadOutlined />} onClick={fetchTasks} />
                </div>
                <Spin spinning={loading}>
                    {displayedTasks.length > 0 ? (
                        <List dataSource={displayedTasks} renderItem={renderTaskCard} />
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

            {/* Update modal */}
            <Modal
                open={modalVisible}
                title={currentTask?.taskNom || 'Mise a jour'}
                onOk={handleSave}
                okText="Enregistrer"
                cancelText="Annuler"
                confirmLoading={saving}
                onCancel={() => { setModalVisible(false); setCurrentTask(null); form.resetFields(); }}
                destroyOnHidden
                width="95vw"
                style={{ top: 20 }}
            >
                {currentTask && (
                    <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
                        <p style={{ margin: '2px 0' }}><strong>Client:</strong> {currentTask.clientNom || '-'}</p>
                        <p style={{ margin: '2px 0' }}><strong>Bateau:</strong> {currentTask.bateauNom || '-'}</p>
                        {currentTask.description && <p style={{ margin: '2px 0' }}><strong>Description:</strong> {currentTask.description}</p>}
                        <p style={{ margin: '2px 0' }}><strong>Estimee:</strong> {currentTask.dureeEstimee ? `${currentTask.dureeEstimee}h` : '-'}</p>
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
                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.status !== cur?.status}>
                        {({ getFieldValue }) => {
                            if (getFieldValue('status') !== 'INCIDENT') return null;
                            return (
                                <Card size="small" title="Incident" style={{ marginBottom: 12, borderColor: '#ff4d4f' }}>
                                    <Form.Item name="incidentDate" label="Date de l'incident" rules={[{ required: true, message: 'Requise' }]}>
                                        <Input type="date" />
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
