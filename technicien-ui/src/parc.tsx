import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Collapse, Descriptions, Drawer, Empty, Input, List, Segmented, Space, Spin, Tag, message } from 'antd';
import { CarOutlined, CheckCircleOutlined, ReloadOutlined, ShopOutlined, ToolOutlined } from '@ant-design/icons';
import api from './api.ts';

type ParcType = 'bateaux' | 'moteurs' | 'remorques';

interface Client {
    id?: number;
    nom?: string;
}

interface Modele {
    designation?: string;
    anneeDebut?: number;
    anneeFin?: number;
}

interface Materiel {
    id: number;
    name?: string;
    immatriculation?: string;
    numeroSerie?: string;
    numeroClef?: string;
    dateMeS?: string;
    dateAchat?: string;
    dateFinDeGuarantie?: string;
    localisation?: string;
    modele?: Modele;
    proprietaire?: Client;
    proprietaires?: Client[];
    moteurs?: Modele[];
    remorques?: Modele[];
    equipements?: string[];
    datePretRecuperation?: string | null;
}

interface ChecklistItem {
    id?: number;
    nom?: string;
    description?: string;
    done?: boolean;
}

interface Prestation {
    itemId?: number;
    venteId?: number;
    itemType?: string;
    itemNom?: string;
    itemStatus?: string;
    datePlanification?: string;
    clientNom?: string;
    taches?: ChecklistItem[];
}

const statusColor: Record<string, string> = {
    EN_ATTENTE: 'orange', PLANIFIEE: 'cyan', EN_COURS: 'blue', TERMINEE: 'green', INCIDENT: 'red', ANNULEE: 'default',
};
const statusLabel: Record<string, string> = {
    EN_ATTENTE: 'En attente', PLANIFIEE: 'Planifiée', EN_COURS: 'En cours', TERMINEE: 'Terminée', INCIDENT: 'Incident', ANNULEE: 'Annulée',
};

const typeLabel: Record<ParcType, string> = { bateaux: 'Bateau', moteurs: 'Moteur', remorques: 'Remorque' };

const formatModele = (m?: Modele) => {
    if (!m?.designation) return '';
    const annee = m.anneeDebut ? (m.anneeFin && m.anneeFin !== m.anneeDebut ? `${m.anneeDebut}-${m.anneeFin}` : `${m.anneeDebut}`) : '';
    return annee ? `${m.designation} (${annee})` : m.designation;
};

const proprietairesNoms = (m: Materiel) => {
    const noms = m.proprietaires ? m.proprietaires.map((p) => p.nom) : [m.proprietaire?.nom];
    return noms.filter(Boolean).join(', ');
};

const titre = (type: ParcType, m: Materiel) => {
    if (type === 'bateaux') return m.name || m.immatriculation || `Bateau #${m.id}`;
    if (type === 'moteurs') return formatModele(m.modele) || m.numeroSerie || `Moteur #${m.id}`;
    return m.immatriculation || formatModele(m.modele) || `Remorque #${m.id}`;
};

const sousTitre = (type: ParcType, m: Materiel) => {
    const parts: string[] = [];
    if (type === 'bateaux' && m.immatriculation) parts.push(m.immatriculation);
    if (type === 'moteurs' && m.numeroSerie) parts.push(`N° série ${m.numeroSerie}`);
    if (type !== 'moteurs' && m.modele) parts.push(formatModele(m.modele));
    const proprios = proprietairesNoms(m);
    if (proprios) parts.push(proprios);
    return parts.join(' · ');
};

const matches = (type: ParcType, m: Materiel, q: string) => {
    const haystack = [
        m.name, m.immatriculation, m.numeroSerie, m.numeroClef, m.localisation,
        formatModele(m.modele), proprietairesNoms(m),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q.toLowerCase());
};

const dateFr = (v?: string) => {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR');
};

export default function Parc() {
    const [type, setType] = useState<ParcType>('bateaux');
    const [items, setItems] = useState<Materiel[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Materiel | null>(null);
    const [prestations, setPrestations] = useState<Prestation[]>([]);
    const [prestationsLoading, setPrestationsLoading] = useState(false);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/${type}`);
            setItems(res.data || []);
        } catch {
            message.error('Erreur lors du chargement du parc');
        } finally {
            setLoading(false);
        }
    }, [type]);

    useEffect(() => {
        setSearch('');
        setSelected(null);
        fetchItems();
    }, [fetchItems]);

    const openDetail = async (materiel: Materiel) => {
        setSelected(materiel);
        setPrestations([]);
        setPrestationsLoading(true);
        try {
            const res = await api.get(`/technicien-portal/parc/${type}/${materiel.id}/taches`);
            setPrestations(res.data || []);
        } catch {
            message.error('Erreur lors du chargement des prestations');
        } finally {
            setPrestationsLoading(false);
        }
    };

    const filtered = useMemo(
        () => (search.trim() ? items.filter((m) => matches(type, m, search.trim())) : items),
        [items, search, type],
    );

    const detailItems = (m: Materiel) => {
        const rows: Array<[string, React.ReactNode]> = [];
        if (type === 'bateaux') rows.push(['Nom', m.name]);
        rows.push(['Modèle', formatModele(m.modele)]);
        if (type !== 'moteurs') rows.push(['Immatriculation', m.immatriculation]);
        if (type !== 'remorques') rows.push(['N° de série', m.numeroSerie]);
        if (type !== 'remorques') rows.push(['N° de clef', m.numeroClef]);
        rows.push([type === 'bateaux' ? 'Propriétaires' : 'Propriétaire', proprietairesNoms(m)]);
        if (type === 'bateaux') {
            rows.push(['Localisation', m.localisation]);
            rows.push(['Moteurs', (m.moteurs || []).map(formatModele).filter(Boolean).join(', ')]);
            rows.push(['Remorques', (m.remorques || []).map(formatModele).filter(Boolean).join(', ')]);
            rows.push(['Équipements', (m.equipements || []).join(', ')]);
        }
        rows.push(['Mise en service', m.dateMeS ? dateFr(m.dateMeS) : '']);
        rows.push(['Date d\'achat', m.dateAchat ? dateFr(m.dateAchat) : '']);
        rows.push(['Fin de garantie', m.dateFinDeGuarantie ? dateFr(m.dateFinDeGuarantie) : '']);
        return rows
            .filter(([, value]) => value)
            .map(([label, value]) => ({ key: label, label, children: value }));
    };

    return (
        <div>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Segmented
                    block
                    value={type}
                    onChange={(v) => setType(v as ParcType)}
                    options={[
                        { value: 'bateaux', icon: <ShopOutlined />, label: 'Bateaux' },
                        { value: 'moteurs', icon: <ToolOutlined />, label: 'Moteurs' },
                        { value: 'remorques', icon: <CarOutlined />, label: 'Remorques' },
                    ]}
                />
                <Space.Compact style={{ width: '100%' }}>
                    <Input.Search
                        allowClear
                        placeholder="Rechercher (nom, immatriculation, n° de série, propriétaire...)"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchItems} aria-label="Actualiser" />
                </Space.Compact>
                <Spin spinning={loading}>
                    <List
                        grid={{ gutter: 12, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 4 }}
                        dataSource={filtered}
                        locale={{ emptyText: <Empty description="Aucun élément dans le parc" /> }}
                        renderItem={(m) => (
                            <List.Item>
                                <Card size="small" hoverable onClick={() => openDetail(m)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                        <span style={{ fontWeight: 'bold' }}>{titre(type, m)}</span>
                                        {m.datePretRecuperation && (
                                            <Tag color="green" icon={<CheckCircleOutlined />}>Prêt</Tag>
                                        )}
                                    </div>
                                    <div style={{ color: '#666', fontSize: 13 }}>{sousTitre(type, m) || '-'}</div>
                                </Card>
                            </List.Item>
                        )}
                    />
                </Spin>
            </Space>

            <Drawer
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected ? `${typeLabel[type]} - ${titre(type, selected)}` : ''}
                size="large"
                destroyOnHidden
            >
                {selected && (
                    <>
                        <Descriptions bordered size="small" column={1} items={detailItems(selected)} />
                        <h4 style={{ margin: '20px 0 8px' }}>Tâches des prestations</h4>
                        <Spin spinning={prestationsLoading}>
                            {prestations.length === 0 && !prestationsLoading ? (
                                <Empty description="Aucune prestation sur ce matériel" />
                            ) : (
                                <Collapse
                                    items={prestations.map((p) => {
                                        const taches = p.taches || [];
                                        const faites = taches.filter((t) => t.done).length;
                                        return {
                                            key: `${p.itemType}-${p.itemId}`,
                                            label: (
                                                <Space wrap>
                                                    <strong>{p.itemNom || 'Prestation'}</strong>
                                                    <Tag color={statusColor[p.itemStatus || '']}>
                                                        {statusLabel[p.itemStatus || ''] || p.itemStatus}
                                                    </Tag>
                                                    {taches.length > 0 && <span style={{ color: '#888' }}>{faites}/{taches.length}</span>}
                                                </Space>
                                            ),
                                            children: taches.length === 0 ? (
                                                <span style={{ color: '#999' }}>Aucune tâche</span>
                                            ) : (
                                                <List
                                                    size="small"
                                                    dataSource={taches}
                                                    renderItem={(t) => (
                                                        <List.Item>
                                                            <Space align="start">
                                                                <CheckCircleOutlined style={{ color: t.done ? '#52c41a' : '#d9d9d9' }} />
                                                                <div>
                                                                    <div style={{ textDecoration: t.done ? 'line-through' : undefined }}>{t.nom}</div>
                                                                    {t.description && <div style={{ fontSize: 12, color: '#888' }}>{t.description}</div>}
                                                                </div>
                                                            </Space>
                                                        </List.Item>
                                                    )}
                                                />
                                            ),
                                        };
                                    })}
                                />
                            )}
                        </Spin>
                    </>
                )}
            </Drawer>
        </div>
    );
}
