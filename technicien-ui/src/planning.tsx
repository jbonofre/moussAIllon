import React, { useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Col,
    Empty,
    Form,
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
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';

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
    return parsed.toLocaleDateString('fr-FR');
};

const todayIso = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

export default function Planning({ technicienId }: PlanningProps) {
    const [tasks, setTasks] = useState<TaskWithVente[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState<TaskStatus | undefined>(undefined);
    const [modalVisible, setModalVisible] = useState(false);
    const [currentTask, setCurrentTask] = useState<TaskWithVente | null>(null);
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/technicien-portal/techniciens/${technicienId}/taches`);
            setTasks(res.data || []);
        } catch {
            message.error('Erreur lors du chargement des taches');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [technicienId]);

    const filteredTasks = filterStatus
        ? tasks.filter((t) => t.taskStatus === filterStatus)
        : tasks;

    const todayTasks = filteredTasks.filter((t) => {
        if (!t.statusDate) return false;
        return t.statusDate.startsWith(todayIso());
    });

    const pendingTasks = filteredTasks.filter((t) => t.taskStatus === 'EN_ATTENTE' || t.taskStatus === 'PLANIFIEE' || t.taskStatus === 'EN_COURS');
    const incidentTasks = filteredTasks.filter((t) => t.taskStatus === 'INCIDENT');

    const openUpdateModal = (task: TaskWithVente) => {
        setCurrentTask(task);
        form.setFieldsValue({
            status: task.taskStatus || 'EN_COURS',
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

    const columns = [
        {
            title: 'Tache',
            dataIndex: 'taskNom',
            key: 'taskNom',
            render: (val: string) => val || '-',
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
            dataIndex: 'taskStatus',
            key: 'taskStatus',
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
            render: (_: unknown, record: TaskWithVente) => (
                <Space>
                    {(record.taskStatus === 'EN_ATTENTE' || record.taskStatus === 'PLANIFIEE') && (
                        <Button
                            size="small"
                            icon={<ClockCircleOutlined />}
                            onClick={() => {
                                setCurrentTask(record);
                                form.setFieldsValue({
                                    status: 'EN_COURS',
                                    dureeReelle: record.dureeReelle || 0,
                                    notes: record.notes || '',
                                    incidentDate: todayIso(),
                                    incidentDetails: '',
                                });
                                setModalVisible(true);
                            }}
                        >
                            Demarrer
                        </Button>
                    )}
                    {(record.taskStatus === 'PLANIFIEE' || record.taskStatus === 'EN_COURS') && (
                        <Button
                            size="small"
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={() => {
                                setCurrentTask(record);
                                form.setFieldsValue({
                                    status: 'TERMINEE',
                                    dureeReelle: record.dureeReelle || 0,
                                    notes: record.notes || '',
                                    incidentDate: todayIso(),
                                    incidentDetails: '',
                                });
                                setModalVisible(true);
                            }}
                        >
                            Terminer
                        </Button>
                    )}
                    {(record.taskStatus !== 'ANNULEE') && (
                        <Button
                            size="small"
                            danger
                            icon={<ExclamationCircleOutlined />}
                            onClick={() => {
                                setCurrentTask(record);
                                form.setFieldsValue({
                                    status: 'INCIDENT',
                                    dureeReelle: record.dureeReelle || 0,
                                    notes: record.notes || '',
                                    incidentDate: record.incidentDate || todayIso(),
                                    incidentDetails: record.incidentDetails || '',
                                });
                                setModalVisible(true);
                            }}
                        >
                            Incident
                        </Button>
                    )}
                    <Button size="small" onClick={() => openUpdateModal(record)}>
                        Modifier
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={8} lg={6}>
                    <Card>
                        <Badge status="processing" /> Aujourd'hui: <strong>{todayTasks.length}</strong> tache(s)
                    </Card>
                </Col>
                <Col xs={24} sm={8} lg={6}>
                    <Card>
                        <Badge status="warning" /> A faire: <strong>{pendingTasks.length}</strong>
                    </Card>
                </Col>
                <Col xs={24} sm={8} lg={6}>
                    <Card>
                        <Badge status="error" /> Incidents: <strong>{incidentTasks.length}</strong>
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
                            <Button icon={<ReloadOutlined />} onClick={fetchTasks} />
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Card title={`Taches du jour (${todayIso()})`} style={{ marginBottom: 16 }}>
                {todayTasks.length > 0 ? (
                    <Table
                        rowKey="taskId"
                        dataSource={todayTasks}
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
                    rowKey="taskId"
                    dataSource={filteredTasks}
                    columns={columns}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    bordered
                />
            </Card>

            <Modal
                open={modalVisible}
                title={currentTask ? `Mise a jour: ${currentTask.taskNom || 'Tache'}` : 'Mise a jour'}
                onOk={handleSave}
                okText="Enregistrer"
                cancelText="Annuler"
                confirmLoading={saving}
                onCancel={() => {
                    setModalVisible(false);
                    setCurrentTask(null);
                    form.resetFields();
                }}
                destroyOnHidden
                width={600}
            >
                {currentTask && (
                    <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                        <p><strong>Client:</strong> {currentTask.clientNom || '-'}</p>
                        <p><strong>Bateau:</strong> {currentTask.bateauNom || '-'}</p>
                        <p><strong>Description:</strong> {currentTask.description || '-'}</p>
                        <p><strong>Duree estimee:</strong> {currentTask.dureeEstimee ? `${currentTask.dureeEstimee}h` : '-'}</p>
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
                                <Select options={taskStatusOptions} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dureeReelle" label="Temps passe (heures)">
                                <InputNumber min={0} step={0.25} precision={2} style={{ width: '100%' }} addonAfter="h" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="notes" label="Notes">
                        <Input.TextArea rows={3} />
                    </Form.Item>
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
                                        <Input type="date" />
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
