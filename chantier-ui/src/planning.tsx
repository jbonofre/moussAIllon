import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Badge, Button, Card, Col, DatePicker, Empty, Form, Input, Modal, Row, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CalendarOutlined, EditOutlined, EyeOutlined, LeftOutlined, RightOutlined, WarningOutlined } from '@ant-design/icons';
import api from './api.ts';
import dayjs from 'dayjs';

type PlanningStatus = 'EN_ATTENTE' | 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'INCIDENT' | 'ANNULEE';

interface ClientEntity {
    id: number;
    prenom?: string;
    nom: string;
}

interface TechnicienEntity {
    id: number;
    prenom?: string;
    nom?: string;
    couleur?: string;
}

interface ProduitCatalogueEntity {
    id: number;
}

interface TaskEntity {
    id: number;
    nom: string;
    done: boolean;
}

interface VenteForfaitEntry {
    id?: number;
    forfait?: { id: number; nom: string; dureeEstimee?: number };
    quantite?: number;
    techniciens?: TechnicienEntity[];
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    status?: PlanningStatus;
    statusDate?: string;
    dureeReelle?: number;
    notes?: string;
    taches?: TaskEntity[];
}

interface VenteServiceEntry {
    id?: number;
    service?: { id: number; nom: string; dureeEstimee?: number };
    quantite?: number;
    techniciens?: TechnicienEntity[];
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    status?: PlanningStatus;
    statusDate?: string;
    dureeReelle?: number;
    notes?: string;
    taches?: TaskEntity[];
}

interface VenteEntity {
    id?: number;
    status: string;
    bonPourAccord?: boolean;
    client?: ClientEntity;
    bateau?: { id: number; name?: string; immatriculation?: string };
    produits?: ProduitCatalogueEntity[];
    venteForfaits?: VenteForfaitEntry[];
    venteServices?: VenteServiceEntry[];
    date?: string;
    prixVenteTTC?: number;
    modePaiement?: string;
}

interface PlanningItem {
    id?: number;
    type: 'forfait' | 'service';
    nom: string;
    techniciens?: TechnicienEntity[];
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    status?: PlanningStatus;
    statusDate?: string;
    dureeEstimee?: number;
    dureeReelle?: number;
    quantite?: number;
    venteId?: number;
    clientNom?: string;
    bateauNom?: string;
    bateauImmatriculation?: string;
    taches?: TaskEntity[];
}

interface PlanningFormValues {
    date: string;
    dateDebut?: string;
    dateFin?: string;
    dureeReelle?: number;
    status: PlanningStatus;
    technicienIds?: number[];
    incidentDate?: string;
    incidentDetails?: string;
}

interface CalendarEvent {
    eventId: string;
    startTime: Date;
    title: string;
    backgroundColor?: string;
    textColor?: string;
    dureeEstimee?: number;
    bateauNom?: string;
    bateauImmatriculation?: string;
    clientNom?: string;
    forfaitServiceNom?: string;
    status?: PlanningStatus;
    progressPct?: number;
}

interface PlanningItemRow {
    key: string;
    vente: VenteEntity;
    item: PlanningItem;
    itemType: 'forfait' | 'service';
    itemIndex: number;
}

const statusOptions: Array<{ value: PlanningStatus; label: string }> = [
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'PLANIFIEE', label: 'Planifiee' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'TERMINEE', label: 'Terminee' },
    { value: 'INCIDENT', label: 'Incident' },
    { value: 'ANNULEE', label: 'Annulee' }
];


const statusColor: Record<PlanningStatus, string> = {
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

const toDayjs = (value?: string) => {
    if (!value) {
        return undefined;
    }
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed : undefined;
};

const getTechnicienColor = (techniciens?: TechnicienEntity[]) => {
    const technicien = techniciens?.[0];
    if (!technicien?.id) {
        return '#8c8c8c';
    }
    if (technicien.couleur) {
        return technicien.couleur;
    }
    const index = Math.abs(technicien.id) % technicienPalette.length;
    return technicienPalette[index];
};

const buildPlanningItems = (ventes: VenteEntity[]): PlanningItemRow[] => {
    const rows: PlanningItemRow[] = [];
    for (const vente of ventes) {
        const clientNom = vente.client ? `${vente.client.prenom || ''} ${vente.client.nom}`.trim() : '';
        const bateauNom = vente.bateau?.name;
        const bateauImmatriculation = vente.bateau?.immatriculation;

        for (let i = 0; i < (vente.venteForfaits || []).length; i++) {
            const vf = vente.venteForfaits![i];
            const item: PlanningItem = {
                id: vf.id,
                type: 'forfait',
                nom: vf.forfait?.nom || '',
                techniciens: vf.techniciens,
                datePlanification: vf.datePlanification,
                dateDebut: vf.dateDebut,
                dateFin: vf.dateFin,
                status: vf.status,
                statusDate: vf.statusDate,
                dureeEstimee: vf.forfait?.dureeEstimee,
                dureeReelle: vf.dureeReelle,
                quantite: vf.quantite,
                venteId: vente.id,
                clientNom,
                bateauNom,
                bateauImmatriculation,
                taches: vf.taches,
            };
            rows.push({
                key: `vf-${vente.id}-${vf.id || i}-${i}`,
                vente,
                item,
                itemType: 'forfait',
                itemIndex: i,
            });
        }

        for (let i = 0; i < (vente.venteServices || []).length; i++) {
            const vs = vente.venteServices![i];
            const item: PlanningItem = {
                id: vs.id,
                type: 'service',
                nom: vs.service?.nom || '',
                techniciens: vs.techniciens,
                datePlanification: vs.datePlanification,
                dateDebut: vs.dateDebut,
                dateFin: vs.dateFin,
                status: vs.status,
                statusDate: vs.statusDate,
                dureeEstimee: vs.service?.dureeEstimee,
                dureeReelle: vs.dureeReelle,
                quantite: vs.quantite,
                venteId: vente.id,
                clientNom,
                bateauNom,
                bateauImmatriculation,
                taches: vs.taches,
            };
            rows.push({
                key: `vs-${vente.id}-${vs.id || i}-${i}`,
                vente,
                item,
                itemType: 'service',
                itemIndex: i,
            });
        }
    }
    return rows;
};

export default function Planning() {
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [techniciens, setTechniciens] = useState<TechnicienEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedWeekStart, setSelectedWeekStart] = useState(() => dayjs().startOf('week'));
    const [selectedDate, setSelectedDate] = useState(todayIso());
    const [selectedStatus, setSelectedStatus] = useState<PlanningStatus | undefined>(undefined);
    const [selectedTechnicien, setSelectedTechnicien] = useState<number | undefined>(undefined);
    const [modalVisible, setModalVisible] = useState(false);
    const [formDirty, setFormDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentRow, setCurrentRow] = useState<PlanningItemRow | null>(null);
    const [form] = Form.useForm<PlanningFormValues>();
    const draggedRowRef = useRef<PlanningItemRow | null>(null);
    const [dragOverDay, setDragOverDay] = useState<string | null>(null);
    const [prestationModalVisible, setPrestationModalVisible] = useState(false);
    const [prestationVente, setPrestationVente] = useState<VenteEntity | null>(null);
    const [prestationLoading, setPrestationLoading] = useState(false);

    const openPrestationModal = async (venteId: number) => {
        setPrestationModalVisible(true);
        setPrestationLoading(true);
        try {
            const res = await api.get(`/ventes/${venteId}`);
            setPrestationVente(res.data);
        } catch {
            message.error('Erreur lors du chargement de la prestation.');
        } finally {
            setPrestationLoading(false);
        }
    };
    const fetchVentes = async () => {
        setLoading(true);
        try {
            const response = await api.get('/ventes');
            setVentes(response.data || []);
        } catch {
            message.error('Erreur lors du chargement du planning.');
        } finally {
            setLoading(false);
        }
    };

    const fetchTechniciens = async () => {
        try {
            const response = await api.get('/techniciens');
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

    const openPlanningModal = (row: PlanningItemRow, forcedDate?: string) => {
        if (!row.vente.bonPourAccord) {
            message.warning('Le bon pour accord est requis avant de planifier les interventions');
            return;
        }
        setCurrentRow(row);
        form.setFieldsValue({
            date:
                toDayjs(row.item.statusDate)
                || (forcedDate ? dayjs(`${forcedDate}T08:00`) : undefined)
                || dayjs(`${selectedDate || todayIso()}T08:00`),
            dateDebut: toDayjs(row.item.dateDebut),
            dateFin: toDayjs(row.item.dateFin),
            dureeReelle: row.item.dureeReelle,
            status: row.item.status === 'EN_ATTENTE' ? 'PLANIFIEE' : (row.item.status || 'PLANIFIEE'),
            technicienIds: (row.item.techniciens || []).map(t => t.id),
        });
        setFormDirty(false);
        setModalVisible(true);
    };

    const handleModalCancel = () => {
        if (formDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setFormDirty(false);
                    setModalVisible(false);
                    setCurrentRow(null);
                    form.resetFields();
                },
            });
        } else {
            setModalVisible(false);
            setCurrentRow(null);
            form.resetFields();
        }
    };


    const allItems = useMemo<PlanningItemRow[]>(
        () => buildPlanningItems(ventes),
        [ventes]
    );

    const matchesTechnicien = (row: PlanningItemRow) =>
        !selectedTechnicien || (row.item.techniciens || []).some(t => t.id === selectedTechnicien);

    const pendingItems = useMemo<PlanningItemRow[]>(
        () =>
            allItems
                .filter((row) => !row.item.status || row.item.status === 'EN_ATTENTE')
                .filter((row) => !selectedStatus || row.item.status === selectedStatus)
                .filter(matchesTechnicien),
        [allItems, selectedStatus, selectedTechnicien]
    );

    const pendingItemsForDay = useMemo<PlanningItemRow[]>(
        () => pendingItems.filter((row) => toIsoDay(row.item.statusDate) === selectedDate),
        [pendingItems, selectedDate]
    );

    const plannedItems = useMemo<PlanningItemRow[]>(
        () =>
            allItems
                .filter((row) => row.item.status === 'PLANIFIEE' || row.item.status === 'EN_COURS')
                .filter((row) => (toIsoDay(row.item.statusDate) || toIsoDay(row.item.datePlanification)) === selectedDate)
                .filter((row) => !selectedStatus || row.item.status === selectedStatus)
                .filter(matchesTechnicien),
        [allItems, selectedDate, selectedStatus, selectedTechnicien]
    );

    const lateItems = useMemo<PlanningItemRow[]>(
        () => {
            const now = dayjs();
            return allItems
                .filter((row) => row.item.status === 'PLANIFIEE' || row.item.status === 'EN_COURS')
                .filter((row) => {
                    const planned = row.item.statusDate ? dayjs(row.item.statusDate) : null;
                    return planned && planned.isValid() && planned.isBefore(now);
                })
                .filter(matchesTechnicien);
        },
        [allItems, selectedTechnicien]
    );

    const enCoursItems = useMemo<PlanningItemRow[]>(
        () =>
            allItems
                .filter((row) => row.item.status === 'EN_COURS')
                .filter(matchesTechnicien),
        [allItems, selectedTechnicien]
    );

    const termineeItems = useMemo<PlanningItemRow[]>(
        () =>
            allItems
                .filter((row) => row.item.status === 'TERMINEE')
                .filter(matchesTechnicien),
        [allItems, selectedTechnicien]
    );

    const calendarEvents = useMemo<CalendarEvent[]>(
        () =>
            allItems
                .filter((row) => row.item.status === 'PLANIFIEE' || row.item.status === 'EN_COURS')
                .filter(matchesTechnicien)
                .map((row) => {
                    const { vente, item } = row;
                    const startSource = item.dateDebut || item.statusDate || vente.date;
                    if (!startSource) {
                        return null;
                    }
                    const startDate = dayjs(startSource);
                    if (!startDate.isValid()) {
                        return null;
                    }

                    const typeLabel = item.type === 'forfait' ? 'Forfait' : 'Service';
                    const taches = item.taches || [];
                    const totalTaches = taches.length;
                    const doneTaches = taches.filter((t) => t.done).length;
                    const progressPct = totalTaches > 0 ? Math.round((doneTaches / totalTaches) * 100) : undefined;

                    return {
                        eventId: row.key,
                        startTime: startDate.toDate(),
                        title: `[${typeLabel}] ${item.nom || 'Sans nom'} (${getClientLabel(vente.client)})`,
                        backgroundColor: getTechnicienColor(item.techniciens),
                        textColor: '#ffffff',
                        dureeEstimee: item.dureeEstimee,
                        bateauNom: item.bateauNom,
                        bateauImmatriculation: item.bateauImmatriculation,
                        clientNom: item.clientNom,
                        forfaitServiceNom: item.nom,
                        status: item.status,
                        progressPct,
                    } as CalendarEvent;
                })
                .filter(Boolean) as CalendarEvent[],
        [allItems, selectedTechnicien]
    );

    const HOUR_START = 7;
    const HOUR_END = 19;
    const TOTAL_HOURS = HOUR_END - HOUR_START;

    const weekDays = useMemo(() => {
        const days: dayjs.Dayjs[] = [];
        for (let i = 0; i < 7; i++) {
            days.push(selectedWeekStart.add(i, 'day'));
        }
        return days;
    }, [selectedWeekStart]);

    const weekLabel = useMemo(() => {
        const end = selectedWeekStart.add(6, 'day');
        return `${selectedWeekStart.format('DD MMM')} – ${end.format('DD MMM YYYY')}`;
    }, [selectedWeekStart]);

    const weekEvents = useMemo(() => {
        const weekEnd = selectedWeekStart.add(7, 'day');
        return calendarEvents.filter((ev) => {
            const d = dayjs(ev.startTime);
            return d.isAfter(selectedWeekStart.subtract(1, 'day')) && d.isBefore(weekEnd);
        });
    }, [calendarEvents, selectedWeekStart]);

    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    const handleSavePlanning = async () => {
        if (!currentRow?.vente?.id) {
            return;
        }
        try {
            const values = await form.validateFields();
            setSaving(true);
            const venteId = currentRow.vente.id;
            const latestVenteResponse = await api.get(`/ventes/${venteId}`);
            const latestVente = (latestVenteResponse.data || currentRow.vente) as VenteEntity;

            const listKey = currentRow.itemType === 'forfait' ? 'venteForfaits' : 'venteServices';
            const latestList = [...(latestVente[listKey] || [])];

            let itemToUpdateIndex = -1;
            if (currentRow.item.id !== undefined && currentRow.item.id !== null) {
                itemToUpdateIndex = latestList.findIndex((entry: VenteForfaitEntry | VenteServiceEntry) => entry.id === currentRow.item.id);
            }
            if (itemToUpdateIndex < 0) {
                itemToUpdateIndex = Math.min(currentRow.itemIndex, latestList.length - 1);
            }
            if (itemToUpdateIndex < 0 || !latestList[itemToUpdateIndex]) {
                message.error("Impossible de trouver l'element a mettre a jour.");
                return;
            }

            latestList[itemToUpdateIndex] = {
                ...latestList[itemToUpdateIndex],
                status: values.status,
                statusDate: dayjs.isDayjs(values.date) ? values.date.format('YYYY-MM-DDTHH:mm') : values.date,
                dateDebut: (dayjs.isDayjs(values.dateDebut) ? values.dateDebut.format('YYYY-MM-DDTHH:mm') : values.dateDebut) || latestList[itemToUpdateIndex].dateDebut,
                dateFin: (dayjs.isDayjs(values.dateFin) ? values.dateFin.format('YYYY-MM-DDTHH:mm') : values.dateFin) || latestList[itemToUpdateIndex].dateFin,
                dureeReelle: values.dureeReelle,
                techniciens: (values.technicienIds || []).map((id: number) => techniciens.find((t) => t.id === id)).filter(Boolean) as TechnicienEntity[],
            };

            const updatedVente: VenteEntity = {
                ...latestVente,
                [listKey]: latestList
            };

            const res = await api.put(`/ventes/${venteId}`, updatedVente);
            message.success('Planning mis a jour.');
            setFormDirty(false);
            const savedVente = res.data as VenteEntity;
            const savedList = savedVente[listKey] || [];
            const savedEntry = savedList[itemToUpdateIndex] || latestList[itemToUpdateIndex];

            const clientNom = savedVente.client ? `${savedVente.client.prenom || ''} ${savedVente.client.nom}`.trim() : '';
            const bateauNom = savedVente.bateau?.name;
            const bateauImmatriculation = savedVente.bateau?.immatriculation;
            const savedItem: PlanningItem = currentRow.itemType === 'forfait'
                ? {
                    id: (savedEntry as VenteForfaitEntry).id,
                    type: 'forfait',
                    nom: (savedEntry as VenteForfaitEntry).forfait?.nom || '',
                    techniciens: savedEntry.techniciens,
                    datePlanification: savedEntry.datePlanification,
                    dateDebut: savedEntry.dateDebut,
                    dateFin: savedEntry.dateFin,
                    status: savedEntry.status,
                    statusDate: savedEntry.statusDate,
                    dureeEstimee: (savedEntry as VenteForfaitEntry).forfait?.dureeEstimee,
                    dureeReelle: savedEntry.dureeReelle,
                    quantite: savedEntry.quantite,
                    venteId: savedVente.id,
                    clientNom,
                    bateauNom,
                    bateauImmatriculation,
                    taches: (savedEntry as VenteForfaitEntry).taches,
                }
                : {
                    id: (savedEntry as VenteServiceEntry).id,
                    type: 'service',
                    nom: (savedEntry as VenteServiceEntry).service?.nom || '',
                    techniciens: savedEntry.techniciens,
                    datePlanification: savedEntry.datePlanification,
                    dateDebut: savedEntry.dateDebut,
                    dateFin: savedEntry.dateFin,
                    status: savedEntry.status,
                    statusDate: savedEntry.statusDate,
                    dureeEstimee: (savedEntry as VenteServiceEntry).service?.dureeEstimee,
                    dureeReelle: savedEntry.dureeReelle,
                    quantite: savedEntry.quantite,
                    venteId: savedVente.id,
                    clientNom,
                    bateauNom,
                    bateauImmatriculation,
                    taches: (savedEntry as VenteServiceEntry).taches,
                };

            setCurrentRow({ ...currentRow, vente: savedVente, item: savedItem });
            form.setFieldsValue({
                date: toDayjs(savedEntry.statusDate) || values.date,
                dateDebut: toDayjs(savedEntry.dateDebut) || values.dateDebut,
                dateFin: toDayjs(savedEntry.dateFin) || values.dateFin,
                dureeReelle: savedEntry.dureeReelle ?? values.dureeReelle,
                status: savedEntry.status || values.status,
                technicienIds: (savedEntry.techniciens || []).map((t: TechnicienEntity) => t.id),
            });
            fetchVentes();
        } catch (error) {
            const formError = error as { errorFields?: unknown[] };
            if (Array.isArray(formError.errorFields) && formError.errorFields.length > 0) {
                return;
            }
            if (api.isAxiosError(error)) {
                message.error(error.response?.data?.message || "Erreur lors de la mise a jour.");
                return;
            }
            message.error("Erreur lors de la mise a jour.");
        } finally {
            setSaving(false);
        }
    };

    const commonColumns = [
        {
            title: 'Bateau',
            key: 'bateau',
            render: (_: unknown, record: PlanningItemRow) => record.item.bateauNom || '-'
        },
        {
            title: 'Client',
            dataIndex: 'client',
            render: (_: unknown, record: PlanningItemRow) => getClientLabel(record.vente.client)
        },
        {
            title: 'Type',
            key: 'itemType',
            render: (_: unknown, record: PlanningItemRow) => (
                <Tag color={record.item.type === 'forfait' ? 'purple' : 'geekblue'}>
                    {record.item.type === 'forfait' ? 'Forfait' : 'Service'}
                </Tag>
            )
        },
        {
            title: 'Statut',
            dataIndex: 'itemStatus',
            render: (_: unknown, record: PlanningItemRow) => {
                const status = record.item.status || 'EN_ATTENTE';
                const label = statusOptions.find((item) => item.value === status)?.label || status;
                return <Tag color={statusColor[status] || 'default'}>{label}</Tag>;
            }
        },
        {
            title: 'Nom',
            key: 'itemName',
            render: (_: unknown, record: PlanningItemRow) => record.item.nom || '(Sans nom)'
        },
        {
            title: 'Debut',
            key: 'dateDebut',
            render: (_: unknown, record: PlanningItemRow) => record.item.dateDebut ? dayjs(record.item.dateDebut).format('DD/MM/YYYY HH:mm') : '-'
        },
        {
            title: 'Fin',
            key: 'dateFin',
            render: (_: unknown, record: PlanningItemRow) => record.item.dateFin ? dayjs(record.item.dateFin).format('DD/MM/YYYY HH:mm') : '-'
        },
        {
            title: 'Durée',
            key: 'duree',
            render: (_: unknown, record: PlanningItemRow) => {
                const estimee = record.item.dureeEstimee;
                const reelle = record.item.dureeReelle;
                const overrun = estimee != null && reelle != null && reelle > estimee;
                return (
                    <span style={overrun ? { color: '#fa541c', fontWeight: 600 } : undefined}>
                        {reelle != null ? `${reelle}h` : '-'} / {estimee != null ? `${estimee}h` : '-'}
                        {overrun && <WarningOutlined style={{ marginLeft: 6, color: '#fa541c' }} title="Durée réelle supérieure à la durée estimée" />}
                    </span>
                );
            }
        }
    ];

    const pendingColumns = [
        ...commonColumns,
        {
            title: 'Date statut',
            key: 'statusDate',
            render: (_: unknown, record: PlanningItemRow) => toIsoDay(record.item.statusDate) || '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: PlanningItemRow) => (
                <Space>
                    <Tooltip title={!record.vente.bonPourAccord ? 'Le bon pour accord est requis' : undefined}>
                        <Button type="primary" icon={<CalendarOutlined />} disabled={!record.vente.bonPourAccord} onClick={() => openPlanningModal(record, selectedDate)}>
                            Planifier
                        </Button>
                    </Tooltip>
                    {record.vente.id ? (
                        <Button icon={<EyeOutlined />} onClick={() => openPrestationModal(record.vente.id!)}>
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
            render: (_: unknown, record: PlanningItemRow) => toIsoDay(record.item.statusDate) || '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: PlanningItemRow) => (
                <Space>
                    <Tooltip title={!record.vente.bonPourAccord ? 'Le bon pour accord est requis' : undefined}>
                        <Button icon={<EditOutlined />} disabled={!record.vente.bonPourAccord} onClick={() => openPlanningModal(record)}>
                            Replanifier
                        </Button>
                    </Tooltip>
                    {record.vente.id && (
                        <Button icon={<EyeOutlined />} onClick={() => openPrestationModal(record.vente.id!)}>
                            Voir prestation
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <Card title="Planning">
            <Row gutter={[16, 16]}>
                <Col flex="auto">
                    <Card size="small" title="Filtres">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Select
                                allowClear
                                options={statusOptions}
                                placeholder="Tous les statuts"
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
                                <Badge status="processing" /> Semaine: <strong>{weekLabel}</strong>
                            </div>
                            <div>
                                <Badge status="success" /> Planifiées (semaine): <strong>{weekEvents.length}</strong>
                            </div>
                            <div>
                                <Badge status="warning" /> En attente (jour): <strong>{pendingItemsForDay.length}</strong>
                            </div>
                            <div>
                                <Badge status="default" /> En attente (total): <strong>{pendingItems.length}</strong>
                            </div>
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card
                        size="small"
                        title={
                            <Space>
                                <Button icon={<LeftOutlined />} size="small" onClick={() => setSelectedWeekStart(selectedWeekStart.subtract(1, 'week'))} />
                                <Button size="small" onClick={() => { setSelectedWeekStart(dayjs().startOf('week')); setSelectedDate(todayIso()); }}>
                                    Aujourd'hui
                                </Button>
                                <Button icon={<RightOutlined />} size="small" onClick={() => setSelectedWeekStart(selectedWeekStart.add(1, 'week'))} />
                                <span style={{ marginLeft: 8, fontWeight: 600 }}>{weekLabel}</span>
                            </Space>
                        }
                    >
                        <div style={{ overflowX: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${TOTAL_HOURS}, 1fr)`, minWidth: TOTAL_HOURS * 80 + 80 }}>
                                {/* Header row: hours */}
                                <div style={{ borderBottom: '2px solid #d9d9d9', padding: '4px 8px', fontWeight: 600, background: '#fafafa' }} />
                                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                                    <div
                                        key={`h-${i}`}
                                        style={{
                                            borderBottom: '2px solid #d9d9d9',
                                            borderLeft: '1px solid #f0f0f0',
                                            padding: '4px 4px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            textAlign: 'center',
                                            background: '#fafafa',
                                        }}
                                    >
                                        {HOUR_START + i}h
                                    </div>
                                ))}

                                {/* Day rows */}
                                {weekDays.map((day) => {
                                    const dayStr = day.format('YYYY-MM-DD');
                                    const isToday = dayStr === todayIso();
                                    const isSelected = dayStr === selectedDate;
                                    const dayEvts = weekEvents.filter((ev) => dayjs(ev.startTime).format('YYYY-MM-DD') === dayStr);

                                    return (
                                        <React.Fragment key={dayStr}>
                                            {/* Day label */}
                                            <div
                                                style={{
                                                    borderBottom: '1px solid #f0f0f0',
                                                    padding: '8px 8px',
                                                    fontWeight: isToday ? 700 : 400,
                                                    background: isToday ? '#e6f4ff' : isSelected ? '#f0f5ff' : undefined,
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                }}
                                                onClick={() => setSelectedDate(dayStr)}
                                            >
                                                <div>{dayNames[day.day()]}</div>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{day.format('DD/MM')}</div>
                                            </div>
                                            {/* Timeline cells */}
                                            <div
                                                style={{
                                                    gridColumn: `2 / -1`,
                                                    borderBottom: '1px solid #f0f0f0',
                                                    position: 'relative',
                                                    minHeight: Math.max(80, dayEvts.length * 28 + 16),
                                                    background: isToday ? '#e6f4ff' : isSelected ? '#f0f5ff' : undefined,
                                                }}
                                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDay(dayStr); }}
                                                onDragLeave={() => setDragOverDay(null)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setDragOverDay(null);
                                                    const row = draggedRowRef.current;
                                                    draggedRowRef.current = null;
                                                    if (row) openPlanningModal(row, dayStr);
                                                }}
                                            >
                                                {/* Vertical grid lines */}
                                                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                                                    <div
                                                        key={`g-${i}`}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${(i / TOTAL_HOURS) * 100}%`,
                                                            top: 0,
                                                            bottom: 0,
                                                            width: 1,
                                                            background: '#f0f0f0',
                                                        }}
                                                    />
                                                ))}
                                                {/* Drop highlight */}
                                                {dragOverDay === dayStr && (
                                                    <div style={{ position: 'absolute', inset: 0, border: '2px dashed #1677ff', borderRadius: 4, pointerEvents: 'none', zIndex: 5 }} />
                                                )}
                                                {/* Events */}
                                                {dayEvts.map((ev, idx) => {
                                                    const start = dayjs(ev.startTime);
                                                    const startHour = start.hour() + start.minute() / 60;
                                                    const duration = ev.dureeEstimee || 1;
                                                    const leftPct = Math.max(0, ((startHour - HOUR_START) / TOTAL_HOURS) * 100);
                                                    const widthPct = Math.min((duration / TOTAL_HOURS) * 100, 100 - leftPct);
                                                    const statusLabel = ev.status ? statusOptions.find((s) => s.value === ev.status)?.label || ev.status : '';
                                                    const tooltipContent = (
                                                        <div style={{ fontSize: 12, lineHeight: '18px' }}>
                                                            <div><strong>{ev.bateauNom || '-'}</strong>{ev.bateauImmatriculation ? ` (${ev.bateauImmatriculation})` : ''}</div>
                                                            <div>Client : {ev.clientNom || '-'}</div>
                                                            <div>{ev.forfaitServiceNom || '-'}</div>
                                                            <div>Statut : {statusLabel} {ev.progressPct !== undefined ? `— ${ev.progressPct}%` : ''}</div>
                                                            <div>{start.format('HH:mm')} — {duration}h</div>
                                                        </div>
                                                    );

                                                    return (
                                                        <Tooltip key={ev.eventId} title={tooltipContent}>
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const matchedRow = allItems.find((r) => r.key === ev.eventId);
                                                                    if (matchedRow) openPlanningModal(matchedRow);
                                                                }}
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 4 + idx * 28,
                                                                    left: `${leftPct}%`,
                                                                    width: `${Math.max(widthPct, 2)}%`,
                                                                    height: 24,
                                                                    background: ev.backgroundColor || '#1677ff',
                                                                    color: ev.textColor || '#fff',
                                                                    borderRadius: 4,
                                                                    padding: '2px 6px',
                                                                    fontSize: 11,
                                                                    lineHeight: '20px',
                                                                    cursor: 'pointer',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    zIndex: 2,
                                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                                }}
                                                            >
                                                                {ev.bateauNom || ev.forfaitServiceNom || '-'}{ev.progressPct !== undefined ? ` (${ev.progressPct}%)` : ''}
                                                            </div>
                                                        </Tooltip>
                                                    );
                                                })}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>

            {lateItems.length > 0 && (
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col span={24}>
                        <Card
                            size="small"
                            title={
                                <span style={{ color: '#fa541c' }}>
                                    <WarningOutlined /> En retard ({lateItems.length})
                                </span>
                            }
                            bodyStyle={{ padding: 12 }}
                            style={{ borderColor: '#fa541c' }}
                        >
                            <Table
                                rowKey="key"
                                loading={loading}
                                dataSource={lateItems}
                                columns={dayColumns}
                                pagination={{ pageSize: 6 }}
                                bordered
                            />
                        </Card>
                    </Col>
                </Row>
            )}

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card
                        size="small"
                        title={<span style={{ color: '#1677ff' }}>Tâches en cours ({enCoursItems.length})</span>}
                        bodyStyle={{ padding: enCoursItems.length ? 12 : 24 }}
                    >
                        {enCoursItems.length ? (
                            <Table
                                rowKey="key"
                                loading={loading}
                                dataSource={enCoursItems}
                                columns={dayColumns}
                                pagination={{ pageSize: 6 }}
                                bordered
                            />
                        ) : (
                            <Empty description="Aucune tâche en cours." />
                        )}
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card title={`Planifie le ${selectedDate}`} size="small" bodyStyle={{ padding: plannedItems.length ? 12 : 24 }}>
                        {plannedItems.length ? (
                            <Table
                                rowKey="key"
                                loading={loading}
                                dataSource={plannedItems}
                                columns={dayColumns}
                                pagination={{ pageSize: 8 }}
                                bordered
                            />
                        ) : (
                            <Empty description="Aucun element planifie pour cette date." />
                        )}
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card
                        title="A planifier (en attente)"
                        size="small"
                        bodyStyle={{ padding: pendingItems.length ? 12 : 24 }}
                    >
                        {pendingItems.length ? (
                            <Table
                                rowKey="key"
                                loading={loading}
                                dataSource={pendingItems}
                                columns={pendingColumns}
                                pagination={{ pageSize: 6 }}
                                bordered
                                onRow={(record) => ({
                                    draggable: true,
                                    style: { cursor: 'grab' },
                                    onDragStart: (e) => {
                                        draggedRowRef.current = record;
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', record.key);
                                    },
                                    onDragEnd: () => {
                                        draggedRowRef.current = null;
                                        setDragOverDay(null);
                                    }
                                })}
                            />
                        ) : (
                            <Empty description="Aucun element en attente." />
                        )}
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Card
                        size="small"
                        title={<span style={{ color: '#52c41a' }}>Terminées ({termineeItems.length})</span>}
                        bodyStyle={{ padding: termineeItems.length ? 12 : 24 }}
                    >
                        {termineeItems.length ? (
                            <Table
                                rowKey="key"
                                loading={loading}
                                dataSource={termineeItems}
                                columns={[
                                    ...commonColumns,
                                    {
                                        title: 'Techniciens',
                                        key: 'techniciens',
                                        render: (_: unknown, record: PlanningItemRow) => {
                                            const ts = record.item.techniciens || [];
                                            return ts.length > 0
                                                ? ts.map(t => `${t.prenom || ''} ${t.nom || ''}`.trim() || `#${t.id}`).join(', ')
                                                : '-';
                                        }
                                    },
                                    {
                                        title: 'Actions',
                                        key: 'actions',
                                        render: (_: unknown, record: PlanningItemRow) => record.vente.id ? (
                                            <Button onClick={() => openPrestationModal(record.vente.id!)}>
                                                Voir prestation
                                            </Button>
                                        ) : null
                                    }
                                ]}
                                pagination={{ pageSize: 8 }}
                                bordered
                            />
                        ) : (
                            <Empty description="Aucune tâche terminée." />
                        )}
                    </Card>
                </Col>
            </Row>

            <Modal
                open={modalVisible}
                title={currentRow?.item?.nom ? `Planifier: ${currentRow.item.nom}` : 'Planifier'}
                onOk={handleSavePlanning}
                okText="Enregistrer"
                confirmLoading={saving}
                cancelText="Fermer"
                width={720}
                onCancel={handleModalCancel}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onValuesChange={() => setFormDirty(true)}>
                    <Form.Item
                        name="date"
                        label="Date et heure planifiees"
                        rules={[{ required: true, message: 'La date est requise' }]}
                    >
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                        name="status"
                        label="Statut"
                        rules={[{ required: true, message: 'Le statut est requis' }]}
                    >
                        <Select options={statusOptions} />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="dateDebut" label="Date de début">
                                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} disabled />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dateFin" label="Date de fin">
                                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} disabled />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="dureeReelle" label="Durée réelle (heures)">
                        <Input type="number" min={0} step={0.5} disabled />
                    </Form.Item>
                    <Form.Item name="technicienIds" label="Techniciens" rules={[{ required: true, message: 'Au moins un technicien est requis' }]}>
                        <Select mode="multiple" showSearch options={technicienOptions} placeholder="Selectionner des techniciens" />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.status !== cur?.status}>
                        {({ getFieldValue }) => {
                            if (getFieldValue('status') !== 'INCIDENT') return null;
                            return (
                                <Card size="small" title="Incident" style={{ marginBottom: 12, borderColor: '#ff4d4f' }}>
                                    <Form.Item name="incidentDate" label="Date de l'incident">
                                        <DatePicker style={{ width: '100%' }} />
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

            <Modal
                open={prestationModalVisible}
                title={prestationVente ? `Prestation #${prestationVente.id}` : 'Prestation'}
                footer={<Button onClick={() => { setPrestationModalVisible(false); setPrestationVente(null); }}>Fermer</Button>}
                onCancel={() => { setPrestationModalVisible(false); setPrestationVente(null); }}
                destroyOnHidden
                width={800}
            >
                {prestationLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>Chargement...</div>
                ) : prestationVente ? (
                    <div>
                        <Card size="small" style={{ marginBottom: 12 }}>
                            <Row gutter={16}>
                                <Col span={8}><strong>Statut:</strong> {prestationVente.status || '-'}</Col>
                                <Col span={8}><strong>Bon pour accord:</strong> {prestationVente.bonPourAccord ? 'Oui' : 'Non'}</Col>
                                <Col span={8}><strong>Date:</strong> {prestationVente.date ? dayjs(prestationVente.date).format('DD/MM/YYYY') : '-'}</Col>
                            </Row>
                            <Row gutter={16} style={{ marginTop: 8 }}>
                                <Col span={8}><strong>Client:</strong> {getClientLabel(prestationVente.client)}</Col>
                                <Col span={8}><strong>Bateau:</strong> {prestationVente.bateau?.name || '-'}</Col>
                                <Col span={8}><strong>Prix TTC:</strong> {prestationVente.prixVenteTTC != null ? `${prestationVente.prixVenteTTC} €` : '-'}</Col>
                            </Row>
                        </Card>
                        {prestationVente.venteForfaits && prestationVente.venteForfaits.length > 0 && (
                            <Card size="small" title="Forfaits" style={{ marginBottom: 12 }}>
                                <Table
                                    rowKey={(_, i) => `f-${i}`}
                                    dataSource={prestationVente.venteForfaits}
                                    pagination={false}
                                    size="small"
                                    columns={[
                                        { title: 'Nom', render: (_: unknown, r: VenteForfaitEntry) => r.forfait?.nom || '-' },
                                        { title: 'Quantité', dataIndex: 'quantite', render: (v: number) => v ?? '-' },
                                        { title: 'Statut', dataIndex: 'status', render: (v: string) => v ? <Tag color={statusColor[v as PlanningStatus] || 'default'}>{statusOptions.find((s) => s.value === v)?.label || v}</Tag> : '-' },
                                        { title: 'Techniciens', render: (_: unknown, r: VenteForfaitEntry) => (r.techniciens || []).length > 0 ? r.techniciens!.map(t => `${t.prenom || ''} ${t.nom || ''}`.trim()).join(', ') : '-' },
                                        { title: 'Durée est.', render: (_: unknown, r: VenteForfaitEntry) => r.forfait?.dureeEstimee ? `${r.forfait.dureeEstimee}h` : '-' },
                                        { title: 'Durée réelle', dataIndex: 'dureeReelle', render: (v: number) => v ? `${v}h` : '-' },
                                    ]}
                                />
                            </Card>
                        )}
                        {prestationVente.venteServices && prestationVente.venteServices.length > 0 && (
                            <Card size="small" title="Services" style={{ marginBottom: 12 }}>
                                <Table
                                    rowKey={(_, i) => `s-${i}`}
                                    dataSource={prestationVente.venteServices}
                                    pagination={false}
                                    size="small"
                                    columns={[
                                        { title: 'Nom', render: (_: unknown, r: VenteServiceEntry) => r.service?.nom || '-' },
                                        { title: 'Quantité', dataIndex: 'quantite', render: (v: number) => v ?? '-' },
                                        { title: 'Statut', dataIndex: 'status', render: (v: string) => v ? <Tag color={statusColor[v as PlanningStatus] || 'default'}>{statusOptions.find((s) => s.value === v)?.label || v}</Tag> : '-' },
                                        { title: 'Techniciens', render: (_: unknown, r: VenteServiceEntry) => (r.techniciens || []).length > 0 ? r.techniciens!.map(t => `${t.prenom || ''} ${t.nom || ''}`.trim()).join(', ') : '-' },
                                        { title: 'Durée est.', render: (_: unknown, r: VenteServiceEntry) => r.service?.dureeEstimee ? `${r.service.dureeEstimee}h` : '-' },
                                        { title: 'Durée réelle', dataIndex: 'dureeReelle', render: (v: number) => v ? `${v}h` : '-' },
                                    ]}
                                />
                            </Card>
                        )}
                    </div>
                ) : null}
            </Modal>
        </Card>
    );
}
