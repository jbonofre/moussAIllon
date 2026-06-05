import React, { useEffect, useMemo, useState } from 'react';
import {
    AutoComplete,
    Button,
    Card,
    Col,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Rate,
    Row,
    Select,
    Space,
    Table,
    Tag,
    DatePicker,
    Dropdown,
    message
} from 'antd';
import { CreditCardOutlined, DeleteOutlined, EditOutlined, PlusCircleOutlined, PlusOutlined, PrinterOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import api from './api.ts';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import ImageUpload from './ImageUpload.tsx';

interface ClientEntity {
    id: number;
    prenom?: string;
    nom: string;
}

interface BateauClientEntity {
    id: number;
    name?: string;
    immatriculation?: string;
}

interface MoteurClientEntity {
    id: number;
    numeroSerie?: string;
}

interface RemorqueClientEntity {
    id: number;
    immatriculation?: string;
}

interface TaskEntity {
    id: number;
    nom?: string;
}

interface ForfaitEntity {
    id: number;
    reference?: string;
    nom: string;
    prixTTC?: number;
    taches?: TaskEntity[];
}

interface ProduitCatalogueEntity {
    id: number;
    nom: string;
    marque?: string;
    categorie?: string;
    ref?: string;
    refs?: string[];
    images?: string[];
    description?: string;
    evaluation?: number;
    stock?: number;
    stockMini?: number;
    emplacement?: string;
    prixPublic?: number;
    frais?: number;
    tauxMarge?: number;
    tauxMarque?: number;
    prixVenteHT?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
}

interface CatalogueBateauEntity {
    id: number;
    modele: string;
    marque: string;
    prixVenteTTC?: number;
}

interface CatalogueMoteurEntity {
    id: number;
    modele: string;
    marque: string;
    prixVenteTTC?: number;
}

interface CatalogueHeliceEntity {
    id: number;
    modele: string;
    marque: string;
    prixVenteTTC?: number;
}

interface CatalogueRemorqueEntity {
    id: number;
    modele: string;
    marque: string;
    prixVenteTTC?: number;
}


const defaultNewProduit = {
    nom: '',
    marque: '',
    categorie: '',
    ref: '',
    refs: [],
    images: [],
    description: '',
    evaluation: 0,
    stock: 0,
    stockMini: 0,
    emplacement: '',
    prixPublic: 0,
    frais: 0,
    tauxMarge: 0,
    tauxMarque: 0,
    prixVenteHT: 0,
    tva: 20,
    montantTVA: 0,
    prixVenteTTC: 0,
};

interface ServiceEntity {
    id: number;
    nom: string;
    prixTTC?: number;
}

interface TaskEntity {
    id?: number;
    nom?: string;
}

type VenteStatus = 'DEVIS' | 'FACTURE_EN_ATTENTE' | 'FACTURE_PRETE' | 'FACTURE_PAYEE';
type ModePaiement = 'CHEQUE' | 'VIREMENT' | 'CARTE' | 'ESPÈCES';
type ModeReglement = 'CHEQUE' | 'VIREMENT' | 'CARTE' | 'ESPÈCES' | 'AVOIR';

interface VentePaiement {
    id?: number;
    mode: ModeReglement;
    montant: number;
    date?: string;
    notes?: string;
    avoirId?: number;
    avoirMotif?: string;
    avoirMontantTTC?: number;
    avoirMontantUtilise?: number;
}

interface AvoirDisponible {
    id: number;
    motif?: string;
    montantTTC: number;
    montantUtilise: number;
}

interface VenteProduitLigne {
    id?: number;
    produit?: ProduitCatalogueEntity;
    quantite: number;
    remise?: number;
    remisePourcentage?: number;
}

interface VenteBateauCatalogueLigne {
    id?: number;
    bateau?: CatalogueBateauEntity;
    quantite: number;
    remise?: number;
    remisePourcentage?: number;
}

interface VenteMoteurCatalogueLigne {
    id?: number;
    moteur?: CatalogueMoteurEntity;
    quantite: number;
    remise?: number;
    remisePourcentage?: number;
}

interface VenteHeliceCatalogueLigne {
    id?: number;
    helice?: CatalogueHeliceEntity;
    quantite: number;
    remise?: number;
    remisePourcentage?: number;
}

interface VenteRemorqueCatalogueLigne {
    id?: number;
    remorque?: CatalogueRemorqueEntity;
    quantite: number;
    remise?: number;
    remisePourcentage?: number;
}

interface VenteEntity {
    id?: number;
    status: VenteStatus;
    bonPourAccord?: boolean;
    comptoir?: boolean;
    signatureBonPourAccord?: string;
    client?: ClientEntity;
    bateau?: BateauClientEntity;
    moteur?: MoteurClientEntity;
    remorque?: RemorqueClientEntity;
    forfaits?: ForfaitEntity[];
    venteProduits?: VenteProduitLigne[];
    venteBateauxCatalogue?: VenteBateauCatalogueLigne[];
    venteMoteursCatalogue?: VenteMoteurCatalogueLigne[];
    venteHelicesCatalogue?: VenteHeliceCatalogueLigne[];
    venteRemorquesCatalogue?: VenteRemorqueCatalogueLigne[];
    services?: ServiceEntity[];
    taches?: TaskEntity[];
    date?: string;
    dateDevis?: string;
    dateBonPourAccord?: string;
    dateFactureEnAttente?: string;
    dateFacturePrete?: string;
    dateFacturePayee?: string;
    montantHT?: number;
    remise?: number;
    montantTTC?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
    modePaiement?: ModePaiement;
    paiements?: VentePaiement[];
}

interface VenteFormValues {
    status: VenteStatus;
    bonPourAccord?: boolean;
    signatureBonPourAccord?: string;
    clientId?: number;
    bateauId?: number;
    moteurId?: number;
    remorqueId?: number;
    forfaits: Array<{ forfaitId?: number; quantite: number; remise?: number; remisePourcentage?: number }>;
    produits: Array<{ produitRef?: string; quantite?: number; remise?: number; remisePourcentage?: number }>;
    services: Array<{ serviceId?: number; quantite: number; remise?: number; remisePourcentage?: number }>;
    date?: string;
    montantHT: number;
    remise: number;
    remisePourcentage: number;
    tva: number;
    montantTVA: number;
    montantTTC: number;
    prixVenteTTC: number;
    modePaiement?: ModePaiement;
}

const modePaiementOptions: Array<{ value: ModePaiement; label: string }> = [
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'CARTE', label: 'Carte' },
    { value: 'ESPÈCES', label: 'Especes' }
];

const statusColor: Record<VenteStatus, string> = {
    DEVIS: 'default',
    FACTURE_EN_ATTENTE: 'orange',
    FACTURE_PRETE: 'blue',
    FACTURE_PAYEE: 'green'
};

const statusLabel: Record<VenteStatus, string> = {
    DEVIS: 'Devis',
    FACTURE_EN_ATTENTE: 'Facture en attente',
    FACTURE_PRETE: 'Facture complète',
    FACTURE_PAYEE: 'Facture payée',
};

const defaultVente: VenteFormValues = {
    status: 'FACTURE_PRETE',
    bonPourAccord: true,
    forfaits: [],
    produits: [{}],
    services: [],
    montantHT: 0,
    remise: 0,
    remisePourcentage: 0,
    tva: 20,
    montantTVA: 0,
    montantTTC: 0,
    prixVenteTTC: 0
};

const getTodayDayjs = () => dayjs();

const toDateDayjs = (value?: string) => {
    if (!value) {
        return undefined;
    }
    const d = dayjs(value);
    return d.isValid() ? d : undefined;
};

const toBackendDateValue = (value?: dayjs.Dayjs | string) => {
    if (!value) {
        return undefined;
    }
    const d = dayjs.isDayjs(value) ? value : dayjs(value);
    return d.isValid() ? d.format('YYYY-MM-DDTHH:mm:ss') : undefined;
};

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} EUR`;
const formatDate = (value?: string) => {
    if (!value) {
        return '-';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleDateString('fr-FR') + ' ' + parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const escapeHtml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const getClientLabel = (client?: ClientEntity) => {
    if (!client) {
        return '-';
    }
    const fullName = `${client.prenom || ''} ${client.nom || ''}`.trim();
    return fullName || `Client #${client.id}`;
};

export default function Comptoir() {
    const PRODUIT_CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [clients, setClients] = useState<ClientEntity[]>([]);
    const [bateaux, setBateaux] = useState<BateauClientEntity[]>([]);
    const [moteurs, setMoteurs] = useState<MoteurClientEntity[]>([]);
    const [remorques, setRemorques] = useState<RemorqueClientEntity[]>([]);
    const [forfaits, setForfaits] = useState<ForfaitEntity[]>([]);
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [catalogueBateaux, setCatalogueBateaux] = useState<CatalogueBateauEntity[]>([]);
    const [catalogueMoteurs, setCatalogueMoteurs] = useState<CatalogueMoteurEntity[]>([]);
    const [catalogueHelices, setCatalogueHelices] = useState<CatalogueHeliceEntity[]>([]);
    const [catalogueRemorques, setCatalogueRemorques] = useState<CatalogueRemorqueEntity[]>([]);
    const [services, setServices] = useState<ServiceEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentVente, setCurrentVente] = useState<VenteEntity | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm<VenteFormValues>();
    const watchedStatus = Form.useWatch('status', form) as VenteStatus | undefined;
    const isReadOnly = watchedStatus === 'FACTURE_PAYEE';
    const [formDirty, setFormDirty] = useState(false);
    const [newProduitModalVisible, setNewProduitModalVisible] = useState(false);
    const [newProduitTargetLine, setNewProduitTargetLine] = useState<number | null>(null);
    const [newProduitForm] = Form.useForm();
    const [newProduitFormDirty, setNewProduitFormDirty] = useState(false);
    const [clientSearchTimeout, setClientSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [produitSearchTimeout, setProduitSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [paiementModalVisible, setPaiementModalVisible] = useState(false);
    const [paiementMode, setPaiementMode] = useState<ModeReglement>('CARTE');
    const [paiementMontant, setPaiementMontant] = useState<number>(0);
    const [paiementNotes, setPaiementNotes] = useState('');
    const [paiementAvoirId, setPaiementAvoirId] = useState<number | null>(null);
    const [avoirsDisponibles, setAvoirsDisponibles] = useState<AvoirDisponible[]>([]);
    const [addingPaiement, setAddingPaiement] = useState(false);

    const mergeById = <T extends { id: number }>(prev: T[], next: T[]): T[] => {
        const map = new Map<number, T>();
        prev.forEach((item) => map.set(item.id, item));
        next.forEach((item) => { if (item?.id) map.set(item.id, item); });
        return Array.from(map.values());
    };

    const handleClientSearch = (value: string) => {
        if (clientSearchTimeout) clearTimeout(clientSearchTimeout);
        if (!value || value.trim() === '') return;
        const timeout = setTimeout(async () => {
            try {
                const res = await api.get(`/clients/search?q=${encodeURIComponent(value)}`);
                setClients((prev) => mergeById(prev, res.data || []));
            } catch {
                // ignore
            }
        }, 300);
        setClientSearchTimeout(timeout);
    };

    const handleCatalogueSearch = (value: string) => {
        if (produitSearchTimeout) clearTimeout(produitSearchTimeout);
        if (!value || value.trim() === '') return;
        const q = encodeURIComponent(value);
        const timeout = setTimeout(async () => {
            try {
                const [produitsRes, bateauxRes, moteursRes, helicesRes, remorquesRes] = await Promise.allSettled([
                    api.get(`/catalogue/produits/search?q=${q}`),
                    api.get(`/catalogue/bateaux/search?q=${q}`),
                    api.get(`/catalogue/moteurs/search?q=${q}`),
                    api.get(`/catalogue/helices/search?q=${q}`),
                    api.get(`/catalogue/remorques/search?q=${q}`),
                ]);
                if (produitsRes.status === 'fulfilled') setProduits((prev) => mergeById(prev, produitsRes.value.data || []));
                if (bateauxRes.status === 'fulfilled') setCatalogueBateaux((prev) => mergeById(prev, bateauxRes.value.data || []));
                if (moteursRes.status === 'fulfilled') setCatalogueMoteurs((prev) => mergeById(prev, moteursRes.value.data || []));
                if (helicesRes.status === 'fulfilled') setCatalogueHelices((prev) => mergeById(prev, helicesRes.value.data || []));
                if (remorquesRes.status === 'fulfilled') setCatalogueRemorques((prev) => mergeById(prev, remorquesRes.value.data || []));
            } catch {
                // ignore
            }
        }, 300);
        setProduitSearchTimeout(timeout);
    };

    const marqueOptions = useMemo(() => {
        const unique = Array.from(new Set(produits.map((p) => p.marque).filter(Boolean))) as string[];
        return unique.map((marque) => ({ value: marque }));
    }, [produits]);

    const clientOptions = useMemo(
        () => clients.map((client) => ({ value: client.id, label: getClientLabel(client) })),
        [clients]
    );
    const bateauOptions = useMemo(
        () => bateaux.map((bateau) => ({ value: bateau.id, label: bateau.name || bateau.immatriculation || `Bateau #${bateau.id}` })),
        [bateaux]
    );
    const moteurOptions = useMemo(
        () => moteurs.map((moteur) => ({ value: moteur.id, label: moteur.numeroSerie || `Moteur #${moteur.id}` })),
        [moteurs]
    );
    const remorqueOptions = useMemo(
        () => remorques.map((remorque) => ({ value: remorque.id, label: remorque.immatriculation || `Remorque #${remorque.id}` })),
        [remorques]
    );
    const forfaitOptions = useMemo(
        () =>
            forfaits.map((forfait) => ({
                value: forfait.id,
                label: forfait.reference ? `${forfait.reference} - ${forfait.nom}` : forfait.nom
            })),
        [forfaits]
    );
    const catalogueOptions = useMemo(() => [
        {
            label: 'Produits',
            options: produits.map((p) => ({
                value: `produit:${p.id}`,
                label: `${p.nom}${p.marque ? ` (${p.marque})` : ''}`,
                searchText: `${p.nom} ${p.marque || ''} ${p.ref || ''} ${(p.refs || []).join(' ')}`.toLowerCase(),
            })),
        },
        {
            label: 'Bateaux',
            options: catalogueBateaux.map((b) => ({
                value: `bateau:${b.id}`,
                label: `${b.marque} ${b.modele}`,
                searchText: `${b.marque} ${b.modele}`.toLowerCase(),
            })),
        },
        {
            label: 'Moteurs',
            options: catalogueMoteurs.map((m) => ({
                value: `moteur:${m.id}`,
                label: `${m.marque} ${m.modele}`,
                searchText: `${m.marque} ${m.modele}`.toLowerCase(),
            })),
        },
        {
            label: 'Hélices',
            options: catalogueHelices.map((h) => ({
                value: `helice:${h.id}`,
                label: `${h.marque} ${h.modele}`,
                searchText: `${h.marque} ${h.modele}`.toLowerCase(),
            })),
        },
        {
            label: 'Remorques',
            options: catalogueRemorques.map((r) => ({
                value: `remorque:${r.id}`,
                label: `${r.marque} ${r.modele}`,
                searchText: `${r.marque} ${r.modele}`.toLowerCase(),
            })),
        },
    ], [produits, catalogueBateaux, catalogueMoteurs, catalogueHelices, catalogueRemorques]);

    const getCatalogueItemPrice = (ref?: string): number => {
        if (!ref) return 0;
        const [type, idStr] = ref.split(':');
        const id = parseInt(idStr, 10);
        if (isNaN(id)) return 0;
        if (type === 'produit') return produits.find((p) => p.id === id)?.prixVenteTTC || 0;
        if (type === 'bateau') return catalogueBateaux.find((b) => b.id === id)?.prixVenteTTC || 0;
        if (type === 'moteur') return catalogueMoteurs.find((m) => m.id === id)?.prixVenteTTC || 0;
        if (type === 'helice') return catalogueHelices.find((h) => h.id === id)?.prixVenteTTC || 0;
        if (type === 'remorque') return catalogueRemorques.find((r) => r.id === id)?.prixVenteTTC || 0;
        return 0;
    };
    const serviceOptions = useMemo(
        () => services.map((service) => ({ value: service.id, label: service.nom })),
        [services]
    );

    const filteredVentes = useMemo(() => {
        if (!searchQuery.trim()) return ventes;
        const q = searchQuery.toLowerCase();
        return ventes.filter((v) => {
            const clientLabel = getClientLabel(v.client).toLowerCase();
            const date = (v.date || '').toLowerCase();
            const paiement = (modePaiementOptions.find((o) => o.value === v.modePaiement)?.label || v.modePaiement || '').toLowerCase();
            return clientLabel.includes(q) || date.includes(q) || paiement.includes(q);
        });
    }, [ventes, searchQuery]);

    const fetchVentes = async () => {
        setLoading(true);
        try {
            const response = await api.get('/ventes/search', {
                params: { comptoir: true }
            });
            setVentes(response.data || []);
        } catch {
            message.error('Erreur lors du chargement des ventes comptoir.');
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [
                bateauxRes,
                moteursRes,
                remorquesRes,
                forfaitsRes,
                servicesRes,
                catProduitsRes,
                catBateauxRes,
                catMoteursRes,
                catHelicesRes,
                catRemorquesRes
            ] = await Promise.all([
                api.get('/bateaux'),
                api.get('/moteurs'),
                api.get('/remorques'),
                api.get('/forfaits'),
                api.get('/services'),
                api.get('/catalogue/produits'),
                api.get('/catalogue/bateaux'),
                api.get('/catalogue/moteurs'),
                api.get('/catalogue/helices'),
                api.get('/catalogue/remorques')
            ]);
            setBateaux(bateauxRes.data || []);
            setMoteurs(moteursRes.data || []);
            setRemorques(remorquesRes.data || []);
            setForfaits(forfaitsRes.data || []);
            setServices(servicesRes.data || []);
            setProduits(catProduitsRes.data || []);
            setCatalogueBateaux(catBateauxRes.data || []);
            setCatalogueMoteurs(catMoteursRes.data || []);
            setCatalogueHelices(catHelicesRes.data || []);
            setCatalogueRemorques(catRemorquesRes.data || []);
        } catch {
            message.error('Erreur lors du chargement des listes de reference.');
        }
    };

    useEffect(() => {
        fetchVentes();
        fetchOptions();
    }, []);

    const refreshCurrentVente = async (id: number) => {
        try {
            const res = await api.get<VenteEntity>(`/ventes/${id}`);
            setCurrentVente(res.data);
        } catch {
            message.error('Erreur lors du rechargement de la vente');
        }
    };

    const openPaiementModal = async () => {
        const restant = (currentVente?.prixVenteTTC ?? 0) -
            (currentVente?.paiements ?? []).reduce((s, p) => s + p.montant, 0);
        setPaiementMode('CARTE');
        setPaiementMontant(Math.max(0, Math.round(restant * 100) / 100));
        setPaiementNotes('');
        setPaiementAvoirId(null);
        setAvoirsDisponibles([]);
        setPaiementModalVisible(true);
    };

    const loadAvoirsDisponibles = async (mode: ModeReglement) => {
        if (mode !== 'AVOIR' || !currentVente?.client?.id) return;
        try {
            const res = await api.get<AvoirDisponible[]>(
                `/avoirs/search?clientId=${currentVente.client.id}&status=EMIS`
            );
            setAvoirsDisponibles((res.data || []).filter(
                (a) => Math.round((a.montantTTC - a.montantUtilise) * 100) / 100 > 0.005
            ));
        } catch {
            setAvoirsDisponibles([]);
        }
    };

    const handleAddPaiement = async () => {
        if (!currentVente?.id) return;
        if (paiementMontant <= 0) { message.warning('Le montant doit être supérieur à zéro'); return; }
        if (paiementMode === 'AVOIR' && !paiementAvoirId) { message.warning('Veuillez sélectionner un avoir'); return; }
        setAddingPaiement(true);
        try {
            await api.post(`/ventes/${currentVente.id}/paiements`, {
                mode: paiementMode,
                montant: paiementMontant,
                notes: paiementNotes || undefined,
                avoirId: paiementMode === 'AVOIR' ? paiementAvoirId : undefined,
            });
            message.success('Paiement ajouté');
            setPaiementModalVisible(false);
            await refreshCurrentVente(currentVente.id);
            fetchVentes();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: string } })?.response?.data || "Erreur lors de l'ajout du paiement";
            message.error(msg);
        } finally {
            setAddingPaiement(false);
        }
    };

    const handleRemovePaiement = async (paiementId: number) => {
        if (!currentVente?.id) return;
        try {
            await api.delete(`/ventes/${currentVente.id}/paiements/${paiementId}`);
            message.success('Paiement supprimé');
            await refreshCurrentVente(currentVente.id);
            fetchVentes();
        } catch {
            message.error('Erreur lors de la suppression du paiement');
        }
    };

    const openNewProduitModal = (lineIndex: number) => {
        setNewProduitTargetLine(lineIndex);
        newProduitForm.resetFields();
        newProduitForm.setFieldsValue(defaultNewProduit);
        setNewProduitFormDirty(false);
        setNewProduitModalVisible(true);
    };

    const handleNewProduitSave = async () => {
        try {
            const values = await newProduitForm.validateFields();
            values.images = values.images || [];
            const res = await api.post('/catalogue/produits', values);
            const created = res.data as ProduitCatalogueEntity;
            message.success('Produit ajouté avec succès');
            setProduits((prev) => [...prev, created]);
            if (newProduitTargetLine !== null && created.id) {
                const currentLines = form.getFieldValue('produits') || [];
                const updated = [...currentLines];
                updated[newProduitTargetLine] = { ...updated[newProduitTargetLine], produitRef: `produit:${created.id}` };
                form.setFieldValue('produits', updated);
                recalculateFromLines('auto');
            }
            setNewProduitFormDirty(false);
            setNewProduitModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const onNewProduitValuesChange = (changedValues: Record<string, unknown>) => {
        if (changedValues.prixVenteHT !== undefined || changedValues.tva !== undefined) {
            const prixVenteHT = newProduitForm.getFieldValue('prixVenteHT') || 0;
            const tva = newProduitForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            newProduitForm.setFieldValue('montantTVA', montantTVA);
            const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
            newProduitForm.setFieldValue('prixVenteTTC', prixVenteTTC);
        }
        if (changedValues.prixVenteTTC !== undefined) {
            const prixVenteTTC = newProduitForm.getFieldValue('prixVenteTTC') || 0;
            const tva = newProduitForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            newProduitForm.setFieldValue('montantTVA', montantTVA);
            const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
            newProduitForm.setFieldValue('prixVenteHT', prixVenteHT);
        }
    };

    const openModal = (vente?: VenteEntity) => {
        if (vente) {
            setIsEdit(true);
            setCurrentVente(vente);
            if (vente.client?.id) {
                setClients((prev) => mergeById(prev, [vente.client as ClientEntity]));
            }
            const produitsCatalogue = (vente.venteProduits || [])
                .map((l) => l.produit)
                .filter((p): p is ProduitCatalogueEntity => !!p?.id);
            if (produitsCatalogue.length > 0) setProduits((prev) => mergeById(prev, produitsCatalogue));
            const bateauxCat = (vente.venteBateauxCatalogue || [])
                .map((l) => l.bateau)
                .filter((b): b is CatalogueBateauEntity => !!b?.id);
            if (bateauxCat.length > 0) setCatalogueBateaux((prev) => mergeById(prev, bateauxCat));
            const moteursCat = (vente.venteMoteursCatalogue || [])
                .map((l) => l.moteur)
                .filter((m): m is CatalogueMoteurEntity => !!m?.id);
            if (moteursCat.length > 0) setCatalogueMoteurs((prev) => mergeById(prev, moteursCat));
            const helicesCat = (vente.venteHelicesCatalogue || [])
                .map((l) => l.helice)
                .filter((h): h is CatalogueHeliceEntity => !!h?.id);
            if (helicesCat.length > 0) setCatalogueHelices((prev) => mergeById(prev, helicesCat));
            const remorquesCat = (vente.venteRemorquesCatalogue || [])
                .map((l) => l.remorque)
                .filter((r): r is CatalogueRemorqueEntity => !!r?.id);
            if (remorquesCat.length > 0) setCatalogueRemorques((prev) => mergeById(prev, remorquesCat));

            const produitLines = [
                ...(vente.venteProduits || [])
                    .filter((l) => l.produit?.id)
                    .map((l) => ({ produitRef: `produit:${l.produit!.id}`, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 })),
                ...(vente.venteBateauxCatalogue || [])
                    .filter((l) => l.bateau?.id)
                    .map((l) => ({ produitRef: `bateau:${l.bateau!.id}`, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 })),
                ...(vente.venteMoteursCatalogue || [])
                    .filter((l) => l.moteur?.id)
                    .map((l) => ({ produitRef: `moteur:${l.moteur!.id}`, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 })),
                ...(vente.venteHelicesCatalogue || [])
                    .filter((l) => l.helice?.id)
                    .map((l) => ({ produitRef: `helice:${l.helice!.id}`, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 })),
                ...(vente.venteRemorquesCatalogue || [])
                    .filter((l) => l.remorque?.id)
                    .map((l) => ({ produitRef: `remorque:${l.remorque!.id}`, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 })),
            ];
            form.setFieldsValue({
                status: vente.status || 'DEVIS',
                bonPourAccord: vente.bonPourAccord || false,
                signatureBonPourAccord: vente.signatureBonPourAccord,
                clientId: vente.client?.id,
                bateauId: vente.bateau?.id,
                moteurId: vente.moteur?.id,
                remorqueId: vente.remorque?.id,
                forfaits: (vente.forfaits || []).filter((item) => !!item?.id).map((item) => ({ forfaitId: item.id, quantite: 1 })),
                produits: [...produitLines, {}],
                services: (vente.services || []).filter((item) => !!item?.id).map((item) => ({ serviceId: item.id, quantite: 1 })),
                date: toDateDayjs(vente.date),
                montantHT: vente.montantHT || 0,
                remise: vente.remise || 0,
                remisePourcentage: vente.montantTTC ? Math.round((((vente.remise || 0) / vente.montantTTC) * 100 + Number.EPSILON) * 100) / 100 : 0,
                tva: vente.tva || 0,
                montantTVA: vente.montantTVA || 0,
                montantTTC: vente.montantTTC || 0,
                prixVenteTTC: vente.prixVenteTTC || 0,
                modePaiement: vente.modePaiement
            });
        } else {
            setIsEdit(false);
            setCurrentVente(null);
            form.resetFields();
            form.setFieldsValue({ ...defaultVente, date: getTodayDayjs() });
        }
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
                },
            });
        } else {
            setModalVisible(false);
        }
    };

    const handleNewProduitCancel = () => {
        if (newProduitFormDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setNewProduitFormDirty(false);
                    setNewProduitModalVisible(false);
                },
            });
        } else {
            setNewProduitModalVisible(false);
        }
    };

    const toPayload = (values: VenteFormValues): VenteEntity => ({
        status: values.status,
        bonPourAccord: values.bonPourAccord,
        signatureBonPourAccord: values.signatureBonPourAccord,
        comptoir: true,
        client: clients.find((client) => client.id === values.clientId),
        bateau: bateaux.find((bateau) => bateau.id === values.bateauId),
        moteur: moteurs.find((moteur) => moteur.id === values.moteurId),
        remorque: remorques.find((remorque) => remorque.id === values.remorqueId),
        forfaits: (values.forfaits || [])
            .filter((line) => line.forfaitId)
            .flatMap((line) => {
                const item = forfaits.find((forfait) => forfait.id === line.forfaitId);
                return item ? [item] : [];
            }) as ForfaitEntity[],
        venteProduits: (values.produits || [])
            .filter((line) => line.produitRef?.startsWith('produit:'))
            .flatMap<VenteProduitLigne>((line) => {
                const id = parseInt((line.produitRef || '').split(':')[1], 10);
                const produit = produits.find((p) => p.id === id);
                return produit ? [{
                    produit,
                    quantite: Math.max(1, Math.floor(line.quantite || 1)),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
        venteBateauxCatalogue: (values.produits || [])
            .filter((line) => line.produitRef?.startsWith('bateau:'))
            .flatMap<VenteBateauCatalogueLigne>((line) => {
                const id = parseInt((line.produitRef || '').split(':')[1], 10);
                const bateau = catalogueBateaux.find((b) => b.id === id);
                return bateau ? [{
                    bateau,
                    quantite: Math.max(1, Math.floor(line.quantite || 1)),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
        venteMoteursCatalogue: (values.produits || [])
            .filter((line) => line.produitRef?.startsWith('moteur:'))
            .flatMap<VenteMoteurCatalogueLigne>((line) => {
                const id = parseInt((line.produitRef || '').split(':')[1], 10);
                const moteur = catalogueMoteurs.find((m) => m.id === id);
                return moteur ? [{
                    moteur,
                    quantite: Math.max(1, Math.floor(line.quantite || 1)),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
        venteHelicesCatalogue: (values.produits || [])
            .filter((line) => line.produitRef?.startsWith('helice:'))
            .flatMap<VenteHeliceCatalogueLigne>((line) => {
                const id = parseInt((line.produitRef || '').split(':')[1], 10);
                const helice = catalogueHelices.find((h) => h.id === id);
                return helice ? [{
                    helice,
                    quantite: Math.max(1, Math.floor(line.quantite || 1)),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
        venteRemorquesCatalogue: (values.produits || [])
            .filter((line) => line.produitRef?.startsWith('remorque:'))
            .flatMap<VenteRemorqueCatalogueLigne>((line) => {
                const id = parseInt((line.produitRef || '').split(':')[1], 10);
                const remorque = catalogueRemorques.find((r) => r.id === id);
                return remorque ? [{
                    remorque,
                    quantite: Math.max(1, Math.floor(line.quantite || 1)),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
        services: (values.services || [])
            .filter((line) => line.serviceId)
            .flatMap((line) => {
                const item = services.find((service) => service.id === line.serviceId);
                return item ? [item] : [];
            }) as ServiceEntity[],
        date: toBackendDateValue(values.date),
        montantHT: values.montantHT || 0,
        remise: values.remise || 0,
        tva: values.tva || 0,
        montantTVA: values.montantTVA || 0,
        montantTTC: values.montantTTC || 0,
        prixVenteTTC: values.prixVenteTTC || 0,
        modePaiement: values.modePaiement
    });

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const payload = toPayload(values);
            if (isEdit && currentVente?.id) {
                const res = await api.put(`/ventes/${currentVente.id}`, { ...currentVente, ...payload });
                message.success('Vente comptoir modifiee avec succes');
                setCurrentVente(res.data);
                form.setFieldsValue(values);
            } else {
                const res = await api.post('/ventes', payload);
                message.success('Vente comptoir ajoutee avec succes');
                setIsEdit(true);
                setCurrentVente(res.data);
                form.setFieldsValue(values);
            }
            setFormDirty(false);
            fetchVentes();
        } catch (error) {
            const formError = error as { errorFields?: unknown[] };
            if (Array.isArray(formError.errorFields) && formError.errorFields.length > 0) {
                // Les erreurs de validation sont affichees dans le formulaire.
                return;
            }
            if (axios.isAxiosError(error)) {
                message.error(error.response?.data?.message || "Erreur lors de l'enregistrement de la vente comptoir.");
                return;
            }
            message.error("Erreur lors de l'enregistrement de la vente comptoir.");
        }
    };

    const handleDelete = async (id?: number) => {
        if (!id) {
            return;
        }
        try {
            await api.delete(`/ventes/${id}`);
            message.success('Vente comptoir supprimee avec succes');
            fetchVentes();
        } catch {
            message.error('Erreur lors de la suppression de la vente comptoir.');
        }
    };

    const handleMarkPaid = async () => {
        if (!currentVente?.id) return;
        const values = await form.validateFields();
        const totalPaiements = (currentVente.paiements ?? []).reduce((s, p) => s + p.montant, 0);
        const prixVenteTTC = currentVente.prixVenteTTC ?? 0;
        if (totalPaiements < prixVenteTTC - 0.005) {
            const restant = Math.round((prixVenteTTC - totalPaiements) * 100) / 100;
            message.warning(`Montant restant à régler : ${formatEuro(restant)}. Ajoutez un paiement avant de marquer comme payée.`);
            return;
        }
        form.setFieldsValue({ status: 'FACTURE_PAYEE' });
        const payload = toPayload({ ...values, status: 'FACTURE_PAYEE' });
        try {
            const res = await api.put(`/ventes/${currentVente.id}`, { ...currentVente, ...payload });
            message.success('Vente marquée comme payée');
            setCurrentVente(res.data);
            form.setFieldsValue({ status: res.data.status });
            setFormDirty(false);
            fetchVentes();
        } catch {
            message.error('Erreur lors du marquage comme payée');
            form.setFieldsValue({ status: 'FACTURE_PRETE' });
        }
    };

    const getProduitLines = (vente: VenteEntity) => {
        type LineItem = { id: number; nom: string; marque?: string; prixVenteTTC?: number; quantite: number; remise: number };
        const lines: LineItem[] = [];
        (vente.venteProduits || []).forEach((l) => {
            if (!l.produit?.id) return;
            lines.push({ id: l.produit.id, nom: l.produit.nom, marque: l.produit.marque, prixVenteTTC: l.produit.prixVenteTTC, quantite: l.quantite || 1, remise: l.remise || 0 });
        });
        (vente.venteBateauxCatalogue || []).forEach((l) => {
            if (!l.bateau?.id) return;
            lines.push({ id: l.bateau.id, nom: `${l.bateau.marque} ${l.bateau.modele}`, marque: l.bateau.marque, prixVenteTTC: l.bateau.prixVenteTTC, quantite: l.quantite || 1, remise: l.remise || 0 });
        });
        (vente.venteMoteursCatalogue || []).forEach((l) => {
            if (!l.moteur?.id) return;
            lines.push({ id: l.moteur.id, nom: `${l.moteur.marque} ${l.moteur.modele}`, marque: l.moteur.marque, prixVenteTTC: l.moteur.prixVenteTTC, quantite: l.quantite || 1, remise: l.remise || 0 });
        });
        (vente.venteHelicesCatalogue || []).forEach((l) => {
            if (!l.helice?.id) return;
            lines.push({ id: l.helice.id, nom: `${l.helice.marque} ${l.helice.modele}`, marque: l.helice.marque, prixVenteTTC: l.helice.prixVenteTTC, quantite: l.quantite || 1, remise: l.remise || 0 });
        });
        (vente.venteRemorquesCatalogue || []).forEach((l) => {
            if (!l.remorque?.id) return;
            lines.push({ id: l.remorque.id, nom: `${l.remorque.marque} ${l.remorque.modele}`, marque: l.remorque.marque, prixVenteTTC: l.remorque.prixVenteTTC, quantite: l.quantite || 1, remise: l.remise || 0 });
        });
        return lines;
    };

    const openPrintDocument = (_title: string, contentHtml: string, _width: number = 900) => {
        // Print through a hidden iframe to avoid opening a new tab/window.
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const cleanup = () => {
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        };

        const iframeWindow = iframe.contentWindow;
        if (!iframeWindow) {
            cleanup();
            message.error("Impossible de lancer l'impression.");
            return;
        }

        iframeWindow.document.open();
        iframeWindow.document.write(contentHtml);
        iframeWindow.document.close();
        iframeWindow.focus();
        iframeWindow.print();

        setTimeout(cleanup, 1000);
    };

    const renderPaiementsHtml = (vente: VenteEntity) => {
        const modeLabels: Record<string, string> = { CHEQUE: 'Chèque', VIREMENT: 'Virement', CARTE: 'Carte', 'ESPÈCES': 'Espèces', AVOIR: 'Avoir' };
        const ps = vente.paiements ?? [];
        if (ps.length > 0) {
            return ps.map((p) => {
                const label = modeLabels[p.mode] ?? p.mode;
                const avoir = p.avoirId ? ` (avoir #${p.avoirId})` : '';
                return `<div class="row">${escapeHtml(label)}${escapeHtml(avoir)} : ${escapeHtml(formatEuro(p.montant))}</div>`;
            }).join('');
        }
        if (vente.modePaiement) return `<div class="row"><strong>Mode de paiement:</strong> ${escapeHtml(vente.modePaiement)}</div>`;
        return '';
    };

    const handlePrintInvoice = (vente: VenteEntity) => {
        const title = `Facture #${vente.id || '-'}`;
        const produitRows = getProduitLines(vente)
            .map((item) => {
                const pu = item.prixVenteTTC || 0;
                const brut = pu * item.quantite;
                const total = Math.max(0, brut - item.remise);
                return `
                <tr>
                    <td>${escapeHtml(item.nom)}</td>
                    <td style="text-align:right;">${escapeHtml(formatEuro(pu))}</td>
                    <td style="text-align:right;">${item.quantite}</td>
                    <td style="text-align:right;">${escapeHtml(formatEuro(item.remise))}</td>
                    <td style="text-align:right;">${escapeHtml(formatEuro(total))}</td>
                </tr>`;
            })
            .join('');

        openPrintDocument(
            title,
            `
                <html>
                <head>
                    <title>${escapeHtml(title)}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 24px; color: #1f1f1f; }
                        h1 { margin-bottom: 8px; }
                        .meta { margin-bottom: 16px; color: #595959; }
                        .row { margin-bottom: 6px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                        th, td { border: 1px solid #d9d9d9; padding: 8px; }
                        th { background: #fafafa; text-align: left; }
                    </style>
                </head>
                <body>
                    <h1>${escapeHtml(title)}</h1>
                    <div class="meta">Date: ${escapeHtml(formatDate(vente.date))}</div>
                    <div class="row"><strong>Client:</strong> ${escapeHtml(getClientLabel(vente.client))}</div>
                    ${renderPaiementsHtml(vente) ? `<div><strong>Règlements :</strong>${renderPaiementsHtml(vente)}</div>` : ''}
                    <div class="row"><strong>Montant HT:</strong> ${escapeHtml(formatEuro(vente.montantHT))}</div>
                    <div class="row"><strong>Montant TVA:</strong> ${escapeHtml(formatEuro(vente.montantTVA))}</div>
                    <div class="row"><strong>Montant TTC:</strong> ${escapeHtml(formatEuro(vente.montantTTC))}</div>
                    <div class="row"><strong>Remise:</strong> ${escapeHtml(formatEuro(vente.remise))}</div>
                    <div class="row"><strong>Total a payer:</strong> ${escapeHtml(formatEuro(vente.prixVenteTTC))}</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Produit</th>
                                <th style="text-align:right;">P.U. TTC</th>
                                <th style="text-align:right;">Qté</th>
                                <th style="text-align:right;">Remise</th>
                                <th style="text-align:right;">Total TTC</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${produitRows || '<tr><td colspan="5">Aucun produit</td></tr>'}
                        </tbody>
                    </table>
                </body>
                </html>
            `
        );
    };

    const handlePrintReceipt = (vente: VenteEntity) => {
        const title = `Ticket #${vente.id || '-'}`;
        const produitRows = getProduitLines(vente)
            .map((item) => {
                const pu = item.prixVenteTTC || 0;
                const brut = pu * item.quantite;
                const total = Math.max(0, brut - item.remise);
                const remiseLine = item.remise > 0
                    ? `<div class="line sub"><span>Remise</span><span>-${escapeHtml(formatEuro(item.remise))}</span></div>`
                    : '';
                return `
                <div class="line">
                    <span>${escapeHtml(item.nom)}</span>
                    <span>x${item.quantite}</span>
                </div>
                <div class="line sub">
                    <span>${escapeHtml(formatEuro(pu))} /u</span>
                    <span>${escapeHtml(formatEuro(total))}</span>
                </div>${remiseLine}`;
            })
            .join('');

        openPrintDocument(
            title,
            `
                <html>
                <head>
                    <title>${escapeHtml(title)}</title>
                    <style>
                        body { font-family: "Courier New", monospace; width: 320px; margin: 16px auto; color: #000; }
                        h2 { text-align: center; margin: 0 0 8px; }
                        .line { display: flex; justify-content: space-between; margin: 4px 0; }
                        .line.sub { font-size: 0.85em; color: #555; margin-top: -2px; }
                        .separator { border-top: 1px dashed #000; margin: 10px 0; }
                        .center { text-align: center; }
                    </style>
                </head>
                <body>
                    <h2>${escapeHtml(title)}</h2>
                    <div class="center">${escapeHtml(formatDate(vente.date))}</div>
                    <div class="center">${escapeHtml(getClientLabel(vente.client))}</div>
                    <div class="separator"></div>
                    ${produitRows || '<div class="line"><span>Aucun produit</span><span>-</span></div>'}
                    <div class="separator"></div>
                    <div class="line"><strong>TOTAL TTC</strong><strong>${escapeHtml(formatEuro(vente.prixVenteTTC))}</strong></div>
                    ${(vente.paiements ?? []).length > 0
                        ? (vente.paiements ?? []).map((p) => {
                            const modeLabels: Record<string, string> = { CHEQUE: 'Chèque', VIREMENT: 'Virement', CARTE: 'Carte', 'ESPÈCES': 'Espèces', AVOIR: 'Avoir' };
                            const label = modeLabels[p.mode] ?? p.mode;
                            const avoir = p.avoirId ? ` (avoir #${p.avoirId})` : '';
                            return `<div class="line"><span>${escapeHtml(label)}${escapeHtml(avoir)}</span><span>${escapeHtml(formatEuro(p.montant))}</span></div>`;
                        }).join('')
                        : `<div class="line"><span>Paiement</span><span>${escapeHtml(vente.modePaiement || '-')}</span></div>`}
                    <div class="center" style="margin-top:12px;">Merci de votre visite</div>
                </body>
                </html>
            `,
            420
        );
    };

    const handlePayment = async (vente: VenteEntity, provider: 'stripe' | 'payplug') => {
        if (!vente.id) {
            message.warning('La vente doit etre enregistree avant de generer un lien de paiement.');
            return;
        }
        try {
            const res = await api.post(`/ventes/${vente.id}/payment-link/${provider}`);
            window.open(res.data.url, '_blank', 'noopener,noreferrer');
        } catch {
            message.error(`Erreur lors de la creation du lien de paiement ${provider === 'stripe' ? 'Stripe' : 'PayPlug'}`);
        }
    };

    const paymentMenuItems = (vente: VenteEntity) => ([
        { key: 'stripe', label: 'Payer via Stripe', onClick: () => handlePayment(vente, 'stripe') },
        { key: 'payplug', label: 'Payer via PayPlug', onClick: () => handlePayment(vente, 'payplug') },
    ]);

    const recalculateFromLines = (remiseSource: 'amount' | 'percentage' | 'auto' = 'auto') => {
        const forfaitLines = form.getFieldValue('forfaits') || [];
        const produitLines = form.getFieldValue('produits') || [];
        const serviceLines = form.getFieldValue('services') || [];
        let remise = form.getFieldValue('remise') || 0;
        let remisePourcentage = form.getFieldValue('remisePourcentage') || 0;
        const tva = form.getFieldValue('tva') || 0;

        const sumLine = (prixUnitaire: number, quantite: number, remiseLigne: number) => {
            const brut = prixUnitaire * Math.max(1, Math.floor(quantite || 1));
            return Math.max(0, brut - (remiseLigne || 0));
        };
        const forfaitsTTC = forfaitLines.reduce((sum: number, line: { forfaitId?: number; quantite?: number; remise?: number }) => {
            const prixUnitaire = forfaits.find((item) => item.id === line.forfaitId)?.prixTTC || 0;
            return sum + sumLine(prixUnitaire, line.quantite || 1, line.remise || 0);
        }, 0);
        const produitsTTC = produitLines.reduce((sum: number, line: { produitRef?: string; quantite?: number; remise?: number }) => {
            const prixUnitaire = getCatalogueItemPrice(line.produitRef);
            return sum + sumLine(prixUnitaire, line.quantite || 1, line.remise || 0);
        }, 0);
        const servicesTTC = serviceLines.reduce((sum: number, line: { serviceId?: number; quantite?: number; remise?: number }) => {
            const prixUnitaire = services.find((item) => item.id === line.serviceId)?.prixTTC || 0;
            return sum + sumLine(prixUnitaire, line.quantite || 1, line.remise || 0);
        }, 0);

        const montantTTC = Math.round(((forfaitsTTC + produitsTTC + servicesTTC) + Number.EPSILON) * 100) / 100;
        const montantTVA = Math.round((((montantTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
        const montantHT = Math.round(((montantTTC - montantTVA) + Number.EPSILON) * 100) / 100;

        if (remiseSource === 'percentage') {
            remise = Math.round((((montantTTC * remisePourcentage) / 100) + Number.EPSILON) * 100) / 100;
        } else {
            remisePourcentage = montantTTC > 0
                ? Math.round((((remise / montantTTC) * 100) + Number.EPSILON) * 100) / 100
                : 0;
        }

        const prixVenteTTC = Math.round(((montantTTC - remise) + Number.EPSILON) * 100) / 100;

        form.setFieldValue('montantHT', montantHT);
        form.setFieldValue('montantTVA', montantTVA);
        form.setFieldValue('montantTTC', montantTTC);
        form.setFieldValue('remise', remise);
        form.setFieldValue('remisePourcentage', remisePourcentage);
        form.setFieldValue('prixVenteTTC', prixVenteTTC);
    };

    const syncLineRemise = (changedProduitLines: Array<Partial<{ produitRef: string; quantite: number; remise: number; remisePourcentage: number }> | undefined>) => {
        const currentLines = form.getFieldValue('produits') || [];
        changedProduitLines.forEach((changed, index) => {
            if (!changed) return;
            const line = currentLines[index];
            if (!line) return;
            const prixUnitaire = getCatalogueItemPrice(line.produitRef);
            const quantite = Math.max(1, Math.floor(line.quantite || 1));
            const brut = Math.round(prixUnitaire * quantite * 100) / 100;
            if (changed.remisePourcentage !== undefined) {
                const remise = Math.round(((brut * (changed.remisePourcentage || 0)) / 100 + Number.EPSILON) * 100) / 100;
                form.setFieldValue(['produits', index, 'remise'], remise);
            } else if (changed.remise !== undefined) {
                const remisePourcentage = brut > 0
                    ? Math.round((((changed.remise || 0) / brut) * 100 + Number.EPSILON) * 100) / 100
                    : 0;
                form.setFieldValue(['produits', index, 'remisePourcentage'], remisePourcentage);
            }
        });
    };

    const onValuesChange = (changedValues: Partial<VenteFormValues>, allValues: VenteFormValues) => {
        if (changedValues.produits !== undefined) {
            // Sync line-level remise EUR <-> % when changed
            const lineRemiseChanged = (changedValues.produits as Array<Partial<{ remise: number; remisePourcentage: number }> | undefined>)
                .some((p) => p && (p.remise !== undefined || p.remisePourcentage !== undefined));
            if (lineRemiseChanged) {
                syncLineRemise(changedValues.produits as Array<Partial<{ produitRef: string; quantite: number; remise: number; remisePourcentage: number }> | undefined>);
            }

            const currentProduitLines = allValues.produits || [];
            if (currentProduitLines.length === 0) {
                form.setFieldValue('produits', [{}]);
                return;
            }
            const lastProduitLine = currentProduitLines[currentProduitLines.length - 1];
            const isLastLineComplete = !!lastProduitLine?.produitRef && (lastProduitLine?.quantite || 0) > 0;
            if (isLastLineComplete) {
                form.setFieldValue('produits', [...currentProduitLines, {}]);
                return;
            }
        }

        if (changedValues.montantTTC !== undefined) {
            const tva = allValues.tva || 0;
            const montantTTC = changedValues.montantTTC || 0;
            const montantTVA = Math.round((((montantTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            const montantHT = Math.round(((montantTTC - montantTVA) + Number.EPSILON) * 100) / 100;
            const remise = allValues.remise || 0;
            const remisePourcentage = montantTTC > 0
                ? Math.round((((remise / montantTTC) * 100) + Number.EPSILON) * 100) / 100
                : 0;
            const prixVenteTTC = Math.round(((montantTTC - remise) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantHT', montantHT);
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('remisePourcentage', remisePourcentage);
            form.setFieldValue('prixVenteTTC', prixVenteTTC);
            return;
        }

        if (changedValues.montantHT !== undefined) {
            const tva = allValues.tva || 0;
            const montantHT = changedValues.montantHT || 0;
            const montantTVA = Math.round(((montantHT * tva / 100) + Number.EPSILON) * 100) / 100;
            const montantTTC = Math.round(((montantHT + montantTVA) + Number.EPSILON) * 100) / 100;
            const remise = allValues.remise || 0;
            const remisePourcentage = montantTTC > 0
                ? Math.round((((remise / montantTTC) * 100) + Number.EPSILON) * 100) / 100
                : 0;
            const prixVenteTTC = Math.round(((montantTTC - remise) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTTC', montantTTC);
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('remisePourcentage', remisePourcentage);
            form.setFieldValue('prixVenteTTC', prixVenteTTC);
            return;
        }

        if (changedValues.montantTVA !== undefined) {
            const montantTTC = allValues.montantTTC || 0;
            const montantTVA = changedValues.montantTVA || 0;
            const montantHT = Math.round(((montantTTC - montantTVA) + Number.EPSILON) * 100) / 100;
            const prixVenteTTC = Math.round(((montantTTC - (allValues.remise || 0)) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantHT', montantHT);
            form.setFieldValue('prixVenteTTC', prixVenteTTC);
            return;
        }

        if (changedValues.prixVenteTTC !== undefined) {
            const montantTTC = allValues.montantTTC || 0;
            const prixVenteTTC = changedValues.prixVenteTTC || 0;
            const remise = Math.round(((montantTTC - prixVenteTTC) + Number.EPSILON) * 100) / 100;
            const remisePourcentage = montantTTC > 0
                ? Math.round((((remise / montantTTC) * 100) + Number.EPSILON) * 100) / 100
                : 0;
            form.setFieldValue('remise', remise);
            form.setFieldValue('remisePourcentage', remisePourcentage);
            return;
        }

        if (changedValues.remisePourcentage !== undefined) {
            const montantTTC = allValues.montantTTC || 0;
            const remisePourcentage = changedValues.remisePourcentage || 0;
            const remise = Math.round(((montantTTC * remisePourcentage / 100) + Number.EPSILON) * 100) / 100;
            const prixVenteTTC = Math.round(((montantTTC - remise) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('remise', remise);
            form.setFieldValue('prixVenteTTC', prixVenteTTC);
            return;
        }

        if (changedValues.remise !== undefined) {
            const montantTTC = allValues.montantTTC || 0;
            const remise = changedValues.remise || 0;
            const remisePourcentage = montantTTC > 0
                ? Math.round((((remise / montantTTC) * 100) + Number.EPSILON) * 100) / 100
                : 0;
            const prixVenteTTC = Math.round(((montantTTC - remise) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('remisePourcentage', remisePourcentage);
            form.setFieldValue('prixVenteTTC', prixVenteTTC);
            return;
        }

        if (
            changedValues.forfaits !== undefined ||
            changedValues.produits !== undefined ||
            changedValues.services !== undefined ||
            changedValues.tva !== undefined
        ) {
            recalculateFromLines('auto');
        }
    };

    const columns = [
        {
            title: 'Date',
            dataIndex: 'date',
            sorter: (a: VenteEntity, b: VenteEntity) => (a.date || '').localeCompare(b.date || ''),
            render: (value: string) => value || '-'
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            sorter: (a: VenteEntity, b: VenteEntity) => (a.status || '').localeCompare(b.status || ''),
            filters: [
                { text: statusLabel.DEVIS, value: 'DEVIS' },
                { text: statusLabel.FACTURE_EN_ATTENTE, value: 'FACTURE_EN_ATTENTE' },
                { text: statusLabel.FACTURE_PRETE, value: 'FACTURE_PRETE' },
                { text: statusLabel.FACTURE_PAYEE, value: 'FACTURE_PAYEE' },
            ],
            onFilter: (value: unknown, record: VenteEntity) => record.status === value,
            render: (value: VenteStatus) => <Tag color={statusColor[value] || 'default'}>{statusLabel[value] || value}</Tag>
        },
        {
            title: 'Client',
            dataIndex: 'client',
            sorter: (a: VenteEntity, b: VenteEntity) => getClientLabel(a.client).localeCompare(getClientLabel(b.client)),
            filters: Array.from(new Map(ventes.filter((v) => v.client).map((v) => [v.client!.id, getClientLabel(v.client)])).entries())
                .map(([, label]) => ({ text: label, value: label }))
                .sort((a, b) => a.text.localeCompare(b.text, 'fr')),
            onFilter: (value: unknown, record: VenteEntity) => getClientLabel(record.client) === value,
            render: (value: ClientEntity) => getClientLabel(value)
        },
        {
            title: 'Mode paiement',
            key: 'modePaiement',
            sorter: (a: VenteEntity, b: VenteEntity) => (a.modePaiement || '').localeCompare(b.modePaiement || ''),
            filters: [
                { text: 'Chèque', value: 'CHEQUE' },
                { text: 'Virement', value: 'VIREMENT' },
                { text: 'Carte', value: 'CARTE' },
                { text: 'Espèces', value: 'ESPÈCES' },
                { text: 'Avoir', value: 'AVOIR' },
            ],
            onFilter: (value: unknown, record: VenteEntity) => {
                const ps = record.paiements ?? [];
                if (ps.length > 0) return ps.some((p) => p.mode === value);
                return record.modePaiement === value;
            },
            render: (_: unknown, record: VenteEntity) => {
                const modeLabels: Record<string, string> = { CHEQUE: 'Chèque', VIREMENT: 'Virement', CARTE: 'Carte', 'ESPÈCES': 'Espèces', AVOIR: 'Avoir' };
                const ps = record.paiements ?? [];
                if (ps.length > 0) {
                    const uniques = Array.from(new Set(ps.map((p) => modeLabels[p.mode] ?? p.mode)));
                    return uniques.join(', ');
                }
                return modePaiementOptions.find((item) => item.value === record.modePaiement)?.label || record.modePaiement || '-';
            }
        },
        {
            title: 'Prix vente TTC',
            dataIndex: 'prixVenteTTC',
            sorter: (a: VenteEntity, b: VenteEntity) => (a.prixVenteTTC || 0) - (b.prixVenteTTC || 0),
            render: (value: number) => formatEuro(value)
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: VenteEntity) => (
                <Space>
                    <Button title="Imprimer facture" icon={<FileTextOutlined />} disabled={record.status !== 'FACTURE_PAYEE'} onClick={() => handlePrintInvoice(record)} />
                    <Button title="Imprimer ticket de caisse" icon={<PrinterOutlined />} disabled={record.status !== 'FACTURE_PAYEE'} onClick={() => handlePrintReceipt(record)} />
                    <Dropdown menu={{ items: paymentMenuItems(record) }} placement="bottomRight">
                        <Button title="Lien de paiement" icon={<CreditCardOutlined />} />
                    </Dropdown>
                    <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm
                        title="Supprimer cette vente comptoir ?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Oui"
                        cancelText="Non"
                        disabled={record.status === 'FACTURE_PAYEE'}
                    >
                        <Button danger icon={<DeleteOutlined />} disabled={record.status === 'FACTURE_PAYEE'} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Card title="Comptoir">
            <Space style={{ marginBottom: 16 }}>
                <Input.Search
                    placeholder="Recherche"
                    enterButton
                    allowClear
                    style={{ width: 600 }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onSearch={(value) => setSearchQuery(value)}
                />
                <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
            </Space>

            <Table
                rowKey="id"
                dataSource={filteredVentes}
                columns={columns}
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
                onRow={(record) => ({
                    onClick: (e) => {
                        if ((e.target as HTMLElement).closest('button, .ant-btn, [role="button"]')) return;
                        openModal(record);
                    },
                    style: { cursor: 'pointer' },
                })}
            />

            <Modal
                title={isEdit ? 'Modifier une vente comptoir' : 'Ajouter une vente comptoir'}
                open={modalVisible}
                onCancel={handleModalCancel}
                footer={[
                    <Button
                        key="print-invoice"
                        icon={<FileTextOutlined />}
                        disabled={!currentVente || watchedStatus !== 'FACTURE_PAYEE'}
                        onClick={() => currentVente && handlePrintInvoice(currentVente)}
                    >
                        Imprimer facture
                    </Button>,
                    <Button
                        key="print-receipt"
                        icon={<PrinterOutlined />}
                        disabled={!currentVente || watchedStatus !== 'FACTURE_PAYEE'}
                        onClick={() => currentVente && handlePrintReceipt(currentVente)}
                    >
                        Imprimer ticket
                    </Button>,
                    ...(!isReadOnly && currentVente ? [<Dropdown
                        key="payment"
                        menu={{ items: currentVente ? paymentMenuItems(currentVente) : [] }}
                        placement="topRight"
                    >
                        <Button icon={<CreditCardOutlined />}>
                            Lien de paiement
                        </Button>
                    </Dropdown>] : []),
                    ...(!isReadOnly && isEdit ? [<Button
                        key="mark-paid"
                        type="primary"
                        danger
                        icon={<CreditCardOutlined />}
                        onClick={handleMarkPaid}
                    >
                        Marquer comme payée
                    </Button>] : []),
                    <Button key="cancel" onClick={handleModalCancel}>
                        Fermer
                    </Button>,
                    ...(!isReadOnly ? [<Button key="save" type="primary" onClick={handleSave}>
                        Enregistrer
                    </Button>] : [])
                ]}
                maskClosable={false}
                destroyOnHidden
                width={1100}
            >
                <Form form={form} layout="vertical" initialValues={defaultVente} onValuesChange={(...args) => { setFormDirty(true); onValuesChange(...args); }} disabled={isReadOnly}>
                    <Form.Item noStyle name="status"><input type="hidden" /></Form.Item>
                    <Form.Item noStyle name="bonPourAccord"><input type="hidden" /></Form.Item>
                    {isReadOnly && (
                        <Tag color="green" style={{ marginBottom: 16, fontSize: 14, padding: '4px 12px' }}>Facture payée — consultation uniquement</Tag>
                    )}
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="date" label="Date">
                                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="clientId" label="Client">
                                <Select
                                    allowClear
                                    showSearch
                                    options={clientOptions}
                                    filterOption={false}
                                    onSearch={handleClientSearch}
                                    notFoundContent={null}
                                    placeholder="Rechercher un client par prénom ou nom"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Produits">
                        <Form.List name="produits">
                            {(fields, { remove }) => (
                                <>
                                    {fields.map((field) => (
                                        <Form.Item key={field.key} shouldUpdate noStyle>
                                            {() => {
                                                const produitRef = form.getFieldValue(['produits', field.name, 'produitRef']);
                                                const prixUnitaire = getCatalogueItemPrice(produitRef) || undefined;
                                                const quantite = form.getFieldValue(['produits', field.name, 'quantite']);
                                                const remiseLigne = form.getFieldValue(['produits', field.name, 'remise']) || 0;
                                                const brutLigne = (prixUnitaire && quantite) ? Math.round(prixUnitaire * quantite * 100) / 100 : undefined;
                                                const totalLigne = brutLigne !== undefined
                                                    ? Math.max(0, Math.round((brutLigne - remiseLigne) * 100) / 100)
                                                    : undefined;
                                                const isEmptyLine = !produitRef;
                                                return (
                                                <Space align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                    <Form.Item
                                                        {...field}
                                                        name={[field.name, 'produitRef']}
                                                        rules={[
                                                            {
                                                                validator: async (_, value) => {
                                                                    const line = form.getFieldValue(['produits', field.name]);
                                                                    const quantite = Number(line?.quantite || 0);
                                                                    if (!value && quantite > 0) {
                                                                        throw new Error('Article requis');
                                                                    }
                                                                }
                                                            }
                                                        ]}
                                                        style={{ width: 320 }}
                                                    >
                                                        <Select
                                                            allowClear
                                                            showSearch
                                                            options={catalogueOptions}
                                                            filterOption={(input, option) =>
                                                                ((option as { searchText?: string } | undefined)?.searchText || '').includes(input.toLowerCase())
                                                            }
                                                            onSearch={handleCatalogueSearch}
                                                            notFoundContent={null}
                                                            placeholder="Rechercher produit, bateau, moteur, hélice ou remorque"
                                                        />
                                                    </Form.Item>
                                                    <Form.Item style={{ width: 110 }}>
                                                        <InputNumber
                                                            addonAfter="EUR"
                                                            value={prixUnitaire ?? undefined}
                                                            disabled
                                                            style={{ width: '100%' }}
                                                            placeholder="P.U."
                                                        />
                                                    </Form.Item>
                                                    <Form.Item
                                                        {...field}
                                                        name={[field.name, 'quantite']}
                                                        rules={[
                                                            {
                                                                validator: async (_, value) => {
                                                                    const line = form.getFieldValue(['produits', field.name]);
                                                                    if (!line?.produitRef && (value === undefined || value === null)) {
                                                                        return;
                                                                    }
                                                                    if (!value || value <= 0) {
                                                                        throw new Error('Quantite requise');
                                                                    }
                                                                }
                                                            }
                                                        ]}
                                                        style={{ width: 90 }}
                                                    >
                                                        <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                    </Form.Item>
                                                    <Form.Item
                                                        {...field}
                                                        name={[field.name, 'remisePourcentage']}
                                                        style={{ width: 110 }}
                                                    >
                                                        <InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} placeholder="Remise" />
                                                    </Form.Item>
                                                    <Form.Item
                                                        {...field}
                                                        name={[field.name, 'remise']}
                                                        style={{ width: 130 }}
                                                    >
                                                        <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} placeholder="Remise" />
                                                    </Form.Item>
                                                    <Form.Item style={{ width: 130 }}>
                                                        <InputNumber
                                                            addonAfter="EUR"
                                                            value={totalLigne}
                                                            disabled
                                                            style={{ width: '100%' }}
                                                            placeholder="Total"
                                                        />
                                                    </Form.Item>
                                                    {isEmptyLine && (
                                                        <Button icon={<PlusOutlined />} title="Créer un produit" onClick={() => openNewProduitModal(field.name)} />
                                                    )}
                                                    <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                </Space>
                                                );
                                            }}
                                        </Form.Item>
                                    ))}
                                </>
                            )}
                        </Form.List>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item name="montantHT" label="Montant HT">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="tva" label="TVA (%)">
                                <InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="montantTVA" label="Montant TVA">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="montantTTC" label="Montant TTC">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={6} offset={6}>
                            <Form.Item name="remisePourcentage" label="Remise (%)">
                                <InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="remise" label="Remise (EUR)">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="prixVenteTTC" label="Prix vente TTC">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {isEdit && currentVente?.id && (() => {
                        const ps = currentVente?.paiements ?? [];
                        const totalPaye = ps.reduce((s, p) => s + p.montant, 0);
                        const totalFacture = currentVente?.prixVenteTTC ?? 0;
                        const restant = Math.round((totalFacture - totalPaye) * 100) / 100;
                        const modeLabels: Record<string, string> = { CHEQUE: 'Chèque', VIREMENT: 'Virement', CARTE: 'Carte', 'ESPÈCES': 'Espèces', AVOIR: 'Avoir' };
                        return (
                            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 16 }}>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                                    <Col>
                                        <Space>
                                            <strong>Paiements</strong>
                                            <span>Total : <strong>{formatEuro(totalFacture)}</strong></span>
                                            <span>Payé : <strong style={{ color: totalPaye >= totalFacture - 0.005 ? '#52c41a' : '#faad14' }}>{formatEuro(totalPaye)}</strong></span>
                                            {restant > 0.005 && <span>Restant : <strong style={{ color: '#ff4d4f' }}>{formatEuro(restant)}</strong></span>}
                                        </Space>
                                    </Col>
                                    <Col>
                                        <Button
                                            type="primary"
                                            icon={<PlusCircleOutlined />}
                                            onClick={openPaiementModal}
                                            disabled={isReadOnly}
                                        >
                                            Ajouter un paiement
                                        </Button>
                                    </Col>
                                </Row>
                                <Table
                                    rowKey="id"
                                    size="small"
                                    bordered
                                    pagination={false}
                                    dataSource={ps}
                                    locale={{ emptyText: 'Aucun paiement enregistré' }}
                                    columns={[
                                        { title: 'Mode', dataIndex: 'mode', width: 110, sorter: (a: VentePaiement, b: VentePaiement) => (a.mode || '').localeCompare(b.mode || ''), render: (v: string) => modeLabels[v] ?? v },
                                        {
                                            title: 'Avoir',
                                            key: 'avoir',
                                            sorter: (a: VentePaiement, b: VentePaiement) => (a.avoirId || 0) - (b.avoirId || 0),
                                            render: (_: unknown, r: VentePaiement) =>
                                                r.avoirId ? `#${r.avoirId} — ${r.avoirMotif ?? ''}` : '-',
                                        },
                                        { title: 'Montant', dataIndex: 'montant', width: 120, align: 'right' as const, sorter: (a: VentePaiement, b: VentePaiement) => (a.montant || 0) - (b.montant || 0), render: (v: number) => formatEuro(v) },
                                        { title: 'Notes', dataIndex: 'notes', sorter: (a: VentePaiement, b: VentePaiement) => (a.notes || '').localeCompare(b.notes || ''), render: (v: string) => v ?? '-' },
                                        {
                                            title: '',
                                            key: 'remove',
                                            width: 50,
                                            render: (_: unknown, r: VentePaiement) => (
                                                <Popconfirm
                                                    title="Supprimer ce paiement ?"
                                                    onConfirm={() => r.id && handleRemovePaiement(r.id)}
                                                    okText="Supprimer"
                                                    cancelText="Annuler"
                                                    disabled={isReadOnly}
                                                >
                                                    <Button
                                                        size="small"
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        disabled={isReadOnly}
                                                    />
                                                </Popconfirm>
                                            ),
                                        },
                                    ]}
                                />
                            </div>
                        );
                    })()}
                    {!isEdit && (
                        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 16, color: '#8c8c8c' }}>
                            Enregistrez d'abord la vente pour ajouter un paiement (espèces, carte, avoir client...).
                        </div>
                    )}
                </Form>

                <Modal
                    title="Créer un produit"
                    open={newProduitModalVisible}
                    onOk={handleNewProduitSave}
                    onCancel={handleNewProduitCancel}
                    maskClosable={false}
                    width={1024}
                    okText="Enregistrer"
                    cancelText="Fermer"
                    destroyOnHidden
                >
                    <Form
                        form={newProduitForm}
                        layout="vertical"
                        initialValues={defaultNewProduit}
                        onValuesChange={(...args) => { setNewProduitFormDirty(true); onNewProduitValuesChange(...args); }}
                    >
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="marque" label="Marque">
                                    <AutoComplete allowClear options={marqueOptions} placeholder="Saisir/select. une marque" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                                    <Input />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="categorie" label="Catégorie" rules={[{ required: true, message: 'La catégorie est requise' }]}>
                                    <Select options={PRODUIT_CATEGORIES} placeholder="Choisir une catégorie" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="ref" label="Référence interne">
                                    <Input />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item name="images" label="Images">
                            <ImageUpload />
                        </Form.Item>
                        <Form.Item name="refs" label="Références complémentaires">
                            <Form.List name="refs">
                                {(fields, { add, remove: removeRef }) => (
                                    <>
                                        {fields.map((field) => (
                                            <Space key={field.key} align="baseline">
                                                <Form.Item
                                                    {...field}
                                                    name={[field.name]}
                                                    style={{ flex: 1 }}
                                                >
                                                    <Input placeholder="Réf. complémentaire" style={{ width: 200 }} />
                                                </Form.Item>
                                                <Button icon={<DeleteOutlined />} danger onClick={() => removeRef(field.name)} />
                                            </Space>
                                        ))}
                                        <Button type="dashed" onClick={() => add()} block style={{ marginTop: 8 }}>
                                            Ajouter une référence
                                        </Button>
                                    </>
                                )}
                            </Form.List>
                        </Form.Item>
                        <Form.Item name="description" label="Description">
                            <Input.TextArea rows={3} placeholder="Description du produit" allowClear />
                        </Form.Item>
                        <Form.Item name="evaluation" label="Évaluation">
                            <Rate allowHalf />
                        </Form.Item>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="stock" label="Stock">
                                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="stockMini" label="Stock minimal d'alerte">
                                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item name="emplacement" label="Emplacement">
                            <Input />
                        </Form.Item>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="prixPublic" label="Prix public">
                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="frais" label="Frais">
                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="tauxMarge" label="Taux de marge (%)">
                                    <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="tauxMarque" label="Taux de marque (%)">
                                    <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="prixVenteHT" label="Prix de vente HT">
                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="tva" label="TVA (%)">
                                    <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="montantTVA" label="Montant TVA">
                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="prixVenteTTC" label="Prix de vente TTC">
                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Modal>

                <Modal
                    title="Ajouter un paiement"
                    open={paiementModalVisible}
                    onCancel={() => setPaiementModalVisible(false)}
                    onOk={handleAddPaiement}
                    okText="Valider"
                    confirmLoading={addingPaiement}
                    destroyOnHidden
                    width={480}
                >
                    <Form layout="vertical">
                        <Form.Item label="Mode de règlement" required>
                            <Select
                                value={paiementMode}
                                onChange={(v) => {
                                    setPaiementMode(v);
                                    setPaiementAvoirId(null);
                                    loadAvoirsDisponibles(v);
                                }}
                                options={[
                                    { value: 'CARTE', label: 'Carte' },
                                    { value: 'ESPÈCES', label: 'Espèces' },
                                    { value: 'CHEQUE', label: 'Chèque' },
                                    { value: 'VIREMENT', label: 'Virement' },
                                    { value: 'AVOIR', label: 'Avoir client' },
                                ]}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>

                        {paiementMode === 'AVOIR' && (
                            <Form.Item label="Avoir à appliquer" required>
                                <Select
                                    placeholder="Sélectionner un avoir"
                                    value={paiementAvoirId ?? undefined}
                                    onChange={(v) => {
                                        setPaiementAvoirId(v);
                                        const avoir = avoirsDisponibles.find((a) => a.id === v);
                                        if (avoir) {
                                            const restantAvoir = Math.round((avoir.montantTTC - avoir.montantUtilise) * 100) / 100;
                                            const restantFacture = Math.max(0, Math.round(
                                                ((currentVente?.prixVenteTTC ?? 0) -
                                                (currentVente?.paiements ?? []).reduce((s, p) => s + p.montant, 0)) * 100
                                            ) / 100);
                                            setPaiementMontant(Math.min(restantAvoir, restantFacture));
                                        }
                                    }}
                                    options={avoirsDisponibles.map((a) => ({
                                        value: a.id,
                                        label: `#${a.id} — ${a.motif ?? '(sans motif)'} — solde ${formatEuro(Math.round((a.montantTTC - a.montantUtilise) * 100) / 100)}`,
                                    }))}
                                    notFoundContent="Aucun avoir disponible pour ce client"
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        )}

                        <Form.Item label="Montant" required>
                            <InputNumber
                                min={0.01}
                                precision={2}
                                value={paiementMontant}
                                onChange={(v) => setPaiementMontant(v ?? 0)}
                                addonAfter="€"
                                style={{ width: '100%' }}
                            />
                        </Form.Item>

                        <Form.Item label="Notes (optionnel)">
                            <Input
                                value={paiementNotes}
                                onChange={(e) => setPaiementNotes(e.target.value)}
                                placeholder="Ex: chèque n°12345"
                            />
                        </Form.Item>
                    </Form>
                </Modal>
            </Modal>
        </Card>
    );
}
