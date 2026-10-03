import React, { useEffect, useMemo, useState } from 'react';
import { Image, Table, Rate, Row, Col, Card, Button, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, message, Divider, Tag, Segmented } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import api from './api.ts';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import { useNavigation } from './navigation-context.tsx';
import FournisseurProduits from './fournisseur-produits.tsx';
import FournisseurBateaux from './fournisseur-bateaux.tsx';
import FournisseurMoteurs from './fournisseur-moteurs.tsx';
import FournisseurHelices from './fournisseur-helices.tsx';
import FournisseurRemorques from './fournisseur-remorques.tsx';
import ProduitHistorique from './produit-historique.tsx';
import ForfaitFormModal from './ForfaitFormModal.tsx';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';
import ImportCsvButton from './ImportCsvButton.tsx';

// --- Types ---

type TypeProduit = 'produit' | 'bateau' | 'moteur' | 'helice' | 'remorque';

interface TypeProduitConfig {
    label: string;
    pluriel: string;
    article: string;
    demonstratif: string;
    feminin: boolean;
    endpoint: string;
    color: string;
    forfaitField?: 'bateauxAssocies' | 'moteursAssocies';
}

const TYPES_PRODUIT: Record<TypeProduit, TypeProduitConfig> = {
    produit: { label: 'Produit', pluriel: 'Produits', article: 'un produit', demonstratif: 'ce produit', feminin: false, endpoint: '/catalogue/produits', color: 'orange' },
    bateau: { label: 'Bateau', pluriel: 'Bateaux', article: 'un bateau', demonstratif: 'ce bateau', feminin: false, endpoint: '/catalogue/bateaux', color: 'cyan', forfaitField: 'bateauxAssocies' },
    moteur: { label: 'Moteur', pluriel: 'Moteurs', article: 'un moteur', demonstratif: 'ce moteur', feminin: false, endpoint: '/catalogue/moteurs', color: 'purple', forfaitField: 'moteursAssocies' },
    helice: { label: 'Hélice', pluriel: 'Hélices', article: 'une hélice', demonstratif: 'cette hélice', feminin: true, endpoint: '/catalogue/helices', color: 'blue' },
    remorque: { label: 'Remorque', pluriel: 'Remorques', article: 'une remorque', demonstratif: 'cette remorque', feminin: true, endpoint: '/catalogue/remorques', color: 'gold' },
};

const TYPE_PRODUIT_KEYS = Object.keys(TYPES_PRODUIT) as TypeProduit[];

interface CatalogueEntity {
    id?: number;
    designation: string;
    images?: string[];
    documents?: string[];
    description?: string;
    anneeDebut?: number;
    anneeFin?: number;
    evaluation?: number;
    prixVenteHT?: number;
    tva?: number;
    montantTVA?: number;
    prixVenteTTC?: number;
    [champ: string]: any;
}

interface LigneCatalogue extends CatalogueEntity {
    typeProduit: TypeProduit;
    key: string;
}

interface BateauOption {
    id?: number;
    nom: string;
    description?: string;
    prixHT: number;
    tva: number;
    montantTVA: number;
    prixTTC: number;
}

// Champs communs à tous les types de produit : conservés quand on change de type à la création
const defaultCommun: CatalogueEntity = {
    designation: '',
    description: '',
    anneeDebut: new Date().getFullYear(),
    anneeFin: new Date().getFullYear(),
    images: [],
    documents: [],
    evaluation: 0,
    prixVenteHT: 0,
    tva: 20,
    montantTVA: 0,
    prixVenteTTC: 0,
};

const CHAMPS_COMMUNS = Object.keys(defaultCommun);

const defaultValues: Record<TypeProduit, CatalogueEntity> = {
    produit: {
        ...defaultCommun,
        ref: '',
        refs: [],
        stock: 0,
        stockMini: 0,
        emplacement: '',
    },
    bateau: {
        ...defaultCommun,
        longueurExterieure: 0,
        longueurCoque: 0,
        hauteur: 0,
        largeur: 0,
        tirantAir: 0,
        tirantEau: 0,
        poidsVide: 0,
        poidsMoteurMax: 0,
        chargeMax: 0,
        longueurArbre: '',
        puissanceMax: '',
        reservoirEau: 0,
        reservoirCarburant: 0,
        nombrePassagersMax: 0,
        categorieCe: '',
        stock: 0,
        stockAlerte: 0,
        emplacement: '',
        options: [],
    },
    moteur: {
        ...defaultCommun,
        puissanceCv: 0,
        puissanceKw: 0,
        longueurArbre: '',
        arbre: 0,
        demarrage: '',
        direction: '',
        cylindres: 0,
        cylindree: 0,
        regime: '',
        huileRecommandee: '',
        helicesCompatibles: [],
        stock: 0,
        stockAlerte: 0,
        emplacement: '',
    },
    helice: {
        ...defaultCommun,
        diametre: 0,
        pas: '',
        pales: 0,
        cannelures: 0,
        moteursCompatibles: [],
    },
    remorque: {
        ...defaultCommun,
        ptac: 0,
        chargeAVide: 0,
        chargeUtile: 0,
        longueur: 0,
        largeur: 0,
        longueurMaxBateau: 0,
        largeurMaxBateau: 0,
        fleche: '',
        typeChassis: '',
        roues: '',
        equipement: '',
        stock: 0,
        stockAlerte: 0,
        emplacement: '',
    },
};

const typeChassisList = [
    { label: 'Standard', value: 'Standard' },
    { label: 'Renforcé', value: 'Renforcé' },
];

const rouesList = [
    { label: 'Simple', value: 'Simple' },
    { label: 'Double', value: 'Double' },
];

const CV_TO_KW_FACTOR = 0.735499;

const arrondir = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// Catégorie d'un produit, ou type d'un bateau / moteur
const getCategorie = (entity: CatalogueEntity): string => entity.categorie || entity.type || '';

// --- Champs spécifiques à chaque type de produit ---

const ChampsBateau: React.FC = () => (
    <Row gutter={16}>
        <Col span={12}>
            <Form.Item name="longueurExterieure" label="Longueur extérieure">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="longueurCoque" label="Longueur coque">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="hauteur" label="Hauteur">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="largeur" label="Largeur">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="tirantAir" label="Tirant d'air">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="tirantEau" label="Tirant d'eau">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="poidsVide" label="Poids à vide">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="poidsMoteurMax" label="Poids moteur max">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="chargeMax" label="Charge max">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="longueurArbre" label="Longueur arbre">
                <Input />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="puissanceMax" label="Puissance max">
                <Input />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="reservoirEau" label="Réservoir eau">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="l" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="reservoirCarburant" label="Réservoir carburant">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="l" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="nombrePassagersMax" label="Nombre passagers max">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="categorieCe" label="Catégorie CE">
                <Input />
            </Form.Item>
        </Col>
    </Row>
);

const ChampsMoteur: React.FC<{ helices: CatalogueEntity[] }> = ({ helices }) => (
    <>
        <Row gutter={16}>
            <Col span={12}>
                <Form.Item name="puissanceCv" label="Puissance">
                    <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="cv" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="puissanceKw" label="Puissance">
                    <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="kW" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="longueurArbre" label="Longueur arbre">
                    <Input />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="arbre" label="Arbre">
                    <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="cm" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="demarrage" label="Démarrage">
                    <Input />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="direction" label="Direction">
                    <Input />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="cylindres" label="Nombre de cylindres">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="cylindree" label="Cylindrée">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="cm3" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="regime" label="Régime Max">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="tr/min" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="huileRecommandee" label="Huile recommandée">
                    <Input />
                </Form.Item>
            </Col>
        </Row>
        <Form.Item name="helicesCompatibles" label="Hélices compatibles">
            <Select mode="multiple" optionFilterProp="children" showSearch>
                {helices.map((helice) => (
                    <Select.Option key={helice.id} value={helice.id}>
                        {helice.designation}
                    </Select.Option>
                ))}
            </Select>
        </Form.Item>
    </>
);

const ChampsHelice: React.FC<{ moteurs: CatalogueEntity[] }> = ({ moteurs }) => (
    <>
        <Row gutter={16}>
            <Col span={12}>
                <Form.Item name="diametre" label="Diamètre">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="mm" />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="pas" label="Pas">
                    <Input />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="pales" label="Pales">
                    <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item name="cannelures" label="Cannelures">
                    <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
            </Col>
        </Row>
        <Form.Item name="moteursCompatibles" label="Moteurs compatibles">
            <Select mode="multiple" optionFilterProp="children" showSearch>
                {moteurs.map((moteur) => (
                    <Select.Option key={moteur.id} value={moteur.id}>
                        {moteur.designation}
                    </Select.Option>
                ))}
            </Select>
        </Form.Item>
    </>
);

const ChampsRemorque: React.FC = () => (
    <Row gutter={16}>
        <Col span={12}>
            <Form.Item name="ptac" label="PTAC">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="kg" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="chargeAVide" label="Charge à vide">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="kg" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="chargeUtile" label="Charge utile">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="kg" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="longueur" label="Longueur">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="mm" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="largeur" label="Largeur">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="mm" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="longueurMaxBateau" label="Long. Max. Bateau">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="mm" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="largeurMaxBateau" label="Larg. Max. Bateau">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="mm" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="fleche" label="Flèche">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="mm" />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="typeChassis" label="Type de châssis">
                <Select options={typeChassisList} allowClear />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="roues" label="Roues">
                <Select options={rouesList} allowClear />
            </Form.Item>
        </Col>
        <Col span={12}>
            <Form.Item name="equipement" label="Équipement">
                <Input />
            </Form.Item>
        </Col>
    </Row>
);

// --- Component ---

const CatalogueProduits: React.FC = () => {
    const CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');
    const bateauTypes = useReferenceValeurs('TYPE_BATEAU');
    const moteurTypes = useReferenceValeurs('TYPE_MOTEUR');
    const { pageState } = useNavigation();
    const [catalogue, setCatalogue] = useState<Record<TypeProduit, CatalogueEntity[]>>({
        produit: [],
        bateau: [],
        moteur: [],
        helice: [],
        remorque: [],
    });
    const [forfaits, setForfaits] = useState<any[]>([]);
    const [initialForfaitIds, setInitialForfaitIds] = useState<number[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [recherche, setRecherche] = useState<string>('');
    const [typeFiltre, setTypeFiltre] = useState<TypeProduit | 'tous'>('tous');
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [typeCourant, setTypeCourant] = useState<TypeProduit>('produit');
    const [currentProduit, setCurrentProduit] = useState<CatalogueEntity | null>(null);
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);
    const [forfaitModalVisible, setForfaitModalVisible] = useState(false);

    const isEdit = !!(currentProduit && currentProduit.id);
    const config = TYPES_PRODUIT[typeCourant];

    const fetchType = async (type: TypeProduit) => {
        try {
            const res = await api.get(TYPES_PRODUIT[type].endpoint);
            setCatalogue((prev) => ({ ...prev, [type]: res.data || [] }));
        } catch {
            message.error(`Erreur lors du chargement du catalogue (${TYPES_PRODUIT[type].pluriel.toLowerCase()}).`);
        }
    };

    const fetchCatalogue = async (types: TypeProduit[] = TYPE_PRODUIT_KEYS) => {
        setLoading(true);
        await Promise.all(types.map(fetchType));
        setLoading(false);
    };

    const fetchForfaits = async () => {
        try {
            const res = await api.get('/forfaits');
            setForfaits(res.data || []);
        } catch {
            setForfaits([]);
        }
    };

    useEffect(() => {
        fetchCatalogue();
        fetchForfaits();
    }, []);

    // Permet aux autres vues d'ouvrir le catalogue sur un type de produit donné
    useEffect(() => {
        if (pageState?.typeProduit && TYPES_PRODUIT[pageState.typeProduit as TypeProduit]) {
            setTypeFiltre(pageState.typeProduit);
        }
    }, [pageState]);

    const lignes: LigneCatalogue[] = useMemo(() => {
        const q = recherche.trim().toLowerCase();
        return TYPE_PRODUIT_KEYS
            .filter((type) => typeFiltre === 'tous' || typeFiltre === type)
            .flatMap((type) => catalogue[type].map((entity) => ({ ...entity, typeProduit: type, key: `${type}-${entity.id}` })))
            .filter((ligne) => !q || [ligne.designation, ligne.categorie, ligne.type, ligne.ref, ligne.description]
                .some((valeur) => (valeur || '').toLowerCase().includes(q)));
    }, [catalogue, typeFiltre, recherche]);

    const getForfaitIds = (type: TypeProduit, id?: number): number[] => {
        const field = TYPES_PRODUIT[type].forfaitField;
        if (!field || !id) return [];
        return forfaits
            .filter((f) => (f[field] || []).some((item: any) => item.id === id))
            .map((f) => f.id);
    };

    const getMoteurIdsForHelice = (heliceId?: number): number[] => {
        if (!heliceId) return [];
        return catalogue.moteur
            .filter((moteur) => (moteur.helicesCompatibles || []).some((helice: any) => helice.id === heliceId))
            .map((moteur) => moteur.id as number);
    };

    // Les hélices / moteurs compatibles sont saisis sous forme de liste d'identifiants
    const toFormValues = (type: TypeProduit, entity: CatalogueEntity) => {
        const values: any = { ...defaultValues[type], ...entity };
        if (type === 'moteur') {
            values.helicesCompatibles = (entity.helicesCompatibles || []).map((helice: any) => helice.id);
        }
        if (type === 'helice') {
            values.moteursCompatibles = getMoteurIdsForHelice(entity.id);
        }
        return values;
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

    const openModal = (ligne?: LigneCatalogue) => {
        form.resetFields();
        if (ligne) {
            const { typeProduit, key, ...produit } = ligne;
            const forfaitIds = getForfaitIds(typeProduit, produit.id);
            setTypeCourant(typeProduit);
            setCurrentProduit(produit);
            setInitialForfaitIds(forfaitIds);
            form.setFieldsValue({ ...toFormValues(typeProduit, produit), forfaitIds });
        } else {
            const type = typeFiltre === 'tous' ? 'produit' : typeFiltre;
            setTypeCourant(type);
            setCurrentProduit(null);
            setInitialForfaitIds([]);
            form.setFieldsValue(defaultValues[type]);
        }
        setFormDirty(false);
        setModalVisible(true);
    };

    // Changement de type à la création : on garde les champs communs déjà saisis
    const handleTypeChange = (type: TypeProduit) => {
        const communs = form.getFieldsValue(CHAMPS_COMMUNS);
        form.resetFields();
        form.setFieldsValue({ ...defaultValues[type], ...communs });
        setInitialForfaitIds([]);
        setTypeCourant(type);
    };

    const updateForfaitAssociations = async (type: TypeProduit, id: number, selectedForfaitIds: number[]) => {
        const field = TYPES_PRODUIT[type].forfaitField;
        if (!field) return;
        const added = selectedForfaitIds.filter((forfaitId) => !initialForfaitIds.includes(forfaitId));
        const removed = initialForfaitIds.filter((forfaitId) => !selectedForfaitIds.includes(forfaitId));

        for (const forfaitId of added) {
            const forfait = forfaits.find((f) => f.id === forfaitId);
            if (forfait) {
                const alreadyLinked = (forfait[field] || []).some((item: any) => item.id === id);
                if (!alreadyLinked) {
                    await api.put(`/forfaits/${forfaitId}`, {
                        ...forfait,
                        [field]: [...(forfait[field] || []), { id }],
                    });
                }
            }
        }

        for (const forfaitId of removed) {
            const forfait = forfaits.find((f) => f.id === forfaitId);
            if (forfait) {
                await api.put(`/forfaits/${forfaitId}`, {
                    ...forfait,
                    [field]: (forfait[field] || []).filter((item: any) => item.id !== id),
                });
            }
        }

        if (added.length > 0 || removed.length > 0) {
            await fetchForfaits();
        }
    };

    const handleForfaitCreated = async (newForfait: any) => {
        setForfaitModalVisible(false);
        await fetchForfaits();
        const currentForfaits = form.getFieldValue('forfaitIds') || [];
        form.setFieldsValue({ forfaitIds: [...currentForfaits, newForfait.id] });
    };

    // La compatibilité hélice / moteur est portée par le moteur
    const syncMoteursForHelice = async (helice: CatalogueEntity, selectedMoteurIds: number[]) => {
        if (!helice.id) return;
        const idsToProcess = Array.from(new Set([...getMoteurIdsForHelice(helice.id), ...selectedMoteurIds]));
        await Promise.all(
            idsToProcess.map(async (moteurId) => {
                const moteur = catalogue.moteur.find((m) => m.id === moteurId);
                if (!moteur) return;
                const shouldBeLinked = selectedMoteurIds.includes(moteurId);
                const currentlyLinked = (moteur.helicesCompatibles || []).some((linked: any) => linked.id === helice.id);
                if (shouldBeLinked === currentlyLinked) return;
                const helicesCompatibles = shouldBeLinked
                    ? [...(moteur.helicesCompatibles || []), { id: helice.id }]
                    : (moteur.helicesCompatibles || []).filter((linked: any) => linked.id !== helice.id);
                await api.put(`/catalogue/moteurs/${moteurId}`, { ...moteur, helicesCompatibles });
            }),
        );
    };

    const handleModalOk = async () => {
        let values;
        try {
            values = await form.validateFields();
        } catch (err) {
            // form validation error
            return;
        }
        const type = typeCourant;
        const { forfaitIds, ...produit } = values;
        produit.images = produit.images || [];
        produit.documents = produit.documents || [];
        const moteurIds: number[] = type === 'helice' ? (produit.moteursCompatibles || []) : [];
        if (type === 'moteur') {
            produit.helicesCompatibles = (produit.helicesCompatibles || []).map((id: number) => ({ id }));
        }
        if (type === 'helice') {
            // enregistré côté moteur, voir syncMoteursForHelice
            delete produit.moteursCompatibles;
        }
        try {
            let saved: CatalogueEntity;
            if (isEdit) {
                const res = await api.put(`${config.endpoint}/${currentProduit!.id}`, { ...currentProduit, ...produit });
                saved = res.data;
                message.success(`${config.label} ${config.feminin ? 'modifiée' : 'modifié'} avec succès`);
            } else {
                const res = await api.post(config.endpoint, produit);
                saved = res.data;
                message.success(`${config.label} ${config.feminin ? 'ajoutée' : 'ajouté'} avec succès`);
            }
            setCurrentProduit(saved);
            if (config.forfaitField) {
                await updateForfaitAssociations(type, saved.id as number, forfaitIds || []);
                setInitialForfaitIds(forfaitIds || []);
            }
            if (type === 'helice') {
                await syncMoteursForHelice(saved, moteurIds);
            }
            form.setFieldsValue({
                ...toFormValues(type, saved),
                ...(type === 'helice' ? { moteursCompatibles: moteurIds } : {}),
                forfaitIds,
            });
            setFormDirty(false);
            fetchCatalogue(type === 'moteur' || type === 'helice' ? ['moteur', 'helice'] : [type]);
        } catch {
            message.error("Erreur lors de l'enregistrement.");
        }
    };

    const handleDelete = async (ligne: LigneCatalogue) => {
        if (!ligne.id) return;
        const ligneConfig = TYPES_PRODUIT[ligne.typeProduit];
        try {
            await api.delete(`${ligneConfig.endpoint}/${ligne.id}`);
            message.success(`${ligneConfig.label} ${ligneConfig.feminin ? 'supprimée' : 'supprimé'} avec succès`);
            fetchCatalogue([ligne.typeProduit]);
        } catch {
            message.error('Erreur lors de la suppression.');
        }
    };

    // Catégories proposées en filtre : celles des types de produit affichés
    const categorieFilters = [
        ...(typeFiltre === 'tous' || typeFiltre === 'produit' ? CATEGORIES : []),
        ...(typeFiltre === 'tous' || typeFiltre === 'bateau' ? bateauTypes : []),
        ...(typeFiltre === 'tous' || typeFiltre === 'moteur' ? moteurTypes : []),
    ].filter((option, index, options) => options.findIndex((o) => o.value === option.value) === index);

    // Columns
    const columns = [
        {
            title: 'Désignation',
            dataIndex: 'designation',
            render: (_: string, record: LigneCatalogue) => (
                <Space>
                    {record.images && record.images[0] && (
                        <Image width={32} height={32} style={{ objectFit: 'cover' }} src={record.images[0]} />
                    )}
                    {record.designation}
                </Space>
            ),
            sorter: (a: LigneCatalogue, b: LigneCatalogue) => (a.designation || '').localeCompare(b.designation || ''),
        },
        {
            title: 'Type',
            dataIndex: 'typeProduit',
            render: (type: TypeProduit) => <Tag color={TYPES_PRODUIT[type].color}>{TYPES_PRODUIT[type].label}</Tag>,
            sorter: (a: LigneCatalogue, b: LigneCatalogue) => TYPES_PRODUIT[a.typeProduit].label.localeCompare(TYPES_PRODUIT[b.typeProduit].label),
        },
        {
            title: 'Catégorie',
            key: 'categorie',
            render: (_: any, record: LigneCatalogue) => getCategorie(record),
            sorter: (a: LigneCatalogue, b: LigneCatalogue) => getCategorie(a).localeCompare(getCategorie(b)),
            ...(categorieFilters.length > 0 ? {
                filters: categorieFilters,
                onFilter: (value: any, record: LigneCatalogue) => getCategorie(record) === value,
            } : {}),
        },
        {
            title: 'Référence',
            dataIndex: 'ref',
            sorter: (a: LigneCatalogue, b: LigneCatalogue) => (a.ref || '').localeCompare(b.ref || ''),
        },
        {
            title: 'Evaluation',
            dataIndex: 'evaluation',
            render: (value: number) => <Rate value={value} disabled allowHalf />,
            sorter: (a: LigneCatalogue, b: LigneCatalogue) => (a.evaluation || 0) - (b.evaluation || 0),
        },
        {
            title: 'Stock',
            dataIndex: 'stock',
            sorter: (a: LigneCatalogue, b: LigneCatalogue) => (a.stock || 0) - (b.stock || 0),
        },
        {
            title: 'Prix TTC',
            dataIndex: 'prixVenteTTC',
            key: 'prixVenteTTC',
            render: (value: number) => value ? value.toFixed(2) + " €" : "",
            sorter: (a: LigneCatalogue, b: LigneCatalogue) => (a.prixVenteTTC || 0) - (b.prixVenteTTC || 0),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: LigneCatalogue) => (
                <Space>
                    <Button onClick={() => openModal(record)} icon={<EditOutlined/>} />
                    <Popconfirm
                        title={`Supprimer ${TYPES_PRODUIT[record.typeProduit].demonstratif} ?`}
                        onConfirm={() => handleDelete(record)}
                        okText="Oui"
                        cancelText="Non"
                    >
                        <Button danger icon={<DeleteOutlined/>} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // prix/tva, puissance cv/kW and options autocalc
    const onValuesChange = (changedValues) => {
        setFormDirty(true);
        const hasChanged = (champ: string) => Object.prototype.hasOwnProperty.call(changedValues, champ);

        if (hasChanged('puissanceCv') && !hasChanged('puissanceKw')) {
            const puissanceCv = Number(form.getFieldValue('puissanceCv')) || 0;
            form.setFieldValue('puissanceKw', arrondir(puissanceCv * CV_TO_KW_FACTOR));
        }
        if (hasChanged('puissanceKw') && !hasChanged('puissanceCv')) {
            const puissanceKw = Number(form.getFieldValue('puissanceKw')) || 0;
            form.setFieldValue('puissanceCv', arrondir(puissanceKw / CV_TO_KW_FACTOR));
        }

        if (hasChanged('prixVenteHT') || hasChanged('tva')) {
            const prixVenteHT = form.getFieldValue('prixVenteHT') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = arrondir(prixVenteHT * (tva / 100));
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixVenteTTC', arrondir(prixVenteHT + montantTVA));
        }
        if (hasChanged('prixVenteTTC')) {
            const prixVenteTTC = form.getFieldValue('prixVenteTTC') || 0;
            const tva = form.getFieldValue('tva') || 0;
            const montantTVA = arrondir((prixVenteTTC / (100 + tva)) * tva);
            form.setFieldValue('montantTVA', montantTVA);
            form.setFieldValue('prixVenteHT', arrondir(prixVenteTTC - montantTVA));
        }

        if (hasChanged('options')) {
            const options = form.getFieldValue('options') || [];
            const updatedOptions = options.map((opt: BateauOption) => {
                if (opt && (opt.prixHT !== undefined || opt.tva !== undefined)) {
                    const prixHT = opt.prixHT || 0;
                    const tva = opt.tva || 0;
                    const montantTVA = arrondir(prixHT * (tva / 100));
                    const prixTTC = arrondir(prixHT + montantTVA);
                    return { ...opt, montantTVA, prixTTC };
                }
                return opt;
            });
            form.setFieldValue('options', updatedOptions);
        }
    };

    // --- UI Render ---

    return (
        <>
            <Card title="Catalogue Produits">
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Space wrap>
                            <Input.Search
                                placeholder="Recherche"
                                enterButton
                                allowClear
                                style={{ width: 600 }}
                                onSearch={(value) => setRecherche(value)}
                            />
                            <Segmented
                                value={typeFiltre}
                                onChange={(value) => setTypeFiltre(value as TypeProduit | 'tous')}
                                options={[
                                    { label: 'Tous', value: 'tous' },
                                    ...TYPE_PRODUIT_KEYS.map((type) => ({ label: TYPES_PRODUIT[type].pluriel, value: type })),
                                ]}
                            />
                            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                            <ImportCsvButton endpoint="/catalogue/produits/import" label="Importer des produits (CSV)" onImported={() => fetchCatalogue(['produit'])} />
                        </Space>
                    </Col>
                </Row>
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col span={24}>
                        {/* key : réinitialise tri, filtres et pagination quand on change de type */}
                        <Table
                            key={typeFiltre}
                            rowKey="key"
                            columns={columns}
                            dataSource={lignes}
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
                            title={`${isEdit ? 'Modifier' : 'Ajouter'} ${config.article}`}
                            open={modalVisible}
                            onOk={handleModalOk}
                            onCancel={handleModalCancel}
                            maskClosable={false}
                            width="95vw"
                            okText="Enregistrer"
                            cancelText="Fermer"
                            destroyOnHidden
                        >
                            <Form
                                form={form}
                                layout="vertical"
                                onValuesChange={onValuesChange}
                            >
                                <Row gutter={16}>
                                    <Col span={12}>
                                        {/* Chaque type a son propre référentiel : le type n'est plus modifiable une fois le produit créé */}
                                        <Form.Item label="Type de produit" required>
                                            <Select
                                                value={typeCourant}
                                                onChange={handleTypeChange}
                                                disabled={isEdit}
                                                options={TYPE_PRODUIT_KEYS.map((type) => ({ value: type, label: TYPES_PRODUIT[type].label }))}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="designation" label="Désignation" rules={[{ required: true, message: "La désignation est requise" }]}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    {typeCourant === 'produit' && (
                                        <>
                                            <Col span={12}>
                                                <Form.Item name="categorie" label="Catégorie" rules={[{ required: true, message: "La catégorie est requise" }]}>
                                                    <Select options={CATEGORIES} placeholder="Choisir une catégorie" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="ref" label="Référence interne">
                                                    <Input />
                                                </Form.Item>
                                            </Col>
                                        </>
                                    )}
                                    {(typeCourant === 'bateau' || typeCourant === 'moteur') && (
                                        <Col span={12}>
                                            <Form.Item
                                                name="type"
                                                label={typeCourant === 'bateau' ? 'Type de bateau' : 'Type de moteur'}
                                                rules={[{ required: true, message: "Le type est requis" }]}
                                            >
                                                <Select options={typeCourant === 'bateau' ? bateauTypes : moteurTypes} placeholder="Choisir un type" />
                                            </Form.Item>
                                        </Col>
                                    )}
                                    <Col span={12}>
                                        <Form.Item label="Années">
                                            <Row gutter={8}>
                                                <Col span={12}>
                                                    <Form.Item name="anneeDebut" noStyle>
                                                        <InputNumber min={1900} max={new Date().getFullYear() + 10} step={1} style={{ width: '100%' }} placeholder="Début" />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={12}>
                                                    <Form.Item name="anneeFin" noStyle>
                                                        <InputNumber min={1900} max={new Date().getFullYear() + 10} step={1} style={{ width: '100%' }} placeholder="Fin" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item name="description" label="Description">
                                    <Input.TextArea rows={3} placeholder="Description" allowClear />
                                </Form.Item>
                                <Form.Item name="evaluation" label="Évaluation">
                                    <Rate allowHalf />
                                </Form.Item>
                                <Form.Item name="images" label="Images">
                                    <ImageUpload />
                                </Form.Item>
                                <Form.Item name="documents" label="Documents">
                                    <DocumentUpload />
                                </Form.Item>
                                {typeCourant === 'produit' && (
                                    <Form.Item label="Références complémentaires">
                                        <Form.List name="refs">
                                            {(fields, { add, remove }) => (
                                                <>
                                                    {fields.map(({ key, name, ...restField }) => (
                                                        <Space key={key} align="baseline">
                                                            <Form.Item {...restField} name={[name]} style={{ flex: 1 }}>
                                                                <Input placeholder="Réf. complémentaire" style={{ width: 200 }} />
                                                            </Form.Item>
                                                            <Button icon={<DeleteOutlined />} danger onClick={() => remove(name)} />
                                                        </Space>
                                                    ))}
                                                    <Button type="dashed" onClick={() => add()} block style={{ marginTop: 8 }}>
                                                        Ajouter une référence
                                                    </Button>
                                                </>
                                            )}
                                        </Form.List>
                                    </Form.Item>
                                )}
                                {typeCourant !== 'produit' && (
                                    <Divider titlePlacement="start">Caractéristiques</Divider>
                                )}
                                {typeCourant === 'bateau' && <ChampsBateau />}
                                {typeCourant === 'moteur' && <ChampsMoteur helices={catalogue.helice} />}
                                {typeCourant === 'helice' && <ChampsHelice moteurs={catalogue.moteur} />}
                                {typeCourant === 'remorque' && <ChampsRemorque />}
                                <Divider titlePlacement="start">{typeCourant === 'helice' ? 'Prix' : 'Stock et prix'}</Divider>
                                {/* Les hélices ne sont pas gérées en stock */}
                                {typeCourant !== 'helice' && (
                                    <>
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <Form.Item name="stock" label="Stock">
                                                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name={typeCourant === 'produit' ? 'stockMini' : 'stockAlerte'} label="Stock minimal d'alerte">
                                                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                        <Form.Item name="emplacement" label="Emplacement">
                                            {typeCourant === 'bateau'
                                                ? <Input.TextArea rows={3} placeholder="Emplacement du stock bateau" allowClear />
                                                : <Input />}
                                        </Form.Item>
                                    </>
                                )}
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="prixVenteHT" label="Prix de vente HT">
                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="tva" label="TVA (%)">
                                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="montantTVA" label="Montant TVA">
                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="prixVenteTTC" label="Prix de vente TTC">
                                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                {typeCourant === 'bateau' && (
                                    <>
                                        <Divider titlePlacement="start">Options disponibles</Divider>
                                        <Form.List name="options">
                                            {(fields, { add, remove }) => (
                                                <>
                                                    {fields.map(({ key, name, ...restField }) => (
                                                        <Card key={key} size="small" style={{ marginBottom: 8 }} extra={
                                                            <Button danger icon={<MinusCircleOutlined />} size="small" onClick={() => remove(name)} />
                                                        }>
                                                            <Row gutter={8}>
                                                                <Col span={12}>
                                                                    <Form.Item {...restField} name={[name, 'nom']} label="Nom" rules={[{ required: true, message: 'Nom requis' }]}>
                                                                        <Input />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col span={12}>
                                                                    <Form.Item {...restField} name={[name, 'description']} label="Description">
                                                                        <Input />
                                                                    </Form.Item>
                                                                </Col>
                                                            </Row>
                                                            <Row gutter={8}>
                                                                <Col span={6}>
                                                                    <Form.Item {...restField} name={[name, 'prixHT']} label="Prix HT">
                                                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col span={6}>
                                                                    <Form.Item {...restField} name={[name, 'tva']} label="TVA">
                                                                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="%" />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col span={6}>
                                                                    <Form.Item {...restField} name={[name, 'montantTVA']} label="Montant TVA">
                                                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col span={6}>
                                                                    <Form.Item {...restField} name={[name, 'prixTTC']} label="Prix TTC">
                                                                        <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
                                                                    </Form.Item>
                                                                </Col>
                                                            </Row>
                                                        </Card>
                                                    ))}
                                                    <Button type="dashed" onClick={() => add({ prixHT: 0, tva: 20, montantTVA: 0, prixTTC: 0 })} block icon={<PlusCircleOutlined />} style={{ marginBottom: 24 }}>
                                                        Ajouter une option
                                                    </Button>
                                                </>
                                            )}
                                        </Form.List>
                                    </>
                                )}
                                {config.forfaitField && (
                                    <Form.Item label="Forfaits associés">
                                        <Space.Compact style={{ width: "100%" }}>
                                            <Form.Item name="forfaitIds" noStyle>
                                                <Select
                                                    mode="multiple"
                                                    style={{ width: '100%' }}
                                                    placeholder="Associer des forfaits"
                                                    optionFilterProp="children"
                                                    allowClear
                                                    showSearch
                                                    filterOption={(input, option) =>
                                                        `${option?.children ?? ""}`.toLowerCase().includes(input.toLowerCase())
                                                    }
                                                >
                                                    {forfaits.map((forfait: any) => (
                                                        <Select.Option key={forfait.id} value={forfait.id}>
                                                            {forfait.reference ? `${forfait.reference} - ` : ''}{forfait.nom}
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                            <Button
                                                icon={<PlusCircleOutlined />}
                                                onClick={() => setForfaitModalVisible(true)}
                                            />
                                        </Space.Compact>
                                    </Form.Item>
                                )}
                            </Form>
                            {isEdit && (
                            <>
                                {typeCourant === 'produit' && (
                                    <>
                                        <FournisseurProduits produitId={currentProduit?.id} />
                                        <ProduitHistorique produitId={currentProduit?.id} />
                                    </>
                                )}
                                {typeCourant === 'bateau' && <FournisseurBateaux bateauId={currentProduit?.id} />}
                                {typeCourant === 'moteur' && <FournisseurMoteurs moteurId={currentProduit?.id} />}
                                {typeCourant === 'helice' && <FournisseurHelices heliceId={currentProduit?.id} />}
                                {typeCourant === 'remorque' && <FournisseurRemorques remorqueId={currentProduit?.id} />}
                            </>
                            )}
                            {config.forfaitField && (
                                <ForfaitFormModal
                                    open={forfaitModalVisible}
                                    onCancel={() => setForfaitModalVisible(false)}
                                    onCreated={handleForfaitCreated}
                                    preAssociatedBateauId={typeCourant === 'bateau' ? currentProduit?.id : undefined}
                                    preAssociatedMoteurId={typeCourant === 'moteur' ? currentProduit?.id : undefined}
                                />
                            )}
                        </Modal>
                    </Col>
                </Row>
            </Card>
        </>
    );
};

export default CatalogueProduits;
