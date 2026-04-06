import React, { useEffect, useState } from 'react';
import {
    Button,
    Card,
    DatePicker,
    Form,
    Input,
    Modal,
    Popconfirm,
    Select,
    Space,
    Table,
    Tag,
    message,
} from 'antd';
import { ClockCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusCircleOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import api from './api.ts';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import dayjs from 'dayjs';

interface Campagne {
    id: number;
    nom: string;
    canal: string;
    cible: string;
    cibleFiltre?: string;
    statut: string;
    sujet?: string;
    contenu?: string;
    nombreDestinataires?: number;
    dateCreation?: string;
    dateEnvoi?: string;
    dateProgrammee?: string;
}

interface CatalogueItem {
    id: number;
    modele: string;
    marque: string;
}

interface Destinataire {
    nom: string;
    email: string;
}

interface Historique {
    id: number;
    dateEnvoi: string;
    nombreDestinataires: number;
    statut: string;
    erreur?: string;
}

const canalOptions = [
    { value: 'EMAIL', label: 'Email' },
    { value: 'SMS', label: 'SMS' },
];

const cibleOptions = [
    { value: 'TOUS_LES_CLIENTS', label: 'Tous les clients' },
    { value: 'PROPRIETAIRE_BATEAU', label: 'Propriétaires de bateaux' },
    { value: 'PROPRIETAIRE_BATEAU_MARQUE', label: 'Propriétaires de bateaux (par marque)' },
    { value: 'PROPRIETAIRE_BATEAU_MODELE', label: 'Propriétaires de bateaux (par modèle)' },
    { value: 'PROPRIETAIRE_MOTEUR', label: 'Propriétaires de moteurs' },
    { value: 'PROPRIETAIRE_MOTEUR_MARQUE', label: 'Propriétaires de moteurs (par marque)' },
    { value: 'PROPRIETAIRE_MOTEUR_MODELE', label: 'Propriétaires de moteurs (par modèle)' },
    { value: 'PROPRIETAIRE_REMORQUE', label: 'Propriétaires de remorques' },
    { value: 'PROPRIETAIRE_REMORQUE_MARQUE', label: 'Propriétaires de remorques (par marque)' },
    { value: 'PROPRIETAIRE_REMORQUE_MODELE', label: 'Propriétaires de remorques (par modèle)' },
    { value: 'FOURNISSEUR', label: 'Fournisseurs' },
];

const statutColor: Record<string, string> = { BROUILLON: 'orange', PROGRAMMEE: 'blue', ENVOYEE: 'green' };
const statutLabel: Record<string, string> = { BROUILLON: 'Brouillon', PROGRAMMEE: 'Programmée', ENVOYEE: 'Envoyée' };
const canalLabel: Record<string, string> = { EMAIL: 'Email', SMS: 'SMS' };
const cibleLabel: Record<string, string> = {
    TOUS_LES_CLIENTS: 'Tous les clients',
    PROPRIETAIRE_BATEAU: 'Propriétaires de bateaux',
    PROPRIETAIRE_BATEAU_MARQUE: 'Propriétaires de bateaux (par marque)',
    PROPRIETAIRE_BATEAU_MODELE: 'Propriétaires de bateaux (par modèle)',
    PROPRIETAIRE_MOTEUR: 'Propriétaires de moteurs',
    PROPRIETAIRE_MOTEUR_MARQUE: 'Propriétaires de moteurs (par marque)',
    PROPRIETAIRE_MOTEUR_MODELE: 'Propriétaires de moteurs (par modèle)',
    PROPRIETAIRE_REMORQUE: 'Propriétaires de remorques',
    PROPRIETAIRE_REMORQUE_MARQUE: 'Propriétaires de remorques (par marque)',
    PROPRIETAIRE_REMORQUE_MODELE: 'Propriétaires de remorques (par modèle)',
    FOURNISSEUR: 'Fournisseurs',
};

const historiqueStatutColor: Record<string, string> = { SUCCES: 'green', ECHEC: 'red', PARTIEL: 'orange' };

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR') + ' ' + parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export default function Campagnes() {
    const [campagnes, setCampagnes] = useState<Campagne[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Campagne | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailCampagne, setDetailCampagne] = useState<Campagne | null>(null);
    const [destinataires, setDestinataires] = useState<Destinataire[]>([]);
    const [destLoading, setDestLoading] = useState(false);
    const [historique, setHistorique] = useState<Historique[]>([]);
    const [historiqueLoading, setHistoriqueLoading] = useState(false);
    const [contenu, setContenu] = useState('');
    const [selectedCanal, setSelectedCanal] = useState<string>('EMAIL');
    const [selectedCible, setSelectedCible] = useState<string>('PROPRIETAIRE_BATEAU');
    const [bateauxCatalogue, setBateauxCatalogue] = useState<CatalogueItem[]>([]);
    const [moteursCatalogue, setMoteursCatalogue] = useState<CatalogueItem[]>([]);
    const [remorquesCatalogue, setRemorquesCatalogue] = useState<CatalogueItem[]>([]);
    const [programmerOpen, setProgrammerOpen] = useState(false);
    const [programmerCampagne, setProgrammerCampagne] = useState<Campagne | null>(null);
    const [dateProgrammee, setDateProgrammee] = useState<dayjs.Dayjs | null>(null);
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);

    const fetchCampagnes = () => {
        setLoading(true);
        api.get('/campagnes')
            .then((res) => setCampagnes(res.data || []))
            .catch(() => message.error('Erreur lors du chargement des campagnes'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchCampagnes();
        api.get('/catalogue/bateaux').then((res) => setBateauxCatalogue(res.data || [])).catch(() => {});
        api.get('/catalogue/moteurs').then((res) => setMoteursCatalogue(res.data || [])).catch(() => {});
        api.get('/catalogue/remorques').then((res) => setRemorquesCatalogue(res.data || [])).catch(() => {});
    }, []);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ canal: 'EMAIL', cible: 'PROPRIETAIRE_BATEAU' });
        setContenu('');
        setSelectedCanal('EMAIL');
        setSelectedCible('PROPRIETAIRE_BATEAU');
        setFormDirty(false);
        setModalOpen(true);
    };

    const openEdit = (campagne: Campagne) => {
        setEditing(campagne);
        form.setFieldsValue({
            nom: campagne.nom,
            canal: campagne.canal,
            cible: campagne.cible,
            cibleFiltre: campagne.cibleFiltre,
            sujet: campagne.sujet,
        });
        setContenu(campagne.contenu || '');
        setSelectedCanal(campagne.canal);
        setSelectedCible(campagne.cible);
        setFormDirty(false);
        setModalOpen(true);
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
                    setModalOpen(false);
                },
            });
        } else {
            setModalOpen(false);
        }
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                nom: values.nom,
                canal: values.canal,
                cible: values.cible,
                cibleFiltre: values.cibleFiltre,
                sujet: values.sujet,
                contenu: contenu,
            };
            if (editing) {
                await api.put(`/campagnes/${editing.id}`, payload);
                message.success('Campagne mise à jour');
            } else {
                await api.post('/campagnes', payload);
                message.success('Campagne créée');
            }
            setFormDirty(false);
            setModalOpen(false);
            fetchCampagnes();
        } catch {
            // validation error
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/campagnes/${id}`);
            message.success('Campagne supprimée');
            fetchCampagnes();
        } catch {
            message.error('Erreur lors de la suppression');
        }
    };

    const openDetail = (campagne: Campagne) => {
        setDetailCampagne(campagne);
        setDestinataires([]);
        setHistorique([]);
        setDetailOpen(true);
        setDestLoading(true);
        setHistoriqueLoading(true);
        api.get(`/campagnes/${campagne.id}/destinataires`)
            .then((res) => setDestinataires(res.data || []))
            .catch(() => {})
            .finally(() => setDestLoading(false));
        api.get(`/campagnes/${campagne.id}/historique`)
            .then((res) => setHistorique(res.data || []))
            .catch(() => {})
            .finally(() => setHistoriqueLoading(false));
    };

    const handleEnvoyer = async (campagne: Campagne) => {
        try {
            await api.post(`/campagnes/${campagne.id}/envoyer`, {});
            message.success('Campagne envoyée avec succès');
            fetchCampagnes();
        } catch (err: any) {
            const msg = err?.response?.data || 'Erreur lors de l\'envoi';
            message.error(typeof msg === 'string' ? msg : 'Erreur lors de l\'envoi');
        }
    };

    const openProgrammer = (campagne: Campagne) => {
        setProgrammerCampagne(campagne);
        setDateProgrammee(null);
        setProgrammerOpen(true);
    };

    const handleProgrammer = async () => {
        if (!programmerCampagne || !dateProgrammee) return;
        try {
            await api.post(`/campagnes/${programmerCampagne.id}/envoyer`, {
                dateProgrammee: dateProgrammee.format('YYYY-MM-DDTHH:mm:ss'),
            });
            message.success('Campagne programmée');
            setProgrammerOpen(false);
            fetchCampagnes();
        } catch (err: any) {
            const msg = err?.response?.data || 'Erreur lors de la programmation';
            message.error(typeof msg === 'string' ? msg : 'Erreur lors de la programmation');
        }
    };

    const handleAnnulerProgrammation = async (campagne: Campagne) => {
        try {
            await api.post(`/campagnes/${campagne.id}/annuler-programmation`);
            message.success('Programmation annulée');
            fetchCampagnes();
        } catch (err: any) {
            const msg = err?.response?.data || 'Erreur lors de l\'annulation';
            message.error(typeof msg === 'string' ? msg : 'Erreur lors de l\'annulation');
        }
    };

    const columns = [
        { title: 'Nom', dataIndex: 'nom', key: 'nom' },
        {
            title: 'Canal',
            dataIndex: 'canal',
            key: 'canal',
            render: (val: string) => <Tag color={val === 'EMAIL' ? 'blue' : 'purple'}>{canalLabel[val] || val}</Tag>,
        },
        {
            title: 'Cible',
            dataIndex: 'cible',
            key: 'cible',
            render: (val: string, record: Campagne) => {
                const label = cibleLabel[val] || val;
                return record.cibleFiltre ? `${label} : ${record.cibleFiltre}` : label;
            },
        },
        {
            title: 'Statut',
            dataIndex: 'statut',
            key: 'statut',
            render: (val: string) => <Tag color={statutColor[val]}>{statutLabel[val] || val}</Tag>,
        },
        {
            title: 'Destinataires',
            dataIndex: 'nombreDestinataires',
            key: 'nombreDestinataires',
            render: (val: number, record: Campagne) => record.statut === 'ENVOYEE' ? val : '-',
        },
        {
            title: 'Date envoi',
            dataIndex: 'dateEnvoi',
            key: 'dateEnvoi',
            render: (val: string, record: Campagne) => {
                if (record.statut === 'PROGRAMMEE' && record.dateProgrammee) {
                    return <>Programmé pour le {formatDate(record.dateProgrammee)}</>;
                }
                return formatDate(val);
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 340,
            render: (_: unknown, record: Campagne) => (
                <Space wrap size={[4, 4]}>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
                    {record.statut === 'BROUILLON' && (
                        <>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                            <Popconfirm
                                title="Envoyer cette campagne ?"
                                description="Cette action est irréversible."
                                onConfirm={() => handleEnvoyer(record)}
                            >
                                <Button size="small" type="primary" icon={<SendOutlined />}>Envoyer</Button>
                            </Popconfirm>
                            <Button size="small" icon={<ClockCircleOutlined />} onClick={() => openProgrammer(record)}>Programmer</Button>
                        </>
                    )}
                    {record.statut === 'PROGRAMMEE' && (
                        <>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                            <Popconfirm
                                title="Annuler la programmation ?"
                                onConfirm={() => handleAnnulerProgrammation(record)}
                            >
                                <Button size="small" icon={<StopOutlined />}>Annuler</Button>
                            </Popconfirm>
                        </>
                    )}
                    <Popconfirm title="Supprimer cette campagne ?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const destColumns = [
        { title: 'Nom', dataIndex: 'nom', key: 'nom' },
        { title: selectedCanal === 'SMS' ? 'Téléphone' : 'Email', dataIndex: 'email', key: 'email' },
    ];

    const historiqueColumns = [
        { title: 'Date', dataIndex: 'dateEnvoi', key: 'dateEnvoi', render: (val: string) => formatDate(val) },
        { title: 'Destinataires', dataIndex: 'nombreDestinataires', key: 'nombreDestinataires' },
        {
            title: 'Statut',
            dataIndex: 'statut',
            key: 'statut',
            render: (val: string) => <Tag color={historiqueStatutColor[val] || 'default'}>{val}</Tag>,
        },
        { title: 'Erreur', dataIndex: 'erreur', key: 'erreur', render: (val?: string) => val || '-' },
    ];

    return (
        <Card
            title="Campagnes marketing"
            extra={
                <Button type="primary" icon={<PlusCircleOutlined />} onClick={openCreate}>
                    Nouvelle campagne
                </Button>
            }
        >
            <Table
                rowKey="id"
                dataSource={campagnes}
                columns={columns}
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
            />

            <Modal
                title={editing ? 'Modifier la campagne' : 'Nouvelle campagne'}
                open={modalOpen}
                onCancel={handleModalCancel}
                onOk={handleSave}
                okText={editing ? 'Mettre à jour' : 'Créer'}
                cancelText="Fermer"
                width={750}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onValuesChange={(changed) => {
                    setFormDirty(true);
                    if (changed.canal) {
                        setSelectedCanal(changed.canal);
                    }
                    if (changed.cible) {
                        setSelectedCible(changed.cible);
                        form.setFieldValue('cibleFiltre', undefined);
                    }
                }}>
                    <Form.Item name="nom" label="Nom de la campagne" rules={[{ required: true, message: 'Le nom est requis' }]}>
                        <Input placeholder="Ex: Promotion hivernage 2026" />
                    </Form.Item>
                    <Form.Item name="canal" label="Canal" rules={[{ required: true, message: 'Le canal est requis' }]}>
                        <Select options={canalOptions} />
                    </Form.Item>
                    <Form.Item name="cible" label="Cible" rules={[{ required: true, message: 'La cible est requise' }]}>
                        <Select options={cibleOptions} />
                    </Form.Item>
                    {selectedCible === 'PROPRIETAIRE_BATEAU_MARQUE' && (
                        <Form.Item name="cibleFiltre" label="Marque" rules={[{ required: true, message: 'La marque est requise' }]}>
                            <Select
                                showSearch
                                placeholder="Sélectionner une marque"
                                options={[...new Set(bateauxCatalogue.map((b) => b.marque))].sort().map((m) => ({ value: m, label: m }))}
                            />
                        </Form.Item>
                    )}
                    {selectedCible === 'PROPRIETAIRE_BATEAU_MODELE' && (
                        <Form.Item name="cibleFiltre" label="Modèle" rules={[{ required: true, message: 'Le modèle est requis' }]}>
                            <Select
                                showSearch
                                placeholder="Sélectionner un modèle"
                                options={bateauxCatalogue.map((b) => ({ value: b.modele, label: `${b.marque} - ${b.modele}` })).sort((a, b) => a.label.localeCompare(b.label))}
                            />
                        </Form.Item>
                    )}
                    {selectedCible === 'PROPRIETAIRE_MOTEUR_MARQUE' && (
                        <Form.Item name="cibleFiltre" label="Marque" rules={[{ required: true, message: 'La marque est requise' }]}>
                            <Select
                                showSearch
                                placeholder="Sélectionner une marque"
                                options={[...new Set(moteursCatalogue.map((m) => m.marque))].sort().map((m) => ({ value: m, label: m }))}
                            />
                        </Form.Item>
                    )}
                    {selectedCible === 'PROPRIETAIRE_MOTEUR_MODELE' && (
                        <Form.Item name="cibleFiltre" label="Modèle" rules={[{ required: true, message: 'Le modèle est requis' }]}>
                            <Select
                                showSearch
                                placeholder="Sélectionner un modèle"
                                options={moteursCatalogue.map((m) => ({ value: m.modele, label: `${m.marque} - ${m.modele}` })).sort((a, b) => a.label.localeCompare(b.label))}
                            />
                        </Form.Item>
                    )}
                    {selectedCible === 'PROPRIETAIRE_REMORQUE_MARQUE' && (
                        <Form.Item name="cibleFiltre" label="Marque" rules={[{ required: true, message: 'La marque est requise' }]}>
                            <Select
                                showSearch
                                placeholder="Sélectionner une marque"
                                options={[...new Set(remorquesCatalogue.map((r) => r.marque))].sort().map((m) => ({ value: m, label: m }))}
                            />
                        </Form.Item>
                    )}
                    {selectedCible === 'PROPRIETAIRE_REMORQUE_MODELE' && (
                        <Form.Item name="cibleFiltre" label="Modèle" rules={[{ required: true, message: 'Le modèle est requis' }]}>
                            <Select
                                showSearch
                                placeholder="Sélectionner un modèle"
                                options={remorquesCatalogue.map((r) => ({ value: r.modele, label: `${r.marque} - ${r.modele}` })).sort((a, b) => a.label.localeCompare(b.label))}
                            />
                        </Form.Item>
                    )}
                    {selectedCanal === 'EMAIL' && (
                        <Form.Item name="sujet" label="Sujet de l'email" rules={[{ required: true, message: 'Le sujet est requis' }]}>
                            <Input placeholder="Ex: Offre spéciale hivernage" />
                        </Form.Item>
                    )}
                    <Form.Item label={selectedCanal === 'EMAIL' ? "Contenu de l'email" : "Contenu du SMS"}>
                        {selectedCanal === 'EMAIL' ? (
                            <ReactQuill
                                theme="snow"
                                value={contenu}
                                onChange={(val) => { setContenu(val); setFormDirty(true); }}
                                style={{ height: 250, marginBottom: 42 }}
                            />
                        ) : (
                            <Input.TextArea
                                rows={4}
                                value={contenu}
                                onChange={(e) => { setContenu(e.target.value); setFormDirty(true); }}
                                placeholder="Contenu du SMS..."
                                maxLength={160}
                                showCount
                            />
                        )}
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Programmer l'envoi"
                open={programmerOpen}
                onCancel={() => setProgrammerOpen(false)}
                onOk={handleProgrammer}
                okText="Programmer"
                cancelText="Fermer"
                okButtonProps={{ disabled: !dateProgrammee }}
            >
                <p>Choisissez la date et l'heure d'envoi de la campagne <strong>{programmerCampagne?.nom}</strong> :</p>
                <DatePicker
                    showTime={{ format: 'HH:mm' }}
                    format="DD/MM/YYYY HH:mm"
                    style={{ width: '100%' }}
                    value={dateProgrammee}
                    onChange={(val) => setDateProgrammee(val)}
                    disabledDate={(current) => current && current.isBefore(dayjs(), 'day')}
                    placeholder="Sélectionner une date"
                />
            </Modal>

            <Modal
                title={`Campagne : ${detailCampagne?.nom || ''}`}
                open={detailOpen}
                onCancel={() => setDetailOpen(false)}
                footer={null}
                width={700}
            >
                {detailCampagne && (
                    <div>
                        <p><strong>Canal :</strong> <Tag color={detailCampagne.canal === 'EMAIL' ? 'blue' : 'purple'}>{canalLabel[detailCampagne.canal] || detailCampagne.canal}</Tag></p>
                        <p><strong>Cible :</strong> {cibleLabel[detailCampagne.cible] || detailCampagne.cible}{detailCampagne.cibleFiltre ? ` : ${detailCampagne.cibleFiltre}` : ''}</p>
                        <p><strong>Statut :</strong> <Tag color={statutColor[detailCampagne.statut]}>{statutLabel[detailCampagne.statut] || detailCampagne.statut}</Tag></p>
                        {detailCampagne.sujet && <p><strong>Sujet :</strong> {detailCampagne.sujet}</p>}
                        {detailCampagne.dateCreation && <p><strong>Date de création :</strong> {formatDate(detailCampagne.dateCreation)}</p>}
                        {detailCampagne.dateProgrammee && detailCampagne.statut === 'PROGRAMMEE' && (
                            <p><strong>Envoi programmé pour :</strong> {formatDate(detailCampagne.dateProgrammee)}</p>
                        )}
                        {detailCampagne.dateEnvoi && <p><strong>Date d'envoi :</strong> {formatDate(detailCampagne.dateEnvoi)}</p>}
                        {detailCampagne.statut === 'ENVOYEE' && <p><strong>Nombre de destinataires :</strong> {detailCampagne.nombreDestinataires}</p>}
                        {detailCampagne.contenu && (
                            <>
                                <p><strong>Contenu :</strong></p>
                                {detailCampagne.canal === 'EMAIL' ? (
                                    <div style={{ background: '#fafafa', padding: 12, borderRadius: 4 }} dangerouslySetInnerHTML={{ __html: detailCampagne.contenu }} />
                                ) : (
                                    <p style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 4 }}>{detailCampagne.contenu}</p>
                                )}
                            </>
                        )}
                        <p style={{ marginTop: 16 }}><strong>Destinataires ({destinataires.length}) :</strong></p>
                        <Table
                            rowKey="email"
                            dataSource={destinataires}
                            columns={destColumns}
                            loading={destLoading}
                            pagination={{ pageSize: 5 }}
                            size="small"
                            bordered
                        />
                        <p style={{ marginTop: 16 }}><strong>Historique d'envoi :</strong></p>
                        <Table
                            rowKey="id"
                            dataSource={historique}
                            columns={historiqueColumns}
                            loading={historiqueLoading}
                            pagination={{ pageSize: 5 }}
                            size="small"
                            bordered
                            locale={{ emptyText: 'Aucun envoi effectué' }}
                        />
                    </div>
                )}
            </Modal>
        </Card>
    );
}
