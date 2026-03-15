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
    Table,
    Tag,
    Dropdown,
    message
} from 'antd';
import { CreditCardOutlined, DeleteOutlined, EditOutlined, PlusCircleOutlined, PrinterOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';

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
    prixVenteTTC?: number;
}

interface ServiceEntity {
    id: number;
    nom: string;
    prixTTC?: number;
}

interface TaskEntity {
    id?: number;
    nom?: string;
}

type VenteStatus = 'PAYEE';
type VenteType = 'DEVIS' | 'FACTURE' | 'COMMANDE' | 'LIVRAISON' | 'COMPTOIR';
type ModePaiement = 'CHEQUE' | 'VIREMENT' | 'CARTE' | 'ESPÈCES';

interface VenteEntity {
    id?: number;
    type: VenteType;
    status: VenteStatus;
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

interface SearchFilters {
    clientId?: number;
}

const modePaiementOptions: Array<{ value: ModePaiement; label: string }> = [
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'CARTE', label: 'Carte' },
    { value: 'ESPÈCES', label: 'Especes' }
];

const defaultVente: VenteFormValues = {
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

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} EUR`;
const formatDate = (value?: string) => {
    if (!value) {
        return '-';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleDateString('fr-FR');
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

    const fetchVentes = async (nextFilters?: SearchFilters) => {
        setLoading(true);
        try {
            const activeFilters = nextFilters || {};
            const response = await axios.get('/ventes/search', {
                params: {
                    type: 'COMPTOIR',
                    status: 'PAYEE',
                    ...(activeFilters.clientId !== undefined ? { clientId: activeFilters.clientId } : {})
                }
            });
            const data = (response.data || []).filter((vente: VenteEntity) => vente.type === 'COMPTOIR');
            setVentes(data);
        } catch {
            message.error('Erreur lors du chargement des ventes comptoir.');
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
                servicesRes
            ] = await Promise.all([
                axios.get('/clients'),
                axios.get('/bateaux'),
                axios.get('/moteurs'),
                axios.get('/remorques'),
                axios.get('/forfaits'),
                axios.get('/catalogue/produits'),
                axios.get('/services')
            ]);
            setClients(clientsRes.data || []);
            setBateaux(bateauxRes.data || []);
            setMoteurs(moteursRes.data || []);
            setRemorques(remorquesRes.data || []);
            setForfaits(forfaitsRes.data || []);
            setProduits(produitsRes.data || []);
            setServices(servicesRes.data || []);
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
            const produitLinesMap = (vente.produits || []).reduce((acc, item) => {
                if (!item?.id) {
                    return acc;
                }
                acc.set(item.id, (acc.get(item.id) || 0) + 1);
                return acc;
            }, new Map<number, number>());
            const produitLines = Array.from(produitLinesMap.entries()).map(([produitId, quantite]) => ({ produitId, quantite }));
            form.setFieldsValue({
                clientId: vente.client?.id,
                bateauId: vente.bateau?.id,
                moteurId: vente.moteur?.id,
                remorqueId: vente.remorque?.id,
                forfaits: (vente.forfaits || []).filter((item) => !!item?.id).map((item) => ({ forfaitId: item.id, quantite: 1 })),
                produits: [...produitLines, {}],
                services: (vente.services || []).filter((item) => !!item?.id).map((item) => ({ serviceId: item.id, quantite: 1 })),
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

    const expandByQuantity = <T,>(items: T[], quantite: number): T[] =>
        Array.from({ length: Math.max(1, Math.floor(quantite || 1)) }, () => items).flat();

    const toPayload = (values: VenteFormValues): VenteEntity => ({
        status: 'PAYEE',
        type: 'COMPTOIR',
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
                const res = await axios.put(`/ventes/${currentVente.id}`, { ...currentVente, ...payload, type: 'COMPTOIR' });
                message.success('Vente comptoir modifiee avec succes');
                setCurrentVente(res.data);
                form.setFieldsValue(values);
            } else {
                const res = await axios.post('/ventes', payload);
                message.success('Vente comptoir ajoutee avec succes');
                setIsEdit(true);
                setCurrentVente(res.data);
                form.setFieldsValue(values);
            }
            fetchVentes(filters);
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
            await axios.delete(`/ventes/${id}`);
            message.success('Vente comptoir supprimee avec succes');
            fetchVentes(filters);
        } catch {
            message.error('Erreur lors de la suppression de la vente comptoir.');
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
            .map((produit) => `
                <tr>
                    <td>${escapeHtml(`${produit.nom}${produit.marque ? ` (${produit.marque})` : ''}`)}</td>
                    <td style="text-align:right;">${produit.quantite}</td>
                </tr>
            `)
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
                                <th style="text-align:right;">Quantite</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${produitRows || '<tr><td colspan="2">Aucun produit</td></tr>'}
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
            .map((produit) => `
                <div class="line">
                    <span>${escapeHtml(`${produit.nom}${produit.marque ? ` (${produit.marque})` : ''}`)}</span>
                    <span>x${produit.quantite}</span>
                </div>
            `)
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
                    <Button title="Imprimer facture" icon={<FileTextOutlined />} onClick={() => handlePrintInvoice(record)} />
                    <Button title="Imprimer ticket de caisse" icon={<PrinterOutlined />} onClick={() => handlePrintReceipt(record)} />
                    <Dropdown menu={{ items: paymentMenuItems(record) }} placement="bottomRight">
                        <Button title="Lien de paiement" icon={<CreditCardOutlined />} />
                    </Dropdown>
                    <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm
                        title="Supprimer cette vente comptoir ?"
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
        <Card title="Comptoir">
            <Form
                form={searchForm}
                layout="vertical"
                initialValues={{ clientId: undefined }}
                onFinish={(values) => {
                    const nextFilters: SearchFilters = { clientId: values.clientId };
                    setFilters(nextFilters);
                    fetchVentes(nextFilters);
                }}
            >
                <Row gutter={16}>
                    <Col span={10}>
                        <Form.Item name="clientId" label="Client">
                            <Select allowClear showSearch options={clientOptions} placeholder="Tous les clients" />
                        </Form.Item>
                    </Col>
                    <Col span={6} style={{ display: 'flex', alignItems: 'end' }}>
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

            <Table
                rowKey="id"
                dataSource={ventes}
                columns={columns}
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
            />

            <Modal
                title={isEdit ? 'Modifier une vente comptoir' : 'Ajouter une vente comptoir'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    <Button
                        key="print-invoice"
                        icon={<FileTextOutlined />}
                        disabled={!currentVente}
                        onClick={() => currentVente && handlePrintInvoice(currentVente)}
                    >
                        Imprimer facture
                    </Button>,
                    <Button
                        key="print-receipt"
                        icon={<PrinterOutlined />}
                        disabled={!currentVente}
                        onClick={() => currentVente && handlePrintReceipt(currentVente)}
                    >
                        Imprimer ticket
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
                        <Col span={8}>
                            <Form.Item name="date" label="Date">
                                <Input type="date" />
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
                                <Select allowClear showSearch options={clientOptions} />
                            </Form.Item>
                        </Col>
                    </Row>

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
                                            <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                        </Space>
                                    ))}
                                </>
                            )}
                        </Form.List>
                    </Form.Item>

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
