import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    buildBoatBoxHtml,
    buildClientBoxHtml,
    buildInfoSectionHtml,
    buildCompositionDetails,
    buildDocBoxHtml,
    buildInvoiceTableHtml,
    buildLegalLine,
    buildBancaireHtml,
    buildReceptionHtml,
    buildSocieteBlockHtml,
    buildTotalsHtml,
    buildTvaBreakdownHtml,
    computeRemisePct,
    INVOICE_PRINT_STYLES,
    InvoicePrintLine,
    montantOccasion,
} from './printing/invoiceTemplate.ts';
import {
    calculerTvaVente,
    calculerTvaVenteDepuisHT,
    clientExonereTva,
    prixArticleVente,
    prixPrestationVente,
    tauxTvaVente,
    TOOLTIP_EXONERATION_TVA,
    TVA_VENTE_DEFAUT,
} from './tva-vente.ts';
import { comparerDatesVentes } from './tri-ventes.ts';
import { calculerMarge } from './marge-vente.ts';
import {
    Alert,
    AutoComplete,
    Button,
    Card,
    Checkbox,
    Col,
    Descriptions,
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
    Tooltip,
    DatePicker,
    Dropdown,
    message
} from 'antd';
import type { FormInstance, MenuProps } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, CreditCardOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EnvironmentOutlined, FileDoneOutlined, FileTextOutlined, InfoCircleOutlined, MailOutlined, MoreOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusCircleOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, RollbackOutlined, SendOutlined, SolutionOutlined, StopOutlined, WalletOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from './api.ts';
import { CGV_SECTIONS, CGV_TITLE } from './cgv-content.tsx';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import { useNavigation } from './navigation-context.tsx';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';
import PretRecuperationTag from './PretRecuperationTag.tsx';
import ReceptionResume from './ReceptionResume.tsx';
import { Reception, VOLUMES_CARBURANT, receptionRenseignee } from './reception.ts';
import ProgressionVente, { PopoverProgressionVente } from './ProgressionVente.tsx';
import CommandeFournisseurFromVenteModal from './CommandeFournisseurFromVenteModal.tsx';
import SuspensionRelancesModal from './SuspensionRelancesModal.tsx';
import { ouvrirPdf } from './ouvrir-pdf.ts';
import { FicheCataloguePopover } from './FicheCatalogueModal.tsx';
import SectionLignes from './SectionLignes.tsx';
import MontantsService from './MontantsService.tsx';
import { aplatirTaches } from './checklistParLigne.ts';
import LignesArticles from './LignesArticles.tsx';
import { LigneTriable, ListeTriable, PoigneeLigne } from './LignesTriables.tsx';
import { PackageEntity, articlesDuPackage, getPackageLabel, parsePackageRef } from './package-lignes.ts';
import { paginationConfig } from './pagination.ts';
import { CLIENT_NOM_AIDE, CLIENT_NOM_PLACEHOLDER } from './client-nom.ts';
import {
    ArticleALaVolee,
    LigneLibre,
    articleALaVolee,
    erreurDesignationLibre,
    erreurRefLibre,
    insererLigneLibre,
    nouvelleLigneLibre,
} from './ligne-libre.ts';
import SearchAutoComplete from './SearchAutoComplete.tsx';
import InputQuantite from './InputQuantite.tsx';
import LignesLibresAvoir from './LignesLibresAvoir.tsx';
import { AvoirLigneLibre, erreurLignesLibresAvoir, totalTTCLigneLibreAvoir } from './avoir-ligne-libre.ts';
import { quantiteLigne } from './quantite.ts';

interface ClientEntity {
    id: number;
    nom: string;
    type?: string;
    codeTiers?: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    siret?: string;
    tva?: string;
    // Accord particulier : aucune vente du client n'est relancée
    relancesSuspendues?: boolean;
    motifSuspensionRelances?: string;
}

interface CatalogueMoteurEntity {
    id: number;
    designation?: string;
}

interface BateauClientEntity {
    id: number;
    name?: string;
    immatriculation?: string;
    numeroSerie?: string;
    proprietaires?: ClientEntity[];
    moteurs?: CatalogueMoteurEntity[];
    modele?: { id: number; designation?: string };
}

interface MoteurClientEntity {
    id: number;
    numeroSerie?: string;
    proprietaire?: ClientEntity;
    modele?: { id: number; designation?: string };
}

interface RemorqueClientEntity {
    id: number;
    immatriculation?: string;
    proprietaire?: ClientEntity;
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
    mainOeuvreIndex?: number | null;
    done?: boolean;
    nonFait?: boolean;
    motif?: string;
}

interface VenteForfaitEntity {
    id?: number;
    forfait?: ForfaitEntity;
    quantite?: number;
    remise?: number;
    remisePourcentage?: number;
    techniciens?: TechnicienEntity[];
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    // Posée par l'application technicien quand une tâche terminée est rouverte
    dateReouverture?: string;
    // Posés par l'application technicien quand il corrige les horaires (date de correction, horaires d'origine)
    dateCorrectionHoraires?: string;
    dateDebutOriginale?: string;
    dateFinOriginale?: string;
    status?: PlanningStatus;
    statusDate?: string;
    dureeReelle?: number;
    incidentDate?: string;
    incidentDetails?: string;
    notes?: string;
    // Intervention SAV ou garantie : temps compté au SAV, pas dans les heures facturées (KPIs atelier)
    sav?: boolean;
    taches?: TaskEntity[];
    images?: string[];
    documents?: string[];
}

interface VenteServiceEntity {
    id?: number;
    service?: ServiceEntity;
    quantite?: number;
    remise?: number;
    remisePourcentage?: number;
    techniciens?: TechnicienEntity[];
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    // Posée par l'application technicien quand une tâche terminée est rouverte
    dateReouverture?: string;
    // Posés par l'application technicien quand il corrige les horaires (date de correction, horaires d'origine)
    dateCorrectionHoraires?: string;
    dateDebutOriginale?: string;
    dateFinOriginale?: string;
    status?: PlanningStatus;
    statusDate?: string;
    dureeReelle?: number;
    incidentDate?: string;
    incidentDetails?: string;
    notes?: string;
    // Intervention SAV ou garantie : temps compté au SAV, pas dans les heures facturées (KPIs atelier)
    sav?: boolean;
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
    moteursAssocies?: Array<{ id: number }>;
    bateauxAssocies?: Array<{ id: number }>;
    moteursClientsAssocies?: Array<{ id: number }>;
    bateauxClientsAssocies?: Array<{ id: number }>;
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
    mainOeuvres: [{}] as Array<{ mainOeuvreId?: number; quantite?: number; taches?: Array<{ nom?: string; description?: string }> }>,
    heuresFonctionnement: 0,
    joursFrequence: 0,
    prixHT: 0, tva: 20, montantTVA: 0, prixTTC: 0,
};

interface ProduitCatalogueEntity {
    id: number;
    designation: string;
    categorie?: string;
    ref?: string;
    refs?: string[];
    referencesFournisseurs?: string[];
    images?: string[];
    description?: string;
    evaluation?: number;
    stock?: number;
    stockMini?: number;
    emplacement?: string;
    emplacementMagasin?: string;
    prixVenteHT?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
    ajoutAutomatiqueIntervention?: boolean;
    occasion?: boolean;
}

interface CatalogueBateauEntity {
    id: number;
    designation: string;
    prixVenteHT?: number;
    tva?: number;
    prixVenteTTC?: number;
    stock?: number;
    occasion?: boolean;
}

interface CatalogueMoteurEntity {
    id: number;
    designation: string;
    prixVenteHT?: number;
    tva?: number;
    prixVenteTTC?: number;
    stock?: number;
    occasion?: boolean;
}

interface CatalogueHeliceEntity {
    id: number;
    designation: string;
    prixVenteHT?: number;
    tva?: number;
    prixVenteTTC?: number;
    stock?: number;
    occasion?: boolean;
}

interface CatalogueRemorqueEntity {
    id: number;
    designation: string;
    prixVenteHT?: number;
    tva?: number;
    prixVenteTTC?: number;
    stock?: number;
    occasion?: boolean;
}


const defaultNewProduit = {
    designation: '',
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
    emplacementMagasin: '',
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
    mainOeuvres: [{}] as Array<{ mainOeuvreId?: number; quantite?: number; taches?: Array<{ nom?: string; description?: string }> }>,
    produits: [{}] as Array<{ produitId?: number; quantite?: number }>,
    prixHT: 0, tva: 20, montantTVA: 0, prixTTC: 0,
};

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

interface SocieteData {
    nom?: string;
    siren?: string;
    siret?: string;
    ape?: string;
    rcs?: string;
    forme?: string;
    capital?: number;
    numerotva?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
    bancaire?: string;
    banque?: string;
    iban?: string;
    bic?: string;
    images?: string[];
    conditionsPaiement?: string;
    penalitesRetard?: string;
    indemniteForfaitaire?: number;
}

interface VenteProduitLigne {
    id?: number;
    // Sans identifiant, l'article d'une ligne libre est créé au catalogue par le backend
    produit?: ProduitCatalogueEntity | ArticleALaVolee;
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
    datePretRecuperation?: string | null;
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
    venteProduits?: VenteProduitLigne[];
    venteBateauxCatalogue?: VenteBateauCatalogueLigne[];
    venteMoteursCatalogue?: VenteMoteurCatalogueLigne[];
    venteHelicesCatalogue?: VenteHeliceCatalogueLigne[];
    venteRemorquesCatalogue?: VenteRemorqueCatalogueLigne[];
    date?: string;
    dateDevis?: string;
    dateBonPourAccord?: string;
    dateFactureEnAttente?: string;
    dateFacturePrete?: string;
    dateFacturePayee?: string;
    // Devis/OR refusé par le client : hors pipeline commercial et sans relance
    dateRefus?: string;
    motifRefus?: string;
    numeroFacture?: string;
    dateEcheance?: string;
    conditionsPaiement?: string;
    penalitesRetard?: string;
    indemniteForfaitaire?: number;
    montantHT?: number;
    remise?: number;
    montantTTC?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
    modePaiement?: ModePaiement;
    paiements?: VentePaiement[];
    images?: string[];
    documents?: string[];
    // Dernière relance de paiement automatique envoyée (0 = aucune)
    niveauRelance?: number;
    // Dernière relance automatique du devis/OR en attente de signature (0 = aucune)
    niveauRelanceDevis?: number;
    // Relances suspendues sur la vente, jusqu'à la date de fin incluse si elle est renseignée
    dateSuspensionRelances?: string | null;
    finSuspensionRelances?: string | null;
    motifSuspensionRelances?: string | null;
    note?: string;
    reception?: Reception | null;
}

interface RappelHistoriqueEntity {
    id: number;
    numeroRappel: number;
    destinataire: string;
    sujet: string;
    contenu: string;
    dateEnvoi?: string;
    // Relance écartée du journal sans être envoyée
    ignoree?: boolean;
    motif?: string;
    // Relance par courrier (mise en demeure) : le destinataire est l'adresse postale, à imprimer tant que dateImpression est vide
    courrier?: boolean;
    dateImpression?: string | null;
}

type LigneType = 'forfait' | 'service' | 'produit' | 'bateau' | 'moteur' | 'helice' | 'remorque';

interface LigneUnifiee {
    type?: LigneType;
    itemId?: number;
    // Article saisi à la volée, sans type ni identifiant : créé au catalogue à l'enregistrement
    libre?: LigneLibre;
    quantite?: number;
    remise?: number;
    remisePourcentage?: number;
    technicienIds?: number[];
    status?: PlanningStatus;
    sav?: boolean;
    datePlanification?: string;
    dateDebut?: string;
    dateFin?: string;
    dureeReelle?: number;
    notes?: string;
    incidentDate?: string;
    incidentDetails?: string;
    taches?: Array<{ nom?: string; description?: string; done?: boolean; nonFait?: boolean; motif?: string }>;
    images?: string[];
    documents?: string[];
}

const estLigneVide = (ligne?: LigneUnifiee) => !ligne?.type && !ligne?.itemId && !ligne?.libre;

interface VenteFormValues {
    status: VenteStatus;
    bonPourAccord?: boolean;
    ordreDeReparation?: boolean;
    signatureBonPourAccord?: string;
    clientId?: number;
    bateauId?: number;
    moteurId?: number;
    remorqueId?: number;
    lignes: LigneUnifiee[];
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
    dateEcheance?: string;
    note?: string;
    reception?: Reception;
}


// Motifs de refus proposés pour un devis/OR (saisie libre possible), regroupés dans les KPIs commerciaux
const MOTIFS_REFUS = ['Prix', 'Délai', 'Concurrent', 'Projet abandonné', 'Sans réponse du client'];

// Couleur du tag de la dernière relance de paiement envoyée (1 à 3)
const RELANCE_COULEURS: Record<number, string> = { 1: 'gold', 2: 'orange', 3: 'red' };

const statusOptions: Array<{ value: VenteStatus; label: string }> = [
    { value: 'DEVIS', label: 'Devis/OR' },
    { value: 'FACTURE_EN_ATTENTE', label: 'En cours' },
    { value: 'FACTURE_PRETE', label: 'Terminé' },
    { value: 'FACTURE_PAYEE', label: 'Payé' }
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
    { title: 'En cours', icon: <FileDoneOutlined />, description: formatStepDate(vente?.dateFactureEnAttente) },
    { title: 'Terminé', icon: <WalletOutlined />, description: formatStepDate(vente?.dateFacturePrete) },
    { title: 'Payé', icon: <CheckCircleOutlined />, description: formatStepDate(vente?.dateFacturePayee) },
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
    lignes: [{ quantite: 1 }],
    montantHT: 0,
    remise: 0,
    remisePourcentage: 0,
    tva: 20,
    montantTVA: 0,
    montantTTC: 0,
    prixVenteTTC: 0,
    images: [],
    documents: [],
};

// Une intervention est un forfait ou un service : la main d'oeuvre passe par eux
const compterInterventions = (lignes: LigneUnifiee[]) =>
    lignes.filter((l) => (l.type === 'forfait' || l.type === 'service') && l.itemId).length;

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} EUR`;
const getSoldeDu = (vente: { status?: string; prixVenteTTC?: number; paiements?: Array<{ montant: number }> }) => {
    if (vente.status === 'FACTURE_PAYEE') return 0;
    const totalPaye = (vente.paiements ?? []).reduce((sum, p) => sum + (p.montant || 0), 0);
    return Math.max(0, Math.round(((vente.prixVenteTTC || 0) - totalPaye) * 100) / 100);
};
const referenceTransaction = (vente: VenteEntity) => {
    if (vente.numeroFacture) return vente.numeroFacture;
    if (!vente.id) return '-';
    const parsed = vente.date ? new Date(vente.date) : new Date();
    const year = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
    return `FACT-${year}-${String(vente.id).padStart(5, '0')}`;
};
const formatDatePrint = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.split('T')[0];
    return parsed.toLocaleDateString('fr-FR');
};
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
    return client.nom || `Client #${client.id}`;
};



export default function Vente() {
    const PRODUIT_CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');
    const { navigate, pageState } = useNavigation();
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [clients, setClients] = useState<ClientEntity[]>([]);
    const [bateaux, setBateaux] = useState<BateauClientEntity[]>([]);
    const [moteurs, setMoteurs] = useState<MoteurClientEntity[]>([]);
    const [remorques, setRemorques] = useState<RemorqueClientEntity[]>([]);
    const [forfaits, setForfaits] = useState<ForfaitEntity[]>([]);
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [achatsProduits, setAchatsProduits] = useState<Array<{ produit?: { id: number }; prixAchatHT?: number }>>([]);
    const [services, setServices] = useState<ServiceEntity[]>([]);
    const [mainOeuvres, setMainOeuvres] = useState<MainOeuvreEntity[]>([]);
    const [techniciens, setTechniciens] = useState<TechnicienEntity[]>([]);
    const [catalogueBateaux, setCatalogueBateaux] = useState<CatalogueBateauEntity[]>([]);
    const [catalogueMoteurs, setCatalogueMoteurs] = useState<CatalogueMoteurEntity[]>([]);
    const [catalogueHelices, setCatalogueHelices] = useState<CatalogueHeliceEntity[]>([]);
    const [catalogueRemorques, setCatalogueRemorques] = useState<CatalogueRemorqueEntity[]>([]);
    const [packages, setPackages] = useState<PackageEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    // La marge reste masquée tant qu'on n'a pas cliqué dessus ; elle se remasque à chaque ouverture de la modale
    const [margeVisible, setMargeVisible] = useState(false);
    useEffect(() => { setMargeVisible(false); }, [modalVisible]);
    const [formDirty, setFormDirty] = useState(false);
    const suppressDirtyRef = React.useRef(false);
    const savedLinesRef = React.useRef<string[]>([]);
    // Nombre d'interventions déjà connues, pour détecter l'ajout d'un forfait ou d'un service
    const interventionsConnuesRef = React.useRef(0);
    // Ligne en cours de déplacement : aucune valeur ne change, rien n'est recalculé
    const deplacementLigneRef = React.useRef(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentVente, setCurrentVente] = useState<VenteEntity | null>(null);
    const [rappelHistorique, setRappelHistorique] = useState<RappelHistoriqueEntity[]>([]);
    const [refusVisible, setRefusVisible] = useState(false);
    const [motifRefus, setMotifRefus] = useState('');
    const [suspensionRelancesVisible, setSuspensionRelancesVisible] = useState(false);
    // Conditions de paiement du paramétrage global (société), recopiées sur la vente jusqu'à l'émission de la facture
    const [conditionsSociete, setConditionsSociete] = useState<SocieteData | null>(null);
    const [form] = Form.useForm<VenteFormValues>();
    const watchedClientId = Form.useWatch('clientId', form) as number | undefined;
    const watchedStatus = Form.useWatch('status', form) as VenteStatus | undefined;
    const watchedBonPourAccord = Form.useWatch('bonPourAccord', form) as boolean | undefined;
    const isReadOnly = watchedStatus === 'FACTURE_PAYEE';
    // Devis/OR enregistré en attente de signature, ni accepté ni refusé : il peut être relancé ou refusé
    const devisEnAttente = isEdit && !!currentVente?.id && currentVente.status === 'DEVIS' && !currentVente.bonPourAccord && !currentVente.dateRefus;
    // Facture émise ou devis/OR en attente : la vente peut être relancée, ou ses relances suspendues
    const relancable = isEdit && !!currentVente?.id && (currentVente.status === 'FACTURE_PRETE' || devisEnAttente);
    const relancesVenteSuspendues = !!currentVente?.dateSuspensionRelances
        && (!currentVente.finSuspensionRelances || !dayjs(currentVente.finSuspensionRelances).isBefore(dayjs(), 'day'));
    const exonereTva = clientExonereTva(clients.find((client) => client.id === watchedClientId));
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
    const [cgvAccepted, setCgvAccepted] = useState(false);
    const [cgvModalOpen, setCgvModalOpen] = useState(false);
    const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signatureDrawingRef = useRef(false);
    const [produitSearchTimeout, setProduitSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
    const capturedSignatureRef = useRef<string | null>(null);
    const [commandesFournisseur, setCommandesFournisseur] = useState<any[]>([]);
    const [cfModalVisible, setCfModalVisible] = useState(false);
    const [cfVente, setCfVente] = useState<VenteEntity | null>(null);
    const [cfInitialArticleKey, setCfInitialArticleKey] = useState<string | undefined>(undefined);

    const fetchCommandesFournisseur = async () => {
        try {
            const res = await api.get('/commandes-fournisseur');
            setCommandesFournisseur(res.data || []);
        } catch {
            // ignore
        }
    };

    const linkedCommandesByVente = useMemo(() => {
        const map = new Map<number, any[]>();
        for (const cf of commandesFournisseur) {
            if (cf.vente?.id) {
                const list = map.get(cf.vente.id) || [];
                list.push(cf);
                map.set(cf.vente.id, list);
            }
        }
        return map;
    }, [commandesFournisseur]);

    const handleOpenCommandeFournisseur = (vente: VenteEntity, articleKey?: string) => {
        if (!vente.id) {
            message.warning("Veuillez d'abord enregistrer la vente avant de créer une commande fournisseur liée.");
            return;
        }
        setCfVente(vente);
        setCfInitialArticleKey(articleKey);
        setCfModalVisible(true);
    };

    const mergeById = <T extends { id?: number }>(prev: T[], next: T[]): T[] => {
        const map = new Map<number, T>();
        prev.forEach((item) => { if (item?.id !== undefined) map.set(item.id, item); });
        next.forEach((item) => { if (item?.id !== undefined) map.set(item.id, item); });
        return Array.from(map.values());
    };

    const handleProduitSearch = (value: string) => {
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

    // Paiements multiples
    const [paiementModalVisible, setPaiementModalVisible] = useState(false);
    const [paiementMode, setPaiementMode] = useState<ModeReglement>('CHEQUE');
    const [paiementMontant, setPaiementMontant] = useState<number>(0);
    const [paiementNotes, setPaiementNotes] = useState('');
    const [paiementDate, setPaiementDate] = useState<dayjs.Dayjs>(dayjs());
    const [editPaiement, setEditPaiement] = useState<{ id: number; date: dayjs.Dayjs } | null>(null);
    const [paiementAvoirId, setPaiementAvoirId] = useState<number | null>(null);
    const [avoirsDisponibles, setAvoirsDisponibles] = useState<AvoirDisponible[]>([]);
    const [addingPaiement, setAddingPaiement] = useState(false);

    // Règlement groupé sur plusieurs factures
    const [reglementGroupeVisible, setReglementGroupeVisible] = useState(false);
    const [rgClientId, setRgClientId] = useState<number | null>(null);
    const [rgSelectedIds, setRgSelectedIds] = useState<number[]>([]);
    const [rgMode, setRgMode] = useState<ModeReglement>('CHEQUE');
    const [rgMontant, setRgMontant] = useState<number>(0);
    const [rgNotes, setRgNotes] = useState('');
    const [rgDate, setRgDate] = useState<dayjs.Dayjs>(dayjs());
    const [rgSubmitting, setRgSubmitting] = useState(false);

    // Génération d'avoir depuis une vente
    const [genAvoirModalVente, setGenAvoirModalVente] = useState<VenteEntity | null>(null);
    const [genAvoirMotif, setGenAvoirMotif] = useState('');
    const [genAvoirNotes, setGenAvoirNotes] = useState('');
    const [generatingAvoir, setGeneratingAvoir] = useState(false);
    const [genAvoirSelection, setGenAvoirSelection] = useState<string[]>([]);
    const [genAvoirLignesLibres, setGenAvoirLignesLibres] = useState<AvoirLigneLibre[]>([]);

    const clientOptions = useMemo(
        () => clients.map((client) => ({ value: client.id, label: getClientLabel(client) })),
        [clients]
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

    const bateauOptions = useMemo(
        () => bateaux.map((bateau) => ({ value: bateau.id, label: bateau.name || bateau.immatriculation || `Bateau #${bateau.id}` })),
        [bateaux]
    );

    // Sur une transaction, le champ Bateau ne propose que les bateaux du client sélectionné.
    const bateauOptionsClient = useMemo(
        () => bateauOptions.filter((option) => !watchedClientId
            || bateaux.find((b) => b.id === option.value)?.proprietaires?.some((p) => p.id === watchedClientId)),
        [bateauOptions, bateaux, watchedClientId]
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

    const serviceOptions = useMemo(
        () => services.map((service) => ({ value: service.id, label: service.nom })),
        [services]
    );

    const ligneUnifieeOptions = useMemo(
        () => [
            // Choisir un package ajoute à la vente les articles qu'il regroupe (voir deplierPackage)
            ...(packages.length > 0 ? [{
                label: 'Packages',
                options: packages.map((pack) => ({
                    value: `package:${pack.id}`,
                    label: getPackageLabel(pack),
                    designation: pack.designation,
                    ref: pack.ref,
                    searchText: `${pack.ref || ''} ${pack.designation}`.toLowerCase(),
                })),
            }] : []),
            {
                label: 'Forfaits',
                options: forfaits.map((f) => ({
                    value: `forfait:${f.id}`,
                    label: f.reference ? `${f.reference} - ${f.nom}` : f.nom,
                    designation: f.nom,
                    ref: f.reference,
                    searchText: `${f.reference || ''} ${f.nom}`.toLowerCase(),
                })),
            },
            {
                label: 'Produits',
                options: produits.map((p) => ({
                    value: `produit:${p.id}`,
                    label: p.ref ? `${p.ref} - ${p.designation}` : p.designation,
                    designation: p.designation,
                    ref: p.ref,
                    searchText: `${p.ref || ''} ${p.designation} ${(p.refs || []).join(' ')} ${(p.referencesFournisseurs || []).join(' ')}`.toLowerCase(),
                })),
            },
            {
                label: 'Bateaux',
                options: catalogueBateaux.map((b) => ({
                    value: `bateau:${b.id}`,
                    label: b.ref ? `${b.ref} - ${b.designation}` : b.designation,
                    designation: b.designation,
                    ref: b.ref,
                    searchText: `${b.ref || ''} ${b.designation} ${(b.referencesFournisseurs || []).join(' ')}`.toLowerCase(),
                })),
            },
            {
                label: 'Moteurs',
                options: catalogueMoteurs.map((m) => ({
                    value: `moteur:${m.id}`,
                    label: m.ref ? `${m.ref} - ${m.designation}` : m.designation,
                    designation: m.designation,
                    ref: m.ref,
                    searchText: `${m.ref || ''} ${m.designation} ${(m.referencesFournisseurs || []).join(' ')}`.toLowerCase(),
                })),
            },
            {
                label: 'Hélices',
                options: catalogueHelices.map((h) => ({
                    value: `helice:${h.id}`,
                    label: h.ref ? `${h.ref} - ${h.designation}` : h.designation,
                    designation: h.designation,
                    ref: h.ref,
                    searchText: `${h.ref || ''} ${h.designation} ${(h.referencesFournisseurs || []).join(' ')}`.toLowerCase(),
                })),
            },
            {
                label: 'Remorques',
                options: catalogueRemorques.map((r) => ({
                    value: `remorque:${r.id}`,
                    label: r.ref ? `${r.ref} - ${r.designation}` : r.designation,
                    designation: r.designation,
                    ref: r.ref,
                    searchText: `${r.ref || ''} ${r.designation} ${(r.referencesFournisseurs || []).join(' ')}`.toLowerCase(),
                })),
            },
        ],
        [packages, forfaits, produits, catalogueBateaux, catalogueMoteurs, catalogueHelices, catalogueRemorques]
    );

    const parseLigneValue = (compositeValue?: string): { type: LigneType; id: number } | null => {
        if (!compositeValue) return null;
        const [type, idStr] = compositeValue.split(':');
        const id = parseInt(idStr, 10);
        if (!type || isNaN(id)) return null;
        return { type: type as LigneType, id };
    };

    const toLigneCompositeValue = (type?: LigneType, itemId?: number): string | undefined => {
        if (!type || !itemId) return undefined;
        return `${type}:${itemId}`;
    };

    const changerLigne = (index: number, compositeValue: string) => {
        const packageId = parsePackageRef(compositeValue);
        if (packageId !== undefined) {
            deplierPackage(index, packageId);
            return;
        }
        const parsed = parseLigneValue(compositeValue);
        const currentLignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        const updated = [...currentLignes];
        if (parsed) {
            const isPlanifiable = parsed.type === 'forfait' || parsed.type === 'service';
            // Le statut de planification et les techniciens ne concernent que les
            // forfaits/services : on les réinitialise quand la ligne devient un
            // produit ou un article catalogue, sinon la mention « en attente »
            // persiste sur la ligne (#398).
            const planningReset: Partial<LigneUnifiee> = isPlanifiable
                ? { status: 'EN_ATTENTE' }
                : { status: undefined, technicienIds: undefined, sav: undefined };
            updated[index] = { ...updated[index], type: parsed.type, itemId: parsed.id, ...planningReset };
            const lastLine = updated[updated.length - 1];
            if (lastLine?.type && lastLine?.itemId && (lastLine?.quantite || 0) > 0) {
                updated.push({ quantite: 1 });
            }
        } else {
            updated[index] = { quantite: updated[index]?.quantite || 1 };
        }
        form.setFieldValue('lignes', updated);
        setFormDirty(true);
        recalculateFromLines('auto');
    };

    const fetchVentes = async () => {
        setLoading(true);
        try {
            const [ventesRes, cfRes] = await Promise.all([
                api.get('/ventes'),
                api.get('/commandes-fournisseur')
            ]);
            setVentes(ventesRes.data || []);
            setCommandesFournisseur(cfRes.data || []);
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
                servicesRes,
                mainOeuvresRes,
                techniciensRes,
                catProduitsRes,
                catBateauxRes,
                catMoteursRes,
                catHelicesRes,
                catRemorquesRes,
                achatsRes
            ] = await Promise.all([
                api.get('/clients'),
                api.get('/bateaux'),
                api.get('/moteurs'),
                api.get('/remorques'),
                api.get('/forfaits'),
                api.get('/services'),
                api.get('/main-oeuvres'),
                api.get('/techniciens'),
                api.get('/catalogue/produits'),
                api.get('/catalogue/bateaux'),
                api.get('/catalogue/moteurs'),
                api.get('/catalogue/helices'),
                api.get('/catalogue/remorques'),
                api.get('/fournisseur-produit')
            ]);
            setAchatsProduits(achatsRes.data || []);
            setClients(clientsRes.data || []);
            setBateaux(bateauxRes.data || []);
            setMoteurs(moteursRes.data || []);
            setRemorques(remorquesRes.data || []);
            setForfaits(forfaitsRes.data || []);
            setServices(servicesRes.data || []);
            setMainOeuvres(mainOeuvresRes.data || []);
            setTechniciens(techniciensRes.data || []);
            setProduits(catProduitsRes.data || []);
            setCatalogueBateaux(catBateauxRes.data || []);
            setCatalogueMoteurs(catMoteursRes.data || []);
            setCatalogueHelices(catHelicesRes.data || []);
            setCatalogueRemorques(catRemorquesRes.data || []);
        } catch {
            message.error('Erreur lors du chargement des listes de reference.');
        }
    };

    // Rafraîchit les listes catalogue (produits + bateaux/moteurs/hélices/remorques)
    // afin d'afficher l'état de stock le plus à jour à chaque nouvelle vente.
    const refreshCatalogue = async () => {
        try {
            const [catProduitsRes, catBateauxRes, catMoteursRes, catHelicesRes, catRemorquesRes] = await Promise.all([
                api.get('/catalogue/produits'),
                api.get('/catalogue/bateaux'),
                api.get('/catalogue/moteurs'),
                api.get('/catalogue/helices'),
                api.get('/catalogue/remorques')
            ]);
            setProduits(catProduitsRes.data || []);
            setCatalogueBateaux(catBateauxRes.data || []);
            setCatalogueMoteurs(catMoteursRes.data || []);
            setCatalogueHelices(catHelicesRes.data || []);
            setCatalogueRemorques(catRemorquesRes.data || []);
        } catch {
            // silencieux : le stock affiché reste celui du dernier chargement réussi
        }
    };

    // Chargés à part : sans les packages, la vente reste saisissable article par article
    const fetchPackages = async () => {
        try {
            const res = await api.get('/catalogue/packages');
            setPackages(res.data || []);
        } catch {
            // silencieux
        }
    };

    useEffect(() => {
        fetchVentes();
        fetchOptions();
        (async () => {
            try {
                const res = await api.get<SocieteData>('/societe');
                setConditionsSociete(res.data || null);
            } catch {
                // conditions non affichées en cas d'erreur
            }
        })();
    }, []);

    useEffect(() => {
        if (pageState?.venteId) {
            const venteId = pageState.venteId;
            navigate('/prestations');
            api.get<VenteEntity>(`/ventes/${venteId}`)
                .then((res) => openModal(res.data))
                .catch(() => message.error('Erreur lors du chargement de la vente.'));
            return;
        }
        if (pageState?.clientId) {
            const clientId = pageState.clientId;
            const bateauId = pageState.bateauId;
            navigate('/prestations');
            (async () => {
                let client: ClientEntity | undefined;
                try {
                    const res = await api.get(`/clients/${clientId}`);
                    client = res.data;
                    setClients(prev => mergeById(prev, [res.data]));
                } catch { /* ignore */ }
                if (bateauId) {
                    try {
                        const res = await api.get(`/bateaux/${bateauId}`);
                        setBateaux(prev => mergeById(prev, [res.data]));
                    } catch { /* ignore */ }
                }
                await openModal();
                form.setFieldValue('clientId', clientId);
                if (bateauId) form.setFieldValue('bateauId', bateauId);
                handleClientChange(clientId);
                appliquerTvaClient(client);
            })();
        }
    }, [pageState]);

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

    // Renvoie l'index de la premiere ligne vide (sans type ni article), en en creant une si besoin.
    // Utilise par les boutons « Créer Forfait » / « Ajouter Service » sous la liste des lignes.
    const findOrCreateEmptyLineIndex = (): number => {
        const currentLines: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        const emptyIndex = currentLines.findIndex((l) => estLigneVide(l));
        if (emptyIndex >= 0) {
            return emptyIndex;
        }
        const updated = [...currentLines, { quantite: 1 }];
        form.setFieldValue('lignes', updated);
        return updated.length - 1;
    };

    const ajouterLigneLibre = () => {
        const lignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        form.setFieldValue('lignes', insererLigneLibre(lignes, { libre: nouvelleLigneLibre(), quantite: 1 }, { quantite: 1 }, estLigneVide));
        setFormDirty(true);
    };

    // Recalculer les remises d'une ligne déplacée les arrondirait à nouveau
    const deplacerLigne = (move: (from: number, to: number) => void, from: number, to: number) => {
        deplacementLigneRef.current = true;
        try {
            move(from, to);
        } finally {
            deplacementLigneRef.current = false;
        }
    };

    const autresLignesLibres = (index: number): LigneLibre[] =>
        ((form.getFieldValue('lignes') || []) as LigneUnifiee[])
            .flatMap((ligne, i) => (i !== index && ligne?.libre ? [ligne.libre] : []));

    const handleNewProduitSave = async () => {
        try {
            const values = await newProduitForm.validateFields();
            values.images = values.images || [];
            const res = await api.post('/catalogue/produits', values);
            const created = res.data as ProduitCatalogueEntity;
            message.success('Produit ajouté avec succès');
            setProduits((prev) => [...prev, created]);
            if (newProduitTargetLine !== null && created.id) {
                const currentLines: LigneUnifiee[] = form.getFieldValue('lignes') || [];
                const updated = [...currentLines];
                updated[newProduitTargetLine] = { ...updated[newProduitTargetLine], type: 'produit', itemId: created.id };
                const lastLine = updated[updated.length - 1];
                if (lastLine?.type && lastLine?.itemId && (lastLine?.quantite || 0) > 0) {
                    updated.push({ quantite: 1 });
                }
                form.setFieldValue('lignes', updated);
                recalculateFromLines('auto', { produits: [...produits, created] });
            }
            setNewProduitModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const handleProduitSaved = (updated: ProduitCatalogueEntity) => {
        const previous = produits.find((p) => p.id === updated.id);
        setProduits((prev) => prev.map((p) => p.id === updated.id ? updated : p));
        if (previous?.prixVenteTTC !== updated.prixVenteTTC) {
            recalculateFromLines('auto', { produits: produits.map((p) => p.id === updated.id ? updated : p) });
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
        const lignesMainOeuvre = (service.mainOeuvres || [])
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.mainOeuvre?.id)
                .map(({ item, index }, position) => ({
                    mainOeuvreId: item.mainOeuvre!.id,
                    quantite: item.quantite || 1,
                    // Les tâches non rattachées (anciennes checklists) vont sur la première ligne
                    taches: (service.taches || [])
                        .filter((t) => t.mainOeuvreIndex === index || (position === 0 && (t.mainOeuvreIndex === null || t.mainOeuvreIndex === undefined)))
                        .map((t) => ({ nom: t.nom || '', description: t.description || '' })),
                }));
        newServiceForm.setFieldsValue({
            nom: service.nom || '',
            description: service.description || '',
            dureeEstimee: service.dureeEstimee || 0,
            mainOeuvres: lignesMainOeuvre.length > 0 ? lignesMainOeuvre : [{}],
            produits: (service.produits || [])
                .filter((item) => item.produit?.id)
                .map((item) => ({ produitId: item.produit!.id, quantite: item.quantite || 1 }))
                .concat([{}]),
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
            const lignesMainOeuvre = (values.mainOeuvres || []).filter((item: { mainOeuvreId?: number }) => item.mainOeuvreId);
            const payload = {
                nom: values.nom,
                description: values.description,
                dureeEstimee: values.dureeEstimee || 0,
                mainOeuvres: lignesMainOeuvre.map((item: { mainOeuvreId?: number; quantite?: number }) => ({
                    mainOeuvre: mainOeuvres.find((mo) => mo.id === item.mainOeuvreId),
                    quantite: item.quantite || 1
                })),
                produits: (values.produits || [])
                    .filter((item: { produitId?: number }) => item.produitId)
                    .map((item: { produitId?: number; quantite?: number }) => ({
                        produit: produits.find((p) => p.id === item.produitId),
                        quantite: item.quantite || 1
                    })),
                // Checklist de chaque ligne de main d'oeuvre, rattachée par le rang de la ligne
                taches: lignesMainOeuvre.flatMap((item: { taches?: Array<{ nom?: string; description?: string }> }, index: number) =>
                    (item.taches || [])
                        .filter((t) => t.nom?.trim())
                        .map((t) => ({ nom: t.nom, description: t.description || '', done: false, mainOeuvreIndex: index }))
                ),
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
                    const currentLines: LigneUnifiee[] = form.getFieldValue('lignes') || [];
                    const updatedLines = [...currentLines];
                    updatedLines[newServiceTargetLine] = { ...updatedLines[newServiceTargetLine], type: 'service', itemId: created.id, status: 'EN_ATTENTE' };
                    const lastLine = updatedLines[updatedLines.length - 1];
                    if (lastLine?.type && lastLine?.itemId && (lastLine?.quantite || 0) > 0) {
                        updatedLines.push({ quantite: 1 });
                    }
                    form.setFieldValue('lignes', updatedLines);
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
            const currentLines = (newServiceForm.getFieldValue('mainOeuvres') || []).map((item: any) => (
                item?.mainOeuvreId && (item.quantite === undefined || item.quantite === null)
                    ? { ...item, quantite: 1 }
                    : item
            ));
            if (currentLines.length === 0) {
                newServiceForm.setFieldValue('mainOeuvres', [{}]);
                return;
            }
            // Un service n'a qu'une seule ligne de main d'oeuvre : pas de nouvelle ligne ajoutée automatiquement
            newServiceForm.setFieldValue('mainOeuvres', currentLines);
        }
        if (changedValues.produits !== undefined) {
            let currentLines = (newServiceForm.getFieldValue('produits') || []).map((item: any) => (
                item?.produitId && (item.quantite === undefined || item.quantite === null)
                    ? { ...item, quantite: 1 }
                    : item
            ));
            if (currentLines.length === 0) {
                newServiceForm.setFieldValue('produits', [{}]);
                return;
            }
            const lastLine = currentLines[currentLines.length - 1];
            if (!!lastLine?.produitId && (lastLine?.quantite || 0) > 0) {
                currentLines = [...currentLines, {}];
            }
            newServiceForm.setFieldValue('produits', currentLines);
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

        // Durée estimée = somme des quantités de main d'œuvre (1h = 1 unité)
        if (changedValues.mainOeuvres !== undefined) {
            const moValues = newServiceForm.getFieldValue('mainOeuvres') || [];
            const totalHeures = moValues.reduce(
                (total: number, item: { mainOeuvreId?: number; quantite?: number }) =>
                    total + (item.mainOeuvreId ? (item.quantite || 0) : 0),
                0
            );
            newServiceForm.setFieldValue('dureeEstimee', Math.round((totalHeures + Number.EPSILON) * 100) / 100);
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

    // Lignes de main d'œuvre ou de produits des modals service et forfait, présentées comme celles d'une transaction
    const renderLignesArticles = (
        form: FormInstance,
        onValuesChange: (changedValues: Record<string, unknown>) => void,
        liste: 'mainOeuvres' | 'produits',
        checklist?: boolean,
    ) => (
        <LignesArticles
            form={form}
            checklist={checklist}
            onValuesChange={onValuesChange}
            liste={liste}
            produits={produits}
            mainOeuvres={mainOeuvres.map((mo) => ({ id: mo.id, reference: mo.reference, nom: mo.nom, prixTTC: mo.prixTTC }))}
            onProduitSearch={handleProduitSearch}
            onProduitSaved={handleProduitSaved}
            navigate={navigate}
        />
    );

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
            const lignesMainOeuvre = (values.mainOeuvres || []).filter((item: { mainOeuvreId?: number }) => item.mainOeuvreId);
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
                mainOeuvres: lignesMainOeuvre.map((item: { mainOeuvreId?: number; quantite?: number }) => ({
                    mainOeuvre: mainOeuvres.find((mo) => mo.id === item.mainOeuvreId),
                    quantite: item.quantite || 1
                })),
                // Checklist de chaque ligne de main d'oeuvre, rattachée par le rang de la ligne
                taches: aplatirTaches(lignesMainOeuvre),
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
                const currentLines: LigneUnifiee[] = form.getFieldValue('lignes') || [];
                const updated = [...currentLines];
                updated[newForfaitTargetLine] = { ...updated[newForfaitTargetLine], type: 'forfait', itemId: created.id };
                const lastLine = updated[updated.length - 1];
                if (lastLine?.type && lastLine?.itemId && (lastLine?.quantite || 0) > 0) {
                    updated.push({ quantite: 1 });
                }
                form.setFieldValue('lignes', updated);
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
            let currentLines = (newForfaitForm.getFieldValue('produits') || []).map((item: any) => (
                item?.produitId && (item.quantite === undefined || item.quantite === null)
                    ? { ...item, quantite: 1 }
                    : item
            ));
            if (currentLines.length === 0) {
                currentLines = [{}];
            } else {
                const lastLine = currentLines[currentLines.length - 1];
                if (!!lastLine?.produitId && (lastLine?.quantite || 0) > 0) {
                    currentLines = [...currentLines, {}];
                }
            }
            newForfaitForm.setFieldValue('produits', currentLines);
        }
        if (changedValues.mainOeuvres !== undefined) {
            let currentLines = (newForfaitForm.getFieldValue('mainOeuvres') || []).map((item: any) => (
                item?.mainOeuvreId && (item.quantite === undefined || item.quantite === null)
                    ? { ...item, quantite: 1 }
                    : item
            ));
            if (currentLines.length === 0) {
                currentLines = [{}];
            } else {
                const lastLine = currentLines[currentLines.length - 1];
                if (!!lastLine?.mainOeuvreId && (lastLine?.quantite || 0) > 0) {
                    currentLines = [...currentLines, {}];
                }
            }
            newForfaitForm.setFieldValue('mainOeuvres', currentLines);
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

        // Durée estimée = somme des quantités de main d'œuvre (1h = 1 unité)
        if (changedValues.mainOeuvres !== undefined) {
            const moValues = newForfaitForm.getFieldValue('mainOeuvres') || [];
            const totalHeures = moValues.reduce(
                (total: number, item: { mainOeuvreId?: number; quantite?: number }) =>
                    total + (item.mainOeuvreId ? (item.quantite || 0) : 0),
                0
            );
            newForfaitForm.setFieldValue('dureeEstimee', Math.round((totalHeures + Number.EPSILON) * 100) / 100);
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

    const handleClientChange = (clientId: number | undefined) => {
        if (!clientId) {
            return;
        }
        // Un bateau choisi pour un autre client n'est plus valable
        const bateauCourantId = form.getFieldValue('bateauId');
        if (bateauCourantId && !bateaux.find((b) => b.id === bateauCourantId)?.proprietaires?.some((p) => p.id === clientId)) {
            form.setFieldValue('bateauId', undefined);
        }
        // Auto-populate bateau from client's proprietaire relationship
        const clientBateau = bateaux.find((b) => b.proprietaires?.some((p) => p.id === clientId));
        if (clientBateau && !form.getFieldValue('bateauId')) {
            form.setFieldValue('bateauId', clientBateau.id);
        }
        // Auto-populate moteur from client's proprietaire relationship
        const clientMoteur = moteurs.find((m) => m.proprietaire?.id === clientId);
        if (clientMoteur && !form.getFieldValue('moteurId')) {
            form.setFieldValue('moteurId', clientMoteur.id);
        }
        // Auto-populate remorque from client's proprietaire relationship
        const clientRemorque = remorques.find((r) => r.proprietaire?.id === clientId);
        if (clientRemorque && !form.getFieldValue('remorqueId')) {
            form.setFieldValue('remorqueId', clientRemorque.id);
        }
        // Suggest forfaits matching the selected bateau/moteur or the bateau's moteurs
        const selectedBateauId = clientBateau?.id || form.getFieldValue('bateauId');
        const selectedMoteurId = clientMoteur?.id || form.getFieldValue('moteurId');
        const selectedBateau = bateaux.find((b) => b.id === selectedBateauId);
        const bateauMoteurIds = new Set((selectedBateau?.moteurs || []).map((m) => m.id));
        if (selectedBateauId || selectedMoteurId || bateauMoteurIds.size > 0) {
            const selectedMoteur = moteurs.find((m) => m.id === selectedMoteurId);
            const matchingForfaits = forfaits.filter((f) =>
                // Forfaits gérés directement sur le bateau / moteur client
                (selectedBateauId && f.bateauxClientsAssocies?.some((b) => b.id === selectedBateauId)) ||
                (selectedMoteurId && f.moteursClientsAssocies?.some((m) => m.id === selectedMoteurId)) ||
                // Forfaits du catalogue, via le modèle du bateau / moteur client
                (selectedBateau?.modele?.id && f.bateauxAssocies?.some((b) => b.id === selectedBateau.modele?.id)) ||
                (selectedMoteur?.modele?.id && f.moteursAssocies?.some((m) => m.id === selectedMoteur.modele?.id)) ||
                (bateauMoteurIds.size > 0 && f.moteursAssocies?.some((m) => bateauMoteurIds.has(m.id)))
            );
            if (matchingForfaits.length > 0) {
                const currentLignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
                const existingForfaitIds = new Set(currentLignes.filter((l) => l.type === 'forfait' && l.itemId).map((l) => l.itemId));
                const newForfaits = matchingForfaits.filter((f) => !existingForfaitIds.has(f.id));
                if (newForfaits.length > 0) {
                    const filledLines = currentLignes.filter((l) => (l.type && l.itemId) || l.libre);
                    const newLines: LigneUnifiee[] = [
                        ...filledLines,
                        ...newForfaits.map((f) => ({ type: 'forfait' as LigneType, itemId: f.id, quantite: 1, status: 'EN_ATTENTE' as PlanningStatus })),
                        { quantite: 1 }
                    ];
                    form.setFieldValue('lignes', newLines);
                    recalculateFromLines('auto');
                }
            }
        }
    };

    const openNewClientModal = () => {
        newClientForm.resetFields();
        newClientForm.setFieldsValue({ nom: '', type: 'PARTICULIER', email: '', telephone: '', adresse: '', siren: '', siret: '', tva: '', naf: '', remise: 0, evaluation: 0, notes: '' });
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
            appliquerTvaClient(created);
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
            const clientId = form.getFieldValue('clientId');
            const res = await api.post('/bateaux', { ...values, ...(clientId ? { proprietaires: [{ id: clientId }] } : {}) });
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
        const keys: string[] = [];
        (vente?.venteForfaits || []).forEach(vf => { if (vf.forfait?.id) keys.push(`forfait:${vf.forfait.id}`); });
        (vente?.venteServices || []).forEach(vs => { if (vs.service?.id) keys.push(`service:${vs.service.id}`); });
        (vente?.venteProduits || []).forEach(vp => { if (vp.produit?.id) keys.push(`produit:${vp.produit.id}`); });
        (vente?.venteBateauxCatalogue || []).forEach(vb => { if (vb.bateau?.id) keys.push(`bateau:${vb.bateau.id}`); });
        (vente?.venteMoteursCatalogue || []).forEach(vm => { if (vm.moteur?.id) keys.push(`moteur:${vm.moteur.id}`); });
        (vente?.venteHelicesCatalogue || []).forEach(vh => { if (vh.helice?.id) keys.push(`helice:${vh.helice.id}`); });
        (vente?.venteRemorquesCatalogue || []).forEach(vr => { if (vr.remorque?.id) keys.push(`remorque:${vr.remorque.id}`); });
        savedLinesRef.current = keys.sort();
    };

    const populateForm = (vente: VenteEntity) => {
        if (vente.client?.id) {
            setClients((prev) => mergeById(prev, [vente.client as ClientEntity]));
        }
        const produitsCat = (vente.venteProduits || []).map((l) => l.produit).filter((p): p is ProduitCatalogueEntity => !!p?.id);
        if (produitsCat.length > 0) setProduits((prev) => mergeById(prev, produitsCat));
        const bateauxCat = (vente.venteBateauxCatalogue || []).map((l) => l.bateau).filter((b): b is CatalogueBateauEntity => !!b?.id);
        if (bateauxCat.length > 0) setCatalogueBateaux((prev) => mergeById(prev, bateauxCat));
        const moteursCat = (vente.venteMoteursCatalogue || []).map((l) => l.moteur).filter((m): m is CatalogueMoteurEntity => !!m?.id);
        if (moteursCat.length > 0) setCatalogueMoteurs((prev) => mergeById(prev, moteursCat));
        const helicesCat = (vente.venteHelicesCatalogue || []).map((l) => l.helice).filter((h): h is CatalogueHeliceEntity => !!h?.id);
        if (helicesCat.length > 0) setCatalogueHelices((prev) => mergeById(prev, helicesCat));
        const remorquesCat = (vente.venteRemorquesCatalogue || []).map((l) => l.remorque).filter((r): r is CatalogueRemorqueEntity => !!r?.id);
        if (remorquesCat.length > 0) setCatalogueRemorques((prev) => mergeById(prev, remorquesCat));
        const lignes: LigneUnifiee[] = [];
        (vente.venteForfaits || []).forEach(vf => {
            lignes.push({
                type: 'forfait',
                itemId: vf.forfait?.id,
                quantite: vf.quantite || 1,
                remise: vf.remise || 0,
                remisePourcentage: vf.remisePourcentage || 0,
                technicienIds: (vf.techniciens || []).map(t => t.id),
                status: vf.status || 'EN_ATTENTE',
                sav: vf.sav || false,
                datePlanification: vf.datePlanification,
                dateDebut: vf.dateDebut,
                dateFin: vf.dateFin,
                dureeReelle: vf.dureeReelle || 0,
                notes: vf.notes || '',
                incidentDate: toDateDayjs(vf.incidentDate) as any,
                incidentDetails: vf.incidentDetails || '',
                taches: (vf.taches || []).map(t => ({ nom: t.nom || '', description: t.description || '', done: t.done || false, nonFait: t.nonFait || false, motif: t.motif })),
                images: vf.images || [],
                documents: vf.documents || [],
            });
        });
        (vente.venteServices || []).forEach(vs => {
            lignes.push({
                type: 'service',
                itemId: vs.service?.id,
                quantite: vs.quantite || 1,
                remise: vs.remise || 0,
                remisePourcentage: vs.remisePourcentage || 0,
                technicienIds: (vs.techniciens || []).map(t => t.id),
                status: vs.status || 'EN_ATTENTE',
                sav: vs.sav || false,
                datePlanification: vs.datePlanification,
                dateDebut: vs.dateDebut,
                dateFin: vs.dateFin,
                dureeReelle: vs.dureeReelle || 0,
                notes: vs.notes || '',
                incidentDate: toDateDayjs(vs.incidentDate) as any,
                incidentDetails: vs.incidentDetails || '',
                taches: (vs.taches || []).map(t => ({ nom: t.nom || '', description: t.description || '', done: t.done || false, nonFait: t.nonFait || false, motif: t.motif })),
                images: vs.images || [],
                documents: vs.documents || [],
            });
        });
        (vente.venteProduits || []).forEach((l) => {
            if (l.produit?.id) lignes.push({ type: 'produit', itemId: l.produit.id, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 });
        });
        (vente.venteBateauxCatalogue || []).forEach((l) => {
            if (l.bateau?.id) lignes.push({ type: 'bateau', itemId: l.bateau.id, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 });
        });
        (vente.venteMoteursCatalogue || []).forEach((l) => {
            if (l.moteur?.id) lignes.push({ type: 'moteur', itemId: l.moteur.id, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 });
        });
        (vente.venteHelicesCatalogue || []).forEach((l) => {
            if (l.helice?.id) lignes.push({ type: 'helice', itemId: l.helice.id, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 });
        });
        (vente.venteRemorquesCatalogue || []).forEach((l) => {
            if (l.remorque?.id) lignes.push({ type: 'remorque', itemId: l.remorque.id, quantite: l.quantite || 1, remise: l.remise || 0, remisePourcentage: l.remisePourcentage || 0 });
        });
        interventionsConnuesRef.current = compterInterventions(lignes);
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
            lignes: [...lignes, { quantite: 1 }],
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
            dateEcheance: toDateDayjs(vente.dateEcheance) as any,
            note: vente.note,
            reception: vente.reception || undefined,
        });
    };

    const getBpaSummaryLines = useCallback(() => {
        const allLignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        const lines: Array<{ type: string; reference?: string; nom: string; quantite: number; prixTTC: number }> = [];
        allLignes.forEach((line) => {
            if (line.libre) {
                const quantite = line.quantite || 1;
                lines.push({ type: 'Produit', reference: line.libre.ref?.trim() || '-', nom: (line.libre.designation || '').trim(), quantite, prixTTC: (line.libre.prixVenteTTC || 0) * quantite });
                return;
            }
            if (!line.type || !line.itemId) return;
            const quantite = line.quantite || 1;
            if (line.type === 'forfait') {
                const f = forfaits.find((item) => item.id === line.itemId);
                if (f) lines.push({ type: 'Forfait', reference: f.reference || '-', nom: f.nom, quantite, prixTTC: (f.prixTTC || 0) * quantite });
            } else if (line.type === 'service') {
                const s = services.find((item) => item.id === line.itemId);
                if (s) lines.push({ type: 'Service', reference: '-', nom: s.nom, quantite, prixTTC: (s.prixTTC || 0) * quantite });
            } else if (line.type === 'produit') {
                const p = produits.find((item) => item.id === line.itemId);
                if (p) lines.push({ type: 'Produit', reference: p.ref || '-', nom: p.designation, quantite, prixTTC: (p.prixVenteTTC || 0) * quantite });
            } else if (line.type === 'bateau') {
                const b = catalogueBateaux.find((item) => item.id === line.itemId);
                if (b) lines.push({ type: 'Bateau', reference: '-', nom: b.designation, quantite, prixTTC: (b.prixVenteTTC || 0) * quantite });
            } else if (line.type === 'moteur') {
                const m = catalogueMoteurs.find((item) => item.id === line.itemId);
                if (m) lines.push({ type: 'Moteur', reference: '-', nom: m.designation, quantite, prixTTC: (m.prixVenteTTC || 0) * quantite });
            } else if (line.type === 'helice') {
                const h = catalogueHelices.find((item) => item.id === line.itemId);
                if (h) lines.push({ type: 'Hélice', reference: '-', nom: h.designation, quantite, prixTTC: (h.prixVenteTTC || 0) * quantite });
            } else if (line.type === 'remorque') {
                const r = catalogueRemorques.find((item) => item.id === line.itemId);
                if (r) lines.push({ type: 'Remorque', reference: '-', nom: r.designation, quantite, prixTTC: (r.prixVenteTTC || 0) * quantite });
            }
        });
        return lines;
    }, [form, forfaits, services, produits, catalogueBateaux, catalogueMoteurs, catalogueHelices, catalogueRemorques]);

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
        setCgvAccepted(false);
        setBpaPendingCallback(() => onConfirm);
        setBpaModalVisible(true);
        initSignatureCanvas();
    };

    const handleBpaConfirm = () => {
        if (!cgvAccepted) {
            message.warning('Vous devez accepter les conditions générales de vente pour continuer');
            return;
        }
        if (!signatureDrawingRef.current) {
            message.warning('La signature est requise pour valider le bon pour accord');
            return;
        }
        const canvas = signatureCanvasRef.current;
        const signatureData = canvas ? canvas.toDataURL('image/png') : undefined;
        if (bpaPendingCallback) {
            capturedSignatureRef.current = signatureData || null;
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
        const currentLignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        const currentKeys = currentLignes
            .filter((l) => (l.type && l.itemId) || l.libre?.designation?.trim())
            .map((l) => (l.libre ? `libre:${l.libre.designation}` : `${l.type}:${l.itemId}`))
            .sort();
        const linesChanged = JSON.stringify(currentKeys) !== JSON.stringify(savedLinesRef.current);

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
        // Recharge le stock depuis le backend pour repartir d'un état à jour.
        await Promise.all([refreshCatalogue(), fetchPackages()]);
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
            interventionsConnuesRef.current = 0;
            form.resetFields();
            form.setFieldsValue({ ...defaultVente, date: getTodayDayjs() });
            setFormDirty(false);
            setModalVisible(true);
        }
        setTimeout(() => { suppressDirtyRef.current = false; }, 0);
    };

    const toPayload = (values: VenteFormValues): VenteEntity => {
        const allLignes = (values.lignes || []).filter((l) => l.type && l.itemId);
        const forfaitLines = allLignes.filter((l) => l.type === 'forfait');
        const serviceLines = allLignes.filter((l) => l.type === 'service');
        // Produits du catalogue et articles saisis à la volée, dans l'ordre des lignes
        const produitLines = (values.lignes || []).filter((l) => l.libre || (l.type === 'produit' && l.itemId));
        const bateauLines = allLignes.filter((l) => l.type === 'bateau');
        const moteurLines = allLignes.filter((l) => l.type === 'moteur');
        const heliceLines = allLignes.filter((l) => l.type === 'helice');
        const remorqueLines = allLignes.filter((l) => l.type === 'remorque');

        return {
            status: values.status,
            bonPourAccord: values.bonPourAccord,
            ordreDeReparation: values.ordreDeReparation,
            signatureBonPourAccord: values.signatureBonPourAccord,
            client: clients.find((client) => client.id === values.clientId),
            bateau: bateaux.find((bateau) => bateau.id === values.bateauId),
            moteur: moteurs.find((moteur) => moteur.id === values.moteurId),
            remorque: remorques.find((remorque) => remorque.id === values.remorqueId),
            venteForfaits: forfaitLines.map((line) => {
                const selectedForfait = forfaits.find((f) => f.id === line.itemId);
                const existingTaches = (line.taches || []).filter((t: { nom?: string }) => t.nom?.trim());
                const taches = existingTaches.length > 0
                    ? existingTaches.map((t: { nom?: string; description?: string; done?: boolean; nonFait?: boolean; motif?: string }) => ({ nom: t.nom, description: t.description, done: t.done || false, nonFait: t.nonFait || false, motif: t.motif }))
                    : (selectedForfait?.taches || []).filter((t) => t.nom?.trim()).map((t) => ({ nom: t.nom, description: t.description || '', done: false }));
                const existingVf = (currentVente?.venteForfaits || []).find((vf) => vf.forfait?.id === line.itemId);
                return {
                    forfait: selectedForfait,
                    quantite: line.quantite || 1,
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                    techniciens: (line.technicienIds || []).map((id: number) => techniciens.find((t) => t.id === id)).filter(Boolean),
                    datePlanification: line.datePlanification || existingVf?.datePlanification,
                    dateDebut: line.dateDebut || existingVf?.dateDebut,
                    dateFin: line.dateFin || existingVf?.dateFin,
                    dateReouverture: existingVf?.dateReouverture,
                    dateCorrectionHoraires: existingVf?.dateCorrectionHoraires,
                    dateDebutOriginale: existingVf?.dateDebutOriginale,
                    dateFinOriginale: existingVf?.dateFinOriginale,
                    status: line.status || 'EN_ATTENTE',
                    sav: line.sav || false,
                    dureeReelle: line.dureeReelle || existingVf?.dureeReelle || 0,
                    notes: line.notes || '',
                    incidentDate: toBackendDateValue(line.incidentDate),
                    incidentDetails: line.incidentDetails || '',
                    taches,
                    images: line.images || existingVf?.images || [],
                    documents: line.documents || existingVf?.documents || [],
                };
            }),
            venteServices: serviceLines.map((line) => {
                const existingVs = (currentVente?.venteServices || []).find((vs) => vs.service?.id === line.itemId);
                const existingTaches = (line.taches || []).filter((t: { nom?: string }) => t.nom?.trim());
                const taches = existingTaches.length > 0
                    ? existingTaches.map((t: { nom?: string; description?: string; done?: boolean; nonFait?: boolean; motif?: string }) => ({ nom: t.nom, description: t.description, done: t.done || false, nonFait: t.nonFait || false, motif: t.motif }))
                    : (existingVs?.taches || []).map((t) => ({ nom: t.nom, description: t.description || '', done: t.done || false, nonFait: t.nonFait || false, motif: t.motif }));
                return {
                    service: services.find((s) => s.id === line.itemId),
                    quantite: line.quantite || 1,
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                    techniciens: (line.technicienIds || []).map((id: number) => techniciens.find((t) => t.id === id)).filter(Boolean),
                    datePlanification: line.datePlanification || existingVs?.datePlanification,
                    dateDebut: line.dateDebut || existingVs?.dateDebut,
                    dateFin: line.dateFin || existingVs?.dateFin,
                    dateReouverture: existingVs?.dateReouverture,
                    dateCorrectionHoraires: existingVs?.dateCorrectionHoraires,
                    dateDebutOriginale: existingVs?.dateDebutOriginale,
                    dateFinOriginale: existingVs?.dateFinOriginale,
                    status: line.status || 'EN_ATTENTE',
                    sav: line.sav || false,
                    dureeReelle: line.dureeReelle || existingVs?.dureeReelle || 0,
                    notes: line.notes || '',
                    incidentDate: toBackendDateValue(line.incidentDate),
                    incidentDetails: line.incidentDetails || '',
                    taches,
                    images: line.images || existingVs?.images || [],
                    documents: line.documents || existingVs?.documents || [],
                };
            }),
            venteProduits: produitLines.flatMap<VenteProduitLigne>((line) => {
                // Article saisi à la volée : le backend le crée au catalogue
                const produit = line.libre ? articleALaVolee(line.libre) : produits.find((p) => p.id === line.itemId);
                return produit ? [{
                    produit,
                    quantite: quantiteLigne(line.quantite),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
            venteBateauxCatalogue: bateauLines.flatMap<VenteBateauCatalogueLigne>((line) => {
                const bateau = catalogueBateaux.find((b) => b.id === line.itemId);
                return bateau ? [{
                    bateau,
                    quantite: quantiteLigne(line.quantite),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
            venteMoteursCatalogue: moteurLines.flatMap<VenteMoteurCatalogueLigne>((line) => {
                const moteur = catalogueMoteurs.find((m) => m.id === line.itemId);
                return moteur ? [{
                    moteur,
                    quantite: quantiteLigne(line.quantite),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
            venteHelicesCatalogue: heliceLines.flatMap<VenteHeliceCatalogueLigne>((line) => {
                const helice = catalogueHelices.find((h) => h.id === line.itemId);
                return helice ? [{
                    helice,
                    quantite: quantiteLigne(line.quantite),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
            venteRemorquesCatalogue: remorqueLines.flatMap<VenteRemorqueCatalogueLigne>((line) => {
                const remorque = catalogueRemorques.find((r) => r.id === line.itemId);
                return remorque ? [{
                    remorque,
                    quantite: quantiteLigne(line.quantite),
                    remise: line.remise || 0,
                    remisePourcentage: line.remisePourcentage || 0,
                }] : [];
            }),
            date: toBackendDateValue(values.date),
            dateEcheance: toBackendDateValue(values.dateEcheance),
            montantHT: values.montantHT || 0,
            remise: values.remise || 0,
            tva: values.tva || 0,
            montantTVA: values.montantTVA || 0,
            montantTTC: values.montantTTC || 0,
            prixVenteTTC: values.prixVenteTTC || 0,
            modePaiement: values.modePaiement,
            images: values.images || [],
            documents: values.documents || [],
            note: values.note,
            reception: receptionRenseignee(values.reception) ? values.reception : undefined,
        };
    };

    // Renvoie la vente enregistrée, ou undefined si la validation ou l'enregistrement échoue
    const handleSave = async (): Promise<VenteEntity | undefined> => {
        try {
            const values = await form.validateFields();
            const payload = toPayload(values);
            const signatureValue = capturedSignatureRef.current ?? form.getFieldValue('signatureBonPourAccord') ?? currentVente?.signatureBonPourAccord;
            if (signatureValue != null) {
                payload.signatureBonPourAccord = signatureValue;
            }
            suppressDirtyRef.current = true;
            let saved: VenteEntity;
            if (isEdit && currentVente?.id) {
                const etaitTerminee = currentVente.status === 'FACTURE_PRETE';
                const res = await api.put(`/ventes/${currentVente.id}`, { ...currentVente, ...payload });
                capturedSignatureRef.current = null;
                message.success('Vente modifiee avec succes');
                if (etaitTerminee && res.data.status === 'DEVIS') {
                    message.info('Une prestation a été ajoutée : la vente repasse en attente de bon pour accord, les nouvelles tâches peuvent être planifiées');
                }
                setCurrentVente(res.data);
                snapshotSavedLines(res.data);
                populateForm(res.data);
                saved = res.data;
            } else {
                const res = await api.post('/ventes', payload);
                capturedSignatureRef.current = null;
                message.success('Vente ajoutee avec succes');
                setIsEdit(true);
                setCurrentVente(res.data);
                snapshotSavedLines(res.data);
                populateForm(res.data);
                saved = res.data;
            }
            const crees = (values.lignes || []).flatMap((l) => (l.libre ? [(l.libre.designation || '').trim()] : []));
            if (crees.length > 0) {
                message.info(`Ajouté au catalogue : ${crees.join(', ')}`);
            }
            setFormDirty(false);
            setTimeout(() => { suppressDirtyRef.current = false; }, 0);
            fetchVentes();
            return saved;
        } catch (error) {
            suppressDirtyRef.current = false;
            // Les erreurs de validation sont affichees par le formulaire ; celles du serveur
            // (par exemple un article de ligne libre déjà au catalogue) le sont en message.
            const serveur = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
            if (serveur?.message || serveur?.error) {
                message.error(serveur.message || serveur.error);
            }
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
        // La facture passe en « payée » automatiquement quand les paiements couvrent le solde : pas de passage manuel
        if (step === 4) {
            const totalPaye = (currentVente?.paiements ?? []).reduce((sum, p) => sum + (p.montant || 0), 0);
            const solde = Math.round(((form.getFieldValue('prixVenteTTC') || 0) - totalPaye) * 100) / 100;
            if (solde > 0.005) {
                message.warning(`Solde dû de ${formatEuro(solde)} : ajoutez les paiements correspondants, la facture passera automatiquement en payée.`);
                return;
            }
        }
        // Block transition to "Facture complète" (step 3+) if not all tasks are done
        if (step >= 3 && currentStep < 3) {
            const currentLignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
            const allLines = currentLignes.filter((l) => (l.type === 'forfait' || l.type === 'service') && l.itemId);
            const totalDureeEstimee = allLines.reduce((sum, l) => {
                const duree = l.type === 'forfait'
                    ? forfaits.find((f) => f.id === l.itemId)?.dureeEstimee
                    : services.find((s) => s.id === l.itemId)?.dureeEstimee;
                return sum + (duree || 0);
            }, 0);
            const skipCheck = allLines.length === 0 || totalDureeEstimee === 0;
            if (!skipCheck) {
                const allDone = allLines.every((l: { status?: PlanningStatus }) =>
                    l.status === 'TERMINEE' || l.status === 'ANNULEE'
                );
                const hasTerminee = allLines.some((l: { status?: PlanningStatus }) => l.status === 'TERMINEE');
                if (!allDone || !hasTerminee) {
                    message.warning('Toutes les prestations doivent être terminées avant de passer en Terminé');
                    return;
                }
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
            fetchVentes();
        } catch {
            message.error('Erreur lors de la suppression de la vente.');
        }
    };

    const handleRefus = async () => {
        if (!currentVente?.id) return;
        try {
            await api.post(`/ventes/${currentVente.id}/refus`, { motif: motifRefus });
            message.success('Devis marqué comme refusé');
            setRefusVisible(false);
            setMotifRefus('');
            await refreshCurrentVente(currentVente.id);
            fetchVentes();
        } catch (err: any) {
            message.error(err?.response?.data || 'Erreur lors du refus du devis');
        }
    };

    const handleReprendre = async () => {
        if (!currentVente?.id) return;
        try {
            await api.delete(`/ventes/${currentVente.id}/refus`);
            message.success('Devis repris : il est de nouveau en attente de signature');
            await refreshCurrentVente(currentVente.id);
            fetchVentes();
        } catch (err: any) {
            message.error(err?.response?.data || 'Erreur lors de la reprise du devis');
        }
    };

    // Courrier de relance : sa première impression le date et le retire du journal, les suivantes le réimpriment tel quel
    const imprimerCourrier = async (courrier: RappelHistoriqueEntity) => {
        try {
            const res = courrier.dateImpression
                ? await api.get(`/relances/courriers/${courrier.id}`, { responseType: 'blob' })
                : await api.post('/relances/courriers/impression', { courriers: [courrier.id] }, { responseType: 'blob' });
            ouvrirPdf(res.data, `relance-${currentVente?.numeroFacture || currentVente?.id}.pdf`);
            if (currentVente?.id) {
                api.get<RappelHistoriqueEntity[]>(`/rappels/vente/${currentVente.id}`).then(r => setRappelHistorique(r.data)).catch(() => {});
            }
        } catch {
            message.error("Erreur lors de l'impression du courrier de relance");
        }
    };

    const reprendreRelances = async () => {
        if (!currentVente?.id) return;
        try {
            await api.delete(`/relances/ventes/${currentVente.id}/suspension`);
            message.success('Les relances de la vente reprennent');
            await refreshCurrentVente(currentVente.id);
        } catch (err: any) {
            message.error(err?.response?.data || 'Erreur lors de la reprise des relances');
        }
    };

    const refreshCurrentVente = async (id: number) => {
        try {
            const res = await api.get<VenteEntity>(`/ventes/${id}`);
            setCurrentVente(res.data);
            // Le statut peut avoir changé côté serveur (facture passée automatiquement en payée).
            form.setFieldsValue({ status: res.data.status });
        } catch {
            message.error('Erreur lors du rechargement de la vente');
        }
    };

    const openPaiementModal = (vente: VenteEntity | null = currentVente) => {
        const restant = (vente?.prixVenteTTC ?? 0) -
            (vente?.paiements ?? []).reduce((s, p) => s + p.montant, 0);
        setPaiementMode('CHEQUE');
        setPaiementMontant(Math.max(0, Math.round(restant * 100) / 100));
        // Avant la facture, un paiement est un acompte
        setPaiementNotes(vente?.status === 'DEVIS' || vente?.status === 'FACTURE_EN_ATTENTE' ? 'Acompte' : '');
        setPaiementDate(dayjs());
        setPaiementAvoirId(null);
        setAvoirsDisponibles([]);
        setPaiementModalVisible(true);
    };

    // Transaction pas encore enregistrée : on l'enregistre avant de saisir le paiement (acompte)
    const ajouterPaiementNouvelleVente = async () => {
        const saved = await handleSave();
        if (saved?.id) {
            openPaiementModal(saved);
        }
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
                date: paiementDate.format('YYYY-MM-DDTHH:mm:ss'),
                avoirId: paiementMode === 'AVOIR' ? paiementAvoirId : undefined,
            });
            message.success('Paiement ajouté');
            setPaiementModalVisible(false);
            await refreshCurrentVente(currentVente.id);
            fetchVentes();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: string } })?.response?.data || 'Erreur lors de l\'ajout du paiement';
            message.error(msg);
        } finally {
            setAddingPaiement(false);
        }
    };

    const handleUpdatePaiementDate = async () => {
        if (!currentVente?.id || !editPaiement) return;
        try {
            await api.put(`/ventes/${currentVente.id}/paiements/${editPaiement.id}`, {
                date: editPaiement.date.format('YYYY-MM-DDTHH:mm:ss'),
            });
            message.success('Date du paiement modifiée');
            setEditPaiement(null);
            await refreshCurrentVente(currentVente.id);
            fetchVentes();
        } catch {
            message.error('Erreur lors de la modification de la date du paiement');
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

    const rgVentesClient = useMemo(() => {
        if (!rgClientId) return [];
        return ventes.filter(
            (v) => v.client?.id === rgClientId && v.status === 'FACTURE_PRETE'
        );
    }, [ventes, rgClientId]);

    const rgDistribution = useMemo(() => {
        const selected = rgVentesClient.filter((v) => rgSelectedIds.includes(v.id!));
        const sorted = [...selected].sort((a, b) => {
            const da = a.dateDevis ? new Date(a.dateDevis).getTime() : 0;
            const db = b.dateDevis ? new Date(b.dateDevis).getTime() : 0;
            return da - db;
        });
        let restant = rgMontant;
        return sorted.map((v) => {
            const totalPaye = (v.paiements || []).reduce((s, p) => s + p.montant, 0);
            const balance = Math.round((v.prixVenteTTC - totalPaye) * 100) / 100;
            const alloue = Math.max(0, Math.min(balance, Math.round(restant * 100) / 100));
            restant = Math.round((restant - alloue) * 100) / 100;
            return { vente: v, balance, alloue };
        });
    }, [rgVentesClient, rgSelectedIds, rgMontant]);

    const handleReglementGroupe = async () => {
        if (rgSelectedIds.length === 0) { message.warning('Sélectionnez au moins une facture'); return; }
        if (rgMontant <= 0) { message.warning('Le montant doit être supérieur à zéro'); return; }
        setRgSubmitting(true);
        try {
            await api.post('/ventes/paiement-groupe', {
                venteIds: rgSelectedIds,
                mode: rgMode,
                montant: rgMontant,
                notes: rgNotes || undefined,
                date: rgDate.format('YYYY-MM-DDTHH:mm:ss'),
            });
            message.success('Règlement groupé enregistré');
            setReglementGroupeVisible(false);
            setRgClientId(null);
            setRgSelectedIds([]);
            setRgMontant(0);
            setRgNotes('');
            setRgDate(dayjs());
            const res = await api.get('/ventes');
            setVentes(res.data || []);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: string } })?.response?.data || 'Erreur lors du règlement groupé';
            message.error(msg);
        } finally {
            setRgSubmitting(false);
        }
    };

    // Lignes de la facture proposées à la sélection pour l'avoir (clé = type:identifiant de la ligne de vente)
    const genAvoirLignes = useMemo(() => {
        const v = genAvoirModalVente;
        if (!v) return [];
        const net = (prix?: number, quantite?: number, remise?: number) =>
            Math.max(0, (prix ?? 0) * (quantite ?? 1) - (remise ?? 0));
        const exonere = clientExonereTva(v.client);
        return [
            ...(v.venteForfaits || []).filter((l) => l.id && l.forfait).map((l) => ({
                key: `forfait:${l.id}`, type: 'Forfait', designation: l.forfait!.nom,
                quantite: l.quantite ?? 1, totalTTC: net(prixPrestationVente(l.forfait, exonere), l.quantite, l.remise),
            })),
            ...(v.venteServices || []).filter((l) => l.id && l.service).map((l) => ({
                key: `service:${l.id}`, type: 'Service', designation: l.service!.nom,
                quantite: l.quantite ?? 1, totalTTC: net(prixPrestationVente(l.service, exonere), l.quantite, l.remise),
            })),
            ...(v.venteProduits || []).filter((l) => l.id && l.produit).map((l) => {
                const p = l.produit as ProduitCatalogueEntity;
                return {
                    key: `produit:${l.id}`, type: 'Produit', designation: p.designation ?? 'Produit',
                    quantite: l.quantite ?? 1, totalTTC: net(prixArticleVente(p, exonere), l.quantite, l.remise),
                };
            }),
        ];
    }, [genAvoirModalVente]);

    const openGenerateAvoir = async (vente: VenteEntity) => {
        let complete = vente;
        try {
            // La liste ne porte pas forcément le détail des lignes
            const res = await api.get<VenteEntity>(`/ventes/${vente.id}`);
            complete = res.data;
        } catch {
            // on se contente de la vente déjà chargée
        }
        setGenAvoirMotif('');
        setGenAvoirNotes('');
        setGenAvoirLignesLibres([]);
        setGenAvoirSelection([
            ...(complete.venteForfaits || []).filter((l) => l.id && l.forfait).map((l) => `forfait:${l.id}`),
            ...(complete.venteServices || []).filter((l) => l.id && l.service).map((l) => `service:${l.id}`),
            ...(complete.venteProduits || []).filter((l) => l.id && l.produit).map((l) => `produit:${l.id}`),
        ]);
        setGenAvoirModalVente(complete);
    };

    const handleGenerateAvoir = async () => {
        if (!genAvoirModalVente?.id) return;
        if (!genAvoirMotif.trim()) { message.warning('Le motif est requis'); return; }
        if (genAvoirSelection.length === 0 && genAvoirLignesLibres.length === 0) {
            message.warning('Sélectionnez au moins une ligne ou ajoutez une ligne libre');
            return;
        }
        const erreurLignesLibres = erreurLignesLibresAvoir(genAvoirLignesLibres);
        if (erreurLignesLibres) { message.warning(erreurLignesLibres); return; }
        const ids = (type: string) => genAvoirSelection
            .filter((k) => k.startsWith(`${type}:`))
            .map((k) => Number(k.slice(type.length + 1)));
        setGeneratingAvoir(true);
        try {
            await api.post(`/avoirs/from-vente/${genAvoirModalVente.id}`, {
                motif: genAvoirMotif.trim(),
                notes: genAvoirNotes || undefined,
                forfaitIds: ids('forfait'),
                serviceIds: ids('service'),
                produitIds: ids('produit'),
                lignesLibres: genAvoirLignesLibres.map((l) => ({ ...l, designation: l.designation.trim() })),
            });
            setGenAvoirModalVente(null);
            setGenAvoirMotif('');
            setGenAvoirNotes('');
            setGenAvoirLignesLibres([]);
            Modal.confirm({
                title: 'Avoir généré',
                content: 'L\'avoir a été créé en brouillon. Voulez-vous accéder à la gestion des avoirs ?',
                okText: 'Aller aux avoirs',
                cancelText: 'Rester ici',
                onOk: () => navigate('/avoirs'),
            });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: string } })?.response?.data || 'Erreur lors de la génération de l\'avoir';
            message.error(msg);
        } finally {
            setGeneratingAvoir(false);
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

        const doPrint = () => {
            iframeWindow.print();
            setTimeout(cleanup, 1000);
        };

        const images = Array.from(iframeWindow.document.getElementsByTagName('img'));
        if (images.length === 0) {
            doPrint();
        } else {
            let pending = images.filter(img => !img.complete).length;
            if (pending === 0) {
                doPrint();
            } else {
                const onSettle = () => { pending--; if (pending === 0) doPrint(); };
                images.forEach(img => {
                    if (!img.complete) {
                        img.addEventListener('load', onSettle, { once: true });
                        img.addEventListener('error', onSettle, { once: true });
                    }
                });
            }
        }
    };

    const buildDocumentLines = (vente: VenteEntity): InvoicePrintLine[] => {
        // Un client exonéré de TVA est facturé au prix HT : c'est aussi son prix TTC
        const exonere = clientExonereTva(vente.client);
        const lineFromForfait = (vf: VenteForfaitEntity) => {
            const puTTC = prixPrestationVente(vf.forfait, exonere);
            const quantite = vf.quantite || 1;
            const remise = vf.remise || 0;
            const brut = puTTC * quantite;
            return {
                type: 'Forfait', reference: vf.forfait?.reference || '', label: vf.forfait?.nom || '', quantite,
                puTTC,
                remise, remisePct: vf.remisePourcentage ?? computeRemisePct(remise, puTTC, quantite),
                totalPrixTTC: Math.max(0, brut - remise),
                details: buildCompositionDetails(vf.forfait, quantite),
            };
        };
        const lineFromService = (vs: VenteServiceEntity) => {
            const puTTC = prixPrestationVente(vs.service, exonere);
            const quantite = vs.quantite || 1;
            const remise = vs.remise || 0;
            const brut = puTTC * quantite;
            return {
                type: 'Service', reference: '', label: vs.service?.nom || '', quantite,
                puTTC,
                remise, remisePct: vs.remisePourcentage ?? computeRemisePct(remise, puTTC, quantite),
                totalPrixTTC: Math.max(0, brut - remise),
                details: buildCompositionDetails(vs.service, quantite),
            };
        };
        const lineFromProduit = (vp: VenteProduitLigne) => {
            const label = vp.produit?.designation || '';
            const reference = vp.produit?.ref || '';
            const puTTC = prixArticleVente(vp.produit, exonere);
            const quantite = vp.quantite || 1;
            const remise = vp.remise || 0;
            const brut = puTTC * quantite;
            return {
                type: 'Produit', reference, label, quantite,
                puTTC,
                remise, remisePct: vp.remisePourcentage ?? computeRemisePct(remise, puTTC, quantite),
                totalPrixTTC: Math.max(0, brut - remise),
                occasion: !!vp.produit?.occasion,
            };
        };
        const lineFromCatalogue = (item: { designation?: string; prixVenteHT?: number; tva?: number; prixVenteTTC?: number; occasion?: boolean } | undefined, typeLabel: string, qty: number, remise: number, remisePourcentage?: number) => {
            const puTTC = prixArticleVente(item, exonere);
            const quantite = qty || 1;
            const brut = puTTC * quantite;
            return {
                type: typeLabel, reference: '', label: item?.designation || '', quantite,
                puTTC,
                remise: remise || 0, remisePct: remisePourcentage ?? computeRemisePct(remise || 0, puTTC, quantite),
                totalPrixTTC: Math.max(0, brut - (remise || 0)),
                occasion: !!item?.occasion,
            };
        };
        const forfaitLines = (vente.venteForfaits || []).map(lineFromForfait);
        const produitLines = (vente.venteProduits || []).map(lineFromProduit);
        const serviceLines = (vente.venteServices || []).map(lineFromService);
        const bateauLines = (vente.venteBateauxCatalogue || []).map((vb) => lineFromCatalogue(vb.bateau, 'Bateau', vb.quantite, vb.remise || 0, vb.remisePourcentage));
        const moteurCatLines = (vente.venteMoteursCatalogue || []).map((vm) => lineFromCatalogue(vm.moteur, 'Moteur', vm.quantite, vm.remise || 0, vm.remisePourcentage));
        const heliceLines = (vente.venteHelicesCatalogue || []).map((vh) => lineFromCatalogue(vh.helice, 'Hélice', vh.quantite, vh.remise || 0, vh.remisePourcentage));
        const remorqueCatLines = (vente.venteRemorquesCatalogue || []).map((vr) => lineFromCatalogue(vr.remorque, 'Remorque', vr.quantite, vr.remise || 0, vr.remisePourcentage));
        return [...forfaitLines, ...produitLines, ...bateauLines, ...moteurCatLines, ...heliceLines, ...remorqueCatLines, ...serviceLines];
    };

    const getDocumentType = (vente: VenteEntity): 'devis' | 'ordre_reparation' | 'facture' => {
        if (vente.status === 'DEVIS') {
            return vente.ordreDeReparation ? 'ordre_reparation' : 'devis';
        }
        return 'facture';
    };

    const buildDocumentHtml = (vente: VenteEntity, societe?: SocieteData) => {
        const docType = getDocumentType(vente);
        const showPrices = docType !== 'ordre_reparation';
        const isFacture = docType === 'facture';
        const lines = buildDocumentLines(vente);

        const docTitle = docType === 'devis' ? 'Devis'
            : docType === 'ordre_reparation' ? 'Ordre de Réparation'
            : 'Facture';
        const docRef = vente.numeroFacture || (vente.id ? `#${vente.id}` : '-');
        const title = `${docTitle} ${vente.numeroFacture ? 'n° ' : ''}${docRef}`;

        const societeHtml = buildSocieteBlockHtml(societe);

        const modeLabels: Record<string, string> = { CHEQUE: 'Chèque', VIREMENT: 'Virement', CARTE: 'Carte', 'ESPÈCES': 'Espèces', AVOIR: 'Avoir' };
        const client = vente.client;

        const docBoxRows: Array<[string, string]> = [
            ['Numéro', escapeHtml(docRef)],
            ['Date', escapeHtml(formatDatePrint(vente.date))],
            ...(isFacture && vente.dateEcheance ? [["Échéance", escapeHtml(formatDatePrint(vente.dateEcheance))] as [string, string]] : []),
            ...(client ? [['N° client', escapeHtml(client.codeTiers || String(client.id))] as [string, string]] : []),
            ...(isFacture && vente.modePaiement ? [['Mode de règlement', escapeHtml(modeLabels[vente.modePaiement] ?? vente.modePaiement)] as [string, string]] : []),
            ...(client?.tva ? [['N° TVA Intracom.', escapeHtml(client.tva)] as [string, string]] : []),
        ];
        const docBoxHtml = buildDocBoxHtml(docTitle, docBoxRows);

        const clientBoxHtml = buildClientBoxHtml(client, getClientLabel(client));
        const boatBoxHtml = buildBoatBoxHtml(vente.bateau, vente.moteur);

        const tableHtml = buildInvoiceTableHtml(lines, { showPrices, tva: vente.tva });

        const tvaBreakdownHtml = showPrices
            ? buildTvaBreakdownHtml({ tva: vente.tva, montantHT: vente.montantHT, montantTVA: vente.montantTVA, montantOccasion: montantOccasion(lines), exonere: clientExonereTva(client) })
            : '';

        const bancaireHtml = buildBancaireHtml(societe);

        const totalPaye = (vente.paiements ?? []).reduce((sum, p) => sum + (p.montant || 0), 0);
        // Une facture déjà marquée payée est considérée soldée même si le détail des
        // règlements ne couvre pas (encore) le montant total (ex. mode de paiement
        // renseigné sans ligne de paiement détaillée).
        const soldeDu = vente.status === 'FACTURE_PAYEE' ? 0 : Math.max(0, (vente.prixVenteTTC || 0) - totalPaye);
        const totalsHtml = showPrices
            ? buildTotalsHtml({
                remise: vente.remise, montantHT: vente.montantHT, montantTVA: vente.montantTVA,
                montantTTC: vente.montantTTC, prixVenteTTC: vente.prixVenteTTC, soldeDu, isFacture,
            })
            : '';

        const paiementsHtml = (() => {
            if (!isFacture) return '';
            const ps = vente.paiements ?? [];
            if (ps.length > 0) {
                return ps.map(p => {
                    const label = modeLabels[p.mode] ?? p.mode;
                    const avoir = p.avoirId ? ` (avoir #${p.avoirId})` : '';
                    const date = p.date ? `${formatDatePrint(p.date)} - ` : '';
                    return `<div class="row">${escapeHtml(date)}${escapeHtml(label)}${escapeHtml(avoir)} : ${escapeHtml(formatEuro(p.montant))}</div>`;
                }).join('');
            }
            return '';
        })();
        const paymentHtml = paiementsHtml
            ? `<div class="section"><strong>Règlements :</strong>${paiementsHtml}</div>` : '';

        const conditionsLegalesHtml = isFacture ? `
            <div class="section legal">
                ${vente.conditionsPaiement ? `<div class="row"><strong>Conditions de paiement :</strong> ${escapeHtml(vente.conditionsPaiement)}</div>` : ''}
                ${vente.penalitesRetard ? `<div class="row"><strong>Pénalités de retard :</strong> ${escapeHtml(vente.penalitesRetard)}</div>` : ''}
                <div class="row"><strong>Indemnité forfaitaire de recouvrement :</strong> ${escapeHtml(formatEuro(vente.indemniteForfaitaire ?? 40))}</div>
            </div>` : '';

        const signatureHtml = !isFacture && vente.signatureBonPourAccord
            ? `<div class="section"><h3>Signature client</h3><img src="${vente.signatureBonPourAccord}" style="max-width:300px;border:1px solid #d9d9d9;border-radius:4px;" /></div>` : '';

        const noteHtml = vente.note
            ? `<div class="section"><h3>Note</h3><div class="row" style="white-space:pre-wrap;">${escapeHtml(vente.note)}</div></div>` : '';

        // Placée juste avant la signature : le client signe le bon pour accord au vu de la réception
        const receptionHtml = !isFacture ? buildReceptionHtml(vente.reception) : '';

        const legalLine = buildLegalLine(societe);

        return `<html>
            <head>
                <title>${escapeHtml(title)}</title>
                <style>${INVOICE_PRINT_STYLES}</style>
            </head>
            <body>
                <div class="header-row">
                    ${societeHtml}
                </div>
                ${buildInfoSectionHtml(docBoxHtml, clientBoxHtml, boatBoxHtml)}
                ${paymentHtml}
                <div class="section">
                    ${tableHtml}
                </div>
                ${showPrices ? `
                <div class="footer-row">
                    <div class="footer-left">
                        ${tvaBreakdownHtml}
                        ${bancaireHtml}
                    </div>
                    ${totalsHtml}
                </div>` : ''}
                ${noteHtml}
                ${receptionHtml}
                ${conditionsLegalesHtml}
                ${signatureHtml}
                ${legalLine ? `<div class="page-footer">${escapeHtml(legalLine)}</div>` : ''}
            </body>
        </html>`;
    };

    const handlePrint = async (vente: VenteEntity) => {
        let fullVente = vente;
        if (vente.id) {
            try {
                const res = await api.get<VenteEntity>(`/ventes/${vente.id}`);
                fullVente = res.data;
            } catch {
                // On utilise la vente passée en paramètre en cas d'erreur
            }
        }
        let societe: SocieteData | undefined;
        try {
            const societeRes = await api.get<SocieteData>('/societe');
            societe = societeRes.data;
        } catch {
            // document sans entête société en cas d'erreur
        }
        const docType = getDocumentType(fullVente);
        const docTitle = docType === 'devis' ? 'Devis'
            : docType === 'ordre_reparation' ? 'Ordre de Réparation'
            : 'Facture';
        const docRef = fullVente.numeroFacture ? `n° ${fullVente.numeroFacture}` : `#${fullVente.id || '-'}`;
        openPrintDocument(`${docTitle} ${docRef}`, buildDocumentHtml(fullVente, societe));
    };

    const handleDownloadFacturX = async (vente: VenteEntity) => {
        if (!vente.id) return;
        try {
            const response = await api.get(`/ventes/${vente.id}/facturx`, { responseType: 'blob' });
            const url = URL.createObjectURL(response.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = vente.numeroFacture ? `${vente.numeroFacture}.pdf` : `facture-${vente.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            let detail = '';
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosErr = err as { response: { data: Blob }; message: string };
                try {
                    const text = await axiosErr.response.data.text();
                    const parsed = JSON.parse(text);
                    detail = parsed?.error ?? text;
                } catch {
                    detail = axiosErr.message;
                }
            } else if (err instanceof Error) {
                detail = err.message;
            }
            message.error('Erreur lors de la génération du Factur-X.' + (detail ? ' ' + detail : ''));
        }
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
            await api.post(`/ventes/${vente.id}/email`);
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

    // Dès qu'une intervention (forfait ou service) est ajoutée, ajoute les produits marqués
    // « ajout automatique aux interventions » absents de la vente (ex. : traitement des déchets).
    // Seul l'ajout d'une intervention déclenche : un produit automatique retiré à la main n'est pas remis.
    const ajouterProduitsAutomatiques = (allProduits: ProduitCatalogueEntity[]) => {
        const lignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        const nbInterventions = compterInterventions(lignes);
        const interventionAjoutee = nbInterventions > interventionsConnuesRef.current;
        interventionsConnuesRef.current = nbInterventions;
        if (!interventionAjoutee) return;
        const produitsPresents = new Set(lignes.filter((l) => l.type === 'produit').map((l) => l.itemId));
        const aAjouter = allProduits.filter((p) => p.ajoutAutomatiqueIntervention && !produitsPresents.has(p.id));
        if (aAjouter.length === 0) return;
        const lignesAuto: LigneUnifiee[] = aAjouter.map((p) => ({ type: 'produit', itemId: p.id, quantite: 1 }));
        const derniere = lignes[lignes.length - 1];
        const derniereVide = !!derniere && estLigneVide(derniere);
        form.setFieldValue('lignes', derniereVide
            ? [...lignes.slice(0, -1), ...lignesAuto, derniere]
            : [...lignes, ...lignesAuto, { quantite: 1 }]);
        message.info(`Ajouté automatiquement à l'intervention : ${aAjouter.map((p) => p.designation).join(', ')}`);
    };

    // Un client exonéré de TVA (professionnel de la mer) achète au prix HT des articles, sans TVA
    const venteExoneree = (clientId: number | undefined = form.getFieldValue('clientId')) =>
        clientExonereTva(clients.find((client) => client.id === clientId));

    // Prix unitaire d'une ligne : saisi sur une ligne libre, sinon celui de l'article choisi (HT pour un client exonéré de TVA)
    const prixUnitaireLigne = (line: LigneUnifiee, exonere: boolean = venteExoneree()): number | undefined => {
        const prestation = (item?: { prixTTC?: number; prixHT?: number; tva?: number }) => item && prixPrestationVente(item, exonere);
        const article = (item?: { prixVenteTTC?: number; prixVenteHT?: number; tva?: number }) => item && prixArticleVente(item, exonere);
        if (line.libre) return article(line.libre);
        if (line.type === 'forfait') return prestation(forfaits.find((f) => f.id === line.itemId));
        if (line.type === 'service') return prestation(services.find((s) => s.id === line.itemId));
        if (line.type === 'produit') return article(produits.find((p) => p.id === line.itemId));
        if (line.type === 'bateau') return article(catalogueBateaux.find((b) => b.id === line.itemId));
        if (line.type === 'moteur') return article(catalogueMoteurs.find((m) => m.id === line.itemId));
        if (line.type === 'helice') return article(catalogueHelices.find((h) => h.id === line.itemId));
        if (line.type === 'remorque') return article(catalogueRemorques.find((r) => r.id === line.itemId));
        return undefined;
    };

    // Montant TTC des lignes, dont la part des articles d'occasion, vendus sans TVA (remises de ligne déduites)
    const totauxLignes = (
        allForfaits: ForfaitEntity[] = forfaits,
        allProduits: ProduitCatalogueEntity[] = produits,
        allServices: ServiceEntity[] = services,
        exonere: boolean = venteExoneree(),
    ) => {
        const allLignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        let totalTTC = 0;
        let totalOccasionTTC = 0;
        allLignes.forEach((line) => {
            if (!line.libre && (!line.type || !line.itemId)) return;
            const quantite = quantiteLigne(line.quantite);
            let brut = 0;
            let article: { prixVenteHT?: number; tva?: number; prixVenteTTC?: number; occasion?: boolean } | undefined;
            if (line.libre) {
                brut = prixArticleVente(line.libre, exonere) * quantite;
            } else if (line.type === 'forfait') {
                brut = prixPrestationVente(allForfaits.find((f) => f.id === line.itemId), exonere) * quantite;
            } else if (line.type === 'service') {
                brut = prixPrestationVente(allServices.find((s) => s.id === line.itemId), exonere) * quantite;
            } else if (line.type === 'produit') {
                article = allProduits.find((p) => p.id === line.itemId);
            } else if (line.type === 'bateau') {
                article = catalogueBateaux.find((b) => b.id === line.itemId);
            } else if (line.type === 'moteur') {
                article = catalogueMoteurs.find((m) => m.id === line.itemId);
            } else if (line.type === 'helice') {
                article = catalogueHelices.find((h) => h.id === line.itemId);
            } else if (line.type === 'remorque') {
                article = catalogueRemorques.find((r) => r.id === line.itemId);
            }
            if (article) {
                brut = prixArticleVente(article, exonere) * quantite;
            }
            const net = Math.max(0, brut - (line.remise || 0));
            totalTTC += net;
            if (article?.occasion) {
                totalOccasionTTC += net;
            }
        });
        return { totalTTC, totalOccasionTTC };
    };

    const recalculateFromLines = (
        remiseSource: 'amount' | 'percentage' | 'auto' = 'auto',
        overrides?: { forfaits?: ForfaitEntity[]; produits?: ProduitCatalogueEntity[]; services?: ServiceEntity[]; exonere?: boolean }
    ) => {
        const allForfaits = overrides?.forfaits ?? forfaits;
        const allProduits = overrides?.produits ?? produits;
        const allServices = overrides?.services ?? services;
        const exonere = overrides?.exonere ?? venteExoneree();

        ajouterProduitsAutomatiques(allProduits);
        let remise = form.getFieldValue('remise') || 0;
        let remisePourcentage = form.getFieldValue('remisePourcentage') || 0;
        // Un client exonéré ne paie aucune TVA : les lignes sont à leur prix HT
        if (exonere) form.setFieldValue('tva', 0);
        const tva = form.getFieldValue('tva') || 0;

        const { totalTTC, totalOccasionTTC } = totauxLignes(allForfaits, allProduits, allServices, exonere);
        const montantTTC = Math.round((totalTTC + Number.EPSILON) * 100) / 100;
        const { montantTVA, montantHT } = calculerTvaVente(montantTTC, totalOccasionTTC, tva);

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

    const syncLineRemise = (changedLignes: Array<Partial<LigneUnifiee> | undefined>, exonere: boolean = venteExoneree()) => {
        const currentLines: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        changedLignes.forEach((changed, index) => {
            if (!changed) return;
            const line = currentLines[index];
            if (!line || (!line.libre && (!line.type || !line.itemId))) return;
            const pu = prixUnitaireLigne(line, exonere) || 0;
            const quantite = quantiteLigne(line.quantite);
            const brut = Math.round(pu * quantite * 100) / 100;
            if (changed.remisePourcentage !== undefined) {
                const remise = Math.round(((brut * (changed.remisePourcentage || 0)) / 100 + Number.EPSILON) * 100) / 100;
                form.setFieldValue(['lignes', index, 'remise'], remise);
            } else if (changed.remise !== undefined) {
                const remisePourcentage = brut > 0
                    ? Math.round((((changed.remise || 0) / brut) * 100 + Number.EPSILON) * 100) / 100
                    : 0;
                form.setFieldValue(['lignes', index, 'remisePourcentage'], remisePourcentage);
            }
        });
    };

    // Un professionnel de la mer est exonéré de TVA : au changement de client, le taux de la vente et le prix
    // des lignes (HT ou TTC) suivent le client choisi, les remises en % étant conservées
    const appliquerTvaClient = (client?: ClientEntity) => {
        const exonere = clientExonereTva(client);
        const tva = form.getFieldValue('tva') || 0;
        const changement = exonere ? tva !== 0 : tva === 0;
        if (!changement && !exonere) return;
        if (!exonere) form.setFieldValue('tva', TVA_VENTE_DEFAUT);
        if (changement) {
            const lignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
            syncLineRemise(lignes.map((line) => (line?.remisePourcentage ? { remisePourcentage: line.remisePourcentage } : undefined)), exonere);
        }
        recalculateFromLines(changement ? 'percentage' : 'auto', { exonere });
    };

    // Un package n'est pas une ligne de vente : la ligne où il est choisi est remplacée par les articles qu'il regroupe
    const deplierPackage = (lineIndex: number, packageId: number) => {
        const pack = packages.find((p) => p.id === packageId);
        const articles = articlesDuPackage(pack);
        if (!pack || articles.length === 0) {
            message.info('Ce package ne contient aucun article.');
            return;
        }
        const currentLignes: LigneUnifiee[] = form.getFieldValue('lignes') || [];
        // Comme à la saisie d'une ligne, un forfait du package est à planifier
        const lignesPackage: LigneUnifiee[] = articles.map(({ type, article, quantite }) => (
            type === 'forfait' ? { type, itemId: article.id, quantite, status: 'EN_ATTENTE' } : { type, itemId: article.id, quantite }
        ));
        const updated = [...currentLignes.slice(0, lineIndex), ...lignesPackage, ...currentLignes.slice(lineIndex + 1)];
        const lastLine = updated[updated.length - 1];
        if (lastLine?.type && lastLine?.itemId && (lastLine?.quantite || 0) > 0) {
            updated.push({ quantite: 1 });
        }
        form.setFieldValue('lignes', updated);
        setFormDirty(true);
        recalculateFromLines('auto');
        message.success(`Package « ${pack.designation} » ajouté à la vente`);
    };

    const onValuesChange = (changedValues: Partial<VenteFormValues>, allValues: VenteFormValues) => {
        if (!suppressDirtyRef.current) {
            setFormDirty(true);
        }
        if (deplacementLigneRef.current) {
            return;
        }
        if ('clientId' in changedValues) {
            appliquerTvaClient(clients.find((client) => client.id === changedValues.clientId));
            return;
        }
        if (changedValues.lignes !== undefined) {
            const changedLignesArr = changedValues.lignes as Array<Partial<LigneUnifiee> | undefined>;
            const lineRemiseChanged = changedLignesArr.some((l) => l && (l.remise !== undefined || l.remisePourcentage !== undefined));
            if (lineRemiseChanged) {
                syncLineRemise(changedLignesArr);
            }
            const currentLignes = allValues.lignes || [];
            if (currentLignes.length === 0) {
                form.setFieldValue('lignes', [{ quantite: 1 }]);
            } else {
                const lastLine = currentLignes[currentLignes.length - 1];
                const isLastLineComplete = ((!!lastLine?.type && !!lastLine?.itemId) || !!lastLine?.libre) && (lastLine?.quantite || 0) > 0;
                if (isLastLineComplete) {
                    form.setFieldValue('lignes', [...currentLignes, { quantite: 1 }]);
                }
            }
            if (lineRemiseChanged) {
                recalculateFromLines('auto');
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

        // HT, taux ou montant de TVA modifié : le HT est conservé, le TTC en découle (la remise en EUR est conservée)
        const appliquerMontantTTC = (montantTTC: number) => {
            const remise = allValues.remise || 0;
            const remisePourcentage = montantTTC > 0
                ? Math.round((((remise / montantTTC) * 100) + Number.EPSILON) * 100) / 100
                : 0;
            const prixVenteTTC = Math.round(((montantTTC - remise) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTTC', montantTTC);
            form.setFieldValue('remisePourcentage', remisePourcentage);
            form.setFieldValue('prixVenteTTC', prixVenteTTC);
        };

        if (changedValues.montantHT !== undefined || changedValues.tva !== undefined) {
            const { montantTVA, montantTTC } = calculerTvaVenteDepuisHT(allValues.montantHT || 0, totauxLignes().totalOccasionTTC, allValues.tva || 0);
            form.setFieldValue('montantTVA', montantTVA);
            appliquerMontantTTC(montantTTC);
            return;
        }

        if (changedValues.montantTVA !== undefined) {
            const montantHT = allValues.montantHT || 0;
            const montantTVA = changedValues.montantTVA || 0;
            const tva = tauxTvaVente(montantHT, totauxLignes().totalOccasionTTC, montantTVA);
            if (tva !== undefined) form.setFieldValue('tva', tva);
            appliquerMontantTTC(Math.round(((montantHT + montantTVA) + Number.EPSILON) * 100) / 100);
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

        if (changedValues.lignes !== undefined) {
            recalculateFromLines('auto');
        }
    };

    const columns = [
        {
            title: 'Référence',
            dataIndex: 'id',
            sorter: (a: VenteEntity, b: VenteEntity) => (a.id || 0) - (b.id || 0),
            render: (_value: number, record: VenteEntity) => referenceTransaction(record)
        },
        {
            title: 'Date',
            dataIndex: 'date',
            sorter: comparerDatesVentes,
            defaultSortOrder: 'descend' as const,
            render: (value: string) => formatDatePrint(value)
        },
        {
            title: 'Origine',
            dataIndex: 'comptoir',
            sorter: (a: VenteEntity, b: VenteEntity) => (a.comptoir === b.comptoir ? 0 : a.comptoir ? 1 : -1),
            filters: [
                { text: 'Comptoir', value: true },
                { text: 'Prestation', value: false }
            ],
            onFilter: (value: unknown, record: VenteEntity) => !!record.comptoir === value,
            render: (value: boolean) => <Tag color={value ? 'purple' : 'geekblue'}>{value ? 'Comptoir' : 'Prestation'}</Tag>
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            sorter: (a: VenteEntity, b: VenteEntity) => (a.status || '').localeCompare(b.status || ''),
            filters: [
                ...statusOptions.map(opt => ({ text: opt.label, value: opt.value })),
                { text: 'Bon pour accord', value: 'BPA' },
                { text: 'Refusé', value: 'REFUSE' }
            ],
            onFilter: (value: unknown, record: VenteEntity) => {
                if (value === 'BPA') return record.status === 'DEVIS' && !!record.bonPourAccord;
                if (value === 'REFUSE') return record.status === 'DEVIS' && !!record.dateRefus;
                return record.status === value;
            },
            render: (value: VenteStatus, record: VenteEntity) => {
                if (value === 'DEVIS' && record.dateRefus) {
                    return <Tooltip title={record.motifRefus ? `Motif : ${record.motifRefus}` : undefined}><Tag color="red">Refusé</Tag></Tooltip>;
                }
                const label = value === 'DEVIS' && record.bonPourAccord
                    ? 'Bon pour accord'
                    : statusOptions.find((item) => item.value === value)?.label || value;
                const color = value === 'DEVIS' && record.bonPourAccord ? 'cyan' : statusColor[value] || 'default';
                const tag = <Tag color={color}>{label}</Tag>;
                if (value !== 'FACTURE_EN_ATTENTE') {
                    return tag;
                }
                return <PopoverProgressionVente vente={record}>{tag}</PopoverProgressionVente>;
            }
        },
        {
            title: 'Retrait',
            key: 'pretRecuperation',
            filters: [{ text: 'Prêt à récupérer', value: 'pret' }],
            onFilter: (_value: unknown, record: VenteEntity) => !!record.datePretRecuperation,
            render: (_: unknown, record: VenteEntity) => (
                <PretRecuperationTag datePret={record.datePretRecuperation} basePath="/ventes" id={record.id} onChange={fetchVentes} />
            )
        },
        {
            title: 'Client',
            dataIndex: 'client',
            sorter: (a: VenteEntity, b: VenteEntity) => getClientLabel(a.client).localeCompare(getClientLabel(b.client)),
            filterSearch: true,
            filters: Array.from(
                new Map(
                    ventes
                        .filter(v => v.client?.id !== undefined)
                        .map(v => [v.client!.id, { text: getClientLabel(v.client), value: v.client!.id! }])
                ).values()
            ).sort((a, b) => (a.text as string).localeCompare(b.text as string)),
            onFilter: (value: unknown, record: VenteEntity) => record.client?.id === value,
            render: (value: ClientEntity) => getClientLabel(value)
        },
        {
            title: 'Relance',
            key: 'relance',
            filters: [
                { text: 'Relance 3 envoyée', value: 3 },
                { text: 'Relance 2 envoyée', value: 2 },
                { text: 'Relance 1 envoyée', value: 1 },
                { text: 'Aucune relance', value: 0 }
            ],
            onFilter: (value: unknown, record: VenteEntity) => (record.niveauRelance || 0) === value,
            render: (_: unknown, record: VenteEntity) => {
                const niveau = record.niveauRelance || 0;
                if (niveau > 0) {
                    return <Tag color={RELANCE_COULEURS[niveau]}>Relance {niveau} envoyée</Tag>;
                }
                const niveauDevis = record.status === 'DEVIS' ? record.niveauRelanceDevis || 0 : 0;
                return niveauDevis > 0 ? <Tag color={RELANCE_COULEURS[niveauDevis]}>Devis relancé ({niveauDevis})</Tag> : null;
            }
        },
        {
            title: 'Montant TTC',
            dataIndex: 'prixVenteTTC',
            align: 'right' as const,
            sorter: (a: VenteEntity, b: VenteEntity) => (a.prixVenteTTC || 0) - (b.prixVenteTTC || 0),
            render: (value: number) => formatEuro(value)
        },
        {
            title: 'Solde dû',
            key: 'soldeDu',
            align: 'right' as const,
            sorter: (a: VenteEntity, b: VenteEntity) => getSoldeDu(a) - getSoldeDu(b),
            render: (_: unknown, record: VenteEntity) => {
                if (record.status === 'DEVIS' || record.status === 'FACTURE_EN_ATTENTE') return '-';
                const solde = getSoldeDu(record);
                return <span style={{ color: solde > 0.005 ? '#cf1322' : '#52c41a', fontWeight: 500 }}>{formatEuro(solde)}</span>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: VenteEntity) => (
                <Space>
                    <Button title="Imprimer" icon={<PrinterOutlined />} onClick={() => handlePrint(record)} />
                    {(record.status === 'FACTURE_PRETE' || record.status === 'FACTURE_PAYEE') && (
                        <Button title="Télécharger Factur-X (PDF/A-3 + XML)" icon={<DownloadOutlined />} onClick={() => handleDownloadFacturX(record)} />
                    )}
                    <Button title="Envoyer par email" icon={<MailOutlined />} onClick={() => handleEmail(record)} />
                    <Dropdown menu={{ items: paymentMenuItems(record) }} placement="bottomRight" disabled={record.status !== 'FACTURE_PRETE'}>
                        <Button title="Lien de paiement" icon={<CreditCardOutlined />} disabled={record.status !== 'FACTURE_PRETE'} />
                    </Dropdown>
                    <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                    {(record.status === 'FACTURE_PRETE' || record.status === 'FACTURE_PAYEE') && (
                        <Button
                            title="Générer un avoir"
                            icon={<RollbackOutlined />}
                            onClick={() => openGenerateAvoir(record)}
                        />
                    )}
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
        <Card title="Transactions/Prestations">
            <Space style={{ marginBottom: 16 }}>
                <SearchAutoComplete
                    style={{ width: 600 }}
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSearch={setSearchQuery}
                    source={ventes.map((v) => v.client?.nom)}
                />
                <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={fetchVentes} />
                <Button
                    icon={<WalletOutlined />}
                    onClick={() => {
                        setRgClientId(null);
                        setRgSelectedIds([]);
                        setRgMode('CHEQUE');
                        setRgMontant(0);
                        setRgNotes('');
                        setRgDate(dayjs());
                        setReglementGroupeVisible(true);
                    }}
                >
                    Règlement groupé
                </Button>
            </Space>

            <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                <Col span={24}>
                    <Table
                        rowKey="id"
                        dataSource={filteredVentes}
                        columns={columns}
                        loading={loading}
                        pagination={paginationConfig()}
                        bordered
                        onRow={(record) => ({
                            onClick: (e) => {
                                if ((e.target as HTMLElement).closest('button, .ant-btn, [role="button"]')) return;
                                openModal(record);
                            },
                            style: { cursor: 'pointer' },
                        })}
                    />
                </Col>
            </Row>

            <SuspensionRelancesModal
                open={suspensionRelancesVisible}
                venteId={currentVente?.id}
                numero={currentVente?.numeroFacture || (currentVente?.id ? `#${currentVente.id}` : undefined)}
                client={currentVente?.client ? { id: currentVente.client.id, nom: currentVente.client.nom } : undefined}
                onClose={() => setSuspensionRelancesVisible(false)}
                onSuspendu={() => {
                    setSuspensionRelancesVisible(false);
                    if (currentVente?.id) refreshCurrentVente(currentVente.id);
                }}
            />

            <Modal
                title="Devis refusé par le client"
                open={refusVisible}
                onOk={handleRefus}
                okText="Marquer comme refusé"
                okButtonProps={{ danger: true }}
                cancelText="Annuler"
                onCancel={() => setRefusVisible(false)}
                destroyOnHidden
            >
                <p>
                    Le devis sort du pipeline commercial et n'est plus relancé. Il reste consultable et peut être repris
                    si le client change d'avis.
                </p>
                <Form layout="vertical">
                    <Form.Item label="Motif du refus" htmlFor="motif-refus">
                        <AutoComplete
                            id="motif-refus"
                            value={motifRefus}
                            onChange={setMotifRefus}
                            options={MOTIFS_REFUS.map((motif) => ({ value: motif }))}
                            placeholder="Prix, délai, concurrent… (facultatif)"
                            allowClear
                        />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Transaction/Prestation"
                open={modalVisible}
                onCancel={handleModalCancel}
                footer={[
                    <div key="steps" style={{ textAlign: 'left', marginBottom: 12 }}>
                        <Steps
                            current={venteStepIndex(watchedStatus || 'DEVIS', watchedBonPourAccord)}
                            size="small"
                            items={venteStepItems(currentVente)}
                            onChange={isReadOnly ? undefined : (step) => goToStep(step)}
                        />
                    </div>,
                    <Button
                        key="print"
                        icon={<PrinterOutlined />}
                        disabled={!currentVente}
                        onClick={() => currentVente && handlePrint(currentVente)}
                    >
                        Imprimer
                    </Button>,
                    ...(watchedStatus === 'FACTURE_PRETE' || watchedStatus === 'FACTURE_PAYEE' ? [
                        <Button
                            key="facturx"
                            icon={<DownloadOutlined />}
                            disabled={!currentVente}
                            onClick={() => currentVente && handleDownloadFacturX(currentVente)}
                        >
                            Factur-X
                        </Button>
                    ] : []),
                    <Button
                        key="email"
                        icon={<MailOutlined />}
                        disabled={!currentVente}
                        onClick={() => currentVente && handleEmail(currentVente)}
                    >
                        Envoyer par email
                    </Button>,
                    ...(devisEnAttente ? [
                        <Button key="refus" danger icon={<StopOutlined />} onClick={() => setRefusVisible(true)}>
                            Refusé par le client
                        </Button>
                    ] : []),
                    ...(watchedStatus === 'FACTURE_PRETE' || watchedStatus === 'FACTURE_PAYEE' ? [
                        <Dropdown
                            key="payment"
                            menu={{ items: currentVente ? paymentMenuItems(currentVente) : [] }}
                            placement="topRight"
                        >
                            <Button icon={<CreditCardOutlined />}>
                                Lien de paiement
                            </Button>
                        </Dropdown>,
                        <Button
                            key="genAvoir"
                            icon={<RollbackOutlined />}
                            disabled={!currentVente}
                            onClick={() => {
                                if (!currentVente) return;
                                openGenerateAvoir(currentVente);
                            }}
                        >
                            Générer un avoir
                        </Button>,
                    ] : []),
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
                width="80vw"
            >
                <Form form={form} layout="vertical" initialValues={defaultVente} onValuesChange={onValuesChange} disabled={isReadOnly}>
                    <Form.Item noStyle name="status"><input type="hidden" /></Form.Item>
                    <Form.Item noStyle name="bonPourAccord"><input type="hidden" /></Form.Item>
                    <Form.Item noStyle name="signatureBonPourAccord"><input type="hidden" /></Form.Item>
                    {currentVente?.id && (linkedCommandesByVente.get(currentVente.id) || []).length > 0 && (
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message={
                                <Space wrap align="center">
                                    <strong>Commandes fournisseur associées :</strong>
                                    {(linkedCommandesByVente.get(currentVente.id) || []).map((cf) => (
                                        <Tag
                                            key={cf.id}
                                            color="purple"
                                            icon={<ShoppingCartOutlined />}
                                            style={{ cursor: 'pointer' }}
                                            title={`Voir la commande fournisseur ${cf.reference}`}
                                            onClick={() => navigate('/commandes-fournisseur')}
                                        >
                                            {cf.reference} — {cf.fournisseur?.nom || 'Fournisseur'} ({cf.status})
                                        </Tag>
                                    ))}
                                </Space>
                            }
                            action={
                                <Button
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => handleOpenCommandeFournisseur(currentVente)}
                                >
                                    Commander
                                </Button>
                            }
                        />
                    )}
                    <Steps
                        current={venteStepIndex(
                            watchedStatus || 'DEVIS',
                            watchedBonPourAccord
                        )}
                        size="small"
                        style={{ marginBottom: watchedStatus === 'FACTURE_EN_ATTENTE' ? 8 : 24 }}
                        items={venteStepItems(currentVente)}
                        onChange={isReadOnly ? undefined : (step) => goToStep(step)}
                    />
                    {watchedStatus === 'FACTURE_EN_ATTENTE' && (
                        <div style={{ marginBottom: 16 }}>
                            <ProgressionVente vente={currentVente} />
                        </div>
                    )}
                    {currentVente?.dateRefus && currentVente.status === 'DEVIS' && (
                        <Alert
                            type="error"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message={`Refusé par le client le ${dayjs(currentVente.dateRefus).format('DD/MM/YYYY')}`
                                + (currentVente.motifRefus ? ` — motif : ${currentVente.motifRefus}` : '')}
                            description="Ce devis ne fait plus partie du pipeline commercial et n'est plus relancé. La signature du bon pour accord le reprend."
                            action={<Button size="small" onClick={handleReprendre}>Reprendre le devis</Button>}
                        />
                    )}
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item label="Référence" htmlFor="vente-reference">
                                <Input
                                    id="vente-reference"
                                    readOnly
                                    variant="filled"
                                    value={currentVente?.id ? referenceTransaction(currentVente) : undefined}
                                    placeholder="Attribuée à l'enregistrement"
                                />
                            </Form.Item>
                        </Col>
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
                        {/* modePaiement géré dans la section Paiements sous les montants */}
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Client" required>
                                <Space.Compact style={{ width: '100%' }}>
                                    <Form.Item name="clientId" noStyle rules={[{ required: true, message: 'Le client est obligatoire' }]}>
                                        <Select
                                            allowClear
                                            showSearch
                                            options={clientOptions}
                                            style={{ width: '100%' }}
                                            onChange={handleClientChange}
                                            filterOption={(input, option) =>
                                                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                            placeholder="Rechercher un client par prénom ou nom"
                                        />
                                    </Form.Item>
                                    <Button icon={<PlusOutlined />} title="Créer un client" onClick={openNewClientModal} />
                                </Space.Compact>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Bateau">
                                <Space.Compact style={{ width: '100%' }}>
                                    <Form.Item name="bateauId" noStyle>
                                        <Select allowClear showSearch options={bateauOptionsClient} style={{ width: '100%' }} />
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
                                label: 'Produits & Paiements',
                                children: (
                                    <>
                                    <Form.List name="lignes">
                                        {(fields, { remove, move }) => (
                                            <>
                                                <ListeTriable
                                                    fields={fields}
                                                    move={(from, to) => deplacerLigne(move, from, to)}
                                                    triable={(field) => field.name < fields.length - 1 || !estLigneVide(form.getFieldValue(['lignes', field.name]))}
                                                    disabled={isReadOnly}
                                                >
                                                {fields.map((field) => {
                                                    const ligne: LigneUnifiee = form.getFieldValue(['lignes', field.name]) || {};
                                                    const lineType = ligne.type;
                                                    const itemId = ligne.itemId;
                                                    const libre = ligne.libre;
                                                    const isEmptyLine = !libre && (!lineType || !itemId);
                                                    const isForfaitOrService = lineType === 'forfait' || lineType === 'service';

                                                    const getUnitPrice = () => (lineType && itemId ? prixUnitaireLigne(ligne, exonereTva) : undefined);

                                                    const prod = lineType === 'produit' && itemId
                                                        ? produits.find((p) => p.id === itemId)
                                                        : undefined;
                                                    const emplacements = [
                                                        ...(prod?.emplacement ? [{ key: 'atelier', icon: <EnvironmentOutlined />, label: `Atelier : ${prod.emplacement}` }] : []),
                                                        ...(prod?.emplacementMagasin ? [{ key: 'magasin', icon: <EnvironmentOutlined />, label: `Magasin : ${prod.emplacementMagasin}` }] : []),
                                                    ];
                                                    // Actions secondaires regroupées dans un menu, pour que la ligne tienne dans la modal
                                                    const actionsLigne: MenuProps['items'] = isEmptyLine ? [] : [
                                                        ...(lineType === 'service' && itemId ? [{ key: 'modifier', icon: <EditOutlined />, label: 'Modifier le service', onClick: () => openEditServiceModal(itemId) }] : []),
                                                        ...(isForfaitOrService ? [{ key: 'planifier', icon: <CalendarOutlined />, label: 'Planifier', onClick: () => { setModalVisible(false); navigate('/planning'); } }] : []),
                                                        // Case liée au champ de la ligne : son état reste juste à chaque ouverture du menu
                                                        ...(isForfaitOrService ? [{
                                                            key: 'sav',
                                                            title: "Intervention SAV ou garantie : son temps est compté au SAV, pas dans les heures facturées (KPIs atelier)",
                                                            label: (
                                                                <Form.Item name={[field.name, 'sav']} valuePropName="checked" noStyle>
                                                                    <Checkbox>SAV / garantie</Checkbox>
                                                                </Form.Item>
                                                            ),
                                                        }] : []),
                                                        ...(emplacements.length > 0 ? [{ key: 'emplacements', type: 'group' as const, label: 'Emplacements', children: emplacements }] : []),
                                                    ];

                                                    // Entêtes affichées une seule fois, au-dessus de la première ligne
                                                    const premiereLigne = field.name === 0;
                                                    const decalageEntete = premiereLigne ? 30 : 0;
                                                    return (
                                                    <LigneTriable key={field.key} field={field}>
                                                    <div className="ligne-vente" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                        <PoigneeLigne style={{ marginTop: decalageEntete }} />
                                                        <Form.Item
                                                            name={[field.name, 'type']}
                                                            hidden
                                                        >
                                                            <Input />
                                                        </Form.Item>
                                                        <Form.Item
                                                            name={[field.name, 'itemId']}
                                                            hidden
                                                        >
                                                            <InputNumber />
                                                        </Form.Item>
                                                        {libre && (
                                                            <Form.Item
                                                                name={[field.name, 'libre', 'ref']}
                                                                rules={[{
                                                                    validator: async (_, value) => {
                                                                        const erreur = erreurRefLibre(value, produits, autresLignesLibres(field.name));
                                                                        if (erreur) throw new Error(erreur);
                                                                    }
                                                                }]}
                                                                label={premiereLigne ? "Réf." : undefined}
                                                            style={{ width: 130, flex: 'none', marginBottom: 8 }}
                                                            >
                                                                <Input autoFocus placeholder="Réf." title="Référence (générée si vide)" />
                                                            </Form.Item>
                                                        )}
                                                        {libre && (
                                                            <Form.Item
                                                                name={[field.name, 'libre', 'designation']}
                                                                rules={[{
                                                                    validator: async (_, value) => {
                                                                        const erreur = erreurDesignationLibre(value);
                                                                        if (erreur) throw new Error(erreur);
                                                                    }
                                                                }]}
                                                                label={premiereLigne ? "Désignation" : undefined}
                                                            style={{ flex: '1 1 0', minWidth: 160, marginBottom: 8 }}
                                                            >
                                                                <Input placeholder="Désignation" />
                                                            </Form.Item>
                                                        )}
                                                        {libre && <Form.Item name={[field.name, 'libre', 'tva']} hidden><InputNumber /></Form.Item>}
                                                        {!libre && (
                                                        <Form.Item label={premiereLigne ? "Référence" : undefined} style={{ width: 130, flex: 'none', marginBottom: 8 }}>
                                                            {lineType === 'service' ? (
                                                                <Input disabled />
                                                            ) : (
                                                                <Select
                                                                    allowClear
                                                                    showSearch
                                                                    value={toLigneCompositeValue(lineType, itemId) ?? null}
                                                                    options={ligneUnifieeOptions}
                                                                    optionLabelProp="ref"
                                                                    placeholder="Réf."
                                                                    onSearch={handleProduitSearch}
                                                                    filterOption={(input, option) =>
                                                                        ((option as { ref?: string } | undefined)?.ref || '').toLowerCase().includes(input.toLowerCase())
                                                                    }
                                                                    onChange={(compositeValue: string) => changerLigne(field.name, compositeValue)}
                                                                />
                                                            )}
                                                        </Form.Item>
                                                        )}
                                                        {!libre && (
                                                        <Form.Item label={premiereLigne ? "Désignation" : undefined} style={{ flex: '1 1 0', minWidth: 160, marginBottom: 8 }}>
                                                            {lineType === 'service' ? (
                                                                <Input disabled value={services.find((s) => s.id === itemId)?.nom || ''} placeholder="Service" />
                                                            ) : (
                                                                <Select
                                                                    allowClear
                                                                    showSearch
                                                                    // null plutôt qu'undefined : sinon le sélecteur garde affiché un package sans article
                                                                    value={toLigneCompositeValue(lineType, itemId) ?? null}
                                                                    options={ligneUnifieeOptions}
                                                                    optionLabelProp="designation"
                                                                    placeholder="Package, forfait, produit, bateau, moteur..."
                                                                    onSearch={handleProduitSearch}
                                                                    filterOption={(input, option) =>
                                                                        ((option as { searchText?: string } | undefined)?.searchText || '').includes(input.toLowerCase())
                                                                    }
                                                                    onChange={(compositeValue: string) => changerLigne(field.name, compositeValue)}
                                                                />
                                                            )}
                                                        </Form.Item>
                                                        )}
                                                        {libre ? (
                                                            <Form.Item
                                                                name={[field.name, 'libre', 'prixVenteTTC']}
                                                                rules={[{ required: true, message: 'Prix requis' }]}
                                                                label={premiereLigne ? "PU TTC €" : undefined}
                                                            style={{ width: 95, flex: 'none', marginBottom: 8 }}
                                                            >
                                                                <InputNumber min={0} style={{ width: '100%' }} placeholder="P.U." title="Prix unitaire TTC" />
                                                            </Form.Item>
                                                        ) : (
                                                        <Form.Item noStyle shouldUpdate>
                                                            {() => {
                                                                const pu = getUnitPrice();
                                                                return (
                                                                    <Form.Item label={premiereLigne ? (exonereTva ? "PU HT €" : "PU TTC €") : undefined} style={{ width: 95, flex: 'none', marginBottom: 8 }}>
                                                                        <InputNumber value={pu ?? undefined} style={{ width: '100%' }} disabled placeholder="P.U." />
                                                                    </Form.Item>
                                                                );
                                                            }}
                                                        </Form.Item>
                                                        )}
                                                        <Form.Item
                                                            name={[field.name, 'quantite']}
                                                            rules={[
                                                                {
                                                                    validator: async (_, value) => {
                                                                        const line: LigneUnifiee = form.getFieldValue(['lignes', field.name]);
                                                                        if (estLigneVide(line) && (value === undefined || value === null)) {
                                                                            return;
                                                                        }
                                                                        if (!value || value <= 0) {
                                                                            throw new Error('Quantite requise');
                                                                        }
                                                                    }
                                                                }
                                                            ]}
                                                            label={premiereLigne ? "Quantité" : undefined}
                                                            style={{ width: 70, flex: 'none', marginBottom: 8 }}
                                                        >
                                                            <InputQuantite style={{ width: '100%' }} placeholder="Qte" />
                                                        </Form.Item>
                                                        <Form.Item
                                                            name={[field.name, 'remisePourcentage']}
                                                            label={premiereLigne ? "Remise %" : undefined}
                                                            style={{ width: 85, flex: 'none', marginBottom: 8 }}
                                                        >
                                                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} placeholder="Rem." />
                                                        </Form.Item>
                                                        <Form.Item
                                                            name={[field.name, 'remise']}
                                                            label={premiereLigne ? "Remise €" : undefined}
                                                            style={{ width: 100, flex: 'none', marginBottom: 8 }}
                                                        >
                                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="Rem." />
                                                        </Form.Item>
                                                        <Form.Item noStyle shouldUpdate>
                                                            {() => {
                                                                // Le prix d'une ligne libre se lit à chaque saisie : la liste ne se redessine pas pour autant
                                                                const pu = (libre ? prixArticleVente(form.getFieldValue(['lignes', field.name, 'libre']), exonereTva) : getUnitPrice()) || 0;
                                                                const quantite = form.getFieldValue(['lignes', field.name, 'quantite']) || 0;
                                                                const remise = form.getFieldValue(['lignes', field.name, 'remise']) || 0;
                                                                const brut = pu * quantite;
                                                                const total = Math.max(0, Math.round(((brut - remise) + Number.EPSILON) * 100) / 100);
                                                                return (
                                                                    <Form.Item label={premiereLigne ? "Total €" : undefined} style={{ width: 100, flex: 'none', marginBottom: 8 }}>
                                                                        <InputNumber value={total} style={{ width: '100%' }} disabled />
                                                                    </Form.Item>
                                                                );
                                                            }}
                                                        </Form.Item>
                                                        <Form.Item noStyle shouldUpdate>
                                                            {() => {
                                                                const quantite = form.getFieldValue(['lignes', field.name, 'quantite']) || 0;
                                                                let stock: number | undefined;
                                                                let stockMini = 0;
                                                                if (lineType === 'produit') {
                                                                    const produit = produits.find((p) => p.id === itemId);
                                                                    if (!produit) return <Form.Item label={premiereLigne ? "Stock" : undefined} style={{ width: 50, flex: 'none', marginBottom: 8 }} />;
                                                                    stock = produit.stock ?? 0;
                                                                    stockMini = produit.stockMini ?? 0;
                                                                } else if (lineType === 'bateau') {
                                                                    const item = catalogueBateaux.find((b) => b.id === itemId);
                                                                    if (!item) return <Form.Item label={premiereLigne ? "Stock" : undefined} style={{ width: 50, flex: 'none', marginBottom: 8 }} />;
                                                                    stock = item.stock ?? 0;
                                                                } else if (lineType === 'moteur') {
                                                                    const item = catalogueMoteurs.find((m) => m.id === itemId);
                                                                    if (!item) return <Form.Item label={premiereLigne ? "Stock" : undefined} style={{ width: 50, flex: 'none', marginBottom: 8 }} />;
                                                                    stock = item.stock ?? 0;
                                                                } else if (lineType === 'helice') {
                                                                    const item = catalogueHelices.find((h) => h.id === itemId);
                                                                    if (!item) return <Form.Item label={premiereLigne ? "Stock" : undefined} style={{ width: 50, flex: 'none', marginBottom: 8 }} />;
                                                                    stock = item.stock ?? 0;
                                                                } else if (lineType === 'remorque') {
                                                                    const item = catalogueRemorques.find((r) => r.id === itemId);
                                                                    if (!item) return <Form.Item label={premiereLigne ? "Stock" : undefined} style={{ width: 50, flex: 'none', marginBottom: 8 }} />;
                                                                    stock = item.stock ?? 0;
                                                                } else {
                                                                    return <Form.Item label={premiereLigne ? "Stock" : undefined} style={{ width: 50, flex: 'none', marginBottom: 8 }} />;
                                                                }
                                                                const color = stock === 0 ? 'red' : (stock < quantite || stock < stockMini) ? 'orange' : 'green';
                                                                return (
                                                            <Form.Item label={premiereLigne ? "Stock" : undefined} style={{ width: 50, flex: 'none', marginBottom: 8 }}>
                                                                <Tag color={color} style={{ marginRight: 0, minWidth: 40, textAlign: 'center', lineHeight: '30px', height: 32 }}>{stock}</Tag>
                                                            </Form.Item>
                                                        );
                                                            }}
                                                        </Form.Item>
                                                        {/* Zone d'actions de largeur fixe : les colonnes restent alignées d'une ligne à l'autre */}
                                                        <div style={{ width: 250, flex: 'none', marginTop: decalageEntete, display: 'flex', alignItems: 'center', gap: 6, minHeight: 32 }}>
                                                            {libre && (
                                                                <Tag color="cyan" style={{ marginRight: 0 }} title="Article créé au catalogue à l'enregistrement de la vente">
                                                                    Nouvel article
                                                                </Tag>
                                                            )}
                                                            {lineType && (
                                                                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.lignes?.[field.name]?.sav !== cur.lignes?.[field.name]?.sav}>
                                                                    {() => (isForfaitOrService && form.getFieldValue(['lignes', field.name, 'sav']) ? (
                                                                        <Tag color="volcano" style={{ marginRight: 0, paddingInline: 3 }} title={`${lineType === 'forfait' ? 'Forfait' : 'Service'} SAV / garantie`}>
                                                                            SAV
                                                                        </Tag>
                                                                    ) : (
                                                                        <Tag color={lineType === 'forfait' ? 'blue' : lineType === 'service' ? 'green' : lineType === 'produit' ? 'orange' : 'purple'} style={{ marginRight: 0 }}>
                                                                            {lineType === 'forfait' ? 'F' : lineType === 'service' ? 'S' : lineType === 'produit' ? 'P' : lineType === 'bateau' ? 'B' : lineType === 'moteur' ? 'M' : lineType === 'helice' ? 'H' : 'R'}
                                                                        </Tag>
                                                                    ))}
                                                                </Form.Item>
                                                            )}
                                                            {!isEmptyLine && !libre && (
                                                                <FicheCataloguePopover
                                                                    type={lineType}
                                                                    itemId={itemId}
                                                                    produits={produits}
                                                                    catalogueBateaux={catalogueBateaux}
                                                                    catalogueMoteurs={catalogueMoteurs}
                                                                    catalogueHelices={catalogueHelices}
                                                                    catalogueRemorques={catalogueRemorques}
                                                                    forfaits={forfaits}
                                                                    services={services}
                                                                    navigate={navigate}
                                                                    onProduitSaved={handleProduitSaved}
                                                                />
                                                            )}
                                                            {isForfaitOrService && (
                                                                <>
                                                                    <Form.Item name={[field.name, 'status']} noStyle>
                                                                        <Select allowClear options={planningStatusOptions} placeholder="Statut" aria-label="Statut" style={{ width: 115 }} />
                                                                    </Form.Item>
                                                                    {/* Techniciens non affichés : conservés pour ne pas perdre l'affectation faite au planning */}
                                                                    <Form.Item name={[field.name, 'technicienIds']} hidden><Select mode="multiple" /></Form.Item>
                                                                </>
                                                            )}
                                                            {isEmptyLine && (
                                                                <Button icon={<PlusOutlined />} title="Créer un produit" onClick={() => openNewProduitModal(field.name)} />
                                                            )}
                                                            {actionsLigne.length > 0 && (
                                                                <Dropdown menu={{ items: actionsLigne }} trigger={['click']}>
                                                                    <Button icon={<MoreOutlined />} title="Autres actions" />
                                                                </Dropdown>
                                                            )}
                                                            <Button style={{ marginLeft: 'auto' }} danger icon={<DeleteOutlined />} title="Supprimer la ligne" onClick={() => remove(field.name)} />
                                                        </div>
                                                    </div>
                                                    </LigneTriable>
                                                    );
                                                })}
                                                </ListeTriable>
                                                <Space style={{ marginTop: -12, marginBottom: 16, marginLeft: 16 }}>
                                                    <Button icon={<PlusOutlined />} onClick={() => openNewServiceModal(findOrCreateEmptyLineIndex())}>
                                                        Ajouter Service
                                                    </Button>
                                                    <Button
                                                        icon={<PlusOutlined />}
                                                        title="Saisir un article absent du catalogue : il y est créé à l'enregistrement de la vente"
                                                        onClick={ajouterLigneLibre}
                                                    >
                                                        Ajouter une ligne libre
                                                    </Button>
                                                    <Button icon={<PlusOutlined />} onClick={() => openNewForfaitModal(findOrCreateEmptyLineIndex())}>
                                                        Créer Forfait
                                                    </Button>
                                                </Space>
                                            </>
                                        )}
                                    </Form.List>

                                        <Form.Item noStyle name="montantTTC"><input type="hidden" /></Form.Item>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: 940, maxWidth: '100%' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <Form.Item name="note" label="Note" style={{ marginBottom: 0 }}>
                                                    <Input.TextArea rows={6} allowClear placeholder="Note libre (visible sur le devis et la facture)" />
                                                </Form.Item>
                                            </div>
                                            <div style={{ width: 280, flex: 'none' }}>
                                                <Form.Item name="montantHT" label={<strong>Montant HT (EUR)</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item name="remisePourcentage" label={<strong>Remise (%)</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item name="remise" label={<strong>Remise (EUR)</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item name="tva" label={<strong>TVA (%)</strong>} tooltip={exonereTva ? TOOLTIP_EXONERATION_TVA : undefined} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} disabled={isReadOnly || exonereTva} />
                                                </Form.Item>
                                                <Form.Item name="montantTVA" label={<strong>Montant TVA</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} disabled={isReadOnly || exonereTva} />
                                                </Form.Item>
                                                <Form.Item name="prixVenteTTC" label={<strong>Montant TTC</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item
                                                    label={<strong>Marge</strong>}
                                                    layout="horizontal"
                                                    labelCol={{ flex: '0 0 150px' }}
                                                    wrapperCol={{ flex: '0 0 130px' }}
                                                    labelAlign="right"
                                                    colon={false}
                                                    style={{ marginBottom: 8, width: 280 }}
                                                >
                                                    <Form.Item noStyle shouldUpdate>
                                                        {() => (
                                                            <Tooltip title={(
                                                                <div>
                                                                    <div>Marge HT, cliquer pour {margeVisible ? 'masquer' : 'afficher'}.</div>
                                                                    <div><strong>Produits :</strong> (prix de vente HT - prix d'achat HT moyen chez les fournisseurs) x quantité, remise de ligne déduite.</div>
                                                                    <div><strong>Services et forfaits :</strong> (durée estimée - durée réelle) x tarif horaire de la main d'œuvre, une fois la durée réelle saisie ; négatif en cas de dépassement.</div>
                                                                </div>
                                                            )}>
                                                            <div
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => setMargeVisible((v) => !v)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMargeVisible((v) => !v); }}
                                                                style={{ cursor: 'pointer', border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 11px', textAlign: 'right', background: 'rgba(0,0,0,0.04)', userSelect: 'none' }}
                                                            >
                                                                {margeVisible
                                                                    ? calculerMarge(form.getFieldValue('lignes') || [], produits, achatsProduits, services, forfaits).toFixed(2)
                                                                    : '••••'}
                                                            </div>
                                                            </Tooltip>
                                                        )}
                                                    </Form.Item>
                                                </Form.Item>
                                                <Form.Item
                                                    label={<strong>Solde dû</strong>}
                                                    layout="horizontal"
                                                    labelCol={{ flex: '0 0 150px' }}
                                                    wrapperCol={{ flex: '0 0 130px' }}
                                                    labelAlign="right"
                                                    colon={false}
                                                    style={{ marginBottom: 8, width: 280 }}
                                                >
                                                    <Form.Item noStyle shouldUpdate={(prev, cur) => prev.prixVenteTTC !== cur.prixVenteTTC}>
                                                        {() => {
                                                            const totalPaye = (currentVente?.paiements ?? []).reduce((sum, p) => sum + p.montant, 0);
                                                            const soldeDu = Math.max(0, Math.round(((form.getFieldValue('prixVenteTTC') || 0) - totalPaye) * 100) / 100);
                                                            return <InputNumber value={soldeDu} disabled step={0.01} style={{ width: '100%' }} />;
                                                        }}
                                                    </Form.Item>
                                                </Form.Item>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: 16 }}>
                                                            {isEdit && (
                                                                <>
                                                                    {(() => {
                                                                        const ps = currentVente?.paiements ?? [];
                                                                        const totalPaye = ps.reduce((s, p) => s + p.montant, 0);
                                                                        const totalFacture = currentVente?.prixVenteTTC ?? 0;
                                                                        const restant = Math.round((totalFacture - totalPaye) * 100) / 100;
                                                                        const modeLabels: Record<string, string> = { CHEQUE: 'Chèque', VIREMENT: 'Virement', CARTE: 'Carte', 'ESPÈCES': 'Espèces', AVOIR: 'Avoir' };
                                                                        return (
                                                                            <>
                                                                                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                                                                                    <Col>
                                                                                        <Space>
                                                                                            <span>Total TTC : <strong>{formatEuro(totalFacture)}</strong></span>
                                                                                            <span>Total payé : <strong style={{ color: totalPaye >= totalFacture - 0.005 ? '#52c41a' : '#faad14' }}>{formatEuro(totalPaye)}</strong></span>
                                                                                            {restant > 0.005 && <span>Solde dû : <strong style={{ color: '#ff4d4f' }}>{formatEuro(restant)}</strong></span>}
                                                                                        </Space>
                                                                                    </Col>
                                                                                    <Col>
                                                                                        <Button
                                                                                            type="primary"
                                                                                            icon={<PlusCircleOutlined />}
                                                                                            onClick={() => openPaiementModal()}
                                                                                            disabled={watchedStatus === 'FACTURE_PAYEE'}
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
                                                                                        { title: 'Date', dataIndex: 'date', width: 190, render: (v: string | undefined, r: VentePaiement) => (
                    <Space>
                    <span>{formatDate(v)}</span>
                    <Button size="small" type="text" icon={<EditOutlined />} title="Modifier la date" disabled={watchedStatus === 'FACTURE_PAYEE'} onClick={() => r.id && setEditPaiement({ id: r.id, date: r.date ? dayjs(r.date) : dayjs() })} />
                    </Space>
                    ) },
                                                                                        { title: 'Mode', dataIndex: 'mode', width: 110, render: (v: string) => modeLabels[v] ?? v },
                                                                                        {
                                                                                            title: 'Avoir',
                                                                                            key: 'avoir',
                                                                                            render: (_: unknown, r: VentePaiement) =>
                                                                                                r.avoirId ? `#${r.avoirId} — ${r.avoirMotif ?? ''}` : '-',
                                                                                        },
                                                                                        { title: 'Montant', dataIndex: 'montant', width: 120, align: 'right' as const, render: (v: number) => formatEuro(v) },
                                                                                        { title: 'Notes', dataIndex: 'notes', render: (v: string) => v ?? '-' },
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
                                                                                                    disabled={watchedStatus === 'FACTURE_PAYEE'}
                                                                                                >
                                                                                                    <Button
                                                                                                        size="small"
                                                                                                        danger
                                                                                                        icon={<DeleteOutlined />}
                                                                                                        disabled={watchedStatus === 'FACTURE_PAYEE'}
                                                                                                    />
                                                                                                </Popconfirm>
                                                                                            ),
                                                                                        },
                                                                                    ]}
                                                                                />
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </>
                                                            )}
                                                            {!isEdit && (
                                                                <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                                                                    <Col style={{ color: '#8c8c8c' }}>
                                                                        Aucun paiement enregistré. Un acompte peut être saisi dès maintenant : la transaction sera enregistrée au préalable.
                                                                    </Col>
                                                                    <Col>
                                                                        <Button type="primary" icon={<PlusCircleOutlined />} onClick={ajouterPaiementNouvelleVente}>
                                                                            Ajouter un paiement
                                                                        </Button>
                                                                    </Col>
                                                                </Row>
                                                            )}
                                        </div>

                                        <Row gutter={16}>
                                            <Col span={6}>
                                                <Form.Item name="dateEcheance" label="Date d'échéance">
                                                    <DatePicker style={{ width: '100%' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={18}>
                                                {(() => {
                                                    // Une facture émise garde ses conditions ; sinon ce sont celles du paramétrage global
                                                    const factureEmise = currentVente?.status === 'FACTURE_PRETE' || currentVente?.status === 'FACTURE_PAYEE';
                                                    const conditions = factureEmise ? currentVente : conditionsSociete;
                                                    return (
                                                        <>
                                                            <Descriptions
                                                                size="small"
                                                                column={1}
                                                                items={[
                                                                    { key: 'conditions', label: 'Conditions de paiement', children: conditions?.conditionsPaiement || '—' },
                                                                    { key: 'penalites', label: 'Pénalités de retard', children: conditions?.penalitesRetard || '—' },
                                                                    { key: 'indemnite', label: 'Indemnité forfaitaire de recouvrement', children: formatEuro(conditions?.indemniteForfaitaire ?? 40) },
                                                                ]}
                                                            />
                                                            <div style={{ color: '#8c8c8c' }}>
                                                                {factureEmise
                                                                    ? 'Conditions en vigueur à l\'émission de la facture.'
                                                                    : 'Conditions communes à toutes les transactions, définies dans Paramétrage > Société.'}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </Col>
                                        </Row>
                                    </>
                                )
                            },
                            {
                                key: 'reception',
                                label: 'Bon de Réception',
                                // Rendu dès l'ouverture : validateFields() ignore les champs d'un onglet
                                // jamais affiché, ce qui effacerait la réception à l'enregistrement
                                forceRender: true,
                                children: (
                                    <>
                                        <Row gutter={16}>
                                            <Col span={6}>
                                                <Form.Item name={['reception', 'nombreCles']} label="Nombre de clés">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={6}>
                                                <Form.Item name={['reception', 'volumeCarburant']} label="Volume de carburant dans le réservoir">
                                                    <AutoComplete
                                                        allowClear
                                                        options={VOLUMES_CARBURANT.map((volume) => ({ value: volume }))}
                                                        placeholder="ex : 1/2, 40 L"
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col span={6}>
                                                <Form.Item name={['reception', 'nombreCoupeCircuits']} label="Nombre de coupe-circuits">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={6}>
                                                <Form.Item name={['reception', 'nombreSanglesArrimage']} label="Nombre de sangles d'arrimage">
                                                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                        <Row gutter={16}>
                                            {([
                                                ['nableCoque', 'Nable de coque', false],
                                                ['nourriceCarburant', 'Nourrice de carburant', true],
                                                ['rampeFeuxRemorque', 'Rampe de feux de remorque', true],
                                                ['manivelleRemorque', 'Manivelle de remorque', true],
                                            ] as Array<[keyof Reception, string, boolean]>).map(([champ, label, feminin]) => (
                                                <Col span={6} key={champ}>
                                                    <Form.Item name={['reception', champ]} label={label}>
                                                        <Select
                                                            allowClear
                                                            placeholder="Non renseigné"
                                                            options={[
                                                                { value: true, label: feminin ? 'Présente' : 'Présent' },
                                                                { value: false, label: feminin ? 'Absente' : 'Absent' },
                                                            ]}
                                                        />
                                                    </Form.Item>
                                                </Col>
                                            ))}
                                        </Row>
                                        <Form.Item name={['reception', 'informations']} label="Informations complémentaires">
                                            <Input.TextArea rows={4} allowClear placeholder="État général, choc, rayure, objets laissés à bord… (imprimé sur le devis/OR)" />
                                        </Form.Item>
                                        <Form.Item name={['reception', 'photos']} label="Photos à la réception">
                                            <ImageUpload />
                                        </Form.Item>
                                    </>
                                )
                            },
                            {
                                key: 'rappels',
                                label: 'Relances',
                                children: (
                                    <>
                                        <Row justify="space-between" align="middle" gutter={16} style={{ marginBottom: 16 }}>
                                            <Col flex="auto">
                                                <div style={{ color: '#666' }}>
                                                    Les devis/OR en attente de signature sont relancés selon les délais définis dans
                                                    Paramétrage &gt; Société, à partir de la date du devis. Les relances de paiement
                                                    des factures émises non soldées le sont à partir de la date d'échéance (ou de la date de
                                                    facture à défaut). Les relances dues sont listées chaque jour dans Vente &gt; Relances.
                                                </div>
                                                {isEdit && currentVente?.status === 'FACTURE_PRETE' && (
                                                    <div style={{ marginTop: 8 }}>
                                                        Dernière relance : {currentVente.niveauRelance
                                                            ? <Tag color={RELANCE_COULEURS[currentVente.niveauRelance]}>Relance {currentVente.niveauRelance}</Tag>
                                                            : 'aucune'}
                                                    </div>
                                                )}
                                                {devisEnAttente && (
                                                    <div style={{ marginTop: 8 }}>
                                                        Dernière relance du devis : {currentVente?.niveauRelanceDevis
                                                            ? <Tag color={RELANCE_COULEURS[currentVente.niveauRelanceDevis]}>Relance {currentVente.niveauRelanceDevis}</Tag>
                                                            : 'aucune'}
                                                    </div>
                                                )}
                                                {relancable && currentVente?.client?.relancesSuspendues && (
                                                    <Alert
                                                        style={{ marginTop: 8 }}
                                                        type="warning"
                                                        showIcon
                                                        title="Relances suspendues pour ce client (accord particulier)"
                                                        description={currentVente.client.motifSuspensionRelances
                                                            ? `Motif : ${currentVente.client.motifSuspensionRelances}` : undefined}
                                                    />
                                                )}
                                                {relancable && !currentVente?.client?.relancesSuspendues && relancesVenteSuspendues && (
                                                    <Alert
                                                        style={{ marginTop: 8 }}
                                                        type="warning"
                                                        showIcon
                                                        title={`Relances suspendues depuis le ${dayjs(currentVente?.dateSuspensionRelances).format('DD/MM/YYYY')} `
                                                            + (currentVente?.finSuspensionRelances
                                                                ? `jusqu'au ${dayjs(currentVente.finSuspensionRelances).format('DD/MM/YYYY')} inclus`
                                                                : "jusqu'à leur reprise")}
                                                        description={currentVente?.motifSuspensionRelances
                                                            ? `Motif : ${currentVente.motifSuspensionRelances}` : undefined}
                                                        action={<Button size="small" icon={<PlayCircleOutlined />} onClick={reprendreRelances}>Reprendre</Button>}
                                                    />
                                                )}
                                            </Col>
                                            {relancable && (
                                                <Col>
                                                    {!currentVente?.client?.relancesSuspendues && !relancesVenteSuspendues && (
                                                        <Button
                                                            icon={<PauseCircleOutlined />}
                                                            style={{ marginRight: 8 }}
                                                            onClick={() => setSuspensionRelancesVisible(true)}
                                                        >
                                                            Suspendre les relances
                                                        </Button>
                                                    )}
                                                    <Button
                                                        icon={<SendOutlined />}
                                                        onClick={async () => {
                                                            try {
                                                                await api.post(`/ventes/${currentVente.id}/rappel`);
                                                                message.success('Relance envoyée');
                                                                api.get<RappelHistoriqueEntity[]>(`/rappels/vente/${currentVente.id}`).then(res => setRappelHistorique(res.data)).catch(() => {});
                                                            } catch (err: any) {
                                                                message.error(err?.response?.data || 'Erreur lors de l\'envoi de la relance');
                                                            }
                                                        }}
                                                    >
                                                        {devisEnAttente ? 'Relancer le devis maintenant' : 'Envoyer une relance maintenant'}
                                                    </Button>
                                                </Col>
                                            )}
                                        </Row>
                                        {isEdit && rappelHistorique.length > 0 && (
                                            <>
                                                <h4 style={{ marginTop: 16 }}>Historique des relances</h4>
                                                <Table
                                                    dataSource={rappelHistorique}
                                                    rowKey="id"
                                                    size="small"
                                                    pagination={false}
                                                    columns={[
                                                        {
                                                            title: 'Relance',
                                                            dataIndex: 'numeroRappel',
                                                            width: 120,
                                                            render: (v: number, r: RappelHistoriqueEntity) => (
                                                                <>
                                                                    {v === 0 ? 'Manuel' : `#${v}`}
                                                                    {r.ignoree && <Tag style={{ marginLeft: 8 }}>Ignorée</Tag>}
                                                                    {r.courrier && <Tag color="volcano" style={{ marginLeft: 8 }}>Courrier</Tag>}
                                                                </>
                                                            )
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
                                                            dataIndex: 'sujet',
                                                            render: (v: string, r: RappelHistoriqueEntity) => {
                                                                if (r.ignoree) {
                                                                    return <span style={{ color: '#666' }}>Non envoyée{r.motif ? ` : ${r.motif}` : ''}</span>;
                                                                }
                                                                if (!r.courrier) {
                                                                    return v;
                                                                }
                                                                return (
                                                                    <Space>
                                                                        {v}
                                                                        <Button size="small" icon={<PrinterOutlined />} onClick={() => imprimerCourrier(r)}>
                                                                            {r.dateImpression ? 'Réimprimer' : 'Imprimer'}
                                                                        </Button>
                                                                    </Space>
                                                                );
                                                            }
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
                                                const allLignes: LigneUnifiee[] = getFieldValue('lignes') || [];
                                                const prestationLines = allLignes.filter((l) =>
                                                    (l.type === 'forfait' || l.type === 'service') && l.itemId &&
                                                    ((l.images && l.images.length > 0) || (l.documents && l.documents.length > 0))
                                                );
                                                if (prestationLines.length === 0) return null;
                                                return (
                                                    <>
                                                        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 16 }}>
                                                            <strong>Images & documents des prestations</strong>
                                                        </div>
                                                        {prestationLines.map((line, idx) => {
                                                            const nom = line.type === 'forfait'
                                                                ? forfaits.find((f) => f.id === line.itemId)?.nom
                                                                : services.find((s) => s.id === line.itemId)?.nom;
                                                            const typeLabel = line.type === 'forfait' ? 'Forfait' : 'Service';
                                                            return (
                                                                <div key={`prest-img-${idx}`} style={{ marginTop: 12 }}>
                                                                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{typeLabel} : {nom || `#${line.itemId}`}</div>
                                                                    {line.images && line.images.length > 0 && (
                                                                        <Form.Item label="Images" style={{ marginBottom: 8 }}>
                                                                            <ImageUpload value={line.images} onChange={(urls) => {
                                                                                const currentLignes: LigneUnifiee[] = getFieldValue('lignes');
                                                                                const realIdx = currentLignes.findIndex((l) => l.type === line.type && l.itemId === line.itemId);
                                                                                if (realIdx >= 0) {
                                                                                    currentLignes[realIdx] = { ...currentLignes[realIdx], images: urls };
                                                                                    form.setFieldsValue({ lignes: [...currentLignes] });
                                                                                }
                                                                            }} />
                                                                        </Form.Item>
                                                                    )}
                                                                    {line.documents && line.documents.length > 0 && (
                                                                        <Form.Item label="Documents" style={{ marginBottom: 8 }}>
                                                                            <DocumentUpload value={line.documents} onChange={(urls) => {
                                                                                const currentLignes: LigneUnifiee[] = getFieldValue('lignes');
                                                                                const realIdx = currentLignes.findIndex((l) => l.type === line.type && l.itemId === line.itemId);
                                                                                if (realIdx >= 0) {
                                                                                    currentLignes[realIdx] = { ...currentLignes[realIdx], documents: urls };
                                                                                    form.setFieldsValue({ lignes: [...currentLignes] });
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
                </Form>

                <Modal
                    title="Créer un produit"
                    open={newProduitModalVisible}
                    onOk={handleNewProduitSave}
                    onCancel={makeInnerModalCancel(newProduitFormDirty, setNewProduitFormDirty, setNewProduitModalVisible)}
                    maskClosable={false}
                    width="47.5vw"
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
                        <Form.Item name="designation" label="Désignation" rules={[{ required: true, message: 'La désignation est requise' }]}>
                            <Input />
                        </Form.Item>
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
                        <Form.Item name="refs" label="Codes barres">
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
                                                    <Input placeholder="Code barre" style={{ width: 200 }} />
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
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="emplacement" label="Emplacement atelier">
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="emplacementMagasin" label="Emplacement magasin">
                                    <Input />
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
                width="47.5vw"
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
                        <Form.Item name="dureeEstimee" label="Durée estimée" tooltip="Calculée automatiquement : 1h par unité de main d'œuvre">
                            <InputNumber min={0} step={0.25} precision={2} style={{ width: '100%' }} addonAfter="h" disabled />
                        </Form.Item>
                        <SectionLignes titre="Main d'Oeuvres" couleur="mainOeuvre">
                            {renderLignesArticles(newServiceForm, onNewServiceValuesChange, 'mainOeuvres', true)}
                        </SectionLignes>

                        <SectionLignes titre="Produits" couleur="produit">
                            {renderLignesArticles(newServiceForm, onNewServiceValuesChange, 'produits')}
                        </SectionLignes>
                        <MontantsService />
                    </Form>
                </Modal>

                <Modal
                    title="Créer un forfait"
                    open={newForfaitModalVisible}
                    onOk={handleNewForfaitSave}
                    onCancel={makeInnerModalCancel(newForfaitFormDirty, setNewForfaitFormDirty, setNewForfaitModalVisible)}
                    maskClosable={false}
                width="47.5vw"
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
                                    <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={moteurOptions} placeholder="Sélectionner les moteurs" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="bateauIds" label="Bateaux associés">
                                    <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={bateauOptions} placeholder="Sélectionner les bateaux" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item name="dureeEstimee" label="Durée estimée" tooltip="Calculée automatiquement : 1h par unité de main d'œuvre">
                            <InputNumber min={0} step={0.25} precision={2} style={{ width: '100%' }} addonAfter="h" disabled />
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
                                            <SectionLignes titre="Main d'Oeuvres" couleur="mainOeuvre">
                                                {renderLignesArticles(newForfaitForm, onNewForfaitValuesChange, 'mainOeuvres', true)}
                                            </SectionLignes>

                                            <SectionLignes titre="Produits" couleur="produit">
                                                {renderLignesArticles(newForfaitForm, onNewForfaitValuesChange, 'produits')}
                                            </SectionLignes>
                                        </>
                                    )
                                }
                            ]}
                        />

                        <MontantsService terme="Montant" />
                    </Form>
                </Modal>
            </Modal>

            <Modal
                title="Créer un client"
                open={newClientModalVisible}
                onOk={handleNewClientSave}
                onCancel={makeInnerModalCancel(newClientFormDirty, setNewClientFormDirty, setNewClientModalVisible)}
                maskClosable={false}
                width="95vw"
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
                        <Col span={12}>
                            <Form.Item name="nom" label="Nom" extra={CLIENT_NOM_AIDE} rules={[{ required: true, message: 'Le nom est requis' }]}>
                                <Input placeholder={CLIENT_NOM_PLACEHOLDER} allowClear />
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
                width="95vw"
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
                                options={catalogueBateaux.map((b) => ({ value: b.id, label: b.designation }))}
                                onChange={(value) => newBateauForm.setFieldValue('modele', value ? { id: value } : undefined)}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un modèle" onClick={() => navigate('/catalogue/produits', { typeProduit: 'bateau' })} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item label="Propriétaires">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                mode="multiple"
                                showSearch
                                allowClear
                                placeholder="Rechercher un propriétaire par prénom ou nom"
                                filterOption={(input, option) =>
                                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                }
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
                                options={catalogueMoteurs.map((m) => ({ value: m.id, label: m.designation }))}
                                onChange={(values) => newBateauForm.setFieldValue('moteurs', (values || []).map((id: number) => ({ id })))}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un moteur" onClick={() => navigate('/catalogue/produits', { typeProduit: 'moteur' })} />
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
                width="95vw"
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
                                options={catalogueMoteurs.map((m) => ({ value: m.id, label: m.designation }))}
                                onChange={(value) => newMoteurForm.setFieldValue('modele', value ? { id: value } : undefined)}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un modèle" onClick={() => navigate('/catalogue/produits', { typeProduit: 'moteur' })} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item label="Propriétaire">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="Rechercher un propriétaire par prénom ou nom"
                                filterOption={(input, option) =>
                                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                }
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
                width="95vw"
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
                                options={catalogueRemorques.map((r) => ({ value: r.id, label: r.designation }))}
                                onChange={(value) => newRemorqueForm.setFieldValue('modele', value ? { id: value } : undefined)}
                                style={{ width: '100%' }}
                            />
                            <Button icon={<PlusOutlined />} title="Créer un modèle" onClick={() => navigate('/catalogue/produits', { typeProduit: 'remorque' })} />
                        </Space.Compact>
                    </Form.Item>
                    <Form.Item label="Propriétaire">
                        <Space.Compact style={{ width: '100%' }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="Rechercher un propriétaire par prénom ou nom"
                                filterOption={(input, option) =>
                                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                }
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
                width="95vw"
                maskClosable={false}
                destroyOnHidden
                footer={[
                    <Button key="clear" onClick={clearSignatureCanvas}>
                        Effacer la signature
                    </Button>,
                    <Button key="cancel" onClick={handleBpaCancel}>
                        Fermer
                    </Button>,
                    <Button key="confirm" type="primary" disabled={!cgvAccepted} onClick={handleBpaConfirm}>
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
                            { title: 'Type', dataIndex: 'type', width: 90 },
                            { title: 'Référence', dataIndex: 'reference', width: 120, render: (v: string) => v || '-' },
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
                                        <Table.Summary.Cell index={0} colSpan={4} align="right"><strong>Total TTC</strong></Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right"><strong>{formatEuro(total)}</strong></Table.Summary.Cell>
                                    </Table.Summary.Row>
                                    {remise > 0 && (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={4} align="right">Remise</Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right">-{formatEuro(remise)}</Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={4} align="right"><strong>Prix vente TTC</strong></Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right"><strong>{formatEuro(prixVente)}</strong></Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </>
                            );
                        } : undefined}
                    />
                </div>
                <ReceptionResume reception={form.getFieldValue('reception')} />
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
                <div style={{ marginTop: 12 }}>
                    <Checkbox checked={cgvAccepted} onChange={(e) => setCgvAccepted(e.target.checked)}>
                        J'ai lu et j'accepte les{' '}
                        <a onClick={(e) => { e.preventDefault(); setCgvModalOpen(true); }} href="#">
                            conditions générales de vente
                        </a>
                    </Checkbox>
                </div>
            </Modal>

            <Modal
                title={CGV_TITLE}
                open={cgvModalOpen}
                onCancel={() => setCgvModalOpen(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setCgvModalOpen(false)}>
                        Fermer
                    </Button>,
                ]}
                width={700}
            >
                {CGV_SECTIONS.map((section) => (
                    <div key={section.titre} style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 500 }}>{section.titre}</div>
                        <div>{section.texte}</div>
                    </div>
                ))}
            </Modal>

            {/* Modal génération avoir */}
            <Modal
                title="Générer un avoir depuis cette facture"
                open={!!genAvoirModalVente}
                onCancel={() => setGenAvoirModalVente(null)}
                onOk={handleGenerateAvoir}
                okText="Générer"
                confirmLoading={generatingAvoir}
                destroyOnHidden
                width="95vw"
            >
                <p style={{ marginBottom: 16, color: '#595959' }}>
                    Un avoir en brouillon sera créé avec les lignes cochées de la facture <strong>#{genAvoirModalVente?.id}</strong>
                    et les lignes libres saisies (ex : une heure de main d'œuvre d'un forfait).
                </p>
                <Table
                    size="small"
                    style={{ marginBottom: 16 }}
                    pagination={false}
                    rowKey="key"
                    dataSource={genAvoirLignes}
                    rowSelection={{
                        selectedRowKeys: genAvoirSelection,
                        onChange: (keys) => setGenAvoirSelection(keys as string[]),
                    }}
                    columns={[
                        { title: 'Type', dataIndex: 'type', width: 100 },
                        { title: 'Désignation', dataIndex: 'designation' },
                        { title: 'Qté', dataIndex: 'quantite', width: 70, align: 'right' as const },
                        {
                            title: 'Total TTC',
                            dataIndex: 'totalTTC',
                            width: 120,
                            align: 'right' as const,
                            render: (v: number) => `${v.toFixed(2)} EUR`,
                        },
                    ]}
                />
                <LignesLibresAvoir
                    lignes={genAvoirLignesLibres}
                    onChange={setGenAvoirLignesLibres}
                    exonere={clientExonereTva(genAvoirModalVente?.client)}
                    tvaDefaut={TVA_VENTE_DEFAUT}
                />
                <div style={{ textAlign: 'right', marginBottom: 16 }}>
                    Total de l'avoir (TTC) :{' '}
                    <strong>
                        {(genAvoirLignes
                            .filter((l) => genAvoirSelection.includes(l.key))
                            .reduce((sum, l) => sum + l.totalTTC, 0)
                            + genAvoirLignesLibres.reduce((sum, l) => sum + totalTTCLigneLibreAvoir(l), 0)
                        ).toFixed(2)} EUR
                    </strong>
                </div>
                <Form layout="vertical">
                    <Form.Item label="Motif" required>
                        <Input
                            value={genAvoirMotif}
                            onChange={(e) => setGenAvoirMotif(e.target.value)}
                            placeholder="Ex: Retour marchandise, erreur de facturation..."
                        />
                    </Form.Item>
                    <Form.Item label="Notes (optionnel)">
                        <Input.TextArea
                            rows={3}
                            value={genAvoirNotes}
                            onChange={(e) => setGenAvoirNotes(e.target.value)}
                            placeholder="Informations complémentaires..."
                        />
                    </Form.Item>
                </Form>
            </Modal>


            <Modal
                title="Modifier la date du paiement"
                open={editPaiement !== null}
                onCancel={() => setEditPaiement(null)}
                onOk={handleUpdatePaiementDate}
                okText="Valider"
                destroyOnHidden
            >
                <DatePicker
                    showTime
                    format="DD/MM/YYYY HH:mm"
                    allowClear={false}
                    value={editPaiement?.date}
                    onChange={(v) => v && setEditPaiement((p) => (p ? { ...p, date: v } : p))}
                    style={{ width: '100%' }}
                />
            </Modal>

            {/* Modal ajout paiement */}
            <Modal
                title="Ajouter un paiement"
                open={paiementModalVisible}
                onCancel={() => setPaiementModalVisible(false)}
                onOk={handleAddPaiement}
                okText="Valider"
                confirmLoading={addingPaiement}
                destroyOnHidden
                width="95vw"
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
                                { value: 'CHEQUE', label: 'Chèque' },
                                { value: 'VIREMENT', label: 'Virement' },
                                { value: 'CARTE', label: 'Carte' },
                                { value: 'ESPÈCES', label: 'Espèces' },
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

                    <Form.Item label="Date du paiement" required>
                        <DatePicker
                            showTime
                            format="DD/MM/YYYY HH:mm"
                            allowClear={false}
                            value={paiementDate}
                            onChange={(v) => v && setPaiementDate(v)}
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

            {/* Règlement groupé */}
            <Modal
                title="Règlement groupé"
                open={reglementGroupeVisible}
                onCancel={() => setReglementGroupeVisible(false)}
                onOk={handleReglementGroupe}
                okText="Enregistrer"
                cancelText="Annuler"
                confirmLoading={rgSubmitting}
                width={700}
                destroyOnHidden
            >
                <Form layout="vertical" style={{ marginTop: 8 }}>
                    <Form.Item label="Client">
                        <Select
                            showSearch
                            placeholder="Sélectionner un client"
                            filterOption={(input, option) =>
                                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={clientOptions}
                            value={rgClientId}
                            onChange={(v) => {
                                setRgClientId(v);
                                setRgSelectedIds([]);
                                setRgMontant(0);
                            }}
                            allowClear
                        />
                    </Form.Item>
                    {rgClientId && (
                        <>
                            {rgVentesClient.length === 0 ? (
                                <Alert type="info" message="Aucune facture prête pour ce client" showIcon />
                            ) : (
                                <Form.Item label="Factures à régler">
                                    <Table
                                        rowKey="id"
                                        size="small"
                                        dataSource={rgVentesClient}
                                        pagination={false}
                                        rowSelection={{
                                            selectedRowKeys: rgSelectedIds,
                                            onChange: (keys) => {
                                                const ids = keys as number[];
                                                setRgSelectedIds(ids);
                                                const total = rgVentesClient
                                                    .filter((v) => ids.includes(v.id!))
                                                    .reduce((s, v) => {
                                                        const paid = (v.paiements || []).reduce((a, p) => a + p.montant, 0);
                                                        return s + Math.max(0, v.prixVenteTTC - paid);
                                                    }, 0);
                                                setRgMontant(Math.round(total * 100) / 100);
                                            },
                                        }}
                                        columns={[
                                            { title: 'Référence', dataIndex: 'reference', render: (v: string) => v || '-' },
                                            { title: 'Date', dataIndex: 'dateDevis', render: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '-' },
                                            {
                                                title: 'Solde restant',
                                                align: 'right' as const,
                                                render: (_: unknown, record: VenteEntity) => {
                                                    const paid = (record.paiements || []).reduce((s, p) => s + p.montant, 0);
                                                    const b = Math.max(0, Math.round((record.prixVenteTTC - paid) * 100) / 100);
                                                    return formatEuro(b);
                                                },
                                            },
                                        ]}
                                    />
                                </Form.Item>
                            )}
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Montant reçu (€)">
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            step={0.01}
                                            precision={2}
                                            value={rgMontant}
                                            onChange={(v) => setRgMontant(v ?? 0)}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Mode de règlement">
                                        <Select
                                            value={rgMode}
                                            onChange={(v) => setRgMode(v)}
                                            options={modePaiementOptions.map((o) => ({ value: o.value, label: o.label }))}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item label="Date du paiement" required>
                                <DatePicker
                                    showTime
                                    format="DD/MM/YYYY HH:mm"
                                    allowClear={false}
                                    value={rgDate}
                                    onChange={(v) => v && setRgDate(v)}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                            <Form.Item label="Notes (optionnel)">
                                <Input
                                    value={rgNotes}
                                    onChange={(e) => setRgNotes(e.target.value)}
                                    placeholder="Ex: virement du 04/07/2026"
                                />
                            </Form.Item>
                            {rgDistribution.length > 0 && (
                                <Form.Item label="Répartition">
                                    <Table
                                        rowKey={(r) => r.vente.id!}
                                        size="small"
                                        dataSource={rgDistribution}
                                        pagination={false}
                                        columns={[
                                            { title: 'Facture', render: (_: unknown, r: { vente: VenteEntity }) => r.vente.reference || `#${r.vente.id}` },
                                            { title: 'Solde', align: 'right' as const, render: (_: unknown, r: { balance: number }) => formatEuro(r.balance) },
                                            { title: 'Alloué', align: 'right' as const, render: (_: unknown, r: { alloue: number }) => <Tag color={r.alloue > 0 ? 'green' : 'default'}>{formatEuro(r.alloue)}</Tag> },
                                        ]}
                                        summary={() => {
                                            const totalAlloue = rgDistribution.reduce((s, r) => s + r.alloue, 0);
                                            const nonApplique = Math.max(0, Math.round((rgMontant - totalAlloue) * 100) / 100);
                                            return (
                                                <Table.Summary.Row>
                                                    <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
                                                    <Table.Summary.Cell index={1} align="right"><strong>{formatEuro(rgDistribution.reduce((s, r) => s + r.balance, 0))}</strong></Table.Summary.Cell>
                                                    <Table.Summary.Cell index={2} align="right">
                                                        <strong>{formatEuro(totalAlloue)}</strong>
                                                        {nonApplique > 0.005 && (
                                                            <div style={{ color: '#faad14', fontSize: 11 }}>Non alloué : {formatEuro(nonApplique)}</div>
                                                        )}
                                                    </Table.Summary.Cell>
                                                </Table.Summary.Row>
                                            );
                                        }}
                                    />
                                </Form.Item>
                            )}
                        </>
                    )}
                </Form>
            </Modal>

            <CommandeFournisseurFromVenteModal
                open={cfModalVisible}
                venteId={cfVente?.id ?? null}
                venteNumero={cfVente?.numeroFacture}
                clientNom={getClientLabel(cfVente?.client)}
                initialArticleKey={cfInitialArticleKey}
                onClose={() => {
                    setCfModalVisible(false);
                    setCfInitialArticleKey(undefined);
                }}
                onSuccess={() => {
                    fetchCommandesFournisseur();
                }}
            />
        </Card>
    );
}
