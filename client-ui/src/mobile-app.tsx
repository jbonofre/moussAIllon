import React, { useEffect, useState } from 'react';
import {
    Button,
    Card,
    List,
    Modal,
    Segmented,
    Space,
    Spin,
    Statistic,
    Tag,
    message,
} from 'antd';
import {
    ShopOutlined,
    ToolOutlined,
    CarOutlined,
    FileTextOutlined,
    UserOutlined,
    LogoutOutlined,
    CreditCardOutlined,
    EyeOutlined,
    ReloadOutlined,
    TagsOutlined,
    PlusOutlined,
    DeleteOutlined,
    ScheduleOutlined,
    ClockCircleOutlined,
    CalendarOutlined,
    SyncOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    StopOutlined,
} from '@ant-design/icons';
import api from './api.ts';

interface Client {
    id: number;
    nom: string;
    type: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    siren?: string;
    siret?: string;
    tva?: string;
    naf?: string;
}

interface BateauClientEntity {
    id: number;
    name?: string;
    immatriculation?: string;
    dateFinDeGuarantie?: string;
    localisation?: string;
    modele?: { nom?: string; marque?: string };
}

interface MoteurClientEntity {
    id: number;
    numeroSerie?: string;
    dateFinDeGuarantie?: string;
    modele?: { nom?: string; marque?: string };
}

interface RemorqueClientEntity {
    id: number;
    immatriculation?: string;
    dateFinDeGuarantie?: string;
    modele?: { nom?: string; marque?: string };
}

interface TaskEntity {
    id: number;
    nom: string;
    status: string;
    dateDebut?: string;
    dateFin?: string;
    statusDate?: string;
    description?: string;
    notes?: string;
    technicien?: { id: number; nom: string; prenom?: string };
    dureeReelle: number;
    incidentDate?: string;
    incidentDetails?: string;
}

interface VenteEntity {
    id: number;
    status: string;
    type: string;
    date?: string;
    prixVenteTTC?: number;
    montantHT?: number;
    montantTTC?: number;
    montantTVA?: number;
    remise?: number;
    modePaiement?: string;
    forfaits?: Array<{ id: number; nom: string; reference?: string; prixTTC?: number }>;
    produits?: Array<{ id: number; nom: string; marque?: string; prixVenteTTC?: number }>;
    services?: Array<{ id: number; nom: string; prixTTC?: number }>;
    taches?: TaskEntity[];
    bateau?: { name?: string; immatriculation?: string };
    moteur?: { numeroSerie?: string; modele?: { nom?: string; marque?: string } };
    remorque?: { immatriculation?: string };
}

interface MobileAppProps {
    user: Client;
    onLogout: () => void;
}

interface Annonce {
    id: number;
    titre?: string;
    description?: string;
    prix?: number;
    contact?: string;
    telephone?: string;
    photos?: string[];
    status?: string;
    dateCreation?: string;
    client?: { id: number };
    bateau?: BateauClientEntity;
}

type Page = 'dashboard' | 'bateaux' | 'moteurs' | 'remorques' | 'factures' | 'prestations' | 'annonces' | 'profil';

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR');
};

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} EUR`;

const statusColor: Record<string, string> = { EN_ATTENTE: 'orange', EN_COURS: 'blue', PAYEE: 'green', ANNULEE: 'red' };
const statusLabel: Record<string, string> = { EN_ATTENTE: 'En attente', EN_COURS: 'En cours', PAYEE: 'Payee', ANNULEE: 'Annulee' };
const taskStatusColor: Record<string, string> = { EN_ATTENTE: 'orange', PLANIFIEE: 'cyan', EN_COURS: 'blue', TERMINEE: 'green', INCIDENT: 'red', ANNULEE: 'default' };
const taskStatusLabel: Record<string, string> = { EN_ATTENTE: 'En attente', PLANIFIEE: 'Planifiee', EN_COURS: 'En cours', TERMINEE: 'Terminee', INCIDENT: 'Incident', ANNULEE: 'Annulee' };
const taskStatusIcon: Record<string, React.ReactNode> = { EN_ATTENTE: <ClockCircleOutlined />, PLANIFIEE: <CalendarOutlined />, EN_COURS: <SyncOutlined spin />, TERMINEE: <CheckCircleOutlined />, INCIDENT: <ExclamationCircleOutlined />, ANNULEE: <StopOutlined /> };
const typeLabel: Record<string, string> = { DEVIS: 'Devis', FACTURE: 'Facture', COMMANDE: 'Commande', LIVRAISON: 'Livraison', COMPTOIR: 'Comptoir', PARTICULIER: 'Particulier', PROFESSIONNEL: 'Professionnel', PROFESSIONNEL_MER: 'Pro. de la Mer' };

const warrantyTag = (date?: string) => {
    if (!date) return '-';
    const isExpired = new Date(date) < new Date();
    return <Tag color={isExpired ? 'red' : 'green'}>{formatDate(date)}</Tag>;
};

const modelLabel = (modele?: { nom?: string; marque?: string }) =>
    modele ? `${modele.marque || ''} ${modele.nom || ''}`.trim() || '-' : '-';

export default function MobileApp({ user, onLogout }: MobileAppProps) {
    const [page, setPage] = useState<Page>('dashboard');
    const [loading, setLoading] = useState(false);
    const [bateaux, setBateaux] = useState<BateauClientEntity[]>([]);
    const [moteurs, setMoteurs] = useState<MoteurClientEntity[]>([]);
    const [remorques, setRemorques] = useState<RemorqueClientEntity[]>([]);
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [detailVente, setDetailVente] = useState<VenteEntity | null>(null);
    const [annonces, setAnnonces] = useState<Annonce[]>([]);
    const [detailAnnonce, setDetailAnnonce] = useState<Annonce | null>(null);
    const [annonceFormOpen, setAnnonceFormOpen] = useState(false);
    const [profile, setProfile] = useState<Client | null>(null);
    const [detailTask, setDetailTask] = useState<TaskEntity | null>(null);

    const clientName = user.nom;
    const clientId = user.id;

    const fetchData = async (p: Page) => {
        setLoading(true);
        try {
            switch (p) {
                case 'dashboard': {
                    const [b, m, r, v] = await Promise.all([
                        api.get(`/portal/clients/${clientId}/bateaux`),
                        api.get(`/portal/clients/${clientId}/moteurs`),
                        api.get(`/portal/clients/${clientId}/remorques`),
                        api.get(`/portal/clients/${clientId}/ventes`),
                    ]);
                    setBateaux(b.data || []);
                    setMoteurs(m.data || []);
                    setRemorques(r.data || []);
                    setVentes(v.data || []);
                    break;
                }
                case 'bateaux': {
                    const res = await api.get(`/portal/clients/${clientId}/bateaux`);
                    setBateaux(res.data || []);
                    break;
                }
                case 'moteurs': {
                    const res = await api.get(`/portal/clients/${clientId}/moteurs`);
                    setMoteurs(res.data || []);
                    break;
                }
                case 'remorques': {
                    const res = await api.get(`/portal/clients/${clientId}/remorques`);
                    setRemorques(res.data || []);
                    break;
                }
                case 'factures':
                case 'prestations': {
                    const res = await api.get(`/portal/clients/${clientId}/ventes`);
                    setVentes(res.data || []);
                    break;
                }
                case 'annonces': {
                    const res = await api.get('/annonces/active');
                    setAnnonces(res.data || []);
                    break;
                }
                case 'profil': {
                    const res = await api.get(`/portal/clients/${clientId}`);
                    setProfile(res.data);
                    break;
                }
            }
        } catch {
            message.error('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(page);
    }, [page, clientId]);

    const handlePayment = async (vente: VenteEntity, provider: 'stripe' | 'payplug') => {
        try {
            const res = await api.post(`/ventes/${vente.id}/payment-link/${provider}`);
            window.open(res.data.url, '_blank', 'noopener,noreferrer');
        } catch {
            message.error('Erreur lors de la creation du lien de paiement');
        }
    };

    const renderDashboard = () => (
        <div>
            <Card size="small" style={{ marginBottom: 8 }}><Statistic title="Bateaux" value={bateaux.length} prefix={<ShopOutlined />} /></Card>
            <Card size="small" style={{ marginBottom: 8 }}><Statistic title="Moteurs" value={moteurs.length} prefix={<ToolOutlined />} /></Card>
            <Card size="small" style={{ marginBottom: 8 }}><Statistic title="Remorques" value={remorques.length} prefix={<CarOutlined />} /></Card>
            <Card size="small" style={{ marginBottom: 8 }}><Statistic title="Factures" value={ventes.length} prefix={<FileTextOutlined />} /></Card>
        </div>
    );

    const renderBateaux = () => (
        <List
            dataSource={bateaux}
            renderItem={(b) => (
                <Card size="small" style={{ marginBottom: 8 }}>
                    <p style={{ fontWeight: 'bold', marginBottom: 4 }}>{b.name || b.immatriculation || `Bateau #${b.id}`}</p>
                    <p style={{ margin: 0 }}>Modele: {modelLabel(b.modele)}</p>
                    <p style={{ margin: 0 }}>Immat.: {b.immatriculation || '-'}</p>
                    <p style={{ margin: 0 }}>Lieu: {b.localisation || '-'}</p>
                    <p style={{ margin: 0 }}>Garantie: {warrantyTag(b.dateFinDeGuarantie)}</p>
                </Card>
            )}
        />
    );

    const renderMoteurs = () => (
        <List
            dataSource={moteurs}
            renderItem={(m) => (
                <Card size="small" style={{ marginBottom: 8 }}>
                    <p style={{ fontWeight: 'bold', marginBottom: 4 }}>{m.numeroSerie || `Moteur #${m.id}`}</p>
                    <p style={{ margin: 0 }}>Modele: {modelLabel(m.modele)}</p>
                    <p style={{ margin: 0 }}>Garantie: {warrantyTag(m.dateFinDeGuarantie)}</p>
                </Card>
            )}
        />
    );

    const renderRemorques = () => (
        <List
            dataSource={remorques}
            renderItem={(r) => (
                <Card size="small" style={{ marginBottom: 8 }}>
                    <p style={{ fontWeight: 'bold', marginBottom: 4 }}>{r.immatriculation || `Remorque #${r.id}`}</p>
                    <p style={{ margin: 0 }}>Modele: {modelLabel(r.modele)}</p>
                    <p style={{ margin: 0 }}>Garantie: {warrantyTag(r.dateFinDeGuarantie)}</p>
                </Card>
            )}
        />
    );

    const renderFactures = () => (
        <>
            <List
                dataSource={ventes}
                renderItem={(v) => (
                    <Card size="small" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 'bold' }}>#{v.id} - {typeLabel[v.type] || v.type}</span>
                            <Tag color={statusColor[v.status]}>{statusLabel[v.status] || v.status}</Tag>
                        </div>
                        <p style={{ margin: 0 }}>Date: {formatDate(v.date)}</p>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>Total: {formatEuro(v.prixVenteTTC)}</p>
                        <Space style={{ marginTop: 8 }} wrap>
                            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailVente(v)}>Detail</Button>
                            {v.status !== 'PAYEE' && v.status !== 'ANNULEE' && (
                                <>
                                    <Button size="small" icon={<CreditCardOutlined />} onClick={() => handlePayment(v, 'stripe')}>Stripe</Button>
                                    <Button size="small" icon={<CreditCardOutlined />} onClick={() => handlePayment(v, 'payplug')}>PayPlug</Button>
                                </>
                            )}
                        </Space>
                    </Card>
                )}
            />
            <Modal
                title={detailVente ? `${typeLabel[detailVente.type] || detailVente.type} #${detailVente.id}` : ''}
                open={!!detailVente}
                onCancel={() => setDetailVente(null)}
                footer={null}
                width="95vw"
                style={{ top: 20 }}
            >
                {detailVente && (
                    <div>
                        <p><strong>Date:</strong> {formatDate(detailVente.date)}</p>
                        <p><strong>Statut:</strong> <Tag color={statusColor[detailVente.status]}>{statusLabel[detailVente.status]}</Tag></p>
                        <p><strong>Paiement:</strong> {detailVente.modePaiement || '-'}</p>
                        {(detailVente.forfaits || []).map((f) => (
                            <Card size="small" key={`f-${f.id}`} style={{ marginBottom: 4 }}>
                                <span>Forfait: {f.reference ? `${f.reference} - ` : ''}{f.nom}</span>
                                <span style={{ float: 'right' }}>{formatEuro(f.prixTTC)}</span>
                            </Card>
                        ))}
                        {(detailVente.produits || []).map((p, i) => (
                            <Card size="small" key={`p-${p.id}-${i}`} style={{ marginBottom: 4 }}>
                                <span>Produit: {p.marque ? `${p.nom} (${p.marque})` : p.nom}</span>
                                <span style={{ float: 'right' }}>{formatEuro(p.prixVenteTTC)}</span>
                            </Card>
                        ))}
                        {(detailVente.services || []).map((s) => (
                            <Card size="small" key={`s-${s.id}`} style={{ marginBottom: 4 }}>
                                <span>Service: {s.nom}</span>
                                <span style={{ float: 'right' }}>{formatEuro(s.prixTTC)}</span>
                            </Card>
                        ))}
                        <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                            <p><strong>HT:</strong> {formatEuro(detailVente.montantHT)}</p>
                            <p><strong>TVA:</strong> {formatEuro(detailVente.montantTVA)}</p>
                            <p><strong>TTC:</strong> {formatEuro(detailVente.montantTTC)}</p>
                            {(detailVente.remise || 0) > 0 && <p><strong>Remise:</strong> {formatEuro(detailVente.remise)}</p>}
                            <p style={{ fontSize: 16 }}><strong>Total: {formatEuro(detailVente.prixVenteTTC)}</strong></p>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );

    const ventesWithTasks = ventes.filter((v) => (v.taches || []).length > 0);
    const allTasks = ventesWithTasks.flatMap((v) => v.taches || []);
    const tasksDone = allTasks.filter((t) => t.status === 'TERMINEE').length;
    const globalProgress = allTasks.length > 0 ? Math.round((tasksDone / allTasks.length) * 100) : 0;

    const renderPrestations = () => (
        <>
            {/* Progress summary */}
            <Card size="small" style={{ marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>{globalProgress}% termine</div>
                <div style={{ fontSize: 12, color: '#999' }}>
                    {tasksDone}/{allTasks.length} prestations terminees
                </div>
            </Card>

            {ventesWithTasks.length === 0 && (
                <Card size="small"><p style={{ textAlign: 'center', margin: 0, color: '#999' }}>Aucune prestation en cours</p></Card>
            )}

            {ventesWithTasks.map((v) => {
                const taches = v.taches || [];
                const done = taches.filter((t) => t.status === 'TERMINEE').length;
                const pct = taches.length > 0 ? Math.round((done / taches.length) * 100) : 0;
                const asset = v.bateau?.name || v.bateau?.immatriculation || '';
                return (
                    <Card
                        key={v.id}
                        size="small"
                        title={`${typeLabel[v.type] || v.type} #${v.id}${asset ? ` - ${asset}` : ''}`}
                        extra={<span style={{ fontSize: 12 }}>{pct}%</span>}
                        style={{ marginBottom: 8 }}
                    >
                        {taches.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => setDetailTask(t)}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                            >
                                <span>{t.nom || `Tache #${t.id}`}</span>
                                <Tag icon={taskStatusIcon[t.status]} color={taskStatusColor[t.status]}>{taskStatusLabel[t.status] || t.status}</Tag>
                            </div>
                        ))}
                    </Card>
                );
            })}

            {/* Task detail modal */}
            <Modal
                title={detailTask ? (detailTask.nom || `Tache #${detailTask.id}`) : ''}
                open={!!detailTask}
                onCancel={() => setDetailTask(null)}
                footer={null}
                width="95vw"
                style={{ top: 20 }}
            >
                {detailTask && (
                    <div>
                        <p><strong>Statut:</strong>{' '}
                            <Tag icon={taskStatusIcon[detailTask.status]} color={taskStatusColor[detailTask.status]}>
                                {taskStatusLabel[detailTask.status] || detailTask.status}
                            </Tag>
                        </p>
                        {detailTask.description && <p><strong>Description:</strong> {detailTask.description}</p>}
                        <p><strong>Debut:</strong> {formatDate(detailTask.dateDebut)}</p>
                        <p><strong>Fin:</strong> {formatDate(detailTask.dateFin)}</p>
                        <p><strong>Technicien:</strong>{' '}
                            {detailTask.technicien ? `${detailTask.technicien.prenom || ''} ${detailTask.technicien.nom}`.trim() : 'Non assigne'}
                        </p>
                        <p><strong>Duree reelle:</strong> {detailTask.dureeReelle != null ? `${detailTask.dureeReelle}h` : '-'}</p>
                        {detailTask.notes && <p><strong>Notes:</strong> {detailTask.notes}</p>}
                        {detailTask.status === 'INCIDENT' && (
                            <Card size="small" style={{ background: '#fff2f0', borderColor: '#ffccc7', marginTop: 8 }}>
                                <p style={{ color: '#ff4d4f', fontWeight: 'bold', marginBottom: 4 }}>
                                    <ExclamationCircleOutlined /> Incident signale
                                </p>
                                <p><strong>Date:</strong> {formatDate(detailTask.incidentDate)}</p>
                                <p style={{ margin: 0 }}>{detailTask.incidentDetails || 'Aucun detail'}</p>
                            </Card>
                        )}
                        {detailTask.statusDate && (
                            <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                                Derniere mise a jour: {new Date(detailTask.statusDate).toLocaleString('fr-FR')}
                            </p>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );

    const handleCreateAnnonce = async (values: any) => {
        try {
            const payload = {
                titre: values.titre,
                description: values.description,
                prix: values.prix || 0,
                contact: values.contact,
                telephone: values.telephone,
                photos: [],
                status: 'ACTIVE',
                client: { id: clientId },
            };
            const res = await api.post('/annonces', payload);
            message.success('Annonce creee');
            setAnnonceFormOpen(false);
            fetchData('annonces');
        } catch {
            message.error('Erreur lors de la creation');
        }
    };

    const handleDeleteAnnonce = async (id: number) => {
        try {
            await api.delete(`/annonces/${id}`);
            message.success('Annonce supprimee');
            fetchData('annonces');
        } catch {
            message.error('Erreur lors de la suppression');
        }
    };

    const bateauLabel = (b?: { name?: string; immatriculation?: string; modele?: { nom?: string; marque?: string }; id?: number }) => {
        if (!b) return '-';
        const model = b.modele ? `${b.modele.marque || ''} ${b.modele.nom || ''}`.trim() : '';
        return b.name || model || b.immatriculation || `Bateau #${b.id}`;
    };

    const renderAnnonces = () => (
        <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAnnonceFormOpen(true)} style={{ marginBottom: 12, width: '100%' }}>
                Mettre en vente
            </Button>
            <List
                dataSource={annonces}
                renderItem={(a) => (
                    <Card size="small" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 'bold' }}>{a.titre || `Annonce #${a.id}`}</span>
                            <Tag color={statusColor[a.status || '']}>{statusLabel[a.status || ''] || a.status}</Tag>
                        </div>
                        <p style={{ margin: 0 }}>Bateau: {bateauLabel(a.bateau as any)}</p>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#1890ff' }}>Prix: {formatEuro(a.prix)}</p>
                        <p style={{ margin: 0 }}>Contact: {a.contact || '-'}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#999' }}>Publiee le {formatDate(a.dateCreation)}</p>
                        <Space style={{ marginTop: 8 }} wrap>
                            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailAnnonce(a)}>Detail</Button>
                            {a.client?.id === clientId && (
                                <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDeleteAnnonce(a.id)}>Supprimer</Button>
                            )}
                        </Space>
                    </Card>
                )}
            />
            {/* Detail modal */}
            <Modal
                title={detailAnnonce?.titre || 'Detail'}
                open={!!detailAnnonce}
                onCancel={() => setDetailAnnonce(null)}
                footer={null}
                width="95vw"
                style={{ top: 20 }}
            >
                {detailAnnonce && (
                    <div>
                        <p><strong>Bateau:</strong> {bateauLabel(detailAnnonce.bateau as any)}</p>
                        <p><strong>Prix:</strong> <span style={{ fontSize: 18, color: '#1890ff' }}>{formatEuro(detailAnnonce.prix)}</span></p>
                        <p><strong>Description:</strong></p>
                        <p style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 4 }}>
                            {detailAnnonce.description || 'Pas de description'}
                        </p>
                        <p><strong>Contact:</strong> {detailAnnonce.contact || '-'}</p>
                        <p><strong>Telephone:</strong> {detailAnnonce.telephone || '-'}</p>
                        <p><strong>Date:</strong> {formatDate(detailAnnonce.dateCreation)}</p>
                    </div>
                )}
            </Modal>
            {/* Create modal */}
            <Modal
                title="Nouvelle annonce"
                open={annonceFormOpen}
                onCancel={() => setAnnonceFormOpen(false)}
                footer={null}
                width="95vw"
                style={{ top: 20 }}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        handleCreateAnnonce({
                            titre: fd.get('titre'),
                            description: fd.get('description'),
                            prix: parseFloat(fd.get('prix') as string) || 0,
                            contact: fd.get('contact'),
                            telephone: fd.get('telephone'),
                        });
                    }}
                >
                    <div style={{ marginBottom: 12 }}>
                        <label>Titre *</label>
                        <input name="titre" required style={{ width: '100%', padding: 8 }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label>Description</label>
                        <textarea name="description" rows={3} style={{ width: '100%', padding: 8 }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label>Prix (EUR) *</label>
                        <input name="prix" type="number" min="0" required style={{ width: '100%', padding: 8 }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label>Email de contact</label>
                        <input name="contact" style={{ width: '100%', padding: 8 }} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label>Telephone</label>
                        <input name="telephone" style={{ width: '100%', padding: 8 }} />
                    </div>
                    <Button type="primary" htmlType="submit" block>Publier</Button>
                </form>
            </Modal>
        </>
    );

    const renderProfil = () => (
        <Card size="small">
            {profile && (
                <div>
                    <p><strong>Nom:</strong> {profile.nom}</p>
                    <p><strong>Type:</strong> <Tag>{typeLabel[profile.type] || profile.type}</Tag></p>
                    <p><strong>Email:</strong> {profile.email || '-'}</p>
                    <p><strong>Telephone:</strong> {profile.telephone || '-'}</p>
                    <p><strong>Adresse:</strong> {profile.adresse || '-'}</p>
                    {profile.type !== 'PARTICULIER' && (
                        <>
                            <p><strong>SIREN:</strong> {profile.siren || '-'}</p>
                            <p><strong>SIRET:</strong> {profile.siret || '-'}</p>
                            <p><strong>TVA:</strong> {profile.tva || '-'}</p>
                            <p><strong>NAF:</strong> {profile.naf || '-'}</p>
                        </>
                    )}
                </div>
            )}
        </Card>
    );

    const pageTitle: Record<Page, string> = {
        dashboard: 'Tableau de bord',
        bateaux: 'Mes bateaux',
        moteurs: 'Mes moteurs',
        remorques: 'Mes remorques',
        factures: 'Mes ventes & prestations',
        prestations: 'Interventions',
        annonces: 'Petites annonces',
        profil: 'Mon profil',
    };

    const renderContent = () => {
        switch (page) {
            case 'bateaux': return renderBateaux();
            case 'moteurs': return renderMoteurs();
            case 'remorques': return renderRemorques();
            case 'factures': return renderFactures();
            case 'prestations': return renderPrestations();
            case 'annonces': return renderAnnonces();
            case 'profil': return renderProfil();
            default: return renderDashboard();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ background: '#001529', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}><UserOutlined /> {clientName}</span>
                <Button size="small" icon={<LogoutOutlined />} onClick={onLogout} ghost>Quitter</Button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: 12, background: '#f5f5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>{pageTitle[page]}</h3>
                    <Button size="small" icon={<ReloadOutlined />} onClick={() => fetchData(page)} />
                </div>
                <Spin spinning={loading}>
                    {renderContent()}
                </Spin>
            </div>

            {/* Bottom tab bar */}
            <div style={{ borderTop: '1px solid #e8e8e8', background: '#fff', padding: '4px 0', position: 'sticky', bottom: 0 }}>
                <Segmented
                    block
                    value={page}
                    onChange={(val) => setPage(val as Page)}
                    options={[
                        { value: 'dashboard', icon: <ShopOutlined />, label: '' },
                        { value: 'bateaux', icon: <ShopOutlined />, label: '' },
                        { value: 'moteurs', icon: <ToolOutlined />, label: '' },
                        { value: 'remorques', icon: <CarOutlined />, label: '' },
                        { value: 'factures', icon: <FileTextOutlined />, label: '' },
                        { value: 'prestations', icon: <ScheduleOutlined />, label: '' },
                        { value: 'annonces', icon: <TagsOutlined />, label: '' },
                        { value: 'profil', icon: <UserOutlined />, label: '' },
                    ]}
                    style={{ borderRadius: 0 }}
                />
            </div>
        </div>
    );
}
