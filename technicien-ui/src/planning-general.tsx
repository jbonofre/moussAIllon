import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, Select, Space, Spin, Tag, Tooltip, message } from 'antd';
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from './api.ts';

interface GeneralTechnicien {
    id: number;
    prenom?: string;
    nom?: string;
    couleur?: string;
}

interface GeneralItem {
    itemId?: number;
    venteId?: number;
    itemType?: string;
    itemNom?: string;
    itemStatus?: string;
    dateDebut?: string;
    statusDate?: string;
    dureePlanifiee?: number;
    dureeEstimee?: number;
    clientNom?: string;
    bateauNom?: string;
    bateauImmatriculation?: string;
    tachesTotal?: number;
    tachesFaites?: number;
    techniciens?: GeneralTechnicien[];
}

interface CalendarEvent {
    eventId: string;
    start: dayjs.Dayjs;
    duration: number;
    item: GeneralItem;
    technicien?: GeneralTechnicien;
}

interface PlanningGeneralProps {
    technicienId?: number;
    compact?: boolean;
}

const HOUR_START = 7;
const HOUR_END = 19;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const STATUS_LABELS: Record<string, string> = { PLANIFIEE: 'Planifiee', EN_COURS: 'En cours' };
const PALETTE = ['#1677ff', '#13c2c2', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#fa541c', '#2f54eb'];

const technicienColor = (t?: GeneralTechnicien) => {
    if (!t?.id) return '#8c8c8c';
    return t.couleur || PALETTE[Math.abs(t.id) % PALETTE.length];
};

const technicienLabel = (t?: GeneralTechnicien) =>
    `${t?.prenom || ''} ${t?.nom || ''}`.trim() || 'Non affecte';

const eventTitle = (item: GeneralItem) => item.bateauNom || item.itemNom || '-';

const progress = (item: GeneralItem) =>
    item.tachesTotal ? Math.round(((item.tachesFaites || 0) / item.tachesTotal) * 100) : undefined;

export default function PlanningGeneral({ technicienId, compact = false }: PlanningGeneralProps) {
    const [items, setItems] = useState<GeneralItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [weekStart, setWeekStart] = useState(() => dayjs().startOf('week'));
    const [filterTechnicien, setFilterTechnicien] = useState<number | undefined>(undefined);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await api.get('/technicien-portal/planning-general');
            setItems(res.data || []);
        } catch {
            message.error('Erreur lors du chargement du planning general');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const techniciens = useMemo(() => {
        const map = new Map<number, GeneralTechnicien>();
        items.forEach((item) => (item.techniciens || []).forEach((t) => map.set(t.id, t)));
        return Array.from(map.values()).sort((a, b) => technicienLabel(a).localeCompare(technicienLabel(b)));
    }, [items]);

    // Un événement par technicien affecté (une prestation à deux techniciens apparaît sur chaque couloir).
    const events = useMemo<CalendarEvent[]>(() => {
        const result: CalendarEvent[] = [];
        items.forEach((item, index) => {
            const startSource = item.dateDebut || item.statusDate;
            const start = startSource ? dayjs(startSource) : undefined;
            if (!start || !start.isValid()) return;
            const duration = item.dureePlanifiee || item.dureeEstimee || 1;
            const assigned = item.techniciens && item.techniciens.length > 0 ? item.techniciens : [undefined];
            assigned.forEach((technicien) => {
                if (filterTechnicien && technicien?.id !== filterTechnicien) return;
                result.push({
                    eventId: `${item.itemType}-${item.itemId}-${index}-${technicien?.id ?? 'none'}`,
                    start,
                    duration,
                    item,
                    technicien,
                });
            });
        });
        return result;
    }, [items, filterTechnicien]);

    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart]);
    const weekLabel = `${weekStart.format('DD MMM')} – ${weekStart.add(6, 'day').format('DD MMM YYYY')}`;
    const today = dayjs().format('YYYY-MM-DD');

    const eventsForDay = (day: dayjs.Dayjs) =>
        events
            .filter((ev) => ev.start.format('YYYY-MM-DD') === day.format('YYYY-MM-DD'))
            .sort((a, b) => {
                const ta = a.technicien?.id ?? Number.MAX_SAFE_INTEGER;
                const tb = b.technicien?.id ?? Number.MAX_SAFE_INTEGER;
                return ta !== tb ? ta - tb : a.start.valueOf() - b.start.valueOf();
            });

    const weekCount = weekDays.reduce((sum, day) => sum + eventsForDay(day).length, 0);

    const tooltip = (ev: CalendarEvent) => {
        const pct = progress(ev.item);
        return (
            <div style={{ fontSize: 12, lineHeight: '18px' }}>
                <div>
                    <strong>{ev.item.bateauNom || '-'}</strong>
                    {ev.item.bateauImmatriculation ? ` (${ev.item.bateauImmatriculation})` : ''}
                </div>
                <div>Client : {ev.item.clientNom || '-'}</div>
                <div>Technicien : {technicienLabel(ev.technicien)}</div>
                <div>{ev.item.itemNom || '-'}</div>
                <div>
                    Statut : {STATUS_LABELS[ev.item.itemStatus || ''] || ev.item.itemStatus}
                    {pct !== undefined ? ` — ${pct}%` : ''}
                </div>
                <div>{ev.start.format('HH:mm')} — {ev.duration}h</div>
            </div>
        );
    };

    const renderGridDay = (day: dayjs.Dayjs) => {
        const dayStr = day.format('YYYY-MM-DD');
        const isToday = dayStr === today;
        const dayEvents = eventsForDay(day);

        // Un couloir par technicien ; sous-lignes en cas de chevauchement pour un même technicien.
        const rowByEvent = new Map<string, number>();
        const baseRow = new Map<number, number>();
        const laneEnds = new Map<number, number[]>();
        let totalRows = 0;
        dayEvents.forEach((ev) => {
            const tid = ev.technicien?.id ?? -1;
            const start = ev.start.valueOf();
            const end = start + ev.duration * 3600000;
            if (!baseRow.has(tid)) {
                baseRow.set(tid, totalRows);
                laneEnds.set(tid, []);
                totalRows += 1;
            }
            const lanes = laneEnds.get(tid)!;
            let lane = lanes.findIndex((laneEnd) => start >= laneEnd);
            if (lane === -1) {
                lane = lanes.length;
                lanes.push(end);
                if (lane > 0) totalRows += 1;
            } else {
                lanes[lane] = end;
            }
            rowByEvent.set(ev.eventId, baseRow.get(tid)! + lane);
        });

        return (
            <React.Fragment key={dayStr}>
                <div
                    style={{
                        borderBottom: '1px solid #f0f0f0',
                        padding: '8px 8px',
                        fontWeight: isToday ? 700 : 400,
                        background: isToday ? '#e6f4ff' : undefined,
                        fontSize: 12,
                    }}
                >
                    <div>{DAY_NAMES[day.day()]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{day.format('DD/MM')}</div>
                </div>
                <div
                    style={{
                        gridColumn: '2 / -1',
                        borderBottom: '1px solid #f0f0f0',
                        position: 'relative',
                        minHeight: Math.max(60, totalRows * 28 + 8),
                        background: isToday ? '#e6f4ff' : undefined,
                    }}
                >
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                        <div
                            key={`g-${i}`}
                            style={{ position: 'absolute', left: `${(i / TOTAL_HOURS) * 100}%`, top: 0, bottom: 0, width: 1, background: '#f0f0f0' }}
                        />
                    ))}
                    {dayEvents.map((ev) => {
                        const row = rowByEvent.get(ev.eventId) ?? 0;
                        const startHour = ev.start.hour() + ev.start.minute() / 60;
                        const leftPct = Math.min(Math.max(0, ((startHour - HOUR_START) / TOTAL_HOURS) * 100), 98);
                        const widthPct = Math.min((ev.duration / TOTAL_HOURS) * 100, 100 - leftPct);
                        const pct = progress(ev.item);
                        const mine = technicienId !== undefined && ev.technicien?.id === technicienId;
                        return (
                            <Tooltip key={ev.eventId} title={tooltip(ev)}>
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 4 + row * 28,
                                        left: `${leftPct}%`,
                                        width: `${Math.max(widthPct, 2)}%`,
                                        height: 24,
                                        background: technicienColor(ev.technicien),
                                        color: '#fff',
                                        borderRadius: 4,
                                        padding: '2px 6px',
                                        fontSize: 11,
                                        lineHeight: '20px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        boxShadow: mine ? '0 0 0 2px #262626' : '0 1px 3px rgba(0,0,0,0.15)',
                                        zIndex: 2,
                                    }}
                                >
                                    {eventTitle(ev.item)}{pct !== undefined ? ` (${pct}%)` : ''}
                                </div>
                            </Tooltip>
                        );
                    })}
                </div>
            </React.Fragment>
        );
    };

    const renderAgendaDay = (day: dayjs.Dayjs) => {
        const dayEvents = eventsForDay(day).sort((a, b) => a.start.valueOf() - b.start.valueOf());
        const isToday = day.format('YYYY-MM-DD') === today;
        return (
            <Card
                key={day.format('YYYY-MM-DD')}
                size="small"
                style={{ marginBottom: 8, borderColor: isToday ? '#1677ff' : undefined }}
                title={`${DAY_NAMES[day.day()]} ${day.format('DD/MM')}`}
            >
                {dayEvents.length === 0 ? (
                    <span style={{ color: '#999' }}>Rien de planifie</span>
                ) : (
                    dayEvents.map((ev) => {
                        const pct = progress(ev.item);
                        return (
                            <div key={ev.eventId} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                    <strong>{ev.start.format('HH:mm')} · {eventTitle(ev.item)}</strong>
                                    <Tag color={technicienColor(ev.technicien)} style={{ marginRight: 0 }}>
                                        {technicienLabel(ev.technicien)}
                                    </Tag>
                                </div>
                                <div style={{ fontSize: 12, color: '#595959' }}>
                                    {ev.item.itemNom || '-'} — {ev.item.clientNom || '-'} — {ev.duration}h
                                    {pct !== undefined ? ` — ${pct}%` : ''}
                                </div>
                            </div>
                        );
                    })
                )}
            </Card>
        );
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {!compact && <h2 style={{ margin: 0 }}>Planning general</h2>}
                <Space wrap>
                    <Button icon={<LeftOutlined />} onClick={() => setWeekStart(weekStart.subtract(1, 'week'))} />
                    <Button onClick={() => setWeekStart(dayjs().startOf('week'))}>Cette semaine</Button>
                    <Button icon={<RightOutlined />} onClick={() => setWeekStart(weekStart.add(1, 'week'))} />
                    <strong>{weekLabel}</strong>
                </Space>
                <Space wrap>
                    <Select
                        allowClear
                        placeholder="Tous les techniciens"
                        style={{ minWidth: 190 }}
                        value={filterTechnicien}
                        onChange={setFilterTechnicien}
                        options={techniciens.map((t) => ({ value: t.id, label: technicienLabel(t) }))}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchItems} />
                </Space>
            </div>

            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span><Badge status="success" /> Planifiees (semaine) : <strong>{weekCount}</strong></span>
                {techniciens.map((t) => (
                    <Tag key={t.id} color={technicienColor(t)}>{technicienLabel(t)}</Tag>
                ))}
            </div>

            <Spin spinning={loading}>
                {weekCount === 0 && !loading && <Empty description="Aucune prestation planifiee cette semaine" />}
                {compact ? (
                    weekDays.map(renderAgendaDay)
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${TOTAL_HOURS}, 1fr)`, minWidth: TOTAL_HOURS * 80 + 80 }}>
                            <div style={{ borderBottom: '2px solid #d9d9d9', background: '#fafafa' }} />
                            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                                <div
                                    key={`h-${i}`}
                                    style={{
                                        borderBottom: '2px solid #d9d9d9',
                                        borderLeft: '1px solid #f0f0f0',
                                        padding: '4px',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        textAlign: 'center',
                                        background: '#fafafa',
                                    }}
                                >
                                    {HOUR_START + i}h
                                </div>
                            ))}
                            {weekDays.map(renderGridDay)}
                        </div>
                    </div>
                )}
            </Spin>
        </div>
    );
}
