import React, { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Card,
    Col,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Row,
    Select,
    Space,
    Tabs,
    Table,
    Tag,
    Dropdown,
    message
} from 'antd';
import { CreditCardOutlined, DeleteOutlined, EditOutlined, MailOutlined, PlusCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import axios from 'axios';

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

type TaskStatus = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINEE' | 'INCIDENT' | 'ANNULEE';

interface TaskEntity {
    id?: number;
    nom?: string;
    status?: TaskStatus;
    dateDebut?: string;
    dateFin?: string;
    statusDate?: string;
    description?: string;
    notes?: string;
    technicien?: TechnicienEntity;
    dureeEstimee?: number;
    dureeReelle?: number;
    incidentDate?: string;
    incidentDetails?: string;
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
    prixVenteTTC?: number;
}

interface ServiceEntity {
    id: number;
    nom: string;
    prixTTC?: number;
}

type VenteStatus = 'EN_ATTENTE' | 'EN_COURS' | 'PAYEE' | 'ANNULEE';
type VenteType = 'DEVIS' | 'FACTURE' | 'COMMANDE' | 'LIVRAISON' | 'COMPTOIR';
type ModePaiement = 'CHEQUE' | 'VIREMENT' | 'CARTE' | 'ESPÈCES';

interface VenteEntity {
    id?: number;
    status: VenteStatus;
    type: VenteType;
    client?: ClientEntity;
    bateau?: BateauClientEntity;
    moteur?: MoteurClientEntity;
    remorque?: RemorqueClientEntity;
    forfaits?: ForfaitEntity[];
    produits?: ProduitCatalogueEntity[];
    services?: ServiceEntity[];
    taches?: TaskEntity[];
    date?: string;
    montantHT?: number;
    remise?: number;
    montantTTC?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
    modePaiement?: ModePaiement;
}

interface VenteFormValues {
    status: VenteStatus;
    type: VenteType;
    clientId?: number;
    bateauId?: number;
    moteurId?: number;
    remorqueId?: number;
    forfaits: Array<{ forfaitId?: number; quantite?: number }>;
    produits: Array<{ produitId?: number; quantite?: number }>;
    services: Array<{ serviceId?: number; quantite?: number }>;
    taches: Array<{
        id?: number;
        nom?: string;
        status?: TaskStatus;
        dateDebut?: string;
        dateFin?: string;
        statusDate?: string;
        description?: string;
        notes?: string;
        technicienId?: number;
        dureeEstimee?: number;
        dureeReelle?: number;
        incidentDate?: string;
        incidentDetails?: string;
    }>;
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

interface SearchFilters {
    status?: VenteStatus;
    type?: VenteType;
    clientId?: number;
}

const statusOptions: Array<{ value: VenteStatus; label: string }> = [
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'PAYEE', label: 'Payee' },
    { value: 'ANNULEE', label: 'Annulee' }
];

const typeOptions: Array<{ value: VenteType; label: string }> = [
    { value: 'DEVIS', label: 'Devis' },
    { value: 'FACTURE', label: 'Facture' },
    { value: 'COMMANDE', label: 'Commande' },
    { value: 'LIVRAISON', label: 'Livraison' },
    { value: 'COMPTOIR', label: 'Comptoir' }
];

const modePaiementOptions: Array<{ value: ModePaiement; label: string }> = [
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'CARTE', label: 'Carte' },
    { value: 'ESPÈCES', label: 'Especes' }
];

const taskStatusOptions: Array<{ value: TaskStatus; label: string }> = [
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'TERMINEE', label: 'Terminee' },
    { value: 'INCIDENT', label: 'Incident' },
    { value: 'ANNULEE', label: 'Annulee' }
];

const statusColor: Record<VenteStatus, string> = {
    EN_ATTENTE: 'default',
    EN_COURS: 'blue',
    PAYEE: 'green',
    ANNULEE: 'red'
};

const getTodayIsoDate = () => {
    const now = new Date();
    const timezoneOffsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - timezoneOffsetMs).toISOString().split('T')[0];
};

const toDateInputValue = (value?: string) => {
    if (!value) {
        return undefined;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return undefined;
    }
    const timezoneOffsetMs = parsedDate.getTimezoneOffset() * 60000;
    return new Date(parsedDate.getTime() - timezoneOffsetMs).toISOString().split('T')[0];
};

const toBackendDateValue = (value?: string) => {
    if (!value) {
        return undefined;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return undefined;
    }
    return parsedDate.toISOString().split('T')[0];
};

const defaultVente: VenteFormValues = {
    status: 'EN_ATTENTE',
    type: 'DEVIS',
    forfaits: [{}],
    produits: [{}],
    services: [{}],
    taches: [{}],
    montantHT: 0,
    remise: 0,
    remisePourcentage: 0,
    tva: 20,
    montantTVA: 0,
    montantTTC: 0,
    prixVenteTTC: 0
};

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} EUR`;
const formatDate = (value?: string) => value || '-';
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
    const [ventes, setVentes] = useState<VenteEntity[]>([]);
    const [clients, setClients] = useState<ClientEntity[]>([]);
    const [bateaux, setBateaux] = useState<BateauClientEntity[]>([]);
    const [moteurs, setMoteurs] = useState<MoteurClientEntity[]>([]);
    const [remorques, setRemorques] = useState<RemorqueClientEntity[]>([]);
    const [forfaits, setForfaits] = useState<ForfaitEntity[]>([]);
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [services, setServices] = useState<ServiceEntity[]>([]);
    const [techniciens, setTechniciens] = useState<TechnicienEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentVente, setCurrentVente] = useState<VenteEntity | null>(null);
    const [filters, setFilters] = useState<SearchFilters>({});
    const [searchForm] = Form.useForm<SearchFilters>();
    const [form] = Form.useForm<VenteFormValues>();

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
            const hasType = !!activeFilters.type;
            const hasClient = activeFilters.clientId !== undefined;
            const endpoint = hasStatus || hasType || hasClient ? '/ventes/search' : '/ventes';
            const response = await axios.get(endpoint, {
                params: {
                    ...(hasStatus ? { status: activeFilters.status } : {}),
                    ...(hasType ? { type: activeFilters.type } : {}),
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
                techniciensRes
            ] = await Promise.all([
                axios.get('/clients'),
                axios.get('/bateaux'),
                axios.get('/moteurs'),
                axios.get('/remorques'),
                axios.get('/forfaits'),
                axios.get('/catalogue/produits'),
                axios.get('/services'),
                axios.get('/techniciens')
            ]);
            setClients(clientsRes.data || []);
            setBateaux(bateauxRes.data || []);
            setMoteurs(moteursRes.data || []);
            setRemorques(remorquesRes.data || []);
            setForfaits(forfaitsRes.data || []);
            setProduits(produitsRes.data || []);
            setServices(servicesRes.data || []);
            setTechniciens(techniciensRes.data || []);
        } catch {
            message.error('Erreur lors du chargement des listes de reference.');
        }
    };

    useEffect(() => {
        fetchVentes();
        fetchOptions();
    }, []);

    const openModal = (vente?: VenteEntity) => {
        if (vente) {
            setIsEdit(true);
            setCurrentVente(vente);
            const forfaitLinesMap = (vente.forfaits || []).reduce((acc, item) => {
                if (!item?.id) {
                    return acc;
                }
                acc.set(item.id, (acc.get(item.id) || 0) + 1);
                return acc;
            }, new Map<number, number>());
            const produitLinesMap = (vente.produits || []).reduce((acc, item) => {
                if (!item?.id) {
                    return acc;
                }
                acc.set(item.id, (acc.get(item.id) || 0) + 1);
                return acc;
            }, new Map<number, number>());
            const serviceLinesMap = (vente.services || []).reduce((acc, item) => {
                if (!item?.id) {
                    return acc;
                }
                acc.set(item.id, (acc.get(item.id) || 0) + 1);
                return acc;
            }, new Map<number, number>());
            const forfaitLines = Array.from(forfaitLinesMap.entries()).map(([forfaitId, quantite]) => ({ forfaitId, quantite }));
            const produitLines = Array.from(produitLinesMap.entries()).map(([produitId, quantite]) => ({ produitId, quantite }));
            const serviceLines = Array.from(serviceLinesMap.entries()).map(([serviceId, quantite]) => ({ serviceId, quantite }));
            const taskLines = (vente.taches || [])
                .map<VenteFormValues['taches'][number]>((tache) => ({
                    id: tache.id,
                    nom: tache.nom || '',
                    status: tache.status || 'EN_ATTENTE',
                    dateDebut: toDateInputValue(tache.dateDebut),
                    dateFin: toDateInputValue(tache.dateFin),
                    statusDate: toDateInputValue(tache.statusDate),
                    description: tache.description || '',
                    notes: tache.notes || '',
                    technicienId: tache.technicien?.id,
                    dureeEstimee: tache.dureeEstimee || 0,
                    dureeReelle: tache.dureeReelle || 0
                }));
            form.setFieldsValue({
                status: vente.status || 'EN_ATTENTE',
                type: vente.type || 'DEVIS',
                clientId: vente.client?.id,
                bateauId: vente.bateau?.id,
                moteurId: vente.moteur?.id,
                remorqueId: vente.remorque?.id,
                forfaits: [...forfaitLines, {}],
                produits: [...produitLines, {}],
                services: [...serviceLines, {}],
                taches: [...taskLines, {}],
                date: toDateInputValue(vente.date),
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
            form.setFieldsValue({ ...defaultVente, date: getTodayIsoDate() });
        }
        setModalVisible(true);
    };

    const expandByQuantity = <T,>(items: T[], quantite: number): T[] => {
        const safeQuantity = Math.max(1, Math.floor(quantite || 1));
        return Array.from({ length: safeQuantity }, () => items).flat();
    };

    const buildTasksFromForfaitLines = (forfaitLines: VenteFormValues['forfaits']): VenteFormValues['taches'] => {
        const copiedTasks = (forfaitLines || [])
            .filter((line) => line.forfaitId && (line.quantite || 0) > 0)
            .flatMap((line) => {
                const selectedForfait = forfaits.find((forfait) => forfait.id === line.forfaitId);
                if (!selectedForfait?.taches?.length) {
                    return [];
                }
                const tasksForOneForfait = selectedForfait.taches.map<VenteFormValues['taches'][number]>((tache) => ({
                    // We copy values from forfait tasks into vente tasks.
                    // IDs are omitted so the sale owns its own task rows.
                    nom: tache.nom || '',
                    status: tache.status || 'EN_ATTENTE',
                    dateDebut: toDateInputValue(tache.dateDebut),
                    dateFin: toDateInputValue(tache.dateFin),
                    statusDate: toDateInputValue(tache.statusDate),
                    description: tache.description || '',
                    notes: tache.notes || '',
                    technicienId: tache.technicien?.id,
                    dureeEstimee: tache.dureeEstimee || 0,
                    dureeReelle: tache.dureeReelle || 0
                }));
                return expandByQuantity(tasksForOneForfait, line.quantite || 1);
            });

        return [...copiedTasks, {}];
    };

    const toPayload = (values: VenteFormValues): VenteEntity => ({
        status: values.status,
        type: values.type,
        client: clients.find((client) => client.id === values.clientId),
        bateau: bateaux.find((bateau) => bateau.id === values.bateauId),
        moteur: moteurs.find((moteur) => moteur.id === values.moteurId),
        remorque: remorques.find((remorque) => remorque.id === values.remorqueId),
        forfaits: (values.forfaits || [])
            .filter((line) => line.forfaitId)
            .flatMap((line) => {
                const item = forfaits.find((forfait) => forfait.id === line.forfaitId);
                return item ? expandByQuantity([item], line.quantite || 1) : [];
            }) as ForfaitEntity[],
        produits: (values.produits || [])
            .filter((line) => line.produitId)
            .flatMap((line) => {
                const item = produits.find((produit) => produit.id === line.produitId);
                return item ? expandByQuantity([item], line.quantite || 1) : [];
            }) as ProduitCatalogueEntity[],
        services: (values.services || [])
            .filter((line) => line.serviceId)
            .flatMap((line) => {
                const item = services.find((service) => service.id === line.serviceId);
                return item ? expandByQuantity([item], line.quantite || 1) : [];
            }) as ServiceEntity[],
        taches: (values.taches || [])
            .filter((tache) =>
                Boolean(
                    tache.nom
                    || tache.description
                    || tache.notes
                    || tache.status
                    || tache.technicienId
                    || tache.dateDebut
                    || tache.dateFin
                    || tache.statusDate
                    || (tache.dureeEstimee || 0) > 0
                    || (tache.dureeReelle || 0) > 0
                    || tache.incidentDate
                    || tache.incidentDetails
                )
            )
            .map<TaskEntity>((tache) => ({
                id: tache.id,
                nom: tache.nom || '',
                status: tache.status || 'EN_ATTENTE',
                dateDebut: tache.dateDebut,
                dateFin: tache.dateFin,
                statusDate: tache.statusDate,
                description: tache.description || '',
                notes: tache.notes || '',
                technicien: techniciens.find((technicien) => technicien.id === tache.technicienId),
                dureeEstimee: tache.dureeEstimee || 0,
                dureeReelle: tache.dureeReelle || 0,
                incidentDate: tache.incidentDate,
                incidentDetails: tache.incidentDetails
            })),
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
                const res = await axios.put(`/ventes/${currentVente.id}`, { ...currentVente, ...payload });
                message.success('Vente modifiee avec succes');
                setCurrentVente(res.data);
                form.setFieldsValue(values);
            } else {
                const res = await axios.post('/ventes', payload);
                message.success('Vente ajoutee avec succes');
                setIsEdit(true);
                setCurrentVente(res.data);
                form.setFieldsValue(values);
            }
            fetchVentes(filters);
        } catch {
            // Les erreurs de validation sont affichees par le formulaire.
        }
    };

    const handleDelete = async (id?: number) => {
        if (!id) {
            return;
        }
        try {
            await axios.delete(`/ventes/${id}`);
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

    const handlePrint = (vente: VenteEntity) => {
        const title = `Vente #${vente.id || '-'}`;
        const forfaitLines = Array.from(
            (vente.forfaits || []).reduce((acc, item) => {
                const label = item.reference ? `${item.reference} - ${item.nom}` : item.nom;
                const key = item.id ? `id-${item.id}` : `label-${label}`;
                const current = acc.get(key) || { type: 'Forfait', label, quantite: 0, totalPrixTTC: 0 };
                current.quantite += 1;
                current.totalPrixTTC += item.prixTTC || 0;
                acc.set(key, current);
                return acc;
            }, new Map<string, { type: string; label: string; quantite: number; totalPrixTTC: number }>())
                .values()
        );
        const produitLines = Array.from(
            (vente.produits || []).reduce((acc, item) => {
                const label = `${item.nom}${item.marque ? ` (${item.marque})` : ''}`;
                const key = item.id ? `id-${item.id}` : `label-${label}`;
                const current = acc.get(key) || { type: 'Produit', label, quantite: 0, totalPrixTTC: 0 };
                current.quantite += 1;
                current.totalPrixTTC += item.prixVenteTTC || 0;
                acc.set(key, current);
                return acc;
            }, new Map<string, { type: string; label: string; quantite: number; totalPrixTTC: number }>())
                .values()
        );
        const serviceLines = Array.from(
            (vente.services || []).reduce((acc, item) => {
                const label = item.nom;
                const key = item.id ? `id-${item.id}` : `label-${label}`;
                const current = acc.get(key) || { type: 'Service', label, quantite: 0, totalPrixTTC: 0 };
                current.quantite += 1;
                current.totalPrixTTC += item.prixTTC || 0;
                acc.set(key, current);
                return acc;
            }, new Map<string, { type: string; label: string; quantite: number; totalPrixTTC: number }>())
                .values()
        );
        const invoiceLines = [...forfaitLines, ...produitLines, ...serviceLines];
        const invoiceRowsHtml = invoiceLines.length > 0
            ? `
                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Designation</th>
                            <th>Qte</th>
                            <th>Prix total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoiceLines
                            .map((line) => `
                                <tr>
                                    <td>${escapeHtml(line.type)}</td>
                                    <td>${escapeHtml(line.label)}</td>
                                    <td>${line.quantite}</td>
                                    <td>${escapeHtml(formatEuro(line.totalPrixTTC))}</td>
                                </tr>
                            `)
                            .join('')}
                    </tbody>
                </table>
            `
            : '<p>Aucun element</p>';

        openPrintDocument(
            title,
            `
            <html>
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
                <div class="row"><strong>Type:</strong> ${escapeHtml(vente.type || '-')}</div>
                <div class="row"><strong>Statut:</strong> ${escapeHtml(vente.status || '-')}</div>
                <div class="row"><strong>Client:</strong> ${escapeHtml(getClientLabel(vente.client))}</div>
                <div class="row"><strong>Montant TTC:</strong> ${escapeHtml(formatEuro(vente.montantTTC))}</div>
                <div class="row"><strong>Remise:</strong> ${escapeHtml(formatEuro(vente.remise))}</div>
                <div class="row"><strong>Prix vente TTC:</strong> ${escapeHtml(formatEuro(vente.prixVenteTTC))}</div>
                <div class="row"><strong>Mode de paiement:</strong> ${escapeHtml(vente.modePaiement || '-')}</div>

                <div class="section">
                    <h3>Lignes</h3>
                    ${invoiceRowsHtml}
                </div>
            </body>
            </html>
        `
        );
    };

    const handleEmail = (vente: VenteEntity) => {
        const selectedClientId = form.getFieldValue('clientId');
        const fallbackClient = clients.find((client) => client.id === vente.client?.id || client.id === selectedClientId);
        const email = vente.client?.email || fallbackClient?.email || '';
        if (!email) {
            message.warning("Aucun email client n'est renseigne pour cette vente.");
            return;
        }

        const forfaitLines = Array.from(
            (vente.forfaits || []).reduce((acc, item) => {
                const label = item.reference ? `${item.reference} - ${item.nom}` : item.nom;
                const key = item.id ? `id-${item.id}` : `label-${label}`;
                const current = acc.get(key) || { type: 'Forfait', label, quantite: 0, totalPrixTTC: 0 };
                current.quantite += 1;
                current.totalPrixTTC += item.prixTTC || 0;
                acc.set(key, current);
                return acc;
            }, new Map<string, { type: string; label: string; quantite: number; totalPrixTTC: number }>())
                .values()
        );
        const produitLines = Array.from(
            (vente.produits || []).reduce((acc, item) => {
                const label = `${item.nom}${item.marque ? ` (${item.marque})` : ''}`;
                const key = item.id ? `id-${item.id}` : `label-${label}`;
                const current = acc.get(key) || { type: 'Produit', label, quantite: 0, totalPrixTTC: 0 };
                current.quantite += 1;
                current.totalPrixTTC += item.prixVenteTTC || 0;
                acc.set(key, current);
                return acc;
            }, new Map<string, { type: string; label: string; quantite: number; totalPrixTTC: number }>())
                .values()
        );
        const serviceLines = Array.from(
            (vente.services || []).reduce((acc, item) => {
                const label = item.nom;
                const key = item.id ? `id-${item.id}` : `label-${label}`;
                const current = acc.get(key) || { type: 'Service', label, quantite: 0, totalPrixTTC: 0 };
                current.quantite += 1;
                current.totalPrixTTC += item.prixTTC || 0;
                acc.set(key, current);
                return acc;
            }, new Map<string, { type: string; label: string; quantite: number; totalPrixTTC: number }>())
                .values()
        );
        const invoiceLines = [...forfaitLines, ...produitLines, ...serviceLines];
        const formatColumn = (value: string, width: number, align: 'left' | 'right' = 'left') => {
            const truncated = value.length > width ? `${value.slice(0, width - 1)}.` : value;
            return align === 'right' ? truncated.padStart(width) : truncated.padEnd(width);
        };
        const typeWidth = 8;
        const designationWidth = 38;
        const qtyWidth = 5;
        const priceWidth = 13;
        const rowSeparator = '-'.repeat(typeWidth + designationWidth + qtyWidth + priceWidth + 9);
        const invoiceTableLines = invoiceLines.length > 0
            ? [
                `${formatColumn('Type', typeWidth)} | ${formatColumn('Designation', designationWidth)} | ${formatColumn('Qte', qtyWidth, 'right')} | ${formatColumn('Prix total', priceWidth, 'right')}`,
                rowSeparator,
                ...invoiceLines.map((line) =>
                    `${formatColumn(line.type, typeWidth)} | ${formatColumn(line.label, designationWidth)} | ${formatColumn(String(line.quantite), qtyWidth, 'right')} | ${formatColumn(formatEuro(line.totalPrixTTC), priceWidth, 'right')}`
                )
            ]
            : ['Aucun element'];

        const subject = encodeURIComponent(`Vente #${vente.id || '-'}`);
        const body = encodeURIComponent(
            [
                `Bonjour ${getClientLabel(vente.client || fallbackClient)},`,
                '',
                `Veuillez trouver les informations de votre vente #${vente.id || '-'}.`,
                '',
                `Date             : ${formatDate(vente.date)}`,
                `Type             : ${vente.type || '-'}`,
                `Statut           : ${vente.status || '-'}`,
                `Prix vente TTC   : ${formatEuro(vente.prixVenteTTC)}`,
                `Mode de paiement : ${vente.modePaiement || '-'}`,
                '',
                'Lignes:',
                ...invoiceTableLines,
                '',
                'Cordialement,'
            ].join('\n')
        );

        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
    };

    const handlePayment = async (vente: VenteEntity, provider: 'stripe' | 'payplug') => {
        if (!vente.id) {
            message.warning('La vente doit etre enregistree avant de generer un lien de paiement.');
            return;
        }
        try {
            const res = await axios.post(`/ventes/${vente.id}/payment-link/${provider}`);
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

        const forfaitsTTC = forfaitLines.reduce((sum: number, line: { forfaitId?: number; quantite?: number }) => {
            const prixUnitaire = forfaits.find((item) => item.id === line.forfaitId)?.prixTTC || 0;
            const quantite = Math.max(1, Math.floor(line.quantite || 1));
            return sum + (prixUnitaire * quantite);
        }, 0);
        const produitsTTC = produitLines.reduce((sum: number, line: { produitId?: number; quantite?: number }) => {
            const prixUnitaire = produits.find((item) => item.id === line.produitId)?.prixVenteTTC || 0;
            const quantite = Math.max(1, Math.floor(line.quantite || 1));
            return sum + (prixUnitaire * quantite);
        }, 0);
        const servicesTTC = serviceLines.reduce((sum: number, line: { serviceId?: number; quantite?: number }) => {
            const prixUnitaire = services.find((item) => item.id === line.serviceId)?.prixTTC || 0;
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
        if (changedValues.forfaits !== undefined) {
            const currentForfaitLines = allValues.forfaits || [];
            form.setFieldValue('taches', buildTasksFromForfaitLines(currentForfaitLines));
            if (currentForfaitLines.length === 0) {
                form.setFieldValue('forfaits', [{}]);
                return;
            }
            const lastForfaitLine = currentForfaitLines[currentForfaitLines.length - 1];
            const isLastLineComplete = !!lastForfaitLine?.forfaitId && (lastForfaitLine?.quantite || 0) > 0;
            if (isLastLineComplete) {
                form.setFieldValue('forfaits', [...currentForfaitLines, {}]);
                return;
            }
        }

        if (changedValues.produits !== undefined) {
            const currentProduitLines = allValues.produits || [];
            if (currentProduitLines.length === 0) {
                form.setFieldValue('produits', [{}]);
                return;
            }
            const lastProduitLine = currentProduitLines[currentProduitLines.length - 1];
            const isLastLineComplete = !!lastProduitLine?.produitId && (lastProduitLine?.quantite || 0) > 0;
            if (isLastLineComplete) {
                form.setFieldValue('produits', [...currentProduitLines, {}]);
                return;
            }
        }

        if (changedValues.services !== undefined) {
            const currentServiceLines = allValues.services || [];
            if (currentServiceLines.length === 0) {
                form.setFieldValue('services', [{}]);
                return;
            }
            const lastServiceLine = currentServiceLines[currentServiceLines.length - 1];
            const isLastLineComplete = !!lastServiceLine?.serviceId && (lastServiceLine?.quantite || 0) > 0;
            if (isLastLineComplete) {
                form.setFieldValue('services', [...currentServiceLines, {}]);
                return;
            }
        }

        if (changedValues.taches !== undefined) {
            const currentTaskLines = allValues.taches || [];
            if (currentTaskLines.length === 0) {
                form.setFieldValue('taches', [{}]);
                return;
            }
            const lastTaskLine = currentTaskLines[currentTaskLines.length - 1];
            const isLastLineComplete = Boolean(
                lastTaskLine?.nom?.trim()
                || lastTaskLine?.description?.trim()
                || lastTaskLine?.notes?.trim()
                || lastTaskLine?.status
                || lastTaskLine?.technicienId
                || lastTaskLine?.dateDebut
                || lastTaskLine?.dateFin
                || lastTaskLine?.statusDate
                || (lastTaskLine?.dureeEstimee || 0) > 0
                || (lastTaskLine?.dureeReelle || 0) > 0
            );
            if (isLastLineComplete) {
                form.setFieldValue('taches', [...currentTaskLines, {}]);
                return;
            }
        }

        if (
            changedValues.forfaits !== undefined ||
            changedValues.produits !== undefined ||
            changedValues.services !== undefined ||
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
            render: (value: string) => value || '-'
        },
        {
            title: 'Type',
            dataIndex: 'type',
            render: (value: VenteType) => typeOptions.find((item) => item.value === value)?.label || value
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            render: (value: VenteStatus) => {
                const label = statusOptions.find((item) => item.value === value)?.label || value;
                return <Tag color={statusColor[value] || 'default'}>{label}</Tag>;
            }
        },
        {
            title: 'Client',
            dataIndex: 'client',
            render: (value: ClientEntity) => getClientLabel(value)
        },
        {
            title: 'Forfaits',
            dataIndex: 'forfaits',
            render: (values: ForfaitEntity[]) => values?.length || 0
        },
        {
            title: 'Produits',
            dataIndex: 'produits',
            render: (values: ProduitCatalogueEntity[]) => values?.length || 0
        },
        {
            title: 'Services',
            dataIndex: 'services',
            render: (values: ServiceEntity[]) => values?.length || 0
        },
        {
            title: 'Mode paiement',
            dataIndex: 'modePaiement',
            render: (value: ModePaiement) => modePaiementOptions.find((item) => item.value === value)?.label || value || '-'
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
                    <Dropdown menu={{ items: paymentMenuItems(record) }} placement="bottomRight">
                        <Button title="Lien de paiement" icon={<CreditCardOutlined />} />
                    </Dropdown>
                    <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm
                        title="Supprimer cette vente ?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Oui"
                        cancelText="Non"
                    >
                        <Button danger icon={<DeleteOutlined />} />
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
                initialValues={{ status: undefined, type: undefined, clientId: undefined }}
                onFinish={(values) => {
                    const nextFilters: SearchFilters = {
                        status: values.status,
                        type: values.type,
                        clientId: values.clientId
                    };
                    setFilters(nextFilters);
                    fetchVentes(nextFilters);
                }}
            >
                <Row gutter={16}>
                    <Col span={6}>
                        <Form.Item name="status" label="Statut">
                            <Select allowClear options={statusOptions} placeholder="Tous les statuts" />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="type" label="Type">
                            <Select allowClear options={typeOptions} placeholder="Tous les types" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="clientId" label="Client">
                            <Select allowClear showSearch options={clientOptions} placeholder="Tous les clients" />
                        </Form.Item>
                    </Col>
                    <Col span={4} style={{ display: 'flex', alignItems: 'end' }}>
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
                onCancel={() => setModalVisible(false)}
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
                    <Dropdown
                        key="payment"
                        menu={{ items: currentVente ? paymentMenuItems(currentVente) : [] }}
                        placement="topRight"
                        disabled={!currentVente}
                    >
                        <Button icon={<CreditCardOutlined />}>
                            Lien de paiement
                        </Button>
                    </Dropdown>,
                    <Button key="cancel" onClick={() => setModalVisible(false)}>
                        Annuler
                    </Button>,
                    <Button key="save" type="primary" onClick={handleSave}>
                        Enregistrer
                    </Button>
                ]}
                maskClosable={false}
                destroyOnHidden
                width={1100}
            >
                <Form form={form} layout="vertical" initialValues={defaultVente} onValuesChange={onValuesChange}>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item
                                name="type"
                                label="Type"
                                rules={[{ required: true, message: 'Le type est requis' }]}
                            >
                                <Select options={typeOptions} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="status"
                                label="Statut"
                                rules={[{ required: true, message: 'Le statut est requis' }]}
                            >
                                <Select options={statusOptions} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="date" label="Date">
                                <Input type="date" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="modePaiement" label="Mode de paiement">
                                <Select allowClear options={modePaiementOptions} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="clientId" label="Client">
                                <Select allowClear showSearch options={clientOptions} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="bateauId" label="Bateau">
                                <Select allowClear showSearch options={bateauOptions} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="moteurId" label="Moteur">
                                <Select allowClear showSearch options={moteurOptions} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="remorqueId" label="Remorque">
                                <Select allowClear showSearch options={remorqueOptions} />
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
                                            <Form.List name="forfaits">
                                                {(fields, { remove }) => (
                                                    <>
                                                        {fields.map((field) => (
                                                            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'forfaitId']}
                                                                    rules={[
                                                                        {
                                                                            validator: async (_, value) => {
                                                                                const line = form.getFieldValue(['forfaits', field.name]);
                                                                                const quantite = Number(line?.quantite || 0);
                                                                                if (!value && quantite > 0) {
                                                                                    throw new Error('Forfait requis');
                                                                                }
                                                                            }
                                                                        }
                                                                    ]}
                                                                    style={{ width: 520 }}
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
                                                                                const line = form.getFieldValue(['forfaits', field.name]);
                                                                                if (!line?.forfaitId && (value === undefined || value === null)) {
                                                                                    return;
                                                                                }
                                                                                if (!value || value <= 0) {
                                                                                    throw new Error('Quantite requise');
                                                                                }
                                                                            }
                                                                        }
                                                                    ]}
                                                                    style={{ width: 180 }}
                                                                >
                                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const forfaitId = getFieldValue(['forfaits', field.name, 'forfaitId']);
                                                                        const quantite = getFieldValue(['forfaits', field.name, 'quantite']) || 0;
                                                                        const prixUnitaireTTC = forfaits.find((item) => item.id === forfaitId)?.prixTTC || 0;
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
                                                        ))}
                                                    </>
                                                )}
                                            </Form.List>
                                        </Form.Item>

                                        <Form.Item label="Produits">
                                            <Form.List name="produits">
                                                {(fields, { remove }) => (
                                                    <>
                                                        {fields.map((field) => (
                                                            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'produitId']}
                                                                    rules={[
                                                                        {
                                                                            validator: async (_, value) => {
                                                                                const line = form.getFieldValue(['produits', field.name]);
                                                                                const quantite = Number(line?.quantite || 0);
                                                                                if (!value && quantite > 0) {
                                                                                    throw new Error('Produit requis');
                                                                                }
                                                                            }
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
                                                                    style={{ width: 180 }}
                                                                >
                                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const produitId = getFieldValue(['produits', field.name, 'produitId']);
                                                                        const quantite = getFieldValue(['produits', field.name, 'quantite']) || 0;
                                                                        const prixUnitaireTTC = produits.find((item) => item.id === produitId)?.prixVenteTTC || 0;
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
                                                        ))}
                                                    </>
                                                )}
                                            </Form.List>
                                        </Form.Item>

                                        <Form.Item label="Services">
                                            <Form.List name="services">
                                                {(fields, { remove }) => (
                                                    <>
                                                        {fields.map((field) => (
                                                            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'serviceId']}
                                                                    rules={[
                                                                        {
                                                                            validator: async (_, value) => {
                                                                                const line = form.getFieldValue(['services', field.name]);
                                                                                const quantite = Number(line?.quantite || 0);
                                                                                if (!value && quantite > 0) {
                                                                                    throw new Error('Service requis');
                                                                                }
                                                                            }
                                                                        }
                                                                    ]}
                                                                    style={{ width: 520 }}
                                                                >
                                                                    <Select allowClear showSearch options={serviceOptions} placeholder="Service" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'quantite']}
                                                                    rules={[
                                                                        {
                                                                            validator: async (_, value) => {
                                                                                const line = form.getFieldValue(['services', field.name]);
                                                                                if (!line?.serviceId && (value === undefined || value === null)) {
                                                                                    return;
                                                                                }
                                                                                if (!value || value <= 0) {
                                                                                    throw new Error('Quantite requise');
                                                                                }
                                                                            }
                                                                        }
                                                                    ]}
                                                                    style={{ width: 180 }}
                                                                >
                                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const serviceId = getFieldValue(['services', field.name, 'serviceId']);
                                                                        const quantite = getFieldValue(['services', field.name, 'quantite']) || 0;
                                                                        const prixUnitaireTTC = services.find((item) => item.id === serviceId)?.prixTTC || 0;
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
                                                        ))}
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
                                                        <Row gutter={12}>
                                                            <Col span={8}>
                                                                <Form.Item {...field} name={[field.name, 'nom']} label="Nom">
                                                                    <Input allowClear />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={8}>
                                                                <Form.Item {...field} name={[field.name, 'status']} label="Statut">
                                                                    <Select allowClear options={taskStatusOptions} placeholder="Statut" />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={8}>
                                                                <Form.Item {...field} name={[field.name, 'technicienId']} label="Technicien">
                                                                    <Select allowClear showSearch options={technicienOptions} placeholder="Technicien" />
                                                                </Form.Item>
                                                            </Col>
                                                        </Row>
                                                        <Row gutter={12}>
                                                            <Col span={8}>
                                                                <Form.Item {...field} name={[field.name, 'dateDebut']} label="Date debut">
                                                                    <Input type="date" />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={8}>
                                                                <Form.Item {...field} name={[field.name, 'dateFin']} label="Date fin">
                                                                    <Input type="date" />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={8}>
                                                                <Form.Item {...field} name={[field.name, 'statusDate']} label="Date statut">
                                                                    <Input type="date" />
                                                                </Form.Item>
                                                            </Col>
                                                        </Row>
                                                        <Row gutter={12}>
                                                            <Col span={12}>
                                                                <Form.Item {...field} name={[field.name, 'dureeEstimee']} label="Durée estimée">
                                                                    <InputNumber
                                                                        min={0}
                                                                        step={0.25}
                                                                        precision={2}
                                                                        style={{ width: '100%' }}
                                                                        addonAfter="h"
                                                                    />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={12}>
                                                                <Form.Item {...field} name={[field.name, 'dureeReelle']} label="Durée réelle">
                                                                    <InputNumber
                                                                        min={0}
                                                                        step={0.25}
                                                                        precision={2}
                                                                        style={{ width: '100%' }}
                                                                        addonAfter="h"
                                                                    />
                                                                </Form.Item>
                                                            </Col>
                                                        </Row>
                                                        <Form.Item {...field} name={[field.name, 'description']} label="Description">
                                                            <Input.TextArea rows={2} />
                                                        </Form.Item>
                                                        <Form.Item {...field} name={[field.name, 'notes']} label="Notes">
                                                            <Input.TextArea rows={2} />
                                                        </Form.Item>
                                                        <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.taches?.[field.name]?.status !== cur?.taches?.[field.name]?.status}>
                                                            {({ getFieldValue }) => {
                                                                const status = getFieldValue(['taches', field.name, 'status']);
                                                                if (status !== 'INCIDENT') return null;
                                                                return (
                                                                    <Card size="small" title="Incident" style={{ marginBottom: 12, borderColor: '#ff4d4f' }}>
                                                                        <Row gutter={12}>
                                                                            <Col span={8}>
                                                                                <Form.Item {...field} name={[field.name, 'incidentDate']} label="Date de l'incident">
                                                                                    <Input type="date" />
                                                                                </Form.Item>
                                                                            </Col>
                                                                            <Col span={16}>
                                                                                <Form.Item {...field} name={[field.name, 'incidentDetails']} label="Details de l'incident">
                                                                                    <Input.TextArea rows={2} />
                                                                                </Form.Item>
                                                                            </Col>
                                                                        </Row>
                                                                    </Card>
                                                                );
                                                            }}
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
                        <Col span={6}>
                            <Form.Item name="montantHT" label="Montant HT">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} disabled />
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
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} disabled />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="montantTTC" label="Montant TTC">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} disabled />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="prixVenteTTC" label="Prix vente TTC">
                                <InputNumber addonAfter="EUR" min={0} step={0.01} style={{ width: '100%' }} disabled />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </Card>
    );
}
