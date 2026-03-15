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
    message
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

interface MoteurCatalogueEntity {
    id: number;
    modele: string;
    marque: string;
}

interface BateauCatalogueEntity {
    id: number;
    modele: string;
    marque: string;
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

interface ForfaitProduitEntity {
    id?: number;
    produit?: ProduitCatalogueEntity;
    quantite: number;
}

interface ForfaitServiceEntity {
    id?: number;
    service?: ServiceEntity;
    quantite: number;
}

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
}

type TaskStatus = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINEE' | 'INCIDENT' | 'ANNULEE';

interface TechnicienEntity {
    id: number;
    prenom?: string;
    nom?: string;
}

interface ForfaitEntity {
    id?: number;
    reference?: string;
    nom: string;
    moteursAssocies: MoteurCatalogueEntity[];
    bateauxAssocies: BateauCatalogueEntity[];
    produits: ForfaitProduitEntity[];
    services: ForfaitServiceEntity[];
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
    moteurIds: number[];
    bateauIds: number[];
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
    moteurIds: [],
    bateauIds: [],
    produits: [{}],
    services: [{}],
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

const taskStatusOptions: Array<{ value: TaskStatus; label: string }> = [
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'TERMINEE', label: 'Terminee' },
    { value: 'INCIDENT', label: 'Incident' },
    { value: 'ANNULEE', label: 'Annulee' }
];

export default function Forfaits() {
    const [forfaits, setForfaits] = useState<ForfaitEntity[]>([]);
    const [moteurs, setMoteurs] = useState<MoteurCatalogueEntity[]>([]);
    const [bateaux, setBateaux] = useState<BateauCatalogueEntity[]>([]);
    const [produits, setProduits] = useState<ProduitCatalogueEntity[]>([]);
    const [services, setServices] = useState<ServiceEntity[]>([]);
    const [techniciens, setTechniciens] = useState<TechnicienEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentForfait, setCurrentForfait] = useState<ForfaitEntity | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm<ForfaitFormValues>();

    const moteurOptions = useMemo(
        () => moteurs.map((moteur) => ({ value: moteur.id, label: `${moteur.marque} ${moteur.modele}` })),
        [moteurs]
    );

    const bateauOptions = useMemo(
        () => bateaux.map((bateau) => ({ value: bateau.id, label: `${bateau.marque} ${bateau.modele}` })),
        [bateaux]
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

    const fetchForfaits = async (query?: string) => {
        setLoading(true);
        try {
            const endpoint = query && query.trim() ? '/forfaits/search' : '/forfaits';
            const response = await axios.get(endpoint, { params: query && query.trim() ? { q: query } : {} });
            setForfaits(response.data || []);
        } catch {
            message.error('Erreur lors du chargement des forfaits.');
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [moteursRes, bateauxRes, produitsRes, servicesRes, techniciensRes] = await Promise.all([
                axios.get('/catalogue/moteurs'),
                axios.get('/catalogue/bateaux'),
                axios.get('/catalogue/produits'),
                axios.get('/services'),
                axios.get('/techniciens')
            ]);
            setMoteurs(moteursRes.data || []);
            setBateaux(bateauxRes.data || []);
            setProduits(produitsRes.data || []);
            setServices(servicesRes.data || []);
            setTechniciens(techniciensRes.data || []);
        } catch {
            message.error('Erreur lors du chargement des listes de référence.');
        }
    };

    useEffect(() => {
        fetchForfaits();
        fetchOptions();
    }, []);

    const openModal = (forfait?: ForfaitEntity) => {
        if (forfait) {
            setIsEdit(true);
            setCurrentForfait(forfait);
            form.setFieldsValue({
                reference: forfait.reference || '',
                nom: forfait.nom || '',
                moteurIds: (forfait.moteursAssocies || []).map((m) => m.id),
                bateauIds: (forfait.bateauxAssocies || []).map((b) => b.id),
                produits: (forfait.produits || [])
                    .filter((item) => item.produit?.id)
                    .map<ForfaitFormValues['produits'][number]>((item) => ({ produitId: item.produit!.id, quantite: item.quantite || 1 }))
                    .concat({}),
                services: (forfait.services || [])
                    .filter((item) => item.service?.id)
                    .map<ForfaitFormValues['services'][number]>((item) => ({ serviceId: item.service!.id, quantite: item.quantite || 1 }))
                    .concat({}),
                taches: (forfait.taches || [])
                    .map<ForfaitFormValues['taches'][number]>((tache) => ({
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
        setModalVisible(true);
    };

    const toPayload = (values: ForfaitFormValues): Partial<ForfaitEntity> => ({
        reference: values.reference,
        nom: values.nom,
        moteursAssocies: (values.moteurIds || [])
            .map((id) => moteurs.find((moteur) => moteur.id === id))
            .filter(Boolean) as MoteurCatalogueEntity[],
        bateauxAssocies: (values.bateauIds || [])
            .map((id) => bateaux.find((bateau) => bateau.id === id))
            .filter(Boolean) as BateauCatalogueEntity[],
        produits: (values.produits || [])
            .filter((item) => item.produitId)
            .map((item) => ({
                produit: produits.find((produit) => produit.id === item.produitId),
                quantite: item.quantite || 1
            })),
        services: (values.services || [])
            .filter((item) => item.serviceId)
            .map((item) => ({
                service: services.find((service) => service.id === item.serviceId),
                quantite: item.quantite || 1
            })),
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
                )
            )
            .map((tache) => ({
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
                dureeReelle: tache.dureeReelle || 0
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
                const res = await axios.put(`/forfaits/${currentForfait.id}`, { ...currentForfait, ...payload });
                message.success('Forfait modifié avec succès');
                setCurrentForfait(res.data);
                form.setFieldsValue(values);
            } else {
                const res = await axios.post('/forfaits', payload);
                message.success('Forfait ajouté avec succès');
                setIsEdit(true);
                setCurrentForfait(res.data);
                form.setFieldsValue(values);
            }
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
            await axios.delete(`/forfaits/${id}`);
            message.success('Forfait supprimé avec succès');
            fetchForfaits(searchQuery);
        } catch {
            message.error('Erreur lors de la suppression du forfait.');
        }
    };

    const onValuesChange = (changedValues: Partial<ForfaitFormValues>, allValues: ForfaitFormValues) => {
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
            const isLastLineComplete = !!lastTaskLine?.nom?.trim();
            if (isLastLineComplete) {
                form.setFieldValue('taches', [...currentTaskLines, {}]);
                return;
            }
        }

        if (changedValues.produits !== undefined || changedValues.services !== undefined) {
            const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
            const produitsValues = form.getFieldValue('produits') || [];
            const servicesValues = form.getFieldValue('services') || [];

            const totalProduitsTTC = produitsValues.reduce((total: number, item: { produitId?: number; quantite?: number }) => {
                const prixUnitaireTTC = produits.find((produit) => produit.id === item.produitId)?.prixVenteTTC || 0;
                const quantite = item.quantite || 0;
                return total + (prixUnitaireTTC * quantite);
            }, 0);

            const totalServicesTTC = servicesValues.reduce((total: number, item: { serviceId?: number; quantite?: number }) => {
                const prixUnitaireTTC = services.find((service) => service.id === item.serviceId)?.prixTTC || 0;
                const quantite = item.quantite || 0;
                return total + (prixUnitaireTTC * quantite);
            }, 0);

            const prixTTC = round2(totalProduitsTTC + totalServicesTTC);
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
            render: (values: MoteurCatalogueEntity[]) => values?.length || 0
        },
        {
            title: 'Bateaux',
            dataIndex: 'bateauxAssocies',
            render: (values: BateauCatalogueEntity[]) => values?.length || 0
        },
        {
            title: 'Produits',
            dataIndex: 'produits',
            render: (values: ForfaitProduitEntity[]) => values?.length || 0
        },
        {
            title: 'Services',
            dataIndex: 'services',
            render: (values: ForfaitServiceEntity[]) => values?.length || 0
        },
        {
            title: 'Fréquence',
            key: 'frequence',
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
                        <Input.Search
                            placeholder="Recherche"
                            enterButton
                            allowClear
                            style={{ width: 600 }}
                            onSearch={(value) => {
                                setSearchQuery(value);
                                fetchForfaits(value);
                            }}
                            onChange={(event) => {
                                if (!event.target.value) {
                                    setSearchQuery('');
                                    fetchForfaits();
                                }
                            }}
                        />
                        <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
                    </Space>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                    <Table
                        rowKey="id"
                        dataSource={forfaits}
                        columns={columns}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        bordered
                    />
                </Col>
            </Row>

            <Modal
                title={isEdit ? 'Modifier un forfait' : 'Ajouter un forfait'}
                open={modalVisible}
                onOk={handleSave}
                onCancel={() => setModalVisible(false)}
                okText="Enregistrer"
                cancelText="Annuler"
                maskClosable={false}
                destroyOnHidden
                width={1024}
            >
                <Form form={form} layout="vertical" initialValues={defaultForfait} onValuesChange={onValuesChange}>
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
                                label: 'Produits & Services',
                                children: (
                                    <>
                                        <Form.Item label="Produits inclus">
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
                                                                        const prixUnitaireTTC = produits.find((produit) => produit.id === produitId)?.prixVenteTTC || 0;
                                                                        const prixTTC = Math.round(((prixUnitaireTTC * quantite) + Number.EPSILON) * 100) / 100;

                                                                        return (
                                                                            <Form.Item style={{ width: 180 }}>
                                                                                <InputNumber
                                                                                    addonAfter="EUR"
                                                                                    value={prixTTC}
                                                                                    style={{ width: '100%' }}
                                                                                    disabled
                                                                                />
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

                                        <Form.Item label="Services inclus">
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
                                                                        const prixUnitaireTTC = services.find((service) => service.id === serviceId)?.prixTTC || 0;
                                                                        const prixTTC = Math.round(((prixUnitaireTTC * quantite) + Number.EPSILON) * 100) / 100;

                                                                        return (
                                                                            <Form.Item style={{ width: 180 }}>
                                                                                <InputNumber
                                                                                    addonAfter="EUR"
                                                                                    value={prixTTC}
                                                                                    style={{ width: '100%' }}
                                                                                    disabled
                                                                                />
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
                                                            <Col span={12}>
                                                                <Form.Item {...field} name={[field.name, 'nom']} label="Nom">
                                                                    <Input allowClear />
                                                                </Form.Item>
                                                            </Col>
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
                                                        </Row>
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
            </Modal>
        </Card>
    );
}
