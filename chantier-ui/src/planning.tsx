import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Col, Empty, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import { CalendarOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { WeeklyCalendar } from 'antd-weekly-calendar';
import { useHistory } from 'react-router-dom';

type VenteType = 'DEVIS' | 'FACTURE' | 'COMPTOIR';
type TaskStatus = 'EN_ATTENTE' | 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'INCIDENT' | 'ANNULEE';

interface ClientEntity {
    id: number;
    prenom?: string;
    nom: string;
}

interface TechnicienEntity {
    id: number;
    prenom?: string;
    nom?: string;
}

interface TaskEntity {
    id?: number;
    nom?: string;
    status?: TaskStatus;
    dateDebut?: string;
    dateFin?: string;
    statusDate?: string;
    dureeEstimee?: number;
    technicien?: TechnicienEntity;
    incidentDate?: string;
    incidentDetails?: string;
}

interface ForfaitEntity {
    id: number;
}

interface ProduitCatalogueEntity {
    id: number;
}

interface ServiceEntity {
    id: number;
}

interface VenteEntity {
    id?: number;
    status: string;
    type?: VenteType;
    client?: ClientEntity;
    forfaits?: ForfaitEntity[];
    produits?: ProduitCatalogueEntity[];
    services?: ServiceEntity[];
    taches?: TaskEntity[];
    date?: string;
    prixVenteTTC?: number;
    modePaiement?: string;
}

interface PlanningFormValues {
    date: string;
    dateDebut?: string;
    dateFin?: string;
    status: TaskStatus;
    technicienId?: number;
}

interface WeeklyCalendarEvent {
    eventId: string;
    startTime: Date;
    endTime: Date;
    title: string;
    backgroundColor?: string;
    textColor?: string;
}

interface PendingTaskRow {
    key: string;
    vente: VenteEntity;
    task: TaskEntity;
    taskIndex: number;
}

const taskStatusOptions: Array<{ value: TaskStatus; label: string }> = [
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'PLANIFIEE', label: 'Planifiee' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'TERMINEE', label: 'Terminee' },
    { value: 'INCIDENT', label: 'Incident' },
    { value: 'ANNULEE', label: 'Annulee' }
];

const typeOptions: Array<{ value: VenteType; label: string }> = [
    { value: 'DEVIS', label: 'Devis' },
    { value: 'FACTURE', label: 'Facture' },
    { value: 'COMPTOIR', label: 'Comptoir' }
];

const statusColor: Record<TaskStatus, string> = {
    EN_ATTENTE: 'default',
    PLANIFIEE: 'cyan',
    EN_COURS: 'blue',
    TERMINEE: 'green',
    INCIDENT: 'volcano',
    ANNULEE: 'red'
};

const technicienPalette = [
    '#1677ff',
    '#13c2c2',
    '#52c41a',
    '#faad14',
    '#722ed1',
    '#eb2f96',
    '#fa541c',
    '#2f54eb'
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const getClientLabel = (client?: ClientEntity) => {
    if (!client) {
        return '-';
    }
    const fullName = `${client.prenom || ''} ${client.nom || ''}`.trim();
    return fullName || `Client #${client.id}`;
};

const toIsoDay = (value?: string) => {
    if (!value) {
        return undefined;
    }
    const parsed = dayjs(value);
    if (!parsed.isValid()) {
        return undefined;
    }
    return parsed.format('YYYY-MM-DD');
};

const toDateTimeLocalValue = (value?: string) => {
    if (!value) {
        return undefined;
    }
    const parsed = dayjs(value);
    if (!parsed.isValid()) {
        return undefined;
    }
    return parsed.format('YYYY-MM-DDTHH:mm');
};

const getTechnicienColor = (technicien?: TechnicienEntity) => {
    if (!technicien?.id) {
        return '#8c8c8c';
    }
    const index = Math.abs(technicien.id) % technicienPalette.length;
    return technicienPalette[index];
};

export default function Planning() {
    const history = useHistory();
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [techniciens, setTechniciens] = useState<TechnicienEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(todayIso());
    const [selectedStatus, setSelectedStatus] = useState<TaskStatus | undefined>(undefined);
    const [selectedTechnicien, setSelectedTechnicien] = useState<number | undefined>(undefined);
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentTaskRow, setCurrentTaskRow] = useState<PendingTaskRow | null>(null);
    const [form] = Form.useForm<PlanningFormValues>();
    const calendarRef = useRef<HTMLDivElement>(null);
    const draggedTaskRef = useRef<PendingTaskRow | null>(null);
    const [dragOverDay, setDragOverDay] = useState<string | null>(null);
    const [calendarWeekStart, setCalendarWeekStart] = useState<dayjs.Dayjs>(dayjs().startOf('week'));

    const fetchVentes = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/ventes');
            setVentes(response.data || []);
        } catch {
            message.error('Erreur lors du chargement du planning.');
        } finally {
            setLoading(false);
        }
    };

    const fetchTechniciens = async () => {
        try {
            const response = await axios.get('/techniciens');
            setTechniciens(response.data || []);
        } catch {
            message.error('Erreur lors du chargement des techniciens.');
        }
    };

    useEffect(() => {
        fetchVentes();
        fetchTechniciens();
    }, []);

    const technicienOptions = useMemo(
        () =>
            techniciens.map((technicien) => ({
                value: technicien.id,
                label: `${technicien.prenom || ''} ${technicien.nom || ''}`.trim() || `Technicien #${technicien.id}`
            })),
        [techniciens]
    );

    const openPlanningModal = (taskRow: PendingTaskRow, forcedDate?: string) => {
        setCurrentTaskRow(taskRow);
        form.setFieldsValue({
            date:
                toDateTimeLocalValue(taskRow.task.statusDate)
                || (forcedDate ? `${forcedDate}T08:00` : undefined)
                || `${selectedDate || todayIso()}T08:00`,
            dateDebut: taskRow.task.dateDebut || undefined,
            dateFin: taskRow.task.dateFin || undefined,
            status: taskRow.task.status === 'EN_ATTENTE' ? 'PLANIFIEE' : (taskRow.task.status || 'PLANIFIEE'),
            technicienId: taskRow.task.technicien?.id,
            incidentDate: taskRow.task.incidentDate,
            incidentDetails: taskRow.task.incidentDetails
        });
        setModalVisible(true);
    };

    const getDropDate = (clientX: number): string | undefined => {
        const container = calendarRef.current;
        if (!container) return undefined;
        const headerCells = container.querySelectorAll<HTMLElement>('.ant-table-thead th');
        if (headerCells.length < 2) return undefined;
        // Skip column 0 (time gutter), remaining columns are days starting from Sunday (week start)
        const dayCells = Array.from(headerCells).slice(1);
        for (let i = 0; i < dayCells.length; i++) {
            const rect = dayCells[i].getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right) {
                return calendarWeekStart.add(i, 'day').format('YYYY-MM-DD');
            }
        }
        return undefined;
    };

    const handleCalendarDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const day = getDropDate(e.clientX);
        setDragOverDay(day || null);
    };

    const handleCalendarDragLeave = () => {
        setDragOverDay(null);
    };

    const handleCalendarDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverDay(null);
        const taskRow = draggedTaskRef.current;
        draggedTaskRef.current = null;
        if (!taskRow) return;
        const day = getDropDate(e.clientX);
        if (day) {
            openPlanningModal(taskRow, day);
        }
    };

    const allTasks = useMemo<PendingTaskRow[]>(
        () =>
            ventes.flatMap((vente, venteIndex) =>
                (vente.taches || []).map((task, taskIndex) => ({
                    key: `${vente.id || venteIndex}-${task.id || taskIndex}-${taskIndex}`,
                    vente,
                    task,
                    taskIndex
                }))
            ),
        [ventes]
    );

    const matchesTechnicien = (row: PendingTaskRow) =>
        !selectedTechnicien || row.task.technicien?.id === selectedTechnicien;

    const pendingTasks = useMemo<PendingTaskRow[]>(
        () =>
            allTasks
                .filter((row) => !row.task.status || row.task.status === 'EN_ATTENTE')
                .filter((row) => !selectedStatus || row.task.status === selectedStatus)
                .filter(matchesTechnicien),
        [allTasks, selectedStatus, selectedTechnicien]
    );

    const pendingTasksForDay = useMemo<PendingTaskRow[]>(
        () => pendingTasks.filter((row) => toIsoDay(row.task.statusDate) === selectedDate),
        [pendingTasks, selectedDate]
    );

    const plannedTasks = useMemo<PendingTaskRow[]>(
        () =>
            allTasks
                .filter((row) => row.task.status === 'PLANIFIEE' || row.task.status === 'EN_COURS')
                .filter((row) => toIsoDay(row.task.statusDate) === selectedDate)
                .filter((row) => !selectedStatus || row.task.status === selectedStatus)
                .filter(matchesTechnicien),
        [allTasks, selectedDate, selectedStatus, selectedTechnicien]
    );

    const weeklyEvents = useMemo<WeeklyCalendarEvent[]>(
        () =>
            allTasks
                .filter((row) => row.task.status === 'PLANIFIEE' || row.task.status === 'EN_COURS')
                .filter(matchesTechnicien)
                .map((row) => {
                    const { vente, task } = row;
                    const startSource = task.dateDebut || task.statusDate || vente.date;
                    if (!startSource) {
                        return null;
                    }
                    const startDate = dayjs(startSource);
                    if (!startDate.isValid()) {
                        return null;
                    }

                    const endSource = task.dateFin;
                    const estimatedDurationMinutes = Math.max(
                        1,
                        Math.round(((task.dureeEstimee || 0) > 0 ? (task.dureeEstimee || 0) * 60 : 60))
                    );
                    const endDate = endSource && dayjs(endSource).isValid()
                        ? dayjs(endSource)
                        : startDate.add(estimatedDurationMinutes, 'minute');

                    return {
                        eventId: row.key,
                        startTime: startDate.toDate(),
                        endTime: endDate.toDate(),
                        title: `#${vente.id} ${task.nom || 'Tache sans nom'} (${getClientLabel(vente.client)})`,
                        backgroundColor: getTechnicienColor(task.technicien),
                        textColor: '#ffffff'
                    } as WeeklyCalendarEvent;
                })
                .filter(Boolean) as WeeklyCalendarEvent[],
        [allTasks, selectedTechnicien]
    );

    const handleSavePlanning = async () => {
        if (!currentTaskRow?.vente?.id) {
            return;
        }
        try {
            const values = await form.validateFields();
            setSaving(true);
            const venteId = currentTaskRow.vente.id;
            const latestVenteResponse = await axios.get(`/ventes/${venteId}`);
            const latestVente = (latestVenteResponse.data || currentTaskRow.vente) as VenteEntity;
            const latestTasks = [...(latestVente.taches || [])];

            let taskToUpdateIndex = -1;
            if (currentTaskRow.task.id !== undefined && currentTaskRow.task.id !== null) {
                taskToUpdateIndex = latestTasks.findIndex((task) => task.id === currentTaskRow.task.id);
            }
            if (taskToUpdateIndex < 0) {
                taskToUpdateIndex = Math.min(currentTaskRow.taskIndex, latestTasks.length - 1);
            }
            if (taskToUpdateIndex < 0 || !latestTasks[taskToUpdateIndex]) {
                message.error("Impossible de trouver la tâche à mettre à jour.");
                return;
            }

            latestTasks[taskToUpdateIndex] = {
                ...latestTasks[taskToUpdateIndex],
                status: values.status,
                statusDate: values.date,
                dateDebut: values.dateDebut || latestTasks[taskToUpdateIndex].dateDebut,
                dateFin: values.dateFin || latestTasks[taskToUpdateIndex].dateFin,
                technicien: techniciens.find((technicien) => technicien.id === values.technicienId),
                incidentDate: values.status === 'INCIDENT' ? values.incidentDate : latestTasks[taskToUpdateIndex].incidentDate,
                incidentDetails: values.status === 'INCIDENT' ? values.incidentDetails : latestTasks[taskToUpdateIndex].incidentDetails
            };

            const updatedVente: VenteEntity = {
                ...latestVente,
                taches: latestTasks
            };

            const res = await axios.put(`/ventes/${venteId}`, updatedVente);
            message.success('Planning de la tâche mis a jour.');
            const savedVente = res.data as VenteEntity;
            const savedTask = (savedVente.taches || [])[taskToUpdateIndex] || latestTasks[taskToUpdateIndex];
            setCurrentTaskRow({ ...currentTaskRow, vente: savedVente, task: savedTask });
            form.setFieldsValue({
                date: toDateTimeLocalValue(savedTask.statusDate) || values.date,
                dateDebut: savedTask.dateDebut || values.dateDebut,
                dateFin: savedTask.dateFin || values.dateFin,
                status: savedTask.status || values.status,
                technicienId: savedTask.technicien?.id || values.technicienId,
                incidentDate: savedTask.incidentDate,
                incidentDetails: savedTask.incidentDetails,
            });
            fetchVentes();
        } catch (error) {
            const formError = error as { errorFields?: unknown[] };
            if (Array.isArray(formError.errorFields) && formError.errorFields.length > 0) {
                // Les erreurs de validation sont affichees par le formulaire.
                return;
            }
            if (axios.isAxiosError(error)) {
                message.error(error.response?.data?.message || "Erreur lors de la mise à jour de la tâche.");
                return;
            }
            message.error("Erreur lors de la mise à jour de la tâche.");
        } finally {
            setSaving(false);
        }
    };

    const commonColumns = [
        {
            title: 'Vente',
            dataIndex: 'id',
            render: (_: unknown, record: PendingTaskRow) => `#${record.vente.id}`
        },
        {
            title: 'Client',
            dataIndex: 'client',
            render: (_: unknown, record: PendingTaskRow) => getClientLabel(record.vente.client)
        },
        {
            title: 'Type',
            dataIndex: 'type',
            render: (_: unknown, record: PendingTaskRow) => typeOptions.find((item) => item.value === record.vente.type)?.label || record.vente.type || '-'
        },
        {
            title: 'Statut tâche',
            dataIndex: 'taskStatus',
            render: (_: unknown, record: PendingTaskRow) => {
                const status = record.task.status || 'EN_ATTENTE';
                const label = taskStatusOptions.find((item) => item.value === status)?.label || status;
                return <Tag color={statusColor[status] || 'default'}>{label}</Tag>;
            }
        },
        {
            title: 'Tâche',
            key: 'taskName',
            render: (_: unknown, record: PendingTaskRow) => record.task.nom || '(Sans nom)'
        },
        {
            title: 'Debut',
            key: 'dateDebut',
            render: (_: unknown, record: PendingTaskRow) => record.task.dateDebut ? dayjs(record.task.dateDebut).format('DD/MM/YYYY') : '-'
        },
        {
            title: 'Fin',
            key: 'dateFin',
            render: (_: unknown, record: PendingTaskRow) => record.task.dateFin ? dayjs(record.task.dateFin).format('DD/MM/YYYY') : '-'
        }
    ];

    const pendingTaskColumns = [
        ...commonColumns,
        {
            title: 'Date statut',
            key: 'statusDate',
            render: (_: unknown, record: PendingTaskRow) => toIsoDay(record.task.statusDate) || '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: PendingTaskRow) => (
                <Space>
                    <Button type="primary" icon={<CalendarOutlined />} onClick={() => openPlanningModal(record, selectedDate)}>
                        Planifier
                    </Button>
                    {record.vente.id ? (
                        <Button onClick={() => history.push(`/prestations?venteId=${record.vente.id}`)}>
                            Voir prestation
                        </Button>
                    ) : (
                        <Typography.Text type="secondary">-</Typography.Text>
                    )}
                </Space>
            )
        }
    ];

    const dayColumns = [
        ...commonColumns,
        {
            title: 'Date statut',
            key: 'statusDate',
            render: (_: unknown, record: PendingTaskRow) => toIsoDay(record.task.statusDate) || '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: PendingTaskRow) => (
                <Button icon={<EditOutlined />} onClick={() => openPlanningModal(record)}>
                    Replanifier
                </Button>
            )
        }
    ];

    return (
        <Card title="Planning">
            <Row gutter={[16, 16]}>
                <Col flex="auto">
                    <Card size="small" title="Filtres">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value || todayIso())} />
                            <Select
                                allowClear
                                options={taskStatusOptions}
                                placeholder="Tous les statuts de tâche"
                                value={selectedStatus}
                                onChange={(value) => setSelectedStatus(value)}
                                style={{ width: '100%' }}
                            />
                            <Select
                                allowClear
                                showSearch
                                options={technicienOptions}
                                placeholder="Tous les techniciens"
                                value={selectedTechnicien}
                                onChange={(value) => setSelectedTechnicien(value)}
                                style={{ width: '100%' }}
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            />
                        </Space>
                    </Card>
                </Col>
                <Col flex="auto">
                    <Card size="small" title="Synthese">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <div>
                                <Badge status="processing" /> Date: <strong>{selectedDate}</strong>
                            </div>
                            <div>
                                <Badge status="success" /> Planifiees (jour): <strong>{plannedTasks.length}</strong>
                            </div>
                            <div>
                                <Badge status="warning" /> En attente (jour): <strong>{pendingTasksForDay.length}</strong>
                            </div>
                            <div>
                                <Badge status="default" /> En attente (total): <strong>{pendingTasks.length}</strong>
                            </div>
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card size="small" title={<span>Vue semaine <Typography.Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>(glisser-deposer une tache depuis le tableau ci-dessous)</Typography.Text></span>}>
                        <style>{`
                            .planning-calendar .ant-table-tbody > tr:nth-child(-n+9),
                            .planning-calendar .ant-table-tbody > tr:nth-child(n+24) {
                                display: none;
                            }
                        `}</style>
                        <div
                            ref={calendarRef}
                            className="planning-calendar"
                            onDragOver={handleCalendarDragOver}
                            onDragLeave={handleCalendarDragLeave}
                            onDrop={handleCalendarDrop}
                            style={{
                                position: 'relative',
                                border: dragOverDay ? '2px dashed #1677ff' : '2px dashed transparent',
                                borderRadius: 8,
                                transition: 'border-color 0.2s'
                            }}
                        >
                            {dragOverDay && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    zIndex: 10,
                                    textAlign: 'center',
                                    background: 'rgba(22, 119, 255, 0.08)',
                                    padding: '4px 0',
                                    borderRadius: '8px 8px 0 0',
                                    fontWeight: 500,
                                    color: '#1677ff',
                                    pointerEvents: 'none'
                                }}>
                                    Deposer pour planifier le {dayjs(dragOverDay).format('DD/MM/YYYY')}
                                </div>
                            )}
                            <WeeklyCalendar
                                events={weeklyEvents}
                                weekends
                                onSelectDate={(date) => {
                                    setSelectedDate(dayjs(date).format('YYYY-MM-DD'));
                                    setCalendarWeekStart(dayjs(date).startOf('week'));
                                }}
                                onEventClick={(event: WeeklyCalendarEvent) => {
                                    const matchedTaskRow = allTasks.find((row) => row.key === event.eventId);
                                    if (matchedTaskRow) {
                                        openPlanningModal(matchedTaskRow);
                                    }
                                }}
                            />
                        </div>
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card title={`Planifié le ${selectedDate}`} size="small" bodyStyle={{ padding: plannedTasks.length ? 12 : 24 }}>
                        {plannedTasks.length ? (
                            <Table
                                rowKey="key"
                                loading={loading}
                                dataSource={plannedTasks}
                                columns={dayColumns}
                                pagination={{ pageSize: 8 }}
                                bordered
                            />
                        ) : (
                            <Empty description="Aucune tache planifiee pour cette date." />
                        )}
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card
                        title="A planifier (taches en attente)"
                        size="small"
                        bodyStyle={{ padding: pendingTasks.length ? 12 : 24 }}
                    >
                        {pendingTasks.length ? (
                            <Table
                                rowKey="key"
                                loading={loading}
                                dataSource={pendingTasks}
                                columns={pendingTaskColumns}
                                pagination={{ pageSize: 6 }}
                                bordered
                                onRow={(record) => ({
                                    draggable: true,
                                    style: { cursor: 'grab' },
                                    onDragStart: (e) => {
                                        draggedTaskRef.current = record;
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', record.key);
                                    },
                                    onDragEnd: () => {
                                        draggedTaskRef.current = null;
                                        setDragOverDay(null);
                                    }
                                })}
                            />
                        ) : (
                            <Empty description="Aucune tache en attente." />
                        )}
                    </Card>
                </Col>
            </Row>

            <Modal
                open={modalVisible}
                title={currentTaskRow?.task?.nom ? `Planifier la tâche: ${currentTaskRow.task.nom}` : 'Planifier la tâche'}
                onOk={handleSavePlanning}
                okText="Enregistrer"
                confirmLoading={saving}
                cancelText="Annuler"
                onCancel={() => {
                    setModalVisible(false);
                    setCurrentTaskRow(null);
                    form.resetFields();
                }}
                destroyOnHidden
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="date"
                        label="Date et heure planifiées"
                        rules={[{ required: true, message: 'La date est requise' }]}
                    >
                        <Input type="datetime-local" />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="dateDebut" label="Date de debut">
                                <Input type="date" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dateFin" label="Date de fin">
                                <Input type="date" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item
                        name="status"
                        label="Statut"
                        rules={[{ required: true, message: 'Le statut est requis' }]}
                    >
                        <Select options={taskStatusOptions} />
                    </Form.Item>
                    <Form.Item name="technicienId" label="Technicien">
                        <Select allowClear showSearch options={technicienOptions} placeholder="Selectionner un technicien" />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.status !== cur?.status}>
                        {({ getFieldValue }) => {
                            if (getFieldValue('status') !== 'INCIDENT') return null;
                            return (
                                <Card size="small" title="Incident" style={{ marginBottom: 12, borderColor: '#ff4d4f' }}>
                                    <Form.Item name="incidentDate" label="Date de l'incident">
                                        <Input type="date" />
                                    </Form.Item>
                                    <Form.Item name="incidentDetails" label="Details de l'incident">
                                        <Input.TextArea rows={3} />
                                    </Form.Item>
                                </Card>
                            );
                        }}
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
}
