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
    Rate,
    Row,
    Select,
    Space,
    Tabs,
    message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import api from './api.ts';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import ImageUpload from './ImageUpload.tsx';

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
    nom: '', marque: '', categorie: '', ref: '', refs: [], images: [], description: '',
    evaluation: 0, stock: 0, stockMini: 0, emplacement: '',
    prixPublic: 0, frais: 0, tauxMarge: 0, tauxMarque: 0,
    prixVenteHT: 0, tva: 20, montantTVA: 0, prixVenteTTC: 0,
};

const defaultNewMainOeuvre = {
    reference: '', nom: '', description: '', prixHT: 0, tva: 20, montantTVA: 0, prixTTC: 0,
};

const defaultForfait = {
    reference: '',
    nom: '',
    dureeEstimee: 0,
    moteurIds: [],
    bateauIds: [],
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
    prixTTC: 0,
};

interface ForfaitFormModalProps {
    open: boolean;
    onCancel: () => void;
    onCreated: (forfait: any) => void;
    preAssociatedBateauId?: number;
    preAssociatedMoteurId?: number;
}

export default function ForfaitFormModal({ open, onCancel, onCreated, preAssociatedBateauId, preAssociatedMoteurId }: ForfaitFormModalProps) {
    const PRODUIT_CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');

    const [moteurs, setMoteurs] = useState<any[]>([]);
    const [bateaux, setBateaux] = useState<any[]>([]);
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [mainOeuvresList, setMainOeuvresList] = useState<MainOeuvreEntity[]>([]);

    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);

    const [newProduitModalVisible, setNewProduitModalVisible] = useState(false);
    const [newProduitTargetLine, setNewProduitTargetLine] = useState<number | null>(null);
    const [newProduitForm] = Form.useForm();
    const [newProduitFormDirty, setNewProduitFormDirty] = useState(false);

    const [newMainOeuvreModalVisible, setNewMainOeuvreModalVisible] = useState(false);
    const [newMainOeuvreTargetLine, setNewMainOeuvreTargetLine] = useState<number | null>(null);
    const [newMainOeuvreForm] = Form.useForm();
    const [newMainOeuvreFormDirty, setNewMainOeuvreFormDirty] = useState(false);

    const marqueOptions = useMemo(() => {
        const unique = Array.from(new Set(produits.map((p) => p.marque).filter(Boolean))) as string[];
        return unique.map((marque) => ({ value: marque }));
    }, [produits]);

    const moteurOptions = useMemo(
        () => moteurs.map((m) => ({ value: m.id, label: `${m.marque} ${m.modele}` })),
        [moteurs]
    );

    const bateauOptions = useMemo(
        () => bateaux.map((b) => ({ value: b.id, label: `${b.marque} ${b.modele}` })),
        [bateaux]
    );

    const produitOptions = useMemo(
        () => produits.map((p) => ({ value: p.id, label: `${p.nom}${p.marque ? ` (${p.marque})` : ''}` })),
        [produits]
    );

    const mainOeuvreOptions = useMemo(
        () => mainOeuvresList.map((mo) => ({ value: mo.id, label: mo.reference ? `${mo.reference} - ${mo.nom}` : mo.nom })),
        [mainOeuvresList]
    );

    useEffect(() => {
        if (open) {
            Promise.all([
                api.get('/catalogue/moteurs'),
                api.get('/catalogue/bateaux'),
                api.get('/catalogue/produits'),
                api.get('/main-oeuvres'),
            ]).then(([moteursRes, bateauxRes, produitsRes, mainOeuvresRes]) => {
                setMoteurs(moteursRes.data || []);
                setBateaux(bateauxRes.data || []);
                setProduits(produitsRes.data || []);
                setMainOeuvresList(mainOeuvresRes.data || []);
            }).catch(() => {
                message.error('Erreur lors du chargement des listes de référence.');
            });

            form.resetFields();
            form.setFieldsValue({
                ...defaultForfait,
                bateauIds: preAssociatedBateauId ? [preAssociatedBateauId] : [],
                moteurIds: preAssociatedMoteurId ? [preAssociatedMoteurId] : [],
            });
            setFormDirty(false);
        }
    }, [open]);

    // --- New Produit ---
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
        setNewProduitFormDirty(true);
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

    const handleNewProduitCancel = () => {
        if (newProduitFormDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => { setNewProduitFormDirty(false); setNewProduitModalVisible(false); },
            });
        } else {
            setNewProduitModalVisible(false);
        }
    };

    // --- New Main d'Oeuvre ---
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
        setNewMainOeuvreFormDirty(true);
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

    const handleNewMainOeuvreCancel = () => {
        if (newMainOeuvreFormDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => { setNewMainOeuvreFormDirty(false); setNewMainOeuvreModalVisible(false); },
            });
        } else {
            setNewMainOeuvreModalVisible(false);
        }
    };

    // --- Save ---
    const handleSave = async () => {
        try {
            const values = await form.validateFields();
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
                    .filter((item: any) => item.produitId)
                    .map((item: any) => ({
                        produit: produits.find((p) => p.id === item.produitId),
                        quantite: item.quantite || 1,
                    })),
                mainOeuvres: (values.mainOeuvres || [])
                    .filter((item: any) => item.mainOeuvreId)
                    .map((item: any) => ({
                        mainOeuvre: mainOeuvresList.find((mo) => mo.id === item.mainOeuvreId),
                        quantite: item.quantite || 1,
                    })),
                taches: (values.taches || [])
                    .filter((t: any) => Boolean(t.nom || t.description))
                    .map((t: any) => ({ nom: t.nom || '', description: t.description || '' })),
                heuresFonctionnement: values.heuresFonctionnement || 0,
                joursFrequence: values.joursFrequence || 0,
                prixHT: values.prixHT || 0,
                tva: values.tva || 0,
                montantTVA: values.montantTVA || 0,
                prixTTC: values.prixTTC || 0,
            };
            const res = await api.post('/forfaits', payload);
            message.success('Forfait ajouté avec succès');
            onCreated(res.data);
        } catch {
            // validation errors shown in form
        }
    };

    const handleCancel = () => {
        if (formDirty) {
            Modal.confirm({
                title: "Modifications non enregistrées",
                content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
                okText: "Fermer",
                cancelText: "Annuler",
                onOk: () => { setFormDirty(false); onCancel(); },
            });
        } else {
            onCancel();
        }
    };

    // --- Form value changes ---
    const onValuesChange = (changedValues: any, allValues: any) => {
        setFormDirty(true);

        if (changedValues.produits !== undefined) {
            const lines = allValues.produits || [];
            if (lines.length === 0) {
                form.setFieldValue('produits', [{}]);
            } else {
                const last = lines[lines.length - 1];
                if (!!last?.produitId && (last?.quantite || 0) > 0) {
                    form.setFieldValue('produits', [...lines, {}]);
                }
            }
        }

        if (changedValues.mainOeuvres !== undefined) {
            const lines = allValues.mainOeuvres || [];
            if (lines.length === 0) {
                form.setFieldValue('mainOeuvres', [{}]);
            } else {
                const last = lines[lines.length - 1];
                if (!!last?.mainOeuvreId && (last?.quantite || 0) > 0) {
                    form.setFieldValue('mainOeuvres', [...lines, {}]);
                }
            }
        }

        if (changedValues.taches !== undefined) {
            const lines = allValues.taches || [];
            if (lines.length === 0) {
                form.setFieldValue('taches', [{}]);
            } else {
                const last = lines[lines.length - 1];
                if (!!last?.nom?.trim()) {
                    form.setFieldValue('taches', [...lines, {}]);
                }
            }
        }

        if (changedValues.produits !== undefined || changedValues.mainOeuvres !== undefined) {
            const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
            const produitsValues = form.getFieldValue('produits') || [];
            const moValues = form.getFieldValue('mainOeuvres') || [];

            const totalProduitsTTC = produitsValues.reduce((total: number, item: any) => {
                const prix = produits.find((p) => p.id === item.produitId)?.prixVenteTTC || 0;
                return total + (prix * (item.quantite || 0));
            }, 0);

            const totalMoTTC = moValues.reduce((total: number, item: any) => {
                const prix = mainOeuvresList.find((mo) => mo.id === item.mainOeuvreId)?.prixTTC || 0;
                return total + (prix * (item.quantite || 0));
            }, 0);

            const prixTTC = round2(totalProduitsTTC + totalMoTTC);
            const tva = form.getFieldValue('tva') || 0;
            const remise = form.getFieldValue('remise') || 0;
            const remiseEuros = form.getFieldValue('remiseEuros') || 0;
            const coefficientRemise = 1 - (remise / 100);
            const prixAvantRemiseTTC = coefficientRemise > 0 ? ((prixTTC + remiseEuros) / coefficientRemise) : 0;
            const montantTVA = round2((prixAvantRemiseTTC / (100 + tva)) * tva);
            const prixHT = round2(prixAvantRemiseTTC - montantTVA);

            form.setFieldValue('prixTTC', prixTTC);
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixHT', prixHT);
        }

        if (changedValues.prixHT !== undefined || changedValues.tva !== undefined
            || changedValues.remise !== undefined || changedValues.remiseEuros !== undefined) {
            const prixHT = form.getFieldValue('prixHT') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = Math.round(((prixHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
            const prixAvantRemiseTTC = prixHT + montantTVA;
            const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
            let remise = form.getFieldValue('remise') || 0;
            let remiseEuros = form.getFieldValue('remiseEuros') || 0;

            if (changedValues.remise !== undefined && changedValues.remiseEuros === undefined) {
                remiseEuros = round2(prixAvantRemiseTTC * (remise / 100));
                form.setFieldValue('remiseEuros', remiseEuros);
            } else if (changedValues.remiseEuros !== undefined && changedValues.remise === undefined) {
                remise = prixAvantRemiseTTC > 0 ? round2((remiseEuros / prixAvantRemiseTTC) * 100) : 0;
                form.setFieldValue('remise', remise);
            }

            const prixTTC = Math.max(0, round2(prixAvantRemiseTTC - remiseEuros));
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixTTC', prixTTC);
        }

        if (changedValues.prixTTC !== undefined) {
            const prixTTC = form.getFieldValue('prixTTC') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const remise = form.getFieldValue('remise') || 0;
            const remiseEuros = form.getFieldValue('remiseEuros') || 0;
            const coefficientRemise = 1 - (remise / 100);
            const prixAvantRemiseTTC = coefficientRemise > 0 ? ((prixTTC + remiseEuros) / coefficientRemise) : 0;
            const montantTVA = Math.round((((prixAvantRemiseTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
            const prixHT = Math.round(((prixAvantRemiseTTC - montantTVA) + Number.EPSILON) * 100) / 100;
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixHT', prixHT);
        }
    };

    return (
        <Modal
            title="Ajouter un forfait"
            open={open}
            onOk={handleSave}
            onCancel={handleCancel}
            okText="Enregistrer"
            cancelText="Fermer"
            maskClosable={false}
            destroyOnHidden
            width={1024}
        >
            <Form form={form} layout="vertical" initialValues={defaultForfait} onValuesChange={onValuesChange}>
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
                                                        const produitId = form.getFieldValue(['produits', field.name, 'produitId']);
                                                        const isEmptyLine = !produitId;
                                                        return (
                                                            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'produitId']}
                                                                    rules={[{
                                                                        validator: async (_, value) => {
                                                                            const line = form.getFieldValue(['produits', field.name]);
                                                                            if (!value && Number(line?.quantite || 0) > 0) throw new Error('Produit requis');
                                                                        }
                                                                    }]}
                                                                    style={{ width: 520 }}
                                                                >
                                                                    <Select allowClear showSearch options={produitOptions} placeholder="Produit" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'quantite']}
                                                                    rules={[{
                                                                        validator: async (_, value) => {
                                                                            const line = form.getFieldValue(['produits', field.name]);
                                                                            if (!line?.produitId && (value === undefined || value === null)) return;
                                                                            if (!value || value <= 0) throw new Error('Quantité requise');
                                                                        }
                                                                    }]}
                                                                    style={{ width: 180 }}
                                                                >
                                                                    <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="Qté" />
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

                                    <Form.Item label="Main d'Oeuvres incluses">
                                        <Form.List name="mainOeuvres">
                                            {(fields, { remove }) => (
                                                <>
                                                    {fields.map((field) => {
                                                        const moId = form.getFieldValue(['mainOeuvres', field.name, 'mainOeuvreId']);
                                                        const isEmptyLine = !moId;
                                                        return (
                                                            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'mainOeuvreId']}
                                                                    rules={[{
                                                                        validator: async (_, value) => {
                                                                            const line = form.getFieldValue(['mainOeuvres', field.name]);
                                                                            if (!value && Number(line?.quantite || 0) > 0) throw new Error("Main d'oeuvre requise");
                                                                        }
                                                                    }]}
                                                                    style={{ width: 520 }}
                                                                >
                                                                    <Select allowClear showSearch options={mainOeuvreOptions} placeholder="Main d'Oeuvre" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                    {...field}
                                                                    name={[field.name, 'quantite']}
                                                                    rules={[{
                                                                        validator: async (_, value) => {
                                                                            const line = form.getFieldValue(['mainOeuvres', field.name]);
                                                                            if (!line?.mainOeuvreId && (value === undefined || value === null)) return;
                                                                            if (!value || value <= 0) throw new Error('Quantité requise');
                                                                        }
                                                                    }]}
                                                                    style={{ width: 180 }}
                                                                >
                                                                    <InputNumber min={0.25} step={0.25} style={{ width: '100%' }} placeholder="Qté" />
                                                                </Form.Item>
                                                                <Form.Item noStyle shouldUpdate>
                                                                    {({ getFieldValue }) => {
                                                                        const mid = getFieldValue(['mainOeuvres', field.name, 'mainOeuvreId']);
                                                                        const quantite = getFieldValue(['mainOeuvres', field.name, 'quantite']) || 0;
                                                                        const prixUnitaireTTC = mainOeuvresList.find((mo) => mo.id === mid)?.prixTTC || 0;
                                                                        const prixTTC = Math.round(((prixUnitaireTTC * quantite) + Number.EPSILON) * 100) / 100;
                                                                        return (
                                                                            <Form.Item style={{ width: 180 }}>
                                                                                <InputNumber addonAfter="EUR" value={prixTTC} style={{ width: '100%' }} disabled />
                                                                            </Form.Item>
                                                                        );
                                                                    }}
                                                                </Form.Item>
                                                                {isEmptyLine && (
                                                                    <Button icon={<PlusOutlined />} title="Créer une main d'oeuvre" onClick={() => openNewMainOeuvreModal(field.name)} />
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
                            ),
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
                            ),
                        },
                    ]}
                />

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="remise" label="Remise">
                            <InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="remiseEuros" label="Remise">
                            <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={6}>
                        <Form.Item name="prixHT" label="Prix HT">
                            <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="tva" label="TVA">
                            <InputNumber addonAfter="%" min={0} max={100} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="montantTVA" label="Montant TVA">
                            <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="prixTTC" label="Prix TTC">
                            <InputNumber addonAfter="€" min={0} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>

            {/* Modal création produit */}
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
                <Form form={newProduitForm} layout="vertical" initialValues={defaultNewProduit} onValuesChange={onNewProduitValuesChange}>
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
                                            <Form.Item {...field} name={[field.name]} style={{ flex: 1 }}>
                                                <Input placeholder="Réf. complémentaire" style={{ width: 200 }} />
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
                    <Form.Item name="emplacement" label="Emplacement"><Input /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="prixPublic" label="Prix public"><InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="frais" label="Frais"><InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="tauxMarge" label="Taux de marge (%)"><InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="tauxMarque" label="Taux de marque (%)"><InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
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

            {/* Modal création main d'oeuvre */}
            <Modal
                title="Créer une Main d'Oeuvre"
                open={newMainOeuvreModalVisible}
                onOk={handleNewMainOeuvreSave}
                onCancel={handleNewMainOeuvreCancel}
                maskClosable={false}
                width={900}
                okText="Enregistrer"
                cancelText="Fermer"
                destroyOnHidden
            >
                <Form form={newMainOeuvreForm} layout="vertical" initialValues={defaultNewMainOeuvre} onValuesChange={onNewMainOeuvreValuesChange}>
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
    );
}
