import React, { useEffect, useMemo, useState } from 'react';
import MosaicTable from "./MosaicTable.tsx";
import {
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
    Tabs,
    Table,
    message
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import api from './api.ts';
import { bateauClientOptions, moteurClientOptions, filterClientOption } from './forfait-clients.ts';
import { produitLigneOptions, mainOeuvreLigneOptions, filterLigneOption } from './forfait-lignes.ts';
import LignesArticles from './LignesArticles.tsx';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import ImageUpload from './ImageUpload.tsx';
import { paginationConfig } from './pagination.ts';
import SearchAutoComplete from './SearchAutoComplete.tsx';

interface MoteurCatalogueEntity {
    id: number;
    designation: string;
}

interface BateauCatalogueEntity {
    id: number;
    designation: string;
}

interface ProduitCatalogueEntity {
    id: number;
    designation: string;
    categorie?: string;
    ref?: string;
    refs?: string[];
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
    referencesFournisseurs?: string[];
}

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


const defaultNewProduit = {
    designation: '', categorie: '', ref: '', refs: [], images: [], description: '',
    evaluation: 0, stock: 0, stockMini: 0, emplacement: '', emplacementMagasin: '',
    prixVenteHT: 0, tva: 20, montantTVA: 0, prixVenteTTC: 0,
};

const defaultNewMainOeuvre = {
    reference: '', nom: '', description: '', prixHT: 0, tva: 20, montantTVA: 0, prixTTC: 0,
};

interface ForfaitProduitEntity {
    id?: number;
    produit?: ProduitCatalogueEntity;
    quantite: number;
}

interface ForfaitMainOeuvreEntity {
    id?: number;
    mainOeuvre?: MainOeuvreEntity;
    quantite: number;
}

interface TaskEntity {
    id?: number;
    nom?: string;
    description?: string;
    done?: boolean;
}

interface ForfaitEntity {
    id?: number;
    reference?: string;
    nom: string;
    dureeEstimee: number;
    moteursAssocies: MoteurCatalogueEntity[];
    bateauxAssocies: BateauCatalogueEntity[];
    bateauxClientsAssocies?: Array<{ id: number }>;
    moteursClientsAssocies?: Array<{ id: number }>;
    produits: ForfaitProduitEntity[];
    mainOeuvres: ForfaitMainOeuvreEntity[];
    heuresFonctionnement: number;
    joursFrequence: number;
    prixHT: number;
    tva: number;
    montantTVA: number;
    prixTTC: number;
    taches?: TaskEntity[];
}

interface ForfaitFormValues {
    reference: string;
    nom: string;
    dureeEstimee: number;
    moteurIds: number[];
    bateauIds: number[];
    moteurClientIds: number[];
    bateauClientIds: number[];
    produits: Array<{ produitId?: number; quantite?: number }>;
    mainOeuvres: Array<{ mainOeuvreId?: number; quantite?: number }>;
    taches: Array<{
        id?: number;
        nom?: string;
        description?: string;
    }>;
    heuresFonctionnement: number;
    joursFrequence: number;
    prixHT: number;
    tva: number;
    remise: number;
    remiseEuros: number;
    montantTVA: number;
    prixTTC: number;
}

const defaultForfait: ForfaitFormValues = {
    reference: '',
    nom: '',
    dureeEstimee: 0,
    moteurIds: [],
    bateauIds: [],
    moteurClientIds: [],
    bateauClientIds: [],
    produits: [{}],
    mainOeuvres: [{}],
    taches: [{}],
    heuresFonctionnement: 0,
    joursFrequence: 0,
    prixHT: 0,
    tva: 20,
    remise: 0,
    remiseEuros: 0,
    montantTVA: 0,
    prixTTC: 0
};

const formatEuro = (value?: number) => `${(value || 0).toFixed(2)} €`;

export default function Forfaits() {
    const PRODUIT_CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');
    const [forfaits, setForfaits] = useState<ForfaitEntity[]>([]);
    const [moteurs, setMoteurs] = useState<MoteurCatalogueEntity[]>([]);
    const [bateaux, setBateaux] = useState<BateauCatalogueEntity[]>([]);
    const [bateauxClients, setBateauxClients] = useState<any[]>([]);
    const [moteursClients, setMoteursClients] = useState<any[]>([]);
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [mainOeuvresList, setMainOeuvresList] = useState<MainOeuvreEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentForfait, setCurrentForfait] = useState<ForfaitEntity | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm<ForfaitFormValues>();
    const [formDirty, setFormDirty] = useState(false);
    const [newProduitModalVisible, setNewProduitModalVisible] = useState(false);
    const [newProduitTargetLine, setNewProduitTargetLine] = useState<number | null>(null);
    const [newProduitForm] = Form.useForm();
    const [newProduitFormDirty, setNewProduitFormDirty] = useState(false);
    const [newMainOeuvreModalVisible, setNewMainOeuvreModalVisible] = useState(false);
    const [newMainOeuvreTargetLine, setNewMainOeuvreTargetLine] = useState<number | null>(null);
    const [newMainOeuvreForm] = Form.useForm();
    const [newMainOeuvreFormDirty, setNewMainOeuvreFormDirty] = useState(false);

    const moteurOptions = useMemo(
        () => moteurs.map((moteur) => ({ value: moteur.id, label: moteur.designation })),
        [moteurs]
    );

    const bateauOptions = useMemo(
        () => bateaux.map((bateau) => ({ value: bateau.id, label: bateau.designation })),
        [bateaux]
    );

    const produitOptions = useMemo(
        () => produitLigneOptions(produits),
        [produits]
    );

    const mainOeuvreOptions = useMemo(
        () => mainOeuvreLigneOptions(mainOeuvresList),
        [mainOeuvresList]
    );


    const bateauClientSelectOptions = useMemo(() => bateauClientOptions(bateauxClients), [bateauxClients]);
    const moteurClientSelectOptions = useMemo(
        () => moteurClientOptions(moteursClients, bateauxClients),
        [moteursClients, bateauxClients]
    );

    const fetchForfaits = async (query?: string) => {
        setLoading(true);
        try {
            const endpoint = query && query.trim() ? '/forfaits/search' : '/forfaits';
            const response = await api.get(endpoint, { params: query && query.trim() ? { q: query } : {} });
            setForfaits(response.data || []);
        } catch {
            message.error('Erreur lors du chargement des forfaits.');
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [moteursRes, bateauxRes, produitsRes, mainOeuvresRes, bateauxClientsRes, moteursClientsRes] = await Promise.all([
                api.get('/catalogue/moteurs'),
                api.get('/catalogue/bateaux'),
                api.get('/catalogue/produits/search'),
                api.get('/main-oeuvres'),
                api.get('/bateaux'),
                api.get('/moteurs'),
            ]);
            setBateauxClients(bateauxClientsRes.data || []);
            setMoteursClients(moteursClientsRes.data || []);
            setMoteurs(moteursRes.data || []);
            setBateaux(bateauxRes.data || []);
            setProduits(produitsRes.data || []);
            setMainOeuvresList(mainOeuvresRes.data || []);
        } catch {
            message.error('Erreur lors du chargement des listes de référence.');
        }
    };

    useEffect(() => {
        fetchForfaits();
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
            newProduitForm.setFieldValue('prixVenteTTC', Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100);
        }
        if (changedValues.prixVenteTTC !== undefined) {
            const prixVenteTTC = newProduitForm.getFieldValue('prixVenteTTC') || 0;
            const tva = newProduitForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            newProduitForm.setFieldValue('montantTVA', montantTVA);
            newProduitForm.setFieldValue('prixVenteHT', Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100);
        }
    };

    const openNewMainOeuvreModal = (lineIndex: number) => {
        setNewMainOeuvreTargetLine(lineIndex);
        newMainOeuvreForm.resetFields();
        newMainOeuvreForm.setFieldsValue(defaultNewMainOeuvre);
        setNewMainOeuvreFormDirty(false);
        setNewMainOeuvreModalVisible(true);
    };

    const handleNewMainOeuvreSave = async () => {
        try {
            const values = await newMainOeuvreForm.validateFields();
            const res = await api.post('/main-oeuvres', values);
            const created = res.data as MainOeuvreEntity;
            message.success("Main d'oeuvre ajoutée avec succès");
            setMainOeuvresList((prev) => [...prev, created]);
            if (newMainOeuvreTargetLine !== null && created.id) {
                const currentLines = form.getFieldValue('mainOeuvres') || [];
                const updated = [...currentLines];
                updated[newMainOeuvreTargetLine] = { ...updated[newMainOeuvreTargetLine], mainOeuvreId: created.id };
                form.setFieldValue('mainOeuvres', updated);
            }
            setNewMainOeuvreFormDirty(false);
            setNewMainOeuvreModalVisible(false);
        } catch {
            // validation errors shown in form
        }
    };

    const onNewMainOeuvreValuesChange = (changedValues: Record<string, unknown>) => {
        if (changedValues.prixHT !== undefined || changedValues.tva !== undefined) {
            const prixHT = newMainOeuvreForm.getFieldValue('prixHT') || 0;
            const tva = newMainOeuvreForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            newMainOeuvreForm.setFieldValue('montantTVA', montantTVA);
            newMainOeuvreForm.setFieldValue('prixTTC', Math.round(((prixHT + montantTVA) + Number.EPSILON) * 100) / 100);
        }
        if (changedValues.prixTTC !== undefined) {
            const prixTTC = newMainOeuvreForm.getFieldValue('prixTTC') || 0;
            const tva = newMainOeuvreForm.getFieldValue('tva') || 0;
            const montantTVA = Math.round((((prixTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            newMainOeuvreForm.setFieldValue('montantTVA', montantTVA);
            newMainOeuvreForm.setFieldValue('prixHT', Math.round(((prixTTC - montantTVA) + Number.EPSILON) * 100) / 100);
        }
    };

    const openModal = (forfait?: ForfaitEntity) => {
        if (forfait) {
            setIsEdit(true);
            setCurrentForfait(forfait);
            form.setFieldsValue({
                reference: forfait.reference || '',
                nom: forfait.nom || '',
                dureeEstimee: forfait.dureeEstimee || 0,
                moteurIds: (forfait.moteursAssocies || []).map((m) => m.id),
                bateauIds: (forfait.bateauxAssocies || []).map((b) => b.id),
                moteurClientIds: (forfait.moteursClientsAssocies || []).map((m) => m.id),
                bateauClientIds: (forfait.bateauxClientsAssocies || []).map((b) => b.id),
                produits: (forfait.produits || [])
                    .filter((item) => item.produit?.id)
                    .map<ForfaitFormValues['produits'][number]>((item) => ({ produitId: item.produit!.id, quantite: item.quantite || 1 }))
                    .concat({}),
                mainOeuvres: (forfait.mainOeuvres || [])
                    .filter((item) => item.mainOeuvre?.id)
                    .map<ForfaitFormValues['mainOeuvres'][number]>((item) => ({ mainOeuvreId: item.mainOeuvre!.id, quantite: item.quantite || 1 }))
                    .concat({}),
                taches: (forfait.taches || [])
                    .map<ForfaitFormValues['taches'][number]>((tache) => ({
                        id: tache.id,
                        nom: tache.nom || '',
                        description: tache.description || '',
                    }))
                    .concat({}),
                heuresFonctionnement: forfait.heuresFonctionnement || 0,
                joursFrequence: forfait.joursFrequence || 0,
                prixHT: forfait.prixHT || 0,
                tva: forfait.tva || 0,
                remise: 0,
                remiseEuros: 0,
                montantTVA: forfait.montantTVA || 0,
                prixTTC: forfait.prixTTC || 0
            });
        } else {
            setIsEdit(false);
            setCurrentForfait(null);
            form.resetFields();
            form.setFieldsValue(defaultForfait);
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

    const handleNewMainOeuvreCancel = () => {
        if (newMainOeuvreFormDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => {
                    setNewMainOeuvreFormDirty(false);
                    setNewMainOeuvreModalVisible(false);
                },
            });
        } else {
            setNewMainOeuvreModalVisible(false);
        }
    };

    const toPayload = (values: ForfaitFormValues): Partial<ForfaitEntity> => ({
        reference: values.reference,
        nom: values.nom,
        dureeEstimee: values.dureeEstimee || 0,
        moteursAssocies: (values.moteurIds || [])
            .map((id) => moteurs.find((moteur) => moteur.id === id))
            .filter(Boolean) as MoteurCatalogueEntity[],
        bateauxAssocies: (values.bateauIds || [])
            .map((id) => bateaux.find((bateau) => bateau.id === id))
            .filter(Boolean) as BateauCatalogueEntity[],
        bateauxClientsAssocies: (values.bateauClientIds || []).map((id) => ({ id })),
        moteursClientsAssocies: (values.moteurClientIds || []).map((id) => ({ id })),
        produits: (values.produits || [])
            .filter((item) => item.produitId)
            .map((item) => ({
                produit: produits.find((produit) => produit.id === item.produitId),
                quantite: item.quantite || 1
            })),
        mainOeuvres: (values.mainOeuvres || [])
            .filter((item) => item.mainOeuvreId)
            .map((item) => ({
                mainOeuvre: mainOeuvresList.find((mo) => mo.id === item.mainOeuvreId),
                quantite: item.quantite || 1
            })),
        taches: (values.taches || [])
            .filter((tache) => Boolean(tache.nom || tache.description))
            .map((tache) => ({
                id: tache.id,
                nom: tache.nom || '',
                description: tache.description || '',
            })),
        heuresFonctionnement: values.heuresFonctionnement || 0,
        joursFrequence: values.joursFrequence || 0,
        prixHT: values.prixHT || 0,
        tva: values.tva || 0,
        montantTVA: values.montantTVA || 0,
        prixTTC: values.prixTTC || 0
    });

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const payload = toPayload(values);
            if (isEdit && currentForfait?.id) {
                const res = await api.put(`/forfaits/${currentForfait.id}`, { ...currentForfait, ...payload });
                message.success('Forfait modifié avec succès');
                setCurrentForfait(res.data);
                form.setFieldsValue(values);
            } else {
                const res = await api.post('/forfaits', payload);
                message.success('Forfait ajouté avec succès');
                setIsEdit(true);
                setCurrentForfait(res.data);
                form.setFieldsValue(values);
            }
            setFormDirty(false);
            fetchForfaits(searchQuery);
        } catch {
            // Les erreurs de validation sont affichées par le formulaire.
        }
    };

    const handleDelete = async (id?: number) => {
        if (!id) {
            return;
        }
        try {
            await api.delete(`/forfaits/${id}`);
            message.success('Forfait supprimé avec succès');
            fetchForfaits(searchQuery);
        } catch {
            message.error('Erreur lors de la suppression du forfait.');
        }
    };

    const onValuesChange = (changedValues: Partial<ForfaitFormValues>, allValues: ForfaitFormValues) => {
        if (changedValues.produits !== undefined) {
            let currentProduitLines = (allValues.produits || []).map((item: any) => (
                item?.produitId && (item.quantite === undefined || item.quantite === null)
                    ? { ...item, quantite: 1 }
                    : item
            ));
            if (currentProduitLines.length === 0) {
                currentProduitLines = [{}];
            } else {
                const lastProduitLine = currentProduitLines[currentProduitLines.length - 1];
                const isLastLineComplete = !!lastProduitLine?.produitId && (lastProduitLine?.quantite || 0) > 0;
                if (isLastLineComplete) {
                    currentProduitLines = [...currentProduitLines, {}];
                }
            }
            form.setFieldValue('produits', currentProduitLines);
        }

        if (changedValues.mainOeuvres !== undefined) {
            let currentMoLines = (allValues.mainOeuvres || []).map((item: any) => (
                item?.mainOeuvreId && (item.quantite === undefined || item.quantite === null)
                    ? { ...item, quantite: 1 }
                    : item
            ));
            if (currentMoLines.length === 0) {
                currentMoLines = [{}];
            } else {
                const lastMoLine = currentMoLines[currentMoLines.length - 1];
                const isLastLineComplete = !!lastMoLine?.mainOeuvreId && (lastMoLine?.quantite || 0) > 0;
                if (isLastLineComplete) {
                    currentMoLines = [...currentMoLines, {}];
                }
            }
            form.setFieldValue('mainOeuvres', currentMoLines);
        }

        if (changedValues.taches !== undefined) {
            const currentTaskLines = allValues.taches || [];
            if (currentTaskLines.length === 0) {
                form.setFieldValue('taches', [{}]);
            } else {
                const lastTaskLine = currentTaskLines[currentTaskLines.length - 1];
                const isLastLineComplete = !!lastTaskLine?.nom?.trim();
                if (isLastLineComplete) {
                    form.setFieldValue('taches', [...currentTaskLines, {}]);
                }
            }
        }

        if (changedValues.produits !== undefined || changedValues.mainOeuvres !== undefined) {
            const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
            const produitsValues = form.getFieldValue('produits') || [];
            const moValues = form.getFieldValue('mainOeuvres') || [];

            const totalProduitsTTC = produitsValues.reduce((total: number, item: { produitId?: number; quantite?: number }) => {
                const prixUnitaireTTC = produits.find((produit) => produit.id === item.produitId)?.prixVenteTTC || 0;
                const quantite = item.quantite || 0;
                return total + (prixUnitaireTTC * quantite);
            }, 0);

            const totalMoTTC = moValues.reduce((total: number, item: { mainOeuvreId?: number; quantite?: number }) => {
                const prixUnitaireTTC = mainOeuvresList.find((mo) => mo.id === item.mainOeuvreId)?.prixTTC || 0;
                const quantite = item.quantite || 0;
                return total + (prixUnitaireTTC * quantite);
            }, 0);

            const prixTTC = round2(totalProduitsTTC + totalMoTTC);
            const tva = form.getFieldValue('tva') || 0;
            const remise = form.getFieldValue('remise') || 0;
            const remiseEuros = form.getFieldValue('remiseEuros') || 0;
            const coefficientRemise = 1 - (remise / 100);
            const prixAvantRemiseTTC = coefficientRemise > 0
                ? ((prixTTC + remiseEuros) / coefficientRemise)
                : 0;
            const montantTVA = round2((prixAvantRemiseTTC / (100 + tva)) * tva);
            const prixHT = round2(prixAvantRemiseTTC - montantTVA);

            form.setFieldValue('prixTTC', prixTTC);
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixHT', prixHT);
        }

        // Durée estimée = somme des quantités de main d'œuvre (1h = 1 unité)
        if (changedValues.mainOeuvres !== undefined) {
            const moValues = form.getFieldValue('mainOeuvres') || [];
            const totalHeures = moValues.reduce(
                (total: number, item: { mainOeuvreId?: number; quantite?: number }) =>
                    total + (item.mainOeuvreId ? (item.quantite || 0) : 0),
                0
            );
            form.setFieldValue('dureeEstimee', Math.round((totalHeures + Number.EPSILON) * 100) / 100);
        }

        if (
            changedValues.prixHT !== undefined
            || changedValues.tva !== undefined
            || changedValues.remise !== undefined
            || changedValues.remiseEuros !== undefined
        ) {
            const prixHT = form.getFieldValue('prixHT') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            const prixAvantRemiseTTC = prixHT + montantTVA;
            const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
            let remise = form.getFieldValue('remise') || 0;
            let remiseEuros = form.getFieldValue('remiseEuros') || 0;

            if (changedValues.remise !== undefined && changedValues.remiseEuros === undefined) {
                remiseEuros = round2(prixAvantRemiseTTC * (remise / 100));
                form.setFieldValue('remiseEuros', remiseEuros);
            } else if (changedValues.remiseEuros !== undefined && changedValues.remise === undefined) {
                remise = prixAvantRemiseTTC > 0 ? round2((remiseEuros / prixAvantRemiseTTC) * 100) : 0;
                form.setFieldValue('remise', remise);
            }

            const prixTTC = Math.max(
                0,
                round2(prixAvantRemiseTTC - remiseEuros)
            );
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixTTC', prixTTC);
        }

        if (changedValues.prixTTC !== undefined) {
            const prixTTC = form.getFieldValue('prixTTC') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const remise = form.getFieldValue('remise') || 0;
            const remiseEuros = form.getFieldValue('remiseEuros') || 0;
            const coefficientRemise = 1 - (remise / 100);
            const prixAvantRemiseTTC = coefficientRemise > 0
                ? ((prixTTC + remiseEuros) / coefficientRemise)
                : 0;
            const montantTVA = Math.round((((prixAvantRemiseTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            const prixHT = Math.round(((prixAvantRemiseTTC - montantTVA) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixHT', prixHT);
        }
    };

    const columns = [
        {
            title: 'Reference',
            dataIndex: 'reference',
            sorter: (a: ForfaitEntity, b: ForfaitEntity) => (a.reference || '').localeCompare(b.reference || ''),
            render: (value: string) => value || '-'
        },
        {
            title: 'Nom',
            dataIndex: 'nom',
            sorter: (a: ForfaitEntity, b: ForfaitEntity) => (a.nom || '').localeCompare(b.nom || '')
        },
        {
            title: 'Moteurs',
            dataIndex: 'moteursAssocies',
            sorter: (a: ForfaitEntity, b: ForfaitEntity) => (a.moteursAssocies?.length || 0) - (b.moteursAssocies?.length || 0),
            render: (values: MoteurCatalogueEntity[]) => values?.length || 0
        },
        {
            title: 'Bateaux',
            dataIndex: 'bateauxAssocies',
            sorter: (a: ForfaitEntity, b: ForfaitEntity) => (a.bateauxAssocies?.length || 0) - (b.bateauxAssocies?.length || 0),
            render: (values: BateauCatalogueEntity[]) => values?.length || 0
        },
        {
            title: 'Clients',
            key: 'clients',
            sorter: (a: ForfaitEntity, b: ForfaitEntity) =>
                ((a.bateauxClientsAssocies?.length || 0) + (a.moteursClientsAssocies?.length || 0))
                - ((b.bateauxClientsAssocies?.length || 0) + (b.moteursClientsAssocies?.length || 0)),
            render: (_: unknown, record: ForfaitEntity) =>
                `${record.bateauxClientsAssocies?.length || 0} bateau(x) / ${record.moteursClientsAssocies?.length || 0} moteur(s)`
        },
        {
            title: 'Fréquence',
            key: 'frequence',
            sorter: (a: ForfaitEntity, b: ForfaitEntity) => (a.heuresFonctionnement || 0) - (b.heuresFonctionnement || 0) || (a.joursFrequence || 0) - (b.joursFrequence || 0),
            render: (_: unknown, record: ForfaitEntity) =>
                `${record.heuresFonctionnement || 0}h / ${record.joursFrequence || 0} jours`
        },
        {
            title: 'Prix TTC',
            dataIndex: 'prixTTC',
            sorter: (a: ForfaitEntity, b: ForfaitEntity) => (a.prixTTC || 0) - (b.prixTTC || 0),
            render: (value: number) => formatEuro(value)
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: ForfaitEntity) => (
                <Space>
                    <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm
                        title="Supprimer ce forfait ?"
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
        <Card title="Forfaits">
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Space>
                        <SearchAutoComplete
                            style={{ width: 600 }}
                            onSearch={(value) => {
                                setSearchQuery(value);
                                fetchForfaits(value);
                            }}
                            onChange={(value) => {
                                if (!value) {
                                    setSearchQuery('');
                                    fetchForfaits();
                                }
                            }}
                            searchUrl="/forfaits/search"
                            labelOf={(f) => f.nom}
                        />
                        <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                    </Space>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <MosaicTable
                        rowKey="id"
                        dataSource={forfaits}
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

            <Modal
                title={isEdit ? 'Modifier un forfait' : 'Ajouter un forfait'}
                open={modalVisible}
                onOk={handleSave}
                onCancel={handleModalCancel}
                okText="Enregistrer"
                cancelText="Fermer"
                maskClosable={false}
                destroyOnHidden
                width="62vw"
            >
                <Form form={form} layout="vertical" initialValues={defaultForfait} onValuesChange={(...args) => { setFormDirty(true); onValuesChange(...args); }}>
                    <Form.Item
                        name="reference"
                        label="Reference"
                        rules={[{ required: true, message: 'La référence est requise' }]}
                    >
                        <Input allowClear />
                    </Form.Item>
                    <Form.Item
                        name="nom"
                        label="Nom"
                        rules={[{ required: true, message: 'Le nom est requis' }]}
                    >
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

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="moteurClientIds" label="Moteurs clients associés">
                                <Select
                                    mode="multiple"
                                    allowClear
                                    showSearch
                                    options={moteurClientSelectOptions}
                                    filterOption={filterClientOption}
                                    placeholder="Rechercher par modèle, n° de série, propriétaire, bateau"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="bateauClientIds" label="Bateaux clients associés">
                                <Select
                                    mode="multiple"
                                    allowClear
                                    showSearch
                                    options={bateauClientSelectOptions}
                                    filterOption={filterClientOption}
                                    placeholder="Rechercher par nom, immatriculation, n° de série, moteur"
                                />
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
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Produits inclus</div>
                                        <LignesArticles
                                            form={form}
                                            onValuesChange={(...args) => { setFormDirty(true); onValuesChange(...args); }}
                                            liste="produits"
                                            produits={produits}
                                            mainOeuvres={mainOeuvresList}
                                            onCreate={openNewProduitModal}
                                        />
                                        <Divider style={{ margin: '8px 0 16px' }} />
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Main d'Oeuvres incluses</div>
                                        <LignesArticles
                                            form={form}
                                            onValuesChange={(...args) => { setFormDirty(true); onValuesChange(...args); }}
                                            liste="mainOeuvres"
                                            produits={produits}
                                            mainOeuvres={mainOeuvresList}
                                            onCreate={openNewMainOeuvreModal}
                                        />
                                        <Divider style={{ margin: '8px 0 16px' }} />
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <div style={{ width: 280, flex: 'none' }}>
                                                <Form.Item name="prixHT" label={<strong>Montant HT (EUR)</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item name="remise" label={<strong>Remise (%)</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item name="remiseEuros" label={<strong>Remise (EUR)</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item name="tva" label={<strong>TVA (%)</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item name="montantTVA" label={<strong>Montant TVA</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                                <Form.Item name="prixTTC" label={<strong>Montant TTC</strong>} layout="horizontal" labelCol={{ flex: '0 0 150px' }} wrapperCol={{ flex: '0 0 130px' }} labelAlign="right" colon={false} style={{ marginBottom: 8, width: 280 }}>
                                                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </div>
                                        </div>
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

                </Form>

                <Modal
                    title="Créer un produit"
                    open={newProduitModalVisible}
                    onOk={handleNewProduitSave}
                    onCancel={handleNewProduitCancel}
                    maskClosable={false}
                width="95vw"
                    okText="Enregistrer"
                    cancelText="Fermer"
                    destroyOnHidden
                >
                    <Form form={newProduitForm} layout="vertical" initialValues={defaultNewProduit} onValuesChange={(...args) => { setNewProduitFormDirty(true); onNewProduitValuesChange(...args); }}>
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
                        <Form.Item name="refs" label="Codes barres">
                            <Form.List name="refs">
                                {(fields, { add, remove: removeRef }) => (
                                    <>
                                        {fields.map((field) => (
                                            <Space key={field.key} align="baseline">
                                                <Form.Item {...field} name={[field.name]} style={{ flex: 1 }}>
                                                    <Input placeholder="Code barre" style={{ width: 200 }} />
                                                </Form.Item>
                                                <Button icon={<DeleteOutlined />} danger onClick={() => removeRef(field.name)} />
                                            </Space>
                                        ))}
                                        <Button type="dashed" onClick={() => add()} block style={{ marginTop: 8 }}>Ajouter une référence</Button>
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
                            <Col span={12}><Form.Item name="stock" label="Stock"><InputNumber min={0} step={1} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={12}><Form.Item name="stockMini" label="Stock minimal d'alerte"><InputNumber min={0} step={1} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="emplacement" label="Emplacement atelier"><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="emplacementMagasin" label="Emplacement magasin"><Input /></Form.Item></Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="prixVenteHT" label="Prix de vente HT"><InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" /></Form.Item></Col>
                            <Col span={12}><Form.Item name="tva" label="TVA (%)"><InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="montantTVA" label="Montant TVA"><InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" /></Form.Item></Col>
                            <Col span={12}><Form.Item name="prixVenteTTC" label="Prix de vente TTC"><InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" /></Form.Item></Col>
                        </Row>
                    </Form>
                </Modal>

                <Modal
                    title="Créer une Main d'Oeuvre"
                    open={newMainOeuvreModalVisible}
                    onOk={handleNewMainOeuvreSave}
                    onCancel={handleNewMainOeuvreCancel}
                    maskClosable={false}
                width="48vw"
                    okText="Enregistrer"
                    cancelText="Fermer"
                    destroyOnHidden
                >
                    <Form form={newMainOeuvreForm} layout="vertical" initialValues={defaultNewMainOeuvre} onValuesChange={(...args) => { setNewMainOeuvreFormDirty(true); onNewMainOeuvreValuesChange(...args); }}>
                        <Form.Item name="reference" label="Référence">
                            <Input allowClear />
                        </Form.Item>
                        <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                            <Input allowClear />
                        </Form.Item>
                        <Form.Item name="description" label="Description">
                            <Input.TextArea rows={3} allowClear />
                        </Form.Item>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="prixHT" label="Prix HT"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={12}><Form.Item name="tva" label="TVA (%)"><InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="montantTVA" label="Montant TVA"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                            <Col span={12}><Form.Item name="prixTTC" label="Prix TTC"><InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                        </Row>
                    </Form>
                </Modal>
            </Modal>
        </Card>
    );
}
