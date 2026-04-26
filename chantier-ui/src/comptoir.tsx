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
    produits?: ProduitCatalogueEntity[];
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
}

interface VenteFormValues {
    status: VenteStatus;
    bonPourAccord?: boolean;
    signatureBonPourAccord?: string;
    clientId?: number;
    bateauId?: number;
    moteurId?: number;
    remorqueId?: number;
    forfaits: Array<{ forfaitId?: number; quantite: number }>;
    produits: Array<{ produitId?: number; quantite?: number }>;
    services: Array<{ serviceId?: number; quantite: number }>;
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

    const handleProduitSearch = (value: string) => {
        if (produitSearchTimeout) clearTimeout(produitSearchTimeout);
        if (!value || value.trim() === '') return;
        const timeout = setTimeout(async () => {
            try {
                const res = await api.get(`/catalogue/produits/search?q=${encodeURIComponent(value)}`);
                setProduits((prev) => mergeById(prev, res.data || []));
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
    const produitOptions = useMemo(
        () => produits.map((produit) => ({ value: produit.id, label: `${produit.nom}${produit.marque ? ` (${produit.marque})` : ''}` })),
        [produits]
    );
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
                params: { status: 'FACTURE_PAYEE' }
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
                servicesRes
            ] = await Promise.all([
                api.get('/bateaux'),
                api.get('/moteurs'),
                api.get('/remorques'),
                api.get('/forfaits'),
                api.get('/services')
            ]);
            setBateaux(bateauxRes.data || []);
            setMoteurs(moteursRes.data || []);
            setRemorques(remorquesRes.data || []);
            setForfaits(forfaitsRes.data || []);
            setServices(servicesRes.data || []);
        } catch {
            message.error('Erreur lors du chargement des listes de reference.');
        }
    };

    useEffect(() => {
        fetchVentes();
        fetchOptions();
    }, []);

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
            const venteProduits = (vente.produits || []).filter((p): p is ProduitCatalogueEntity => !!p?.id);
            if (venteProduits.length > 0) {
                setProduits((prev) => mergeById(prev, venteProduits));
            }
            const produitLinesMap = (vente.produits || []).reduce((acc, item) => {
                if (!item?.id) {
                    return acc;
                }
                acc.set(item.id, (acc.get(item.id) || 0) + 1);
                return acc;
            }, new Map<number, number>());
            const produitLines = Array.from(produitLinesMap.entries()).map(([produitId, quantite]) => ({ produitId, quantite }));
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

    const expandByQuantity = <T,>(items: T[], quantite: number): T[] =>
        Array.from({ length: Math.max(1, Math.floor(quantite || 1)) }, () => items).flat();

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
                return item ? expandByQuantity([item], line.quantite) : [];
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
                return item ? expandByQuantity([item], line.quantite) : [];
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
            fetchVentes(filters);
        } catch (error) {
            const formError = error as { errorFields?: unknown[] };
            if (Array.isArray(formError.errorFields) && formError.errorFields.length > 0) {
                // Les erreurs de validation sont affichees dans le formulaire.
                return;
            }
            if (api.isAxiosError(error)) {
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
            fetchVentes(filters);
        } catch {
            message.error('Erreur lors de la suppression de la vente comptoir.');
        }
    };

    const handleMarkPaid = async () => {
        if (!currentVente?.id) return;
        const values = await form.validateFields();
        if (!values.modePaiement) {
            message.warning('Veuillez sélectionner un mode de paiement');
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
            fetchVentes(filters);
        } catch {
            message.error('Erreur lors du marquage comme payée');
            form.setFieldsValue({ status: 'FACTURE_PRETE' });
        }
    };

    const getProduitLines = (vente: VenteEntity) => {
        const quantites = (vente.produits || []).reduce((acc, produit) => {
            const key = `${produit.id}`;
            const current = acc.get(key) || { ...produit, quantite: 0 };
            current.quantite += 1;
            acc.set(key, current);
            return acc;
        }, new Map<string, (ProduitCatalogueEntity & { quantite: number })>());

        return Array.from(quantites.values());
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

    const handlePrintInvoice = (vente: VenteEntity) => {
        const title = `Facture #${vente.id || '-'}`;
        const produitRows = getProduitLines(vente)
            .map((produit) => {
                const pu = produit.prixVenteTTC || 0;
                const total = pu * produit.quantite;
                return `
                <tr>
                    <td>${escapeHtml(`${produit.nom}${produit.marque ? ` (${produit.marque})` : ''}`)}</td>
                    <td style="text-align:right;">${escapeHtml(formatEuro(pu))}</td>
                    <td style="text-align:right;">${produit.quantite}</td>
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
                    <div class="row"><strong>Mode de paiement:</strong> ${escapeHtml(vente.modePaiement || '-')}</div>
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
                                <th style="text-align:right;">Total TTC</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${produitRows || '<tr><td colspan="4">Aucun produit</td></tr>'}
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
            .map((produit) => {
                const pu = produit.prixVenteTTC || 0;
                const total = pu * produit.quantite;
                return `
                <div class="line">
                    <span>${escapeHtml(`${produit.nom}${produit.marque ? ` (${produit.marque})` : ''}`)}</span>
                    <span>x${produit.quantite}</span>
                </div>
                <div class="line sub">
                    <span>${escapeHtml(formatEuro(pu))} /u</span>
                    <span>${escapeHtml(formatEuro(total))}</span>
                </div>`;
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
                    <div class="line"><span>Paiement</span><span>${escapeHtml(vente.modePaiement || '-')}</span></div>
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

        const forfaitsTTC = forfaitLines.reduce((sum: number, line: { forfaitId?: number; quantite?: number }) => {
            const prixUnitaire = forfaits.find((item) => item.id === line.forfaitId)?.prixTTC || 0;
            return sum + (prixUnitaire * Math.max(1, Math.floor(line.quantite || 1)));
        }, 0);
        const produitsTTC = produitLines.reduce((sum: number, line: { produitId?: number; quantite?: number }) => {
            const prixUnitaire = produits.find((item) => item.id === line.produitId)?.prixVenteTTC || 0;
            return sum + (prixUnitaire * Math.max(1, Math.floor(line.quantite || 1)));
        }, 0);
        const servicesTTC = serviceLines.reduce((sum: number, line: { serviceId?: number; quantite?: number }) => {
            const prixUnitaire = services.find((item) => item.id === line.serviceId)?.prixTTC || 0;
            return sum + (prixUnitaire * Math.max(1, Math.floor(line.quantite || 1)));
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
            title: 'Statut',
            dataIndex: 'status',
            render: (value: VenteStatus) => <Tag color={statusColor[value] || 'default'}>{statusLabel[value] || value}</Tag>
        },
        {
            title: 'Client',
            dataIndex: 'client',
            render: (value: ClientEntity) => getClientLabel(value)
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
            <Row gutter={16} align="middle">
                <Col flex="auto">
                    <Input.Search
                        placeholder="Rechercher par client, date, mode de paiement..."
                        allowClear
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onSearch={(value) => setSearchQuery(value)}
                    />
                </Col>
                <Col>
                    <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                </Col>
            </Row>

            <div style={{ marginTop: 16 }} />

            <Table
                rowKey="id"
                dataSource={filteredVentes}
                columns={columns}
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
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
                        <Col span={8}>
                            <Form.Item name="modePaiement" label="Mode de paiement">
                                <Select allowClear options={modePaiementOptions} />
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
                                                const produitId = form.getFieldValue(['produits', field.name, 'produitId']);
                                                const prixUnitaire = produits.find((p) => p.id === produitId)?.prixVenteTTC;
                                                const quantite = form.getFieldValue(['produits', field.name, 'quantite']);
                                                const totalLigne = (prixUnitaire && quantite) ? Math.round(prixUnitaire * quantite * 100) / 100 : undefined;
                                                const isEmptyLine = !produitId;
                                                return (
                                                <Space align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
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
                                                        style={{ width: 420 }}
                                                    >
                                                        <Select
                                                            allowClear
                                                            showSearch
                                                            options={produitOptions}
                                                            filterOption={false}
                                                            onSearch={handleProduitSearch}
                                                            notFoundContent={null}
                                                            placeholder="Rechercher un produit par nom, marque, catégorie ou réf."
                                                        />
                                                    </Form.Item>
                                                    <Form.Item style={{ width: 150 }}>
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
                                                                    if (!line?.produitId && (value === undefined || value === null)) {
                                                                        return;
                                                                    }
                                                                    if (!value || value <= 0) {
                                                                        throw new Error('Quantite requise');
                                                                    }
                                                                }
                                                            }
                                                        ]}
                                                        style={{ width: 150 }}
                                                    >
                                                        <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qte" />
                                                    </Form.Item>
                                                    <Form.Item style={{ width: 150 }}>
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
            </Modal>
        </Card>
    );
}
