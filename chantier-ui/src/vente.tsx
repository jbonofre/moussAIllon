import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AutoComplete,
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Rate,
    Row,
    Select,
    Space,
    Steps,
    Tabs,
    Table,
    Tag,
    DatePicker,
    Dropdown,
    message
} from 'antd';
import { CalendarOutlined, CheckCircleOutlined, CreditCardOutlined, DeleteOutlined, EditOutlined, FileDoneOutlined, FileTextOutlined, LeftOutlined, MailOutlined, PlusCircleOutlined, PlusOutlined, PrinterOutlined, RightOutlined, SendOutlined, SolutionOutlined, WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from './api.ts';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import { useNavigation } from './navigation-context.tsx';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';

interface ClientEntity {
    id: number;
    prenom?: string;
    nom: string;
    email?: string;
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

interface TechnicienEntity {
    id: number;
    prenom?: string;
    nom?: string;
}

type PlanningStatus = 'EN_ATTENTE' | 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'INCIDENT' | 'ANNULEE';

interface TaskEntity {
    id?: number;
    nom?: string;
    description?: string;
    done?: boolean;
}

interface VenteForfaitEntity {
    id?: number;
    forfait?: ForfaitEntity;
    quantite?: number;
    techniciens?: TechnicienEntity[];
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    status?: PlanningStatus;
    statusDate?: string;
    dureeReelle?: number;
    incidentDate?: string;
    incidentDetails?: string;
    notes?: string;
    taches?: TaskEntity[];
    images?: string[];
    documents?: string[];
}

interface VenteServiceEntity {
    id?: number;
    service?: ServiceEntity;
    quantite?: number;
    techniciens?: TechnicienEntity[];
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    status?: PlanningStatus;
    statusDate?: string;
    dureeReelle?: number;
    incidentDate?: string;
    incidentDetails?: string;
    notes?: string;
    taches?: TaskEntity[];
    images?: string[];
    documents?: string[];
}

interface ForfaitProduitEntity {
    produit?: ProduitCatalogueEntity;
    quantite?: number;
}

interface ForfaitMainOeuvreEntity {
    mainOeuvre?: MainOeuvreEntity;
    quantite?: number;
}

interface ForfaitEntity {
    id: number;
    reference?: string;
    nom: string;
    dureeEstimee?: number;
    moteursAssocies?: MoteurClientEntity[];
    bateauxAssocies?: BateauClientEntity[];
    produits?: ForfaitProduitEntity[];
    mainOeuvres?: ForfaitMainOeuvreEntity[];
    heuresFonctionnement?: number;
    joursFrequence?: number;
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
    taches?: TaskEntity[];
}

const defaultNewForfait = {
    reference: '', nom: '',
    dureeEstimee: 0,
    moteurIds: [] as number[],
    bateauIds: [] as number[],
    produits: [{}] as Array<{ produitId?: number; quantite?: number }>,
    mainOeuvres: [{}] as Array<{ mainOeuvreId?: number; quantite?: number }>,
    taches: [{}] as Array<{ nom?: string; description?: string; done?: boolean }>,
    heuresFonctionnement: 0,
    joursFrequence: 0,
    prixHT: 0, tva: 20, montantTVA: 0, prixTTC: 0,
};

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


const defaultNewProduit = {
    nom: '',
    marque: '',
    categorie: '',
    ref: '',
    refs: [],
    images: [],
    documents: [],
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

interface MainOeuvreEntity {
    id: number;
    reference?: string;
    nom: string;
    description?: string;
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

interface ServiceMainOeuvreEntity {
    id?: number;
    mainOeuvre?: MainOeuvreEntity;
    quantite: number;
}

interface ServiceProduitEntity {
    id?: number;
    produit?: ProduitCatalogueEntity;
    quantite: number;
}

interface ServiceEntity {
    id: number;
    nom: string;
    description?: string;
    dureeEstimee?: number;
    mainOeuvres?: ServiceMainOeuvreEntity[];
    produits?: ServiceProduitEntity[];
    taches?: TaskEntity[];
    prixHT?: number;
    tva?: number;
    montantTVA?: number;
    prixTTC?: number;
}

const defaultNewService = {
    nom: '', description: '',
    dureeEstimee: 0,
    mainOeuvres: [{}] as Array<{ mainOeuvreId?: number; quantite?: number }>,
    produits: [{}] as Array<{ produitId?: number; quantite?: number }>,
    taches: [{}] as Array<{ nom?: string; description?: string; done?: boolean }>,
    prixHT: 0, tva: 20, montantTVA: 0, prixTTC: 0,
};

type VenteStatus = 'DEVIS' | 'FACTURE_EN_ATTENTE' | 'FACTURE_PRETE' | 'FACTURE_PAYEE';
type ModePaiement = 'CHEQUE' | 'VIREMENT' | 'CARTE' | 'ESPÈCES';

interface VenteEntity {
    id?: number;
    status: VenteStatus;
    bonPourAccord?: boolean;
    ordreDeReparation?: boolean;
    comptoir?: boolean;
    signatureBonPourAccord?: string;
    client?: ClientEntity;
    bateau?: BateauClientEntity;
    moteur?: MoteurClientEntity;
    remorque?: RemorqueClientEntity;
    venteForfaits?: VenteForfaitEntity[];
    venteServices?: VenteServiceEntity[];
    produits?: ProduitCatalogueEntity[];
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
    images?: string[];
    documents?: string[];
    rappel1Jours?: number;
    rappel2Jours?: number;
    rappel3Jours?: number;
}

interface RappelHistoriqueEntity {
    id: number;
    numeroRappel: number;
    destinataire: string;
    sujet: string;
    contenu: string;
    dateEnvoi?: string;
}

interface VenteFormValues {
    status: VenteStatus;
    bonPourAccord?: boolean;
    ordreDeReparation?: boolean;
    signatureBonPourAccord?: string;
    clientId?: number;
    bateauId?: number;
    moteurId?: number;
    remorqueId?: number;
    venteForfaits: Array<{
        forfaitId?: number;
        quantite?: number;
        technicienIds?: number[];
        status?: PlanningStatus;
        datePlanification?: string;
        dateDebut?: string;
        dateFin?: string;
        dureeReelle?: number;
        notes?: string;
        incidentDate?: string;
        incidentDetails?: string;
        taches?: Array<{ nom?: string; description?: string; done?: boolean }>;
        images?: string[];
        documents?: string[];
    }>;
    venteServices: Array<{
        serviceId?: number;
        quantite?: number;
        technicienIds?: number[];
        status?: PlanningStatus;
        datePlanification?: string;
        dateDebut?: string;
        dateFin?: string;
        dureeReelle?: number;
        notes?: string;
        incidentDate?: string;
        incidentDetails?: string;
        taches?: Array<{ nom?: string; description?: string; done?: boolean }>;
        images?: string[];
        documents?: string[];
    }>;
    produits: Array<{ produitId?: number; quantite?: number }>;
    date?: string;
    montantHT: number;
    remise: number;
    remisePourcentage: number;
    tva: number;
    montantTVA: number;
    montantTTC: number;
    prixVenteTTC: number;
    modePaiement?: ModePaiement;
    images?: string[];
    documents?: string[];
    rappel1Jours?: number;
    rappel2Jours?: number;
    rappel3Jours?: number;
}

interface SearchFilters {
    status?: VenteStatus;
    clientId?: number;
}

const statusOptions: Array<{ value: VenteStatus; label: string }> = [
    { value: 'DEVIS', label: 'Devis/Ordre de Réparation' },
    { value: 'FACTURE_EN_ATTENTE', label: 'Facture en attente' },
    { value: 'FACTURE_PRETE', label: 'Facture prête' },
    { value: 'FACTURE_PAYEE', label: 'Facture payée' }
];

const modePaiementOptions: Array<{ value: ModePaiement; label: string }> = [
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'CARTE', label: 'Carte' },
    { value: 'ESPÈCES', label: 'Especes' }
];

const planningStatusOptions: Array<{ value: PlanningStatus; label: string }> = [
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'PLANIFIEE', label: 'Planifiee' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'TERMINEE', label: 'Terminee' },
    { value: 'INCIDENT', label: 'Incident' },
    { value: 'ANNULEE', label: 'Annulee' }
];

const statusColor: Record<VenteStatus, string> = {
    DEVIS: 'default',
    FACTURE_EN_ATTENTE: 'orange',
    FACTURE_PRETE: 'blue',
    FACTURE_PAYEE: 'green'
};

const venteStepIndex = (status: VenteStatus, bonPourAccord?: boolean): number => {
    switch (status) {
        case 'DEVIS':
            return bonPourAccord ? 1 : 0;
        case 'FACTURE_EN_ATTENTE':
            return 2;
        case 'FACTURE_PRETE':
            return 3;
        case 'FACTURE_PAYEE':
            return 4;
        default:
            return 0;
    }
};

const formatStepDate = (date?: string) => {
    if (!date) return undefined;
    const d = dayjs(date);
    return d.isValid() ? d.format('DD/MM/YYYY HH:mm') : undefined;
};

const venteStepItems = (vente?: VenteEntity | null) => [
    { title: 'Devis/OR', icon: <FileTextOutlined />, description: formatStepDate(vente?.dateDevis) },
    { title: 'Bon pour accord', icon: <SolutionOutlined />, description: formatStepDate(vente?.dateBonPourAccord) },
    { title: 'Facture en attente', icon: <FileDoneOutlined />, description: formatStepDate(vente?.dateFactureEnAttente) },
    { title: 'Facture complète', icon: <WalletOutlined />, description: formatStepDate(vente?.dateFacturePrete) },
    { title: 'Facture payée', icon: <CheckCircleOutlined />, description: formatStepDate(vente?.dateFacturePayee) },
];

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

const defaultVente: VenteFormValues = {
    status: 'DEVIS',
    bonPourAccord: false,
    ordreDeReparation: false,
    venteForfaits: [{ status: 'EN_ATTENTE', quantite: 1 }],
    venteServices: [{ status: 'EN_ATTENTE', quantite: 1 }],
    produits: [{ quantite: 1 }],
    montantHT: 0,
    remise: 0,
    remisePourcentage: 0,
    tva: 20,
    montantTVA: 0,
    montantTTC: 0,
    prixVenteTTC: 0,
    images: [],
    documents: []
};

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} EUR`;
const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.split('T')[0];
    return parsed.toLocaleDateString('fr-FR') + ' ' + parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const getClientLabel = (client?: ClientEntity) => {
    if (!client) {
        return '-';
    }
    const fullName = `${client.prenom || ''} ${client.nom || ''}`.trim();
    return fullName || `Client #${client.id}`;
};

export default function Vente() {
    const PRODUIT_CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');
    const { navigate } = useNavigation();
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [clients, setClients] = useState<ClientEntity[]>([]);
    const [bateaux, setBateaux] = useState<BateauClientEntity[]>([]);
    const [moteurs, setMoteurs] = useState<MoteurClientEntity[]>([]);
    const [remorques, setRemorques] = useState<RemorqueClientEntity[]>([]);
    const [forfaits, setForfaits] = useState<ForfaitEntity[]>([]);
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [services, setServices] = useState<ServiceEntity[]>([]);
    const [mainOeuvres, setMainOeuvres] = useState<MainOeuvreEntity[]>([]);
    const [techniciens, setTechniciens] = useState<TechnicienEntity[]>([]);
    const [catalogueBateaux, setCatalogueBateaux] = useState<Array<{ id: number; marque?: string; modele?: string }>>([]);
    const [catalogueMoteurs, setCatalogueMoteurs] = useState<Array<{ id: number; marque?: string; modele?: string }>>([]);
    const [catalogueRemorques, setCatalogueRemorques] = useState<Array<{ id: number; marque?: string; modele?: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [formDirty, setFormDirty] = useState(false);
    const suppressDirtyRef = React.useRef(false);
    const savedLinesRef = React.useRef<{ forfaitIds: number[]; serviceIds: number[]; produitIds: number[] }>({ forfaitIds: [], serviceIds: [], produitIds: [] });
    const [isEdit, setIsEdit] = useState(false);
    const [currentVente, setCurrentVente] = useState<VenteEntity | null>(null);
    const [rappelHistorique, setRappelHistorique] = useState<RappelHistoriqueEntity[]>([]);
    const [filters, setFilters] = useState<SearchFilters>({});
    const [searchForm] = Form.useForm<SearchFilters>();
    const [form] = Form.useForm<VenteFormValues>();
    const watchedStatus = Form.useWatch('status', form) as VenteStatus | undefined;
    const watchedBonPourAccord = Form.useWatch('bonPourAccord', form) as boolean | undefined;
    const isReadOnly = watchedStatus === 'FACTURE_PAYEE';
    const [newProduitModalVisible, setNewProduitModalVisible] = useState(false);
    const [newProduitTargetLine, setNewProduitTargetLine] = useState<number | null>(null);
    const [newProduitForm] = Form.useForm();
    const [newProduitFormDirty, setNewProduitFormDirty] = useState(false);
    const [newServiceModalVisible, setNewServiceModalVisible] = useState(false);
    const [newServiceTargetLine, setNewServiceTargetLine] = useState<number | null>(null);
    const [editServiceId, setEditServiceId] = useState<number | null>(null);
    const [newServiceForm] = Form.useForm();
    const [newServiceFormDirty, setNewServiceFormDirty] = useState(false);
    const [newForfaitModalVisible, setNewForfaitModalVisible] = useState(false);
    const [newForfaitTargetLine, setNewForfaitTargetLine] = useState<number | null>(null);
    const [newForfaitForm] = Form.useForm();
    const [newForfaitFormDirty, setNewForfaitFormDirty] = useState(false);
    const [newClientModalVisible, setNewClientModalVisible] = useState(false);
    const [newClientForm] = Form.useForm();
    const [newClientFormDirty, setNewClientFormDirty] = useState(false);
    const [newBateauModalVisible, setNewBateauModalVisible] = useState(false);
    const [newBateauForm] = Form.useForm();
    const [newBateauFormDirty, setNewBateauFormDirty] = useState(false);
    const [newMoteurModalVisible, setNewMoteurModalVisible] = useState(false);
    const [newMoteurForm] = Form.useForm();
    const [newMoteurFormDirty, setNewMoteurFormDirty] = useState(false);
    const [newRemorqueModalVisible, setNewRemorqueModalVisible] = useState(false);
    const [newRemorqueForm] = Form.useForm();
    const [newRemorqueFormDirty, setNewRemorqueFormDirty] = useState(false);
    const [bpaModalVisible, setBpaModalVisible] = useState(false);
    const [bpaPendingCallback, setBpaPendingCallback] = useState<(() => void) | null>(null);
    const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signatureDrawingRef = useRef(false);

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
                label: forfait.reference ? `${forfait.reference} - ${forfait.nom}` : forfait.nom,
                searchText: (forfait.reference || '').toLowerCase()
            })),
        [forfaits]
    );

    const produitOptions = useMemo(
        () => produits.map((produit) => ({ value: produit.id, label: `${produit.nom}${produit.marque ? ` (${produit.marque})` : ''}` })),
        [produits]
    );

    const serviceOptions = useMemo(
        () => services.map((service) => ({ value: service.id, label: service.nom })),
        [services]
    );

    const mainOeuvreOptions = useMemo(
        () => mainOeuvres.map((mo) => ({ value: mo.id, label: mo.reference ? `${mo.reference} - ${mo.nom}` : mo.nom })),
        [mainOeuvres]
    );

    const produitOptionsForService = useMemo(
        () => produits.map((p) => ({ value: p.id, label: `${p.nom}${p.marque ? ` (${p.marque})` : ''}` })),
        [produits]
    );

    const technicienOptions = useMemo(
        () =>
            techniciens.map((technicien) => ({
                value: technicien.id,
                label: `${technicien.prenom || ''} ${technicien.nom || ''}`.trim() || `Technicien #${technicien.id}`
            })),
        [techniciens]
    );

    const fetchVentes = async (nextFilters?: SearchFilters) => {
        setLoading(true);
        try {
            const activeFilters = nextFilters || {};
            const hasStatus = !!activeFilters.status;
            const hasClient = activeFilters.clientId !== undefined;
            const endpoint = hasStatus || hasClient ? '/ventes/search' : '/ventes';
            const response = await api.get(endpoint, {
                params: {
                    ...(hasStatus ? { status: activeFilters.status } : {}),
                    ...(hasClient ? { clientId: activeFilters.clientId } : {})
                }
            });
            setVentes(response.data || []);
        } catch {
            message.error('Erreur lors du chargement des ventes.');
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [
                clientsRes,
                bateauxRes,
                moteursRes,
                remorquesRes,
                forfaitsRes,
                produitsRes,
                servicesRes,
                mainOeuvresRes,
                techniciensRes,
                catBateauxRes,
                catMoteursRes,
                catRemorquesRes
            ] = await Promise.all([
                api.get('/clients'),
                api.get('/bateaux'),
                api.get('/moteurs'),
                api.get('/remorques'),
                api.get('/forfaits'),
                api.get('/catalogue/produits'),
                api.get('/services'),
                api.get('/main-oeuvres'),
                api.get('/techniciens'),
                api.get('/catalogue/bateaux'),
                api.get('/catalogue/moteurs'),
                api.get('/catalogue/remorques')
            ]);
            setClients(clientsRes.data || []);
            setBateaux(bateauxRes.data || []);
            setMoteurs(moteursRes.data || []);
            setRemorques(remorquesRes.data || []);
            setForfaits(forfaitsRes.data || []);
            setProduits(produitsRes.data || []);
            setServices(servicesRes.data || []);
            setMainOeuvres(mainOeuvresRes.data || []);
            setTechniciens(techniciensRes.data || []);
            setCatalogueBateaux(catBateauxRes.data || []);
            setCatalogueMoteurs(catMoteursRes.data || []);
            setCatalogueRemorques(catRemorquesRes.data || []);
        } catch {
            message.error('Erreur lors du chargement des listes de reference.');
        }
    };

    useEffect(() => {
        fetchVentes();
        fetchOptions();
    }, []);

    const makeInnerModalCancel = (dirty: boolean, setDirty: (v: boolean) => void, setVisible: (v: boolean) => void) => () => {
        if (dirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setDirty(false);
                    setVisible(false);
                },
            });
        } else {
            setVisible(false);
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
                updated[newProduitTargetLine] = { ...updated[newProduitTargetLine], produitId: created.id };
                // Check if this was the last line and add a new empty line
                const lastLine = updated[updated.length - 1];
                if (!!lastLine?.produitId && (lastLine?.quantite || 0) > 0) {
                    updated.push({ quantite: 1 });
                }
                form.setFieldValue('produits', updated);
                recalculateFromLines('auto', { produits: [...produits, created] });
            }
            setNewProduitModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const onNewProduitValuesChange = (changedValues: Record<string, unknown>) => {
        setNewProduitFormDirty(true);
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

    const openNewServiceModal = (lineIndex: number) => {
        setNewServiceTargetLine(lineIndex);
        setEditServiceId(null);
        newServiceForm.resetFields();
        newServiceForm.setFieldsValue(defaultNewService);
        setNewServiceFormDirty(false);
        setNewServiceModalVisible(true);
    };

    const openEditServiceModal = (serviceId: number) => {
        setNewServiceTargetLine(null);
        setEditServiceId(serviceId);
        const service = services.find((s) => s.id === serviceId);
        if (!service) return;
        newServiceForm.resetFields();
        newServiceForm.setFieldsValue({
            nom: service.nom || '',
            description: service.description || '',
            dureeEstimee: service.dureeEstimee || 0,
            mainOeuvres: (service.mainOeuvres || [])
                .filter((item) => item.mainOeuvre?.id)
                .map((item) => ({ mainOeuvreId: item.mainOeuvre!.id, quantite: item.quantite || 1 }))
                .concat([{}]),
            produits: (service.produits || [])
                .filter((item) => item.produit?.id)
                .map((item) => ({ produitId: item.produit!.id, quantite: item.quantite || 1 }))
                .concat([{}]),
            taches: (service.taches || []).map((t) => ({ nom: t.nom || '', description: t.description || '', done: t.done || false })),
            prixHT: service.prixHT || 0,
            tva: service.tva || 0,
            montantTVA: service.montantTVA || 0,
            prixTTC: service.prixTTC || 0,
        });
        setNewServiceFormDirty(false);
        setNewServiceModalVisible(true);
    };

    const handleNewServiceSave = async () => {
        try {
            const values = await newServiceForm.validateFields();
            const payload = {
                nom: values.nom,
                description: values.description,
                dureeEstimee: values.dureeEstimee || 0,
                mainOeuvres: (values.mainOeuvres || [])
                    .filter((item: { mainOeuvreId?: number }) => item.mainOeuvreId)
                    .map((item: { mainOeuvreId?: number; quantite?: number }) => ({
                        mainOeuvre: mainOeuvres.find((mo) => mo.id === item.mainOeuvreId),
                        quantite: item.quantite || 1
                    })),
                produits: (values.produits || [])
                    .filter((item: { produitId?: number }) => item.produitId)
                    .map((item: { produitId?: number; quantite?: number }) => ({
                        produit: produits.find((p) => p.id === item.produitId),
                        quantite: item.quantite || 1
                    })),
                taches: (values.taches || [])
                    .filter((t: { nom?: string }) => t.nom?.trim())
                    .map((t: { nom?: string; description?: string; done?: boolean }) => ({
                        nom: t.nom,
                        description: t.description || '',
                        done: t.done || false
                    })),
                prixHT: values.prixHT || 0,
                tva: values.tva || 0,
                montantTVA: values.montantTVA || 0,
                prixTTC: values.prixTTC || 0
            };
            if (editServiceId) {
                const res = await api.put(`/services/${editServiceId}`, { id: editServiceId, ...payload });
                const updated = res.data as ServiceEntity;
                message.success('Service modifié avec succès');
                setServices((prev) => prev.map((s) => s.id === editServiceId ? updated : s));
                recalculateFromLines('auto', { services: services.map((s) => s.id === editServiceId ? updated : s) });
            } else {
                const res = await api.post('/services', payload);
                const created = res.data as ServiceEntity;
                message.success('Service ajouté avec succès');
                setServices((prev) => [...prev, created]);
                if (newServiceTargetLine !== null && created.id) {
                    const currentLines = form.getFieldValue('venteServices') || [];
                    const updatedLines = [...currentLines];
                    updatedLines[newServiceTargetLine] = { ...updatedLines[newServiceTargetLine], serviceId: created.id };
                    // Check if this was the last line and add a new empty line
                    const lastLine = updatedLines[updatedLines.length - 1];
                    if (!!lastLine?.serviceId && (lastLine?.quantite || 0) > 0) {
                        updatedLines.push({ status: 'EN_ATTENTE', quantite: 1 });
                    }
                    form.setFieldValue('venteServices', updatedLines);
                    recalculateFromLines('auto', { services: [...services, created] });
                }
            }
            setNewServiceModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const onNewServiceValuesChange = (changedValues: Record<string, unknown>) => {
        setNewServiceFormDirty(true);
        // Auto-add new line when last line is complete
        if (changedValues.mainOeuvres !== undefined) {
            const currentLines = newServiceForm.getFieldValue('mainOeuvres') || [];
            if (currentLines.length === 0) {
                newServiceForm.setFieldValue('mainOeuvres', [{}]);
                return;
            }
            const lastLine = currentLines[currentLines.length - 1];
            if (!!lastLine?.mainOeuvreId && (lastLine?.quantite || 0) > 0) {
                newServiceForm.setFieldValue('mainOeuvres', [...currentLines, {}]);
            }
        }
        if (changedValues.produits !== undefined) {
            const currentLines = newServiceForm.getFieldValue('produits') || [];
            if (currentLines.length === 0) {
                newServiceForm.setFieldValue('produits', [{}]);
                return;
            }
            const lastLine = currentLines[currentLines.length - 1];
            if (!!lastLine?.produitId && (lastLine?.quantite || 0) > 0) {
                newServiceForm.setFieldValue('produits', [...currentLines, {}]);
            }
        }
        if (changedValues.taches !== undefined) {
            const currentLines = newServiceForm.getFieldValue('taches') || [];
            if (currentLines.length === 0) {
                newServiceForm.setFieldValue('taches', [{}]);
            } else {
                const lastLine = currentLines[currentLines.length - 1];
                if (!!lastLine?.nom?.trim()) {
                    newServiceForm.setFieldValue('taches', [...currentLines, {}]);
                }
            }
        }

        // Recalculate totals from lines
        if (changedValues.mainOeuvres !== undefined || changedValues.produits !== undefined) {
            const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
            const moValues = newServiceForm.getFieldValue('mainOeuvres') || [];
            const prodValues = newServiceForm.getFieldValue('produits') || [];
            const totalMoTTC = moValues.reduce((total: number, item: { mainOeuvreId?: number; quantite?: number }) => {
                const prix = mainOeuvres.find((mo) => mo.id === item.mainOeuvreId)?.prixTTC || 0;
                return total + (prix * (item.quantite || 0));
            }, 0);
            const totalProdTTC = prodValues.reduce((total: number, item: { produitId?: number; quantite?: number }) => {
                const prix = produits.find((p) => p.id === item.produitId)?.prixVenteTTC || 0;
                return total + (prix * (item.quantite || 0));
            }, 0);
            const prixTTC = round2(totalMoTTC + totalProdTTC);
            const tva = newServiceForm.getFieldValue('tva') || 0;
            const montantTVA = round2((prixTTC / (100 + tva)) * tva);
            const prixHT = round2(prixTTC - montantTVA);
            newServiceForm.setFieldValue('prixTTC', prixTTC);
            newServiceForm.setFieldValue('montantTVA', montantTVA);
            newServiceForm.setFieldValue('prixHT', prixHT);
        }

        if (changedValues.prixHT !== undefined || changedValues.tva !== undefined) {
            const prixHT = newServiceForm.getFieldValue('prixHT') || 0;
            const tva = newServiceForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            newServiceForm.setFieldValue('montantTVA', montantTVA);
            newServiceForm.setFieldValue('prixTTC', Math.round(((prixHT + montantTVA) + Number.EPSILON) * 100) / 100);
        }
        if (changedValues.prixTTC !== undefined) {
            const prixTTC = newServiceForm.getFieldValue('prixTTC') || 0;
            const tva = newServiceForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            newServiceForm.setFieldValue('montantTVA', montantTVA);
            newServiceForm.setFieldValue('prixHT', Math.round(((prixTTC - montantTVA) + Number.EPSILON) * 100) / 100);
        }
    };

    const openNewForfaitModal = (lineIndex: number) => {
        setNewForfaitTargetLine(lineIndex);
        newForfaitForm.resetFields();
        newForfaitForm.setFieldsValue(defaultNewForfait);
        setNewForfaitFormDirty(false);
        setNewForfaitModalVisible(true);
    };

    const handleNewForfaitSave = async () => {
        try {
            const values = await newForfaitForm.validateFields();
            const payload = {
                reference: values.reference,
                nom: values.nom,
                dureeEstimee: values.dureeEstimee || 0,
                moteursAssocies: (values.moteurIds || [])
                    .map((id: number) => moteurs.find((m) => m.id === id))
                    .filter(Boolean),
                bateauxAssocies: (values.bateauIds || [])
                    .map((id: number) => bateaux.find((b) => b.id === id))
                    .filter(Boolean),
                produits: (values.produits || [])
                    .filter((item: { produitId?: number }) => item.produitId)
                    .map((item: { produitId?: number; quantite?: number }) => ({
                        produit: produits.find((p) => p.id === item.produitId),
                        quantite: item.quantite || 1
                    })),
                mainOeuvres: (values.mainOeuvres || [])
                    .filter((item: { mainOeuvreId?: number }) => item.mainOeuvreId)
                    .map((item: { mainOeuvreId?: number; quantite?: number }) => ({
                        mainOeuvre: mainOeuvres.find((mo) => mo.id === item.mainOeuvreId),
                        quantite: item.quantite || 1
                    })),
                taches: (values.taches || [])
                    .filter((t: { nom?: string }) => t.nom?.trim())
                    .map((t: { nom?: string; description?: string; done?: boolean }) => ({
                        nom: t.nom,
                        description: t.description || '',
                        done: t.done || false
                    })),
                heuresFonctionnement: values.heuresFonctionnement || 0,
                joursFrequence: values.joursFrequence || 0,
                prixHT: values.prixHT || 0,
                tva: values.tva || 0,
                montantTVA: values.montantTVA || 0,
                prixTTC: values.prixTTC || 0
            };
            const res = await api.post('/forfaits', payload);
            const created = res.data as ForfaitEntity;
            message.success('Forfait ajouté avec succès');
            setForfaits((prev) => [...prev, created]);
            if (newForfaitTargetLine !== null && created.id) {
                const currentLines = form.getFieldValue('venteForfaits') || [];
                const updated = [...currentLines];
                updated[newForfaitTargetLine] = { ...updated[newForfaitTargetLine], forfaitId: created.id };
                // Check if this was the last line and add a new empty line
                const lastLine = updated[updated.length - 1];
                if (!!lastLine?.forfaitId && (lastLine?.quantite || 0) > 0) {
                    updated.push({ status: 'EN_ATTENTE', quantite: 1 });
                }
                form.setFieldValue('venteForfaits', updated);
                recalculateFromLines('auto', { forfaits: [...forfaits, created] });
            }
            setNewForfaitModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const onNewForfaitValuesChange = (changedValues: Record<string, unknown>) => {
        setNewForfaitFormDirty(true);
        // Auto-add new line when last line is complete
        if (changedValues.produits !== undefined) {
            const currentLines = newForfaitForm.getFieldValue('produits') || [];
            if (currentLines.length === 0) {
                newForfaitForm.setFieldValue('produits', [{}]);
            } else {
                const lastLine = currentLines[currentLines.length - 1];
                if (!!lastLine?.produitId && (lastLine?.quantite || 0) > 0) {
                    newForfaitForm.setFieldValue('produits', [...currentLines, {}]);
                }
            }
        }
        if (changedValues.mainOeuvres !== undefined) {
            const currentLines = newForfaitForm.getFieldValue('mainOeuvres') || [];
            if (currentLines.length === 0) {
                newForfaitForm.setFieldValue('mainOeuvres', [{}]);
            } else {
                const lastLine = currentLines[currentLines.length - 1];
                if (!!lastLine?.mainOeuvreId && (lastLine?.quantite || 0) > 0) {
                    newForfaitForm.setFieldValue('mainOeuvres', [...currentLines, {}]);
                }
            }
        }
        if (changedValues.taches !== undefined) {
            const currentLines = newForfaitForm.getFieldValue('taches') || [];
            if (currentLines.length === 0) {
                newForfaitForm.setFieldValue('taches', [{}]);
            } else {
                const lastLine = currentLines[currentLines.length - 1];
                if (!!lastLine?.nom?.trim()) {
                    newForfaitForm.setFieldValue('taches', [...currentLines, {}]);
                }
            }
        }

        // Recalculate totals from product/MO lines
        if (changedValues.produits !== undefined || changedValues.mainOeuvres !== undefined) {
            const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
            const prodValues = newForfaitForm.getFieldValue('produits') || [];
            const moValues = newForfaitForm.getFieldValue('mainOeuvres') || [];
            const totalProdTTC = prodValues.reduce((total: number, item: { produitId?: number; quantite?: number }) => {
                const prix = produits.find((p) => p.id === item.produitId)?.prixVenteTTC || 0;
                return total + (prix * (item.quantite || 0));
            }, 0);
            const totalMoTTC = moValues.reduce((total: number, item: { mainOeuvreId?: number; quantite?: number }) => {
                const prix = mainOeuvres.find((mo) => mo.id === item.mainOeuvreId)?.prixTTC || 0;
                return total + (prix * (item.quantite || 0));
            }, 0);
            const prixTTC = round2(totalProdTTC + totalMoTTC);
            const tva = newForfaitForm.getFieldValue('tva') || 0;
            const montantTVA = round2((prixTTC / (100 + tva)) * tva);
            const prixHT = round2(prixTTC - montantTVA);
            newForfaitForm.setFieldValue('prixTTC', prixTTC);
            newForfaitForm.setFieldValue('montantTVA', montantTVA);
            newForfaitForm.setFieldValue('prixHT', prixHT);
        }

        if (changedValues.prixHT !== undefined || changedValues.tva !== undefined) {
            const prixHT = newForfaitForm.getFieldValue('prixHT') || 0;
            const tva = newForfaitForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            newForfaitForm.setFieldValue('montantTVA', montantTVA);
            newForfaitForm.setFieldValue('prixTTC', Math.round(((prixHT + montantTVA) + Number.EPSILON) * 100) / 100);
        }
        if (changedValues.prixTTC !== undefined) {
            const prixTTC = newForfaitForm.getFieldValue('prixTTC') || 0;
            const tva = newForfaitForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            newForfaitForm.setFieldValue('montantTVA', montantTVA);
            newForfaitForm.setFieldValue('prixHT', Math.round(((prixTTC - montantTVA) + Number.EPSILON) * 100) / 100);
        }
    };

    const openNewClientModal = () => {
        newClientForm.resetFields();
        newClientForm.setFieldsValue({ nom: '', prenom: '', type: 'PARTICULIER', email: '', telephone: '', adresse: '', siren: '', siret: '', tva: '', naf: '', remise: 0, evaluation: 0, notes: '' });
        setNewClientFormDirty(false);
        setNewClientModalVisible(true);
    };

    const handleNewClientSave = async () => {
        try {
            const values = await newClientForm.validateFields();
            const res = await api.post('/clients', values);
            const created = res.data as ClientEntity;
            message.success('Client ajouté avec succès');
            setClients((prev) => [...prev, created]);
            form.setFieldValue('clientId', created.id);
            setNewClientModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const openNewBateauModal = () => {
        newBateauForm.resetFields();
        newBateauForm.setFieldsValue({ name: '', immatriculation: '', numeroSerie: '', numeroClef: '', dateMeS: null, dateAchat: null, dateFinDeGuarantie: null, localisation: '' });
        setNewBateauFormDirty(false);
        setNewBateauModalVisible(true);
    };
    const handleNewBateauSave = async () => {
        try {
            const values = await newBateauForm.validateFields();
            const res = await api.post('/bateaux', values);
            const created = res.data;
            message.success('Bateau ajouté avec succès');
            setBateaux((prev) => [...prev, created]);
            form.setFieldValue('bateauId', created.id);
            setNewBateauModalVisible(false);
        } catch { }
    };

    const openNewMoteurModal = () => {
        newMoteurForm.resetFields();
        newMoteurForm.setFieldsValue({ numeroSerie: '', numeroClef: '', dateMeS: null, dateAchat: null, dateFinDeGuarantie: null });
        setNewMoteurFormDirty(false);
        setNewMoteurModalVisible(true);
    };
    const handleNewMoteurSave = async () => {
        try {
            const values = await newMoteurForm.validateFields();
            const res = await api.post('/moteurs', values);
            const created = res.data;
            message.success('Moteur ajouté avec succès');
            setMoteurs((prev) => [...prev, created]);
            form.setFieldValue('moteurId', created.id);
            setNewMoteurModalVisible(false);
        } catch { }
    };

    const openNewRemorqueModal = () => {
        newRemorqueForm.resetFields();
        newRemorqueForm.setFieldsValue({ immatriculation: '', dateMeS: null, dateAchat: null, dateFinDeGuarantie: null });
        setNewRemorqueFormDirty(false);
        setNewRemorqueModalVisible(true);
    };
    const handleNewRemorqueSave = async () => {
        try {
            const values = await newRemorqueForm.validateFields();
            const res = await api.post('/remorques', values);
            const created = res.data;
            message.success('Remorque ajoutée avec succès');
            setRemorques((prev) => [...prev, created]);
            form.setFieldValue('remorqueId', created.id);
            setNewRemorqueModalVisible(false);
        } catch { }
    };

    const snapshotSavedLines = (vente?: VenteEntity | null) => {
        savedLinesRef.current = {
            forfaitIds: (vente?.venteForfaits || []).map(vf => vf.forfait?.id).filter(Boolean).sort() as number[],
            serviceIds: (vente?.venteServices || []).map(vs => vs.service?.id).filter(Boolean).sort() as number[],
            produitIds: (vente?.produits || []).map(p => p?.id).filter(Boolean).sort() as number[],
        };
    };

    const populateForm = (vente: VenteEntity) => {
        const venteForfaitLines = (vente.venteForfaits || []).map(vf => ({
            forfaitId: vf.forfait?.id,
            quantite: vf.quantite || 1,
            technicienIds: (vf.techniciens || []).map(t => t.id),
            status: vf.status || 'EN_ATTENTE',
            datePlanification: vf.datePlanification,
            dateDebut: vf.dateDebut,
            dateFin: vf.dateFin,
            dureeReelle: vf.dureeReelle || 0,
            notes: vf.notes || '',
            incidentDate: toDateDayjs(vf.incidentDate),
            incidentDetails: vf.incidentDetails || '',
            taches: (vf.taches || []).map(t => ({ nom: t.nom || '', description: t.description || '', done: t.done || false })),
            images: vf.images || [],
            documents: vf.documents || [],
        }));
        const venteServiceLines = (vente.venteServices || []).map(vs => ({
            serviceId: vs.service?.id,
            quantite: vs.quantite || 1,
            technicienIds: (vs.techniciens || []).map(t => t.id),
            status: vs.status || 'EN_ATTENTE',
            datePlanification: vs.datePlanification,
            dateDebut: vs.dateDebut,
            dateFin: vs.dateFin,
            dureeReelle: vs.dureeReelle || 0,
            notes: vs.notes || '',
            incidentDate: toDateDayjs(vs.incidentDate),
            incidentDetails: vs.incidentDetails || '',
            taches: (vs.taches || []).map(t => ({ nom: t.nom || '', description: t.description || '', done: t.done || false })),
            images: vs.images || [],
            documents: vs.documents || [],
        }));
        const produitLinesMap = (vente.produits || []).reduce((acc, item) => {
            if (!item?.id) {
                return acc;
            }
            acc.set(item.id, (acc.get(item.id) || 0) + 1);
            return acc;
        }, new Map<number, number>());
        const produitLines = Array.from(produitLinesMap.entries()).map(([produitId, quantite]) => ({ produitId, quantite }));
        form.resetFields();
        form.setFieldsValue({
            status: vente.status || 'DEVIS',
            bonPourAccord: vente.bonPourAccord || false,
            ordreDeReparation: vente.ordreDeReparation || false,
            signatureBonPourAccord: vente.signatureBonPourAccord,
            clientId: vente.client?.id,
            bateauId: vente.bateau?.id,
            moteurId: vente.moteur?.id,
            remorqueId: vente.remorque?.id,
            venteForfaits: [...venteForfaitLines, { status: 'EN_ATTENTE', quantite: 1 }],
            venteServices: [...venteServiceLines, { status: 'EN_ATTENTE', quantite: 1 }],
            produits: [...produitLines, { quantite: 1 }],
            date: toDateDayjs(vente.date) || getTodayDayjs(),
            montantHT: vente.montantHT || 0,
            remise: vente.remise || 0,
            remisePourcentage: vente.montantTTC ? Math.round((((vente.remise || 0) / vente.montantTTC) * 100 + Number.EPSILON) * 100) / 100 : 0,
            tva: vente.tva || 0,
            montantTVA: vente.montantTVA || 0,
            montantTTC: vente.montantTTC || 0,
            prixVenteTTC: vente.prixVenteTTC || 0,
            modePaiement: vente.modePaiement,
            images: vente.images || [],
            documents: vente.documents || [],
            rappel1Jours: vente.rappel1Jours,
            rappel2Jours: vente.rappel2Jours,
            rappel3Jours: vente.rappel3Jours
        });
    };

    const getBpaSummaryLines = useCallback(() => {
        const venteForfaitLines = form.getFieldValue('venteForfaits') || [];
        const venteServiceLines = form.getFieldValue('venteServices') || [];
        const produitLines = form.getFieldValue('produits') || [];
        const lines: Array<{ type: string; nom: string; quantite: number; prixTTC: number }> = [];
        venteForfaitLines.forEach((line: { forfaitId?: number; quantite?: number }) => {
            if (!line.forfaitId) return;
            const f = forfaits.find((item) => item.id === line.forfaitId);
            if (f) lines.push({ type: 'Forfait', nom: f.nom, quantite: line.quantite || 1, prixTTC: (f.prixTTC || 0) * (line.quantite || 1) });
        });
        venteServiceLines.forEach((line: { serviceId?: number; quantite?: number }) => {
            if (!line.serviceId) return;
            const s = services.find((item) => item.id === line.serviceId);
            if (s) lines.push({ type: 'Service', nom: s.nom, quantite: line.quantite || 1, prixTTC: (s.prixTTC || 0) * (line.quantite || 1) });
        });
        produitLines.forEach((line: { produitId?: number; quantite?: number }) => {
            if (!line.produitId) return;
            const p = produits.find((item) => item.id === line.produitId);
            if (p) lines.push({ type: 'Produit', nom: p.nom, quantite: line.quantite || 1, prixTTC: (p.prixVenteTTC || 0) * (line.quantite || 1) });
        });
        return lines;
    }, [form, forfaits, services, produits]);

    const initSignatureCanvas = useCallback(() => {
        setTimeout(() => {
            const canvas = signatureCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            let drawing = false;
            const getPos = (e: MouseEvent | TouchEvent) => {
                const rect = canvas.getBoundingClientRect();
                if ('touches' in e) {
                    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
                }
                return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
            };
            const onStart = (e: MouseEvent | TouchEvent) => { e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); signatureDrawingRef.current = true; };
            const onMove = (e: MouseEvent | TouchEvent) => { if (!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
            const onEnd = () => { drawing = false; };

            canvas.addEventListener('mousedown', onStart);
            canvas.addEventListener('mousemove', onMove);
            canvas.addEventListener('mouseup', onEnd);
            canvas.addEventListener('mouseleave', onEnd);
            canvas.addEventListener('touchstart', onStart, { passive: false });
            canvas.addEventListener('touchmove', onMove, { passive: false });
            canvas.addEventListener('touchend', onEnd);
        }, 100);
    }, []);

    const requestBonPourAccord = (onConfirm: () => void) => {
        signatureDrawingRef.current = false;
        setBpaPendingCallback(() => onConfirm);
        setBpaModalVisible(true);
        initSignatureCanvas();
    };

    const handleBpaConfirm = () => {
        if (!signatureDrawingRef.current) {
            message.warning('La signature est requise pour valider le bon pour accord');
            return;
        }
        const canvas = signatureCanvasRef.current;
        const signatureData = canvas ? canvas.toDataURL('image/png') : undefined;
        if (bpaPendingCallback) {
            form.setFieldsValue({ signatureBonPourAccord: signatureData });
            bpaPendingCallback();
        }
        setBpaModalVisible(false);
        setBpaPendingCallback(null);
    };

    const handleBpaCancel = () => {
        setBpaModalVisible(false);
        setBpaPendingCallback(null);
    };

    const clearSignatureCanvas = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        signatureDrawingRef.current = false;
    };

    const handleModalCancel = () => {
        const venteForfaits = form.getFieldValue('venteForfaits') || [];
        const venteServices = form.getFieldValue('venteServices') || [];
        const venteProduits = form.getFieldValue('produits') || [];
        const currentForfaitIds = venteForfaits.map((l: { forfaitId?: number }) => l.forfaitId).filter(Boolean).sort() as number[];
        const currentServiceIds = venteServices.map((l: { serviceId?: number }) => l.serviceId).filter(Boolean).sort() as number[];
        const currentProduitIds = venteProduits.map((l: { produitId?: number }) => l.produitId).filter(Boolean).sort() as number[];
        const saved = savedLinesRef.current;
        const linesChanged =
            JSON.stringify(currentForfaitIds) !== JSON.stringify(saved.forfaitIds) ||
            JSON.stringify(currentServiceIds) !== JSON.stringify(saved.serviceIds) ||
            JSON.stringify(currentProduitIds) !== JSON.stringify(saved.produitIds);

        if (linesChanged) {
            Modal.warning({
                title: "Impossible de fermer",
                content: "Des forfaits, services ou produits n'ont pas été enregistrés. Veuillez enregistrer avant de fermer.",
            });
        } else if (formDirty) {
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

    const openModal = async (vente?: VenteEntity) => {
        suppressDirtyRef.current = true;
        if (vente) {
            setIsEdit(true);
            setCurrentVente(vente);
            snapshotSavedLines(vente);
            setFormDirty(false);
            setModalVisible(true);
            if (vente.id) {
                api.get<RappelHistoriqueEntity[]>(`/rappels/vente/${vente.id}`).then(res => setRappelHistorique(res.data)).catch(() => setRappelHistorique([]));
                // Fetch the full vente to ensure all nested data is loaded
                try {
                    const res = await api.get<VenteEntity>(`/ventes/${vente.id}`);
                    const fullVente = res.data;
                    setCurrentVente(fullVente);
                    snapshotSavedLines(fullVente);
                    populateForm(fullVente);
                } catch {
                    populateForm(vente);
                }
            } else {
                populateForm(vente);
            }
        } else {
            setIsEdit(false);
            setCurrentVente(null);
            setRappelHistorique([]);
            snapshotSavedLines(null);
            form.resetFields();
            form.setFieldsValue({ ...defaultVente, date: getTodayDayjs() });
            setFormDirty(false);
            setModalVisible(true);
        }
        setTimeout(() => { suppressDirtyRef.current = false; }, 0);
    };

    const toPayload = (values: VenteFormValues): VenteEntity => ({
        status: values.status,
        bonPourAccord: values.bonPourAccord,
        ordreDeReparation: values.ordreDeReparation,
        signatureBonPourAccord: values.signatureBonPourAccord,
        client: clients.find((client) => client.id === values.clientId),
        bateau: bateaux.find((bateau) => bateau.id === values.bateauId),
        moteur: moteurs.find((moteur) => moteur.id === values.moteurId),
        remorque: remorques.find((remorque) => remorque.id === values.remorqueId),
        venteForfaits: (values.venteForfaits || [])
            .filter((line) => line.forfaitId)
            .map((line) => {
                const selectedForfait = forfaits.find((f) => f.id === line.forfaitId);
                // Use existing taches if available, otherwise copy from catalogue forfait template
                const existingTaches = (line.taches || []).filter((t: { nom?: string }) => t.nom?.trim());
                const taches = existingTaches.length > 0
                    ? existingTaches.map((t: { nom?: string; description?: string; done?: boolean }) => ({ nom: t.nom, description: t.description, done: t.done || false }))
                    : (selectedForfait?.taches || []).filter((t) => t.nom?.trim()).map((t) => ({ nom: t.nom, description: t.description || '', done: false }));
                // Preserve existing vente data (dates, etc.) from currentVente if available
                const existingVf = (currentVente?.venteForfaits || []).find((vf) => vf.forfait?.id === line.forfaitId);
                return {
                    forfait: selectedForfait,
                    quantite: line.quantite || 1,
                    techniciens: (line.technicienIds || []).map((id: number) => techniciens.find((t) => t.id === id)).filter(Boolean),
                    datePlanification: line.datePlanification || existingVf?.datePlanification,
                    dateDebut: line.dateDebut || existingVf?.dateDebut,
                    dateFin: line.dateFin || existingVf?.dateFin,
                    status: line.status || 'EN_ATTENTE',
                    dureeReelle: line.dureeReelle || existingVf?.dureeReelle || 0,
                    notes: line.notes || '',
                    incidentDate: toBackendDateValue(line.incidentDate),
                    incidentDetails: line.incidentDetails || '',
                    taches,
                    images: line.images || existingVf?.images || [],
                    documents: line.documents || existingVf?.documents || [],
                };
            }),
        venteServices: (values.venteServices || [])
            .filter((line) => line.serviceId)
            .map((line) => {
                // Preserve existing taches from currentVente
                const existingVs = (currentVente?.venteServices || []).find((vs) => vs.service?.id === line.serviceId);
                const existingTaches = (line.taches || []).filter((t: { nom?: string }) => t.nom?.trim());
                const taches = existingTaches.length > 0
                    ? existingTaches.map((t: { nom?: string; description?: string; done?: boolean }) => ({ nom: t.nom, description: t.description, done: t.done || false }))
                    : (existingVs?.taches || []).map((t) => ({ nom: t.nom, description: t.description || '', done: t.done || false }));
                return {
                    service: services.find((s) => s.id === line.serviceId),
                    quantite: line.quantite || 1,
                    techniciens: (line.technicienIds || []).map((id: number) => techniciens.find((t) => t.id === id)).filter(Boolean),
                    datePlanification: line.datePlanification || existingVs?.datePlanification,
                    dateDebut: line.dateDebut || existingVs?.dateDebut,
                    dateFin: line.dateFin || existingVs?.dateFin,
                    status: line.status || 'EN_ATTENTE',
                    dureeReelle: line.dureeReelle || existingVs?.dureeReelle || 0,
                    notes: line.notes || '',
                    incidentDate: toBackendDateValue(line.incidentDate),
                    incidentDetails: line.incidentDetails || '',
                    taches,
                    images: line.images || existingVs?.images || [],
                    documents: line.documents || existingVs?.documents || [],
                };
            }),
        produits: (values.produits || [])
            .filter((line) => line.produitId)
            .flatMap((line) => {
                const item = produits.find((produit) => produit.id === line.produitId);
                const safeQuantity = Math.max(1, Math.floor(line.quantite || 1));
                return item ? Array.from({ length: safeQuantity }, () => item) : [];
            }) as ProduitCatalogueEntity[],
        date: toBackendDateValue(values.date),
        montantHT: values.montantHT || 0,
        remise: values.remise || 0,
        tva: values.tva || 0,
        montantTVA: values.montantTVA || 0,
        montantTTC: values.montantTTC || 0,
        prixVenteTTC: values.prixVenteTTC || 0,
        modePaiement: values.modePaiement,
        images: values.images || [],
        documents: values.documents || [],
        rappel1Jours: values.rappel1Jours,
        rappel2Jours: values.rappel2Jours,
        rappel3Jours: values.rappel3Jours
    });

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const payload = toPayload(values);
            suppressDirtyRef.current = true;
            if (isEdit && currentVente?.id) {
                const res = await api.put(`/ventes/${currentVente.id}`, { ...currentVente, ...payload });
                message.success('Vente modifiee avec succes');
                setCurrentVente(res.data);
                snapshotSavedLines(res.data);
                populateForm(res.data);
            } else {
                const res = await api.post('/ventes', payload);
                message.success('Vente ajoutee avec succes');
                setIsEdit(true);
                setCurrentVente(res.data);
                snapshotSavedLines(res.data);
                populateForm(res.data);
            }
            setFormDirty(false);
            setTimeout(() => { suppressDirtyRef.current = false; }, 0);
            fetchVentes(filters);
        } catch {
            // Les erreurs de validation sont affichees par le formulaire.
        }
    };

    const goToStep = (step: number) => {
        const steps: Array<{ status: VenteStatus; bonPourAccord: boolean }> = [
            { status: 'DEVIS', bonPourAccord: false },
            { status: 'DEVIS', bonPourAccord: true },
            { status: 'FACTURE_EN_ATTENTE', bonPourAccord: true },
            { status: 'FACTURE_PRETE', bonPourAccord: true },
            { status: 'FACTURE_PAYEE', bonPourAccord: true },
        ];
        const currentStep = venteStepIndex(watchedStatus || 'DEVIS', watchedBonPourAccord);
        if (step === currentStep) return;
        // Transitioning to "Bon pour accord" (step 1) from "Devis" (step 0)
        if (step >= 1 && currentStep === 0) {
            requestBonPourAccord(() => {
                form.setFieldsValue(steps[step]);
                setFormDirty(true);
                handleSave();
            });
            return;
        }
        // Block transition to "Facture complète" (step 3+) if not all tasks are done
        if (step >= 3 && currentStep < 3) {
            const forfaitLines = (form.getFieldValue('venteForfaits') || []).filter((l: { forfaitId?: number }) => l.forfaitId);
            const serviceLines = (form.getFieldValue('venteServices') || []).filter((l: { serviceId?: number }) => l.serviceId);
            const allLines = [...forfaitLines, ...serviceLines];
            const allDone = allLines.length > 0 && allLines.every((l: { status?: PlanningStatus }) =>
                l.status === 'TERMINEE' || l.status === 'ANNULEE'
            );
            const hasTerminee = allLines.some((l: { status?: PlanningStatus }) => l.status === 'TERMINEE');
            if (!allDone || !hasTerminee) {
                message.warning('Toutes les prestations doivent être terminées avant de passer en facture complète');
                return;
            }
        }
        form.setFieldsValue(steps[step]);
        setFormDirty(true);
        handleSave();
    };

    const handleDelete = async (id?: number) => {
        if (!id) {
            return;
        }
        try {
            await api.delete(`/ventes/${id}`);
            message.success('Vente supprimee avec succes');
            fetchVentes(filters);
        } catch {
            message.error('Erreur lors de la suppression de la vente.');
        }
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

    const buildDocumentLines = (vente: VenteEntity) => {
        const forfaitLines = (vente.venteForfaits || []).map(vf => ({
            type: 'Forfait', label: vf.forfait?.nom || '', quantite: vf.quantite || 1,
            totalPrixTTC: (vf.forfait?.prixTTC || 0) * (vf.quantite || 1)
        }));
        const produitLines = Array.from(
            (vente.produits || []).reduce((acc, item) => {
                const label = `${item.nom}${item.marque ? ` (${item.marque})` : ''}`;
                const key = item.id ? `id-${item.id}` : `label-${label}`;
                const current = acc.get(key) || { type: 'Produit', label, quantite: 0, totalPrixTTC: 0 };
                current.quantite += 1;
                current.totalPrixTTC += item.prixVenteTTC || 0;
                acc.set(key, current);
                return acc;
            }, new Map<string, { type: string; label: string; quantite: number; totalPrixTTC: number }>()).values()
        );
        const serviceLines = (vente.venteServices || []).map(vs => ({
            type: 'Service', label: vs.service?.nom || '', quantite: vs.quantite || 1,
            totalPrixTTC: (vs.service?.prixTTC || 0) * (vs.quantite || 1)
        }));
        return [...forfaitLines, ...produitLines, ...serviceLines];
    };

    const getDocumentType = (vente: VenteEntity): 'devis' | 'ordre_reparation' | 'facture' => {
        if (vente.status === 'DEVIS') {
            return vente.ordreDeReparation ? 'ordre_reparation' : 'devis';
        }
        return 'facture';
    };

    const buildDocumentHtml = (vente: VenteEntity) => {
        const docType = getDocumentType(vente);
        const showPrices = docType !== 'ordre_reparation';
        const lines = buildDocumentLines(vente);

        const docTitle = docType === 'devis' ? 'Devis'
            : docType === 'ordre_reparation' ? 'Ordre de Réparation'
            : 'Facture';
        const title = `${docTitle} #${vente.id || '-'}`;

        const priceColumn = showPrices ? '<th>Prix total TTC</th>' : '';
        const tableHtml = lines.length > 0
            ? `<table class="invoice-table">
                <thead><tr><th>Type</th><th>Désignation</th><th>Qté</th>${priceColumn}</tr></thead>
                <tbody>${lines.map((line) => `
                    <tr>
                        <td>${escapeHtml(line.type)}</td>
                        <td>${escapeHtml(line.label)}</td>
                        <td>${line.quantite}</td>
                        ${showPrices ? `<td>${escapeHtml(formatEuro(line.totalPrixTTC))}</td>` : ''}
                    </tr>`).join('')}
                </tbody>
              </table>`
            : '<p>Aucun élément</p>';

        const totalsHtml = showPrices ? `
            <div class="section">
                <div class="row"><strong>Montant TTC:</strong> ${escapeHtml(formatEuro(vente.montantTTC))}</div>
                ${(vente.remise || 0) > 0 ? `<div class="row"><strong>Remise:</strong> ${escapeHtml(formatEuro(vente.remise))}</div>` : ''}
                <div class="row"><strong>Prix vente TTC:</strong> ${escapeHtml(formatEuro(vente.prixVenteTTC))}</div>
            </div>` : '';

        const paymentHtml = docType === 'facture' && vente.modePaiement
            ? `<div class="row"><strong>Mode de paiement:</strong> ${escapeHtml(vente.modePaiement)}</div>` : '';

        const signatureHtml = docType !== 'facture' && vente.signatureBonPourAccord
            ? `<div class="section"><h3>Signature client</h3><img src="${vente.signatureBonPourAccord}" style="max-width:300px;border:1px solid #d9d9d9;border-radius:4px;" /></div>` : '';

        return `<html>
            <head>
                <title>${escapeHtml(title)}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 24px; color: #1f1f1f; }
                    h1 { margin-bottom: 8px; }
                    .meta { margin-bottom: 20px; color: #595959; }
                    .row { margin-bottom: 8px; }
                    .section { margin-top: 20px; }
                    .invoice-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                    .invoice-table th, .invoice-table td { border: 1px solid #d9d9d9; padding: 6px 8px; }
                    .invoice-table th { background: #fafafa; text-align: left; }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(title)}</h1>
                <div class="meta">Date: ${escapeHtml(formatDate(vente.date))}</div>
                <div class="row"><strong>Client:</strong> ${escapeHtml(getClientLabel(vente.client))}</div>
                ${paymentHtml}
                <div class="section">
                    <h3>Détails</h3>
                    ${tableHtml}
                </div>
                ${totalsHtml}
                ${signatureHtml}
            </body>
        </html>`;
    };

    const handlePrint = (vente: VenteEntity) => {
        const docType = getDocumentType(vente);
        const docTitle = docType === 'devis' ? 'Devis'
            : docType === 'ordre_reparation' ? 'Ordre de Réparation'
            : 'Facture';
        openPrintDocument(`${docTitle} #${vente.id || '-'}`, buildDocumentHtml(vente));
    };

    const handleEmail = async (vente: VenteEntity) => {
        if (!vente.id) {
            message.warning('La vente doit être enregistrée avant d\'envoyer un email.');
            return;
        }
        const selectedClientId = form.getFieldValue('clientId');
        const fallbackClient = clients.find((client) => client.id === vente.client?.id || client.id === selectedClientId);
        const email = vente.client?.email || fallbackClient?.email || '';
        if (!email) {
            message.warning("Aucun email client n'est renseigné pour cette vente.");
            return;
        }
        try {
            await axios.post(`/ventes/${vente.id}/email`);
            message.success('L\'email a été envoyé à ' + email);
        } catch {
            message.error('Erreur lors de l\'envoi de l\'email.');
        }
    };

    const handlePayment = async (vente: VenteEntity, provider: 'stripe' | 'payplug') => {
        if (!vente.id) {
            message.warning('La vente doit etre enregistree avant de generer un lien de paiement.');
            return;
        }
        if (vente.status !== 'FACTURE_PRETE') {
            message.warning('Le paiement n\'est possible que lorsque la facture est prête.');
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

    const recalculateFromLines = (
        remiseSource: 'amount' | 'percentage' | 'auto' = 'auto',
        overrides?: { forfaits?: ForfaitEntity[]; produits?: ProduitCatalogueEntity[]; services?: ServiceEntity[] }
    ) => {
        const venteForfaitLines = form.getFieldValue('venteForfaits') || [];
        const produitLines = form.getFieldValue('produits') || [];
        const venteServiceLines = form.getFieldValue('venteServices') || [];
        let remise = form.getFieldValue('remise') || 0;
        let remisePourcentage = form.getFieldValue('remisePourcentage') || 0;
        const tva = form.getFieldValue('tva') || 0;

        const allForfaits = overrides?.forfaits ?? forfaits;
        const allProduits = overrides?.produits ?? produits;
        const allServices = overrides?.services ?? services;

        const forfaitsTTC = venteForfaitLines.reduce((sum: number, line: { forfaitId?: number; quantite?: number }) => {
            const prixUnitaire = allForfaits.find((item) => item.id === line.forfaitId)?.prixTTC || 0;
            const quantite = Math.max(1, Math.floor(line.quantite || 1));
            return sum + (prixUnitaire * quantite);
        }, 0);
        const produitsTTC = produitLines.reduce((sum: number, line: { produitId?: number; quantite?: number }) => {
            const prixUnitaire = allProduits.find((item) => item.id === line.produitId)?.prixVenteTTC || 0;
            const quantite = Math.max(1, Math.floor(line.quantite || 1));
            return sum + (prixUnitaire * quantite);
        }, 0);
        const servicesTTC = venteServiceLines.reduce((sum: number, line: { serviceId?: number; quantite?: number }) => {
            const prixUnitaire = allServices.find((item) => item.id === line.serviceId)?.prixTTC || 0;
            const quantite = Math.max(1, Math.floor(line.quantite || 1));
            return sum + (prixUnitaire * quantite);
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

    const onValuesChange = (changedValues: Partial<VenteFormValues>, allValues: VenteFormValues) => {
        if (!suppressDirtyRef.current) {
            setFormDirty(true);
        }
        if (changedValues.venteForfaits !== undefined) {
            const currentForfaitLines = allValues.venteForfaits || [];
            if (currentForfaitLines.length === 0) {
                form.setFieldValue('venteForfaits', [{ status: 'EN_ATTENTE', quantite: 1 }]);
            } else {
                const lastForfaitLine = currentForfaitLines[currentForfaitLines.length - 1];
                const isLastLineComplete = !!lastForfaitLine?.forfaitId && (lastForfaitLine?.quantite || 0) > 0;
                if (isLastLineComplete) {
                    form.setFieldValue('venteForfaits', [...currentForfaitLines, { status: 'EN_ATTENTE', quantite: 1 }]);
                }
            }
        }

        if (changedValues.produits !== undefined) {
            const currentProduitLines = allValues.produits || [];
            if (currentProduitLines.length === 0) {
                form.setFieldValue('produits', [{ quantite: 1 }]);
            } else {
                const lastProduitLine = currentProduitLines[currentProduitLines.length - 1];
                const isLastLineComplete = !!lastProduitLine?.produitId && (lastProduitLine?.quantite || 0) > 0;
                if (isLastLineComplete) {
                    form.setFieldValue('produits', [...currentProduitLines, { quantite: 1 }]);
                }
            }
        }

        if (changedValues.venteServices !== undefined) {
            const currentServiceLines = allValues.venteServices || [];
            if (currentServiceLines.length === 0) {
                form.setFieldValue('venteServices', [{ status: 'EN_ATTENTE', quantite: 1 }]);
            } else {
                const lastServiceLine = currentServiceLines[currentServiceLines.length - 1];
                const isLastLineComplete = !!lastServiceLine?.serviceId && (lastServiceLine?.quantite || 0) > 0;
                if (isLastLineComplete) {
                    form.setFieldValue('venteServices', [...currentServiceLines, { status: 'EN_ATTENTE', quantite: 1 }]);
                }
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

        if (
            changedValues.venteForfaits !== undefined ||
            changedValues.produits !== undefined ||
            changedValues.venteServices !== undefined ||
            changedValues.tva !== undefined ||
            changedValues.remisePourcentage !== undefined ||
            changedValues.remise !== undefined
        ) {
            if (changedValues.remisePourcentage !== undefined) {
                recalculateFromLines('percentage');
                return;
            }
            if (changedValues.remise !== undefined) {
                recalculateFromLines('amount');
                return;
            }
            recalculateFromLines('auto');
        }
    };

    const columns = [
        {
            title: 'Date',
            dataIndex: 'date',
            render: (value: string) => formatDate(value)
        },
        {
            title: 'Origine',
            dataIndex: 'comptoir',
            render: (value: boolean) => <Tag color={value ? 'purple' : 'geekblue'}>{value ? 'Comptoir' : 'Prestation'}</Tag>
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            render: (value: VenteStatus, record: VenteEntity) => {
                const label = value === 'DEVIS' && record.bonPourAccord
                    ? 'Bon pour accord'
                    : statusOptions.find((item) => item.value === value)?.label || value;
                const color = value === 'DEVIS' && record.bonPourAccord ? 'cyan' : statusColor[value] || 'default';
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
            title: 'Client',
            dataIndex: 'client',
            render: (value: ClientEntity) => getClientLabel(value)
        },
        {
            title: 'Forfaits',
            dataIndex: 'venteForfaits',
            render: (values: VenteForfaitEntity[]) => values?.length || 0
        },
        {
            title: 'Services',
            dataIndex: 'venteServices',
            render: (values: VenteServiceEntity[]) => values?.length || 0
        },
        {
            title: 'Produits',
            dataIndex: 'produits',
            render: (values: ProduitCatalogueEntity[]) => values?.length || 0
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
                    <Button title="Imprimer" icon={<PrinterOutlined />} onClick={() => handlePrint(record)} />
                    <Button title="Envoyer par email" icon={<MailOutlined />} onClick={() => handleEmail(record)} />
                    <Dropdown menu={{ items: paymentMenuItems(record) }} placement="bottomRight" disabled={record.status !== 'FACTURE_PRETE'}>
                        <Button title="Lien de paiement" icon={<CreditCardOutlined />} disabled={record.status !== 'FACTURE_PRETE'} />
                    </Dropdown>
                    <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm
                        title="Supprimer cette vente ?"
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
        <Card title="Prestations">
            <Form
                form={searchForm}
                layout="vertical"
                initialValues={{ status: undefined, clientId: undefined }}
                onFinish={(values) => {
                    const nextFilters: SearchFilters = {
                        status: values.status,
                        clientId: values.clientId
                    };
                    setFilters(nextFilters);
                    fetchVentes(nextFilters);
                }}
            >
                <Row gutter={16} align="bottom">
                    <Col flex="auto">
                        <Row gutter={16}>
                            <Col span={10}>
                                <Form.Item name="status" label="Statut" style={{ marginBottom: 0 }}>
                                    <Select allowClear options={statusOptions} placeholder="Tous les statuts" />
                                </Form.Item>
                            </Col>
                            <Col span={14}>
                                <Form.Item name="clientId" label="Client" style={{ marginBottom: 0 }}>
                                    <Select allowClear showSearch options={clientOptions} placeholder="Tous les clients" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Col>
                    <Col flex="none" style={{ marginBottom: 0 }}>
                        <Space>
                            <Button type="primary" htmlType="submit">Rechercher</Button>
                            <Button
                                onClick={() => {
                                    searchForm.resetFields();
                                    setFilters({});
                                    fetchVentes();
                                }}
                            >
                                Reinitialiser
                            </Button>
                            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                        </Space>
                    </Col>
                </Row>
            </Form>

            <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                <Col span={24}>
                    <Table
                        rowKey="id"
                        dataSource={ventes}
                        columns={columns}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        bordered
                    />
                </Col>
            </Row>

            <Modal
                title={isEdit ? 'Modifier une vente' : 'Ajouter une vente'}
                open={modalVisible}
                onCancel={handleModalCancel}
                footer={[
                    <Button
                        key="print"
                        icon={<PrinterOutlined />}
                        disabled={!currentVente}
                        onClick={() => currentVente && handlePrint(currentVente)}
                    >
                        Imprimer
                    </Button>,
                    <Button
                        key="email"
                        icon={<MailOutlined />}
                        disabled={!currentVente}
                        onClick={() => currentVente && handleEmail(currentVente)}
                    >
                        Envoyer par email
                    </Button>,
                    ...(watchedStatus === 'FACTURE_PRETE' || watchedStatus === 'FACTURE_PAYEE' ? [<Dropdown
                        key="payment"
                        menu={{ items: currentVente ? paymentMenuItems(currentVente) : [] }}
                        placement="topRight"
                    >
                        <Button icon={<CreditCardOutlined />}>
                            Lien de paiement
                        </Button>
                    </Dropdown>] : []),
                    ...(!isReadOnly ? [<div key="step-nav" style={{ flex: 1, textAlign: 'left' }}>
                        <Button
                            icon={<LeftOutlined />}
                            disabled={venteStepIndex(watchedStatus || 'DEVIS', watchedBonPourAccord) <= 0}
                            onClick={() => {
                                const current = venteStepIndex(watchedStatus || 'DEVIS', watchedBonPourAccord);
                                if (current > 0) goToStep(current - 1);
                            }}
                        >
                            Précédent
                        </Button>
                        <Button
                            style={{ marginLeft: 8 }}
                            disabled={venteStepIndex(watchedStatus || 'DEVIS', watchedBonPourAccord) >= 4}
                            onClick={() => {
                                const current = venteStepIndex(watchedStatus || 'DEVIS', watchedBonPourAccord);
                                if (current < 4) goToStep(current + 1);
                            }}
                        >
                            Suivant
                            <RightOutlined />
                        </Button>
                    </div>] : []),
                    <Button key="cancel" onClick={handleModalCancel}>
                        Fermer
                    </Button>,
                    ...(!isReadOnly ? [
                        <Button key="discard" onClick={() => { setFormDirty(false); setModalVisible(false); }}>
                            Annuler
                        </Button>,
                        <Button key="save" type="primary" onClick={handleSave}>
                            Enregistrer
                        </Button>
                    ] : [])
                ]}
                maskClosable={false}
                destroyOnHidden
                width={1400}
            >
                <Form form={form} layout="vertical" initialValues={defaultVente} onValuesChange={onValuesChange} disabled={isReadOnly}>
                    <Form.Item noStyle name="status"><input type="hidden" /></Form.Item>
                    <Form.Item noStyle name="bonPourAccord"><input type="hidden" /></Form.Item>
                    <Steps
                        current={venteStepIndex(
                            watchedStatus || 'DEVIS',
                            watchedBonPourAccord
                        )}
                        size="small"
                        style={{ marginBottom: 24 }}
                        items={venteStepItems(currentVente)}
                        onChange={isReadOnly ? undefined : (step) => goToStep(step)}
                    />
                    <Row gutter={16}>
                        {watchedStatus === 'DEVIS' && !watchedBonPourAccord && (
                            <Col span={8}>
                                <Form.Item name="ordreDeReparation" label="Affichage client">
                                    <Select options={[
                                        { value: false, label: 'Devis chiffré' },
                                        { value: true, label: 'Ordre de Réparation' },
                                    ]} />
                                </Form.Item>
                            </Col>
                        )}
                        <Col span={8}>
                            <Form.Item name="date" label="Date">
                                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        {(watchedStatus === 'FACTURE_PRETE' || watchedStatus === 'FACTURE_PAYEE') && (
                            <Col span={8}>
                                <Form.Item name="modePaiement" label="Mode de paiement">
                                    <Select allowClear options={modePaiementOptions} />
                                </Form.Item>
                            </Col>
                        )}
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Client" required>
                                <Space.Compact style={{ width: '100%' }}>
                                    <Form.Item name="clientId" noStyle rules={[{ required: true, message: 'Le client est obligatoire' }]}>
                                        <Select allowClear showSearch options={clientOptions} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Button icon={<PlusOutlined />} title="Créer un client" onClick={openNewClientModal} />
                                </Space.Compact>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Bateau">
                                <Space.Compact style={{ width: '100%' }}>
                                    <Form.Item name="bateauId" noStyle>
                                        <Select allowClear showSearch options={bateauOptions} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Button icon={<PlusOutlined />} title="Créer un bateau" onClick={openNewBateauModal} />
                                </Space.Compact>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Moteur">
                                <Space.Compact style={{ width: '100%' }}>
                                    <Form.Item name="moteurId" noStyle>
                                        <Select allowClear showSearch options={moteurOptions} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Button icon={<PlusOutlined />} title="Créer un moteur" onClick={openNewMoteurModal} />
                                </Space.Compact>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Remorque">
                                <Space.Compact style={{ width: '100%' }}>
                                    <Form.Item name="remorqueId" noStyle>
                                        <Select allowClear showSearch options={remorqueOptions} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Button icon={<PlusOutlined />} title="Créer une remorque" onClick={openNewRemorqueModal} />
                                </Space.Compact>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Tabs
                        defaultActiveKey="lignes"
                        items={[
                            {
                                key: 'lignes',
                                label: 'Lignes',
                                children: (
                                    <>
                                        <Form.Item label="Forfaits">
                                            <Form.List name="venteForfaits">
                                                {(fields, { remove }) => (
                                                    <>
                                                        {fields.map((field) => {
                                                            const forfaitId = form.getFieldValue(['venteForfaits', field.name, 'forfaitId']);
                                                            const isEmptyLine = !forfaitId;
                                                            return (
                                                            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8, flexWrap: 'nowrap' }}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'forfaitId']}
                                                                    rules={[
                                                                        {
                                                                            validator: async () => {}
                                                                        }
                                                                    ]}
                                                                    style={{ width: 280 }}
                                                                >
                                                                    <Select
                                                                        allowClear
                                                                        showSearch
                                                                        options={forfaitOptions}
                                                                        placeholder="Forfait"
                                                                        filterOption={(input, option) =>
                                                                            (((option as { searchText?: string } | undefined)?.searchText) || '').includes(input.toLowerCase())
                                                                        }
                                                                    />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'quantite']}
                                                                    rules={[
                                                                        {
                                                                            validator: async (_, value) => {
                                                                                const line = form.getFieldValue(['venteForfaits', field.name]);
                                                                                if (!line?.forfaitId && (value === undefined || value === null)) {
                                                                                    return;
                                                                                }
                                                                                if (!value || value <= 0) {
                                                                                    throw new Error('Quantite requise');
                                                                                }
                                                                            }
                                                                        }
                                                                    ]}
                                                                    style={{ width: 80 }}
                                                                >
                                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const fId = getFieldValue(['venteForfaits', field.name, 'forfaitId']);
                                                                        const pu = forfaits.find((f) => f.id === fId)?.prixTTC;
                                                                        return (
                                                                            <Form.Item style={{ width: 120 }}>
                                                                                <InputNumber addonAfter="EUR" value={pu ?? undefined} style={{ width: '100%' }} disabled placeholder="P.U." />
                                                                            </Form.Item>
                                                                        );
                                                                    }}
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const fId = getFieldValue(['venteForfaits', field.name, 'forfaitId']);
                                                                        const quantite = getFieldValue(['venteForfaits', field.name, 'quantite']) || 0;
                                                                        const pu = forfaits.find((f) => f.id === fId)?.prixTTC || 0;
                                                                        const total = Math.round(((pu * quantite) + Number.EPSILON) * 100) / 100;
                                                                        return (
                                                                            <Form.Item style={{ width: 120 }}>
                                                                                <InputNumber addonAfter="EUR" value={total} style={{ width: '100%' }} disabled />
                                                                            </Form.Item>
                                                                        );
                                                                    }}
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'status']}
                                                                    style={{ width: 130 }}
                                                                >
                                                                    <Select allowClear options={planningStatusOptions} placeholder="Statut" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'technicienIds']}
                                                                    style={{ width: 220 }}
                                                                >
                                                                    <Select mode="multiple" allowClear showSearch options={technicienOptions} placeholder="Techniciens" disabled={!watchedBonPourAccord} />
                                                                </Form.Item>
                                                                {isEmptyLine ? (
                                                                    <Button icon={<PlusOutlined />} title="Créer un forfait" onClick={() => openNewForfaitModal(field.name)} />
                                                                ) : (
                                                                    <Button icon={<CalendarOutlined />} title="Planifier" disabled={!watchedBonPourAccord} onClick={() => { setModalVisible(false); navigate('/planning'); }} />
                                                                )}
                                                                <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                            </Space>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            </Form.List>
                                        </Form.Item>

                                        <Form.Item label="Services">
                                            <Form.List name="venteServices">
                                                {(fields, { remove }) => (
                                                    <>
                                                        {fields.map((field) => {
                                                            const serviceId = form.getFieldValue(['venteServices', field.name, 'serviceId']);
                                                            const isEmptyLine = !serviceId;
                                                            return (
                                                            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8, flexWrap: 'nowrap' }}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'serviceId']}
                                                                    hidden
                                                                >
                                                                    <InputNumber />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    style={{ width: 280 }}
                                                                >
                                                                    <Input disabled value={services.find((s) => s.id === serviceId)?.nom || ''} placeholder="Service" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'quantite']}
                                                                    rules={[
                                                                        {
                                                                            validator: async (_, value) => {
                                                                                const line = form.getFieldValue(['venteServices', field.name]);
                                                                                if (!line?.serviceId && (value === undefined || value === null)) {
                                                                                    return;
                                                                                }
                                                                                if (!value || value <= 0) {
                                                                                    throw new Error('Quantite requise');
                                                                                }
                                                                            }
                                                                        }
                                                                    ]}
                                                                    style={{ width: 80 }}
                                                                >
                                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const sId = getFieldValue(['venteServices', field.name, 'serviceId']);
                                                                        const pu = services.find((s) => s.id === sId)?.prixTTC;
                                                                        return (
                                                                            <Form.Item style={{ width: 120 }}>
                                                                                <InputNumber addonAfter="EUR" value={pu ?? undefined} style={{ width: '100%' }} disabled placeholder="P.U." />
                                                                            </Form.Item>
                                                                        );
                                                                    }}
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const sId = getFieldValue(['venteServices', field.name, 'serviceId']);
                                                                        const quantite = getFieldValue(['venteServices', field.name, 'quantite']) || 0;
                                                                        const pu = services.find((s) => s.id === sId)?.prixTTC || 0;
                                                                        const total = Math.round(((pu * quantite) + Number.EPSILON) * 100) / 100;
                                                                        return (
                                                                            <Form.Item style={{ width: 120 }}>
                                                                                <InputNumber addonAfter="EUR" value={total} style={{ width: '100%' }} disabled />
                                                                            </Form.Item>
                                                                        );
                                                                    }}
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'status']}
                                                                    style={{ width: 130 }}
                                                                >
                                                                    <Select allowClear options={planningStatusOptions} placeholder="Statut" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'technicienIds']}
                                                                    style={{ width: 220 }}
                                                                >
                                                                    <Select mode="multiple" allowClear showSearch options={technicienOptions} placeholder="Techniciens" disabled={!watchedBonPourAccord} />
                                                                </Form.Item>
                                                                {isEmptyLine ? (
                                                                    <Button icon={<PlusOutlined />} title="Créer un service" onClick={() => openNewServiceModal(field.name)} />
                                                                ) : (
                                                                    <>
                                                                        <Button icon={<EditOutlined />} title="Modifier le service" onClick={() => openEditServiceModal(serviceId)} />
                                                                        <Button icon={<CalendarOutlined />} title="Planifier" disabled={!watchedBonPourAccord} onClick={() => { setModalVisible(false); navigate('/planning'); }} />
                                                                    </>
                                                                )}
                                                                <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                            </Space>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            </Form.List>
                                        </Form.Item>

                                        <Form.Item label="Produits">
                                            <Form.List name="produits">
                                                {(fields, { remove }) => (
                                                    <>
                                                        {fields.map((field) => {
                                                            const produitId = form.getFieldValue(['produits', field.name, 'produitId']);
                                                            const isEmptyLine = !produitId;
                                                            return (
                                                            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'produitId']}
                                                                    rules={[
                                                                        {
                                                                            validator: async () => {}
                                                                        }
                                                                    ]}
                                                                    style={{ width: 520 }}
                                                                >
                                                                    <Select allowClear showSearch options={produitOptions} placeholder="Produit" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'quantite']}
                                                                    rules={[
                                                                        {
                                                                            validator: async (_, value) => {
                                                                                const line = form.getFieldValue(['produits', field.name]);
                                                                                if (!line?.produitId && (value === undefined || value === null)) {
                                                                                    return;
                                                                                }
                                                                                if (!value || value <= 0) {
                                                                                    throw new Error('Quantite requise');
                                                                                }
                                                                            }
                                                                        }
                                                                    ]}
                                                                    style={{ width: 120 }}
                                                                >
                                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const pid = getFieldValue(['produits', field.name, 'produitId']);
                                                                        const pu = produits.find((item) => item.id === pid)?.prixVenteTTC;
                                                                        return (
                                                                            <Form.Item style={{ width: 150 }}>
                                                                                <InputNumber addonAfter="EUR" value={pu ?? undefined} style={{ width: '100%' }} disabled placeholder="P.U." />
                                                                            </Form.Item>
                                                                        );
                                                                    }}
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const pid = getFieldValue(['produits', field.name, 'produitId']);
                                                                        const quantite = getFieldValue(['produits', field.name, 'quantite']) || 0;
                                                                        const prixUnitaireTTC = produits.find((item) => item.id === pid)?.prixVenteTTC || 0;
                                                                        const prixTTC = Math.round(((prixUnitaireTTC * quantite) + Number.EPSILON) * 100) / 100;

                                                                        return (
                                                                            <Form.Item style={{ width: 150 }}>
                                                                                <InputNumber addonAfter="EUR" value={prixTTC} style={{ width: '100%' }} disabled />
                                                                            </Form.Item>
                                                                        );
                                                                    }}
                                                                </Form.Item>
                                                                {isEmptyLine && (
                                                                    <Button icon={<PlusOutlined />} title="Créer un produit" onClick={() => openNewProduitModal(field.name)} />
                                                                )}
                                                                <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                            </Space>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            </Form.List>
                                        </Form.Item>
                                    </>
                                )
                            },
                            {
                                key: 'rappels',
                                label: 'Rappels',
                                children: (
                                    <>
                                        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                            <Col>
                                                <span style={{ color: '#666' }}>
                                                    Configurez les rappels automatiques par email envoyés au client avant la date de la prestation.
                                                </span>
                                            </Col>
                                            {isEdit && currentVente?.id && (
                                                <Col>
                                                    <Button
                                                        icon={<SendOutlined />}
                                                        onClick={async () => {
                                                            try {
                                                                await api.post(`/ventes/${currentVente.id}/rappel`);
                                                                message.success('Rappel envoye avec succes');
                                                                api.get<RappelHistoriqueEntity[]>(`/rappels/vente/${currentVente.id}`).then(res => setRappelHistorique(res.data)).catch(() => {});
                                                            } catch (err: any) {
                                                                message.error(err?.response?.data || 'Erreur lors de l\'envoi du rappel');
                                                            }
                                                        }}
                                                    >
                                                        Envoyer un rappel maintenant
                                                    </Button>
                                                </Col>
                                            )}
                                        </Row>
                                        <Row gutter={16}>
                                            <Col span={8}>
                                                <Form.Item name="rappel1Jours" label="Rappel 1 (jours avant)">
                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Ex: 30" addonAfter="jours" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={8}>
                                                <Form.Item name="rappel2Jours" label="Rappel 2 (jours avant)">
                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Ex: 7" addonAfter="jours" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={8}>
                                                <Form.Item name="rappel3Jours" label="Rappel 3 (jours avant)">
                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Ex: 1" addonAfter="jours" />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                        {isEdit && rappelHistorique.length > 0 && (
                                            <>
                                                <h4 style={{ marginTop: 16 }}>Historique des rappels envoyes</h4>
                                                <Table
                                                    dataSource={rappelHistorique}
                                                    rowKey="id"
                                                    size="small"
                                                    pagination={false}
                                                    columns={[
                                                        {
                                                            title: 'Rappel',
                                                            dataIndex: 'numeroRappel',
                                                            width: 80,
                                                            render: (v: number) => v === 0 ? 'Manuel' : `#${v}`
                                                        },
                                                        {
                                                            title: 'Date d\'envoi',
                                                            dataIndex: 'dateEnvoi',
                                                            width: 160,
                                                            render: (v: string) => v ? new Date(v).toLocaleString('fr-FR') : '-'
                                                        },
                                                        {
                                                            title: 'Destinataire',
                                                            dataIndex: 'destinataire',
                                                            width: 200
                                                        },
                                                        {
                                                            title: 'Sujet',
                                                            dataIndex: 'sujet'
                                                        }
                                                    ]}
                                                />
                                            </>
                                        )}
                                    </>
                                )
                            },
                            {
                                key: 'images',
                                label: 'Images & Documents',
                                children: (
                                    <>
                                        <Form.Item name="images" label="Images">
                                            <ImageUpload />
                                        </Form.Item>
                                        <Form.Item name="documents" label="Documents">
                                            <DocumentUpload />
                                        </Form.Item>
                                        <Form.Item noStyle shouldUpdate>
                                            {({ getFieldValue }) => {
                                                const vfLines = (getFieldValue('venteForfaits') || []).filter((l: { forfaitId?: number; images?: string[]; documents?: string[] }) => l.forfaitId && ((l.images && l.images.length > 0) || (l.documents && l.documents.length > 0)));
                                                const vsLines = (getFieldValue('venteServices') || []).filter((l: { serviceId?: number; images?: string[]; documents?: string[] }) => l.serviceId && ((l.images && l.images.length > 0) || (l.documents && l.documents.length > 0)));
                                                if (vfLines.length === 0 && vsLines.length === 0) return null;
                                                return (
                                                    <>
                                                        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 16 }}>
                                                            <strong>Images & documents des prestations</strong>
                                                        </div>
                                                        {vfLines.map((line: { forfaitId: number; images?: string[]; documents?: string[] }, idx: number) => {
                                                            const f = forfaits.find((ff) => ff.id === line.forfaitId);
                                                            return (
                                                                <div key={`vf-img-${idx}`} style={{ marginTop: 12 }}>
                                                                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Forfait : {f?.nom || `#${line.forfaitId}`}</div>
                                                                    {line.images && line.images.length > 0 && (
                                                                        <Form.Item label="Images" style={{ marginBottom: 8 }}>
                                                                            <ImageUpload value={line.images} onChange={(urls) => {
                                                                                const allLines = getFieldValue('venteForfaits');
                                                                                const realIdx = allLines.findIndex((l: { forfaitId?: number }) => l.forfaitId === line.forfaitId);
                                                                                if (realIdx >= 0) {
                                                                                    allLines[realIdx] = { ...allLines[realIdx], images: urls };
                                                                                    form.setFieldsValue({ venteForfaits: [...allLines] });
                                                                                }
                                                                            }} />
                                                                        </Form.Item>
                                                                    )}
                                                                    {line.documents && line.documents.length > 0 && (
                                                                        <Form.Item label="Documents" style={{ marginBottom: 8 }}>
                                                                            <DocumentUpload value={line.documents} onChange={(urls) => {
                                                                                const allLines = getFieldValue('venteForfaits');
                                                                                const realIdx = allLines.findIndex((l: { forfaitId?: number }) => l.forfaitId === line.forfaitId);
                                                                                if (realIdx >= 0) {
                                                                                    allLines[realIdx] = { ...allLines[realIdx], documents: urls };
                                                                                    form.setFieldsValue({ venteForfaits: [...allLines] });
                                                                                }
                                                                            }} />
                                                                        </Form.Item>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {vsLines.map((line: { serviceId: number; images?: string[]; documents?: string[] }, idx: number) => {
                                                            const s = services.find((ss) => ss.id === line.serviceId);
                                                            return (
                                                                <div key={`vs-img-${idx}`} style={{ marginTop: 12 }}>
                                                                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Service : {s?.nom || `#${line.serviceId}`}</div>
                                                                    {line.images && line.images.length > 0 && (
                                                                        <Form.Item label="Images" style={{ marginBottom: 8 }}>
                                                                            <ImageUpload value={line.images} onChange={(urls) => {
                                                                                const allLines = getFieldValue('venteServices');
                                                                                const realIdx = allLines.findIndex((l: { serviceId?: number }) => l.serviceId === line.serviceId);
                                                                                if (realIdx >= 0) {
                                                                                    allLines[realIdx] = { ...allLines[realIdx], images: urls };
                                                                                    form.setFieldsValue({ venteServices: [...allLines] });
                                                                                }
                                                                            }} />
                                                                        </Form.Item>
                                                                    )}
                                                                    {line.documents && line.documents.length > 0 && (
                                                                        <Form.Item label="Documents" style={{ marginBottom: 8 }}>
                                                                            <DocumentUpload value={line.documents} onChange={(urls) => {
                                                                                const allLines = getFieldValue('venteServices');
                                                                                const realIdx = allLines.findIndex((l: { serviceId?: number }) => l.serviceId === line.serviceId);
                                                                                if (realIdx >= 0) {
                                                                                    allLines[realIdx] = { ...allLines[realIdx], documents: urls };
                                                                                    form.setFieldsValue({ venteServices: [...allLines] });
                                                                                }
                                                                            }} />
                                                                        </Form.Item>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            }}
                                        </Form.Item>
                                    </>
                                )
                            },
                        ]}
                    />

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
                            <Form.Item name="remisePourcentage" label="Remise (%)">
                                <InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="remise" label="Remise (EUR)">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="montantTVA" label="Montant TVA">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="montantTTC" label="Montant TTC">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="prixVenteTTC" label="Prix vente TTC">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>

                <Modal
                    title="Créer un produit"
                    open={newProduitModalVisible}
                    onOk={handleNewProduitSave}
                    onCancel={makeInnerModalCancel(newProduitFormDirty, setNewProduitFormDirty, setNewProduitModalVisible)}
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
                        onValuesChange={onNewProduitValuesChange}
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
                        <Form.Item name="documents" label="Documents">
                            <DocumentUpload />
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
                    title={editServiceId ? "Modifier un service" : "Créer un service"}
                    open={newServiceModalVisible}
                    onOk={handleNewServiceSave}
                    onCancel={makeInnerModalCancel(newServiceFormDirty, setNewServiceFormDirty, setNewServiceModalVisible)}
                    maskClosable={false}
                    width={1000}
                    okText="Enregistrer"
                    cancelText="Fermer"
                    destroyOnHidden
                >
                    <Form form={newServiceForm} layout="vertical" initialValues={defaultNewService} onValuesChange={onNewServiceValuesChange}>
                        <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                            <Input allowClear />
                        </Form.Item>
                        <Form.Item name="description" label="Description">
                            <Input.TextArea rows={2} allowClear />
                        </Form.Item>
                        <Form.Item name="dureeEstimee" label="Durée estimée">
                            <InputNumber min={0} step={0.25} precision={2} style={{ width: '100%' }} addonAfter="h" />
                        </Form.Item>
                        <Tabs
                            defaultActiveKey="mainOeuvres"
                            items={[
                                {
                                    key: 'mainOeuvres',
                                    label: "Main d'Oeuvres",
                                    children: (
                                        <Form.List name="mainOeuvres">
                                            {(fields, { remove }) => (
                                                <>
                                                    {fields.map((field, index) => (
                                                        <Row gutter={8} key={field.key} align="middle">
                                                            <Col span={16}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'mainOeuvreId']}
                                                                    label={index === 0 ? "Main d'Oeuvre" : undefined}
                                                                >
                                                                    <Select
                                                                        showSearch
                                                                        allowClear
                                                                        placeholder="Sélectionner une main d'oeuvre"
                                                                        options={mainOeuvreOptions}
                                                                        filterOption={(input, option) =>
                                                                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                                        }
                                                                    />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={5}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'quantite']}
                                                                    label={index === 0 ? 'Quantité' : undefined}
                                                                >
                                                                    <InputNumber min={0.25} step={0.25} style={{ width: '100%' }} />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={3}>
                                                                <Form.Item label={index === 0 ? ' ' : undefined}>
                                                                    {fields.length > 1 && (
                                                                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                                    )}
                                                                </Form.Item>
                                                            </Col>
                                                        </Row>
                                                    ))}
                                                </>
                                            )}
                                        </Form.List>
                                    )
                                },
                                {
                                    key: 'produits',
                                    label: 'Produits',
                                    children: (
                                        <Form.List name="produits">
                                            {(fields, { remove }) => (
                                                <>
                                                    {fields.map((field, index) => (
                                                        <Row gutter={8} key={field.key} align="middle">
                                                            <Col span={16}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'produitId']}
                                                                    label={index === 0 ? 'Produit' : undefined}
                                                                >
                                                                    <Select
                                                                        showSearch
                                                                        allowClear
                                                                        placeholder="Sélectionner un produit"
                                                                        options={produitOptionsForService}
                                                                        filterOption={(input, option) =>
                                                                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                                        }
                                                                    />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={5}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'quantite']}
                                                                    label={index === 0 ? 'Quantité' : undefined}
                                                                >
                                                                    <InputNumber min={1} style={{ width: '100%' }} />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={3}>
                                                                <Form.Item label={index === 0 ? ' ' : undefined}>
                                                                    {fields.length > 1 && (
                                                                        <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                                    )}
                                                                </Form.Item>
                                                            </Col>
                                                        </Row>
                                                    ))}
                                                </>
                                            )}
                                        </Form.List>
                                    )
                                },
                                {
                                    key: 'taches',
                                    label: 'Tâches Associées',
                                    children: (
                                        <Form.List name="taches">
                                            {(fields, { remove }) => (
                                                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                                                    {fields.map((field) => (
                                                        <Card
                                                            key={field.key}
                                                            size="small"
                                                            title={`Tâche ${field.name + 1}`}
                                                            extra={<Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                                                        >
                                                            <Form.Item {...field} name={[field.name, 'nom']} label="Nom">
                                                                <Input allowClear />
                                                            </Form.Item>
                                                            <Form.Item {...field} name={[field.name, 'description']} label="Description">
                                                                <Input.TextArea rows={2} />
                                                            </Form.Item>
                                                        </Card>
                                                    ))}
                                                </Space>
                                            )}
                                        </Form.List>
                                    )
                                }
                            ]}
                        />
                        <Row gutter={16} style={{ marginTop: 16 }}>
                            <Col span={6}><Form.Item name="prixHT" label="Prix HT"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="tva" label="TVA (%)"><InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="montantTVA" label="Montant TVA"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="prixTTC" label="Prix TTC"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                    </Form>
                </Modal>

                <Modal
                    title="Créer un forfait"
                    open={newForfaitModalVisible}
                    onOk={handleNewForfaitSave}
                    onCancel={makeInnerModalCancel(newForfaitFormDirty, setNewForfaitFormDirty, setNewForfaitModalVisible)}
                    maskClosable={false}
                    width={1024}
                    okText="Enregistrer"
                    cancelText="Fermer"
                    destroyOnHidden
                >
                    <Form form={newForfaitForm} layout="vertical" initialValues={defaultNewForfait} onValuesChange={onNewForfaitValuesChange}>
                        <Form.Item name="reference" label="Référence" rules={[{ required: true, message: 'La référence est requise' }]}>
                            <Input allowClear />
                        </Form.Item>
                        <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                            <Input allowClear />
                        </Form.Item>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="moteurIds" label="Moteurs associés">
                                    <Select mode="multiple" allowClear options={moteurOptions} placeholder="Sélectionner les moteurs" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="bateauIds" label="Bateaux associés">
                                    <Select mode="multiple" allowClear options={bateauOptions} placeholder="Sélectionner les bateaux" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item name="dureeEstimee" label="Durée estimée">
                            <InputNumber min={0} step={0.25} precision={2} style={{ width: '100%' }} addonAfter="h" />
                        </Form.Item>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="heuresFonctionnement" label="Heures de fonctionnement">
                                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="joursFrequence" label="Fréquence (jours)">
                                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Tabs
                            defaultActiveKey="contenu"
                            items={[
                                {
                                    key: 'contenu',
                                    label: "Produits & Main d'Oeuvres",
                                    children: (
                                        <>
                                            <Form.Item label="Produits inclus">
                                                <Form.List name="produits">
                                                    {(fields, { remove }) => (
                                                        <>
                                                            {fields.map((field) => {
                                                                const produitId = newForfaitForm.getFieldValue(['produits', field.name, 'produitId']);
                                                                return (
                                                                <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                    <Form.Item
                                                                        {...field}
                                                                        name={[field.name, 'produitId']}
                                                                        style={{ width: 520 }}
                                                                    >
                                                                        <Select allowClear showSearch options={produitOptions} placeholder="Produit" />
                                                                    </Form.Item>
                                                                    <Form.Item
                                                                        {...field}
                                                                        name={[field.name, 'quantite']}
                                                                        style={{ width: 180 }}
                                                                    >
                                                                        <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                                    </Form.Item>
                                                                    <Form.Item noStyle shouldUpdate>
                                                                        {({ getFieldValue }) => {
                                                                            const pid = getFieldValue(['produits', field.name, 'produitId']);
                                                                            const quantite = getFieldValue(['produits', field.name, 'quantite']) || 0;
                                                                            const prixUnitaireTTC = produits.find((p) => p.id === pid)?.prixVenteTTC || 0;
                                                                            const prixTTC = Math.round(((prixUnitaireTTC * quantite) + Number.EPSILON) * 100) / 100;
                                                                            return (
                                                                                <Form.Item style={{ width: 180 }}>
                                                                                    <InputNumber addonAfter="EUR" value={prixTTC} style={{ width: '100%' }} disabled />
                                                                                </Form.Item>
                                                                            );
                                                                        }}
                                                                    </Form.Item>
                                                                    <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                                </Space>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </Form.List>
                                            </Form.Item>

                                            <Form.Item label="Main d'Oeuvres incluses">
                                                <Form.List name="mainOeuvres">
                                                    {(fields, { remove }) => (
                                                        <>
                                                            {fields.map((field) => {
                                                                const moId = newForfaitForm.getFieldValue(['mainOeuvres', field.name, 'mainOeuvreId']);
                                                                return (
                                                                <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                    <Form.Item
                                                                        {...field}
                                                                        name={[field.name, 'mainOeuvreId']}
                                                                        style={{ width: 520 }}
                                                                    >
                                                                        <Select allowClear showSearch options={mainOeuvreOptions} placeholder="Main d'Oeuvre" />
                                                                    </Form.Item>
                                                                    <Form.Item
                                                                        {...field}
                                                                        name={[field.name, 'quantite']}
                                                                        style={{ width: 180 }}
                                                                    >
                                                                        <InputNumber min={0.25} step={0.25} style={{ width: '100%' }} placeholder="Qte" />
                                                                    </Form.Item>
                                                                    <Form.Item noStyle shouldUpdate>
                                                                        {({ getFieldValue }) => {
                                                                            const mid = getFieldValue(['mainOeuvres', field.name, 'mainOeuvreId']);
                                                                            const quantite = getFieldValue(['mainOeuvres', field.name, 'quantite']) || 0;
                                                                            const prixUnitaireTTC = mainOeuvres.find((mo) => mo.id === mid)?.prixTTC || 0;
                                                                            const prixTTC = Math.round(((prixUnitaireTTC * quantite) + Number.EPSILON) * 100) / 100;
                                                                            return (
                                                                                <Form.Item style={{ width: 180 }}>
                                                                                    <InputNumber addonAfter="EUR" value={prixTTC} style={{ width: '100%' }} disabled />
                                                                                </Form.Item>
                                                                            );
                                                                        }}
                                                                    </Form.Item>
                                                                    <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                                                </Space>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </Form.List>
                                            </Form.Item>
                                        </>
                                    )
                                },
                                {
                                    key: 'taches',
                                    label: 'Tâches Associées',
                                    children: (
                                        <Form.List name="taches">
                                            {(fields, { remove }) => (
                                                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                                                    {fields.map((field) => (
                                                        <Card
                                                            key={field.key}
                                                            size="small"
                                                            title={`Tâche ${field.name + 1}`}
                                                            extra={<Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                                                        >
                                                            <Form.Item {...field} name={[field.name, 'nom']} label="Nom">
                                                                <Input allowClear />
                                                            </Form.Item>
                                                            <Form.Item {...field} name={[field.name, 'description']} label="Description">
                                                                <Input.TextArea rows={2} />
                                                            </Form.Item>
                                                        </Card>
                                                    ))}
                                                </Space>
                                            )}
                                        </Form.List>
                                    )
                                }
                            ]}
                        />

                        <Row gutter={16}>
                            <Col span={6}><Form.Item name="prixHT" label="Prix HT"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="tva" label="TVA (%)"><InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="montantTVA" label="Montant TVA"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="prixTTC" label="Prix TTC"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                    </Form>
                </Modal>
            </Modal>

            <Modal
                title="Créer un client"
                open={newClientModalVisible}
                onOk={handleNewClientSave}
                onCancel={makeInnerModalCancel(newClientFormDirty, setNewClientFormDirty, setNewClientModalVisible)}
                maskClosable={false}
                width={800}
                okText="Enregistrer"
                cancelText="Fermer"
                destroyOnHidden
            >
                <Form form={newClientForm} layout="vertical" onValuesChange={() => setNewClientFormDirty(true)}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Le type est requis' }]}>
                                <Select options={[
                                    { value: 'PARTICULIER', label: 'Particulier' },
                                    { value: 'PROFESSIONNEL', label: 'Professionnel' },
                                    { value: 'PROFESSIONNEL_MER', label: 'Professionnel de la Mer' },
                                ]} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
                            {({ getFieldValue }) =>
                                getFieldValue('type') === 'PARTICULIER' && (
                                    <Col span={12}>
                                        <Form.Item name="prenom" label="Prénom">
                                            <Input allowClear />
                                        </Form.Item>
                                    </Col>
                                )
                            }
                        </Form.Item>
                        <Col span={12}>
                            <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="email" label="Email">
                                <Input type="email" allowClear />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="telephone" label="Téléphone">
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="adresse" label="Adresse">
                        <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} allowClear />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
                        {({ getFieldValue }) =>
                            getFieldValue('type') !== 'PARTICULIER' && (
                                <>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="siren" label="SIREN">
                                                <Input allowClear />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="siret" label="SIRET">
                                                <Input allowClear />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item name="tva" label="TVA">
                                                <Input allowClear />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="naf" label="NAF">
                                                <Input allowClear />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </>
                            )
                        }
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="remise" label="Remise (%)">
                                <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="evaluation" label="Évaluation">
                                <Rate allowClear />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="notes" label="Notes">
                        <Input.TextArea rows={3} allowClear />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Créer un bateau"
                open={newBateauModalVisible}
                onOk={handleNewBateauSave}
                onCancel={makeInnerModalCancel(newBateauFormDirty, setNewBateauFormDirty, setNewBateauModalVisible)}
                maskClosable={false}
                width={800}
                okText="Enregistrer"
                cancelText="Fermer"
                destroyOnHidden
            >
                <Form form={newBateauForm} layout="vertical" onValuesChange={() => setNewBateauFormDirty(true)}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="name" label="Nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="immatriculation" label="Immatriculation">
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="numeroSerie" label="Numéro de série">
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="numeroClef" label="Numéro clef">
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="dateMeS" label="Date MeS">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="dateAchat" label="Date achat">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="dateFinDeGuarantie" label="Date fin garantie">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="localisation" label="Localisation">
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="localisationGps" label="Localisation GPS">
                                <Input allowClear placeholder="lat, lng" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Modèle catalogue">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="Associer à un modèle du catalogue"
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                options={catalogueBateaux.map((b) => ({ value: b.id, label: `${b.marque || ''} ${b.modele || ''}`.trim() }))}
                                onChange={(value) => newBateauForm.setFieldValue('modele', value ? { id: value } : undefined)}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un modèle" onClick={() => navigate('/catalogue/bateaux')} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item label="Propriétaires">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                mode="multiple"
                                showSearch
                                allowClear
                                placeholder="Sélectionner les propriétaires"
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                options={clientOptions}
                                onChange={(values) => newBateauForm.setFieldValue('proprietaires', (values || []).map((id: number) => ({ id })))}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un client" onClick={openNewClientModal} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item label="Moteurs">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                mode="multiple"
                                showSearch
                                allowClear
                                placeholder="Sélectionner les moteurs à associer"
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                options={catalogueMoteurs.map((m) => ({ value: m.id, label: `${m.marque || ''} ${m.modele || ''}`.trim() }))}
                                onChange={(values) => newBateauForm.setFieldValue('moteurs', (values || []).map((id: number) => ({ id })))}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un moteur" onClick={() => navigate('/catalogue/moteurs')} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item name="images" label="Images">
                        <ImageUpload />
                    </Form.Item>
                    <Form.Item name="documents" label="Documents">
                        <DocumentUpload />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Créer un moteur"
                open={newMoteurModalVisible}
                onOk={handleNewMoteurSave}
                onCancel={makeInnerModalCancel(newMoteurFormDirty, setNewMoteurFormDirty, setNewMoteurModalVisible)}
                maskClosable={false}
                width={800}
                okText="Enregistrer"
                cancelText="Fermer"
                destroyOnHidden
            >
                <Form form={newMoteurForm} layout="vertical" onValuesChange={() => setNewMoteurFormDirty(true)}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="numeroSerie" label="Numéro de série" rules={[{ required: true, message: 'Le numéro de série est requis' }]}>
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="numeroClef" label="Numéro de clef">
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="dateMeS" label="Date MeS">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="dateAchat" label="Date achat">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="dateFinDeGuarantie" label="Date fin garantie">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Modèle catalogue">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="Associer à un modèle du catalogue"
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                options={catalogueMoteurs.map((m) => ({ value: m.id, label: `${m.marque || ''} ${m.modele || ''}`.trim() }))}
                                onChange={(value) => newMoteurForm.setFieldValue('modele', value ? { id: value } : undefined)}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un modèle" onClick={() => navigate('/catalogue/moteurs')} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item label="Propriétaire">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="Sélectionner le propriétaire"
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                options={clientOptions}
                                onChange={(value) => newMoteurForm.setFieldValue('proprietaire', value ? { id: value } : undefined)}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un client" onClick={openNewClientModal} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item name="images" label="Images">
                        <ImageUpload />
                    </Form.Item>
                    <Form.Item name="documents" label="Documents">
                        <DocumentUpload />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Créer une remorque"
                open={newRemorqueModalVisible}
                onOk={handleNewRemorqueSave}
                onCancel={makeInnerModalCancel(newRemorqueFormDirty, setNewRemorqueFormDirty, setNewRemorqueModalVisible)}
                maskClosable={false}
                width={800}
                okText="Enregistrer"
                cancelText="Fermer"
                destroyOnHidden
            >
                <Form form={newRemorqueForm} layout="vertical" onValuesChange={() => setNewRemorqueFormDirty(true)}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="immatriculation" label="Immatriculation" rules={[{ required: true, message: "L'immatriculation est requise" }]}>
                                <Input allowClear />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="dateMeS" label="Date MeS">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="dateAchat" label="Date achat">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="dateFinDeGuarantie" label="Date fin garantie">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Modèle catalogue">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="Associer à un modèle du catalogue"
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                options={catalogueRemorques.map((r) => ({ value: r.id, label: `${r.marque || ''} ${r.modele || ''}`.trim() }))}
                                onChange={(value) => newRemorqueForm.setFieldValue('modele', value ? { id: value } : undefined)}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un modèle" onClick={() => navigate('/catalogue/remorques')} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item label="Propriétaire">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="Sélectionner le propriétaire"
                                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                options={clientOptions}
                                onChange={(value) => newRemorqueForm.setFieldValue('proprietaire', value ? { id: value } : undefined)}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un client" onClick={openNewClientModal} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item name="images" label="Images">
                        <ImageUpload />
                    </Form.Item>
                    <Form.Item name="documents" label="Documents">
                        <DocumentUpload />
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="Bon pour accord — Signature client"
                open={bpaModalVisible}
                onCancel={handleBpaCancel}
                width={700}
                maskClosable={false}
                destroyOnHidden
                footer={[
                    <Button key="clear" onClick={clearSignatureCanvas}>
                        Effacer la signature
                    </Button>,
                    <Button key="cancel" onClick={handleBpaCancel}>
                        Fermer
                    </Button>,
                    <Button key="confirm" type="primary" onClick={handleBpaConfirm}>
                        Valider le bon pour accord
                    </Button>
                ]}
            >
                <div style={{ marginBottom: 16 }}>
                    <Table
                        size="small"
                        pagination={false}
                        dataSource={getBpaSummaryLines()}
                        rowKey={(_, idx) => `bpa-${idx}`}
                        columns={[
                            { title: 'Type', dataIndex: 'type', width: 100 },
                            { title: 'Désignation', dataIndex: 'nom' },
                            { title: 'Qté', dataIndex: 'quantite', width: 60, align: 'center' as const },
                            ...(!form.getFieldValue('ordreDeReparation') ? [
                                { title: 'Prix TTC', dataIndex: 'prixTTC', width: 120, align: 'right' as const, render: (v: number) => formatEuro(v) },
                            ] : []),
                        ]}
                        summary={!form.getFieldValue('ordreDeReparation') ? (data) => {
                            const total = data.reduce((sum, row) => sum + row.prixTTC, 0);
                            const remise = form.getFieldValue('remise') || 0;
                            const prixVente = Math.round(((total - remise) + Number.EPSILON) * 100) / 100;
                            return (
                                <>
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>Total TTC</strong></Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right"><strong>{formatEuro(total)}</strong></Table.Summary.Cell>
                                    </Table.Summary.Row>
                                    {remise > 0 && (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={3} align="right">Remise</Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right">-{formatEuro(remise)}</Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>Prix vente TTC</strong></Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right"><strong>{formatEuro(prixVente)}</strong></Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </>
                            );
                        } : undefined}
                    />
                </div>
                <Divider />
                <div style={{ marginBottom: 8, fontWeight: 500 }}>Signature du client :</div>
                <canvas
                    ref={signatureCanvasRef}
                    style={{
                        width: '100%',
                        height: 200,
                        border: '1px solid #d9d9d9',
                        borderRadius: 6,
                        cursor: 'crosshair',
                        touchAction: 'none',
                    }}
                />
            </Modal>
        </Card>
    );
}
