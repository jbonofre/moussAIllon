import React, { useEffect, useState } from 'react';
import {
    Button,
    Card,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Select,
    Space,
    Table,
    Tag,
    message,
} from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusCircleOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import api from './api.ts';
import ImageUpload from './ImageUpload.tsx';
import { useNavigation } from './navigation-context.tsx';

interface ClientEntity {
    id: number;
    prenom?: string;
    nom: string;
    email?: string;
    telephone?: string;
}

interface BateauClientEntity {
    id: number;
    name?: string;
    immatriculation?: string;
    modele?: { id: number; nom?: string; marque?: string };
}

interface Annonce {
    id: number;
    titre?: string;
    description?: string;
    prix?: number;
    contact?: string;
    telephone?: string;
    photos?: string[];
    publications?: string[];
    status?: string;
    dateCreation?: string;
    client?: ClientEntity;
    bateau?: BateauClientEntity;
}

const plateformes = [
    { key: 'YOUBOAT', label: 'YouBoat', color: '#0070c0' },
    { key: 'LEBONCOIN', label: 'Leboncoin', color: '#f56a00' },
    { key: 'BAND_OF_BOATS', label: 'Band of Boats', color: '#1a3c5e' },
    { key: 'BOAT24', label: 'Boat24', color: '#006837' },
    { key: 'YACHTWORLD', label: 'YachtWorld', color: '#003366' },
];

const statusColor: Record<string, string> = { ACTIVE: 'green', VENDU: 'blue', EXPIRE: 'red' };
const statusLabel: Record<string, string> = { ACTIVE: 'Active', VENDU: 'Vendu', EXPIRE: 'Expiree' };

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR');
};

const formatEuro = (value?: number) => value != null ? `${value.toFixed(2)} EUR` : '-';

export default function Annonces() {
    const [annonces, setAnnonces] = useState<Annonce[]>([]);
    const [clients, setClients] = useState<ClientEntity[]>([]);
    const [bateaux, setBateaux] = useState<BateauClientEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailAnnonce, setDetailAnnonce] = useState<Annonce | null>(null);
    const [editing, setEditing] = useState<Annonce | null>(null);
    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const [publishAnnonce, setPublishAnnonce] = useState<Annonce | null>(null);
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);
    const { navigate, pageState } = useNavigation();

    const fetchAnnonces = () => {
        setLoading(true);
        api.get('/annonces')
            .then((res) => setAnnonces(res.data || []))
            .catch(() => message.error('Erreur lors du chargement des annonces'))
            .finally(() => setLoading(false));
    };

    const fetchClients = () => {
        api.get('/clients')
            .then((res) => setClients(res.data || []))
            .catch(() => {});
    };

    const fetchBateaux = () => {
        api.get('/bateaux/clients')
            .then((res) => setBateaux(res.data || []))
            .catch(() => {});
    };

    useEffect(() => {
        fetchAnnonces();
        fetchClients();
        fetchBateaux();
    }, []);

    useEffect(() => {
        if (pageState?.photos && pageState.photos.length > 0) {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({
                status: 'ACTIVE',
                photos: pageState.photos,
                bateauId: pageState.bateauId,
                clientId: pageState.clientId,
            });
            setFormDirty(false);
            setModalOpen(true);
            // Clear page state to prevent re-opening on re-render
            navigate('/annonces');
        }
    }, [pageState]);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ status: 'ACTIVE' });
        setFormDirty(false);
        setModalOpen(true);
    };

    const openEdit = (annonce: Annonce) => {
        setEditing(annonce);
        form.setFieldsValue({
            titre: annonce.titre,
            description: annonce.description,
            prix: annonce.prix,
            contact: annonce.contact,
            telephone: annonce.telephone,
            photos: annonce.photos || [],
            status: annonce.status,
            clientId: annonce.client?.id,
            bateauId: annonce.bateau?.id,
        });
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

    const openDetail = (annonce: Annonce) => {
        setDetailAnnonce(annonce);
        setDetailOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const photos = values.photos || [];
            const payload: any = {
                titre: values.titre,
                description: values.description,
                prix: values.prix || 0,
                contact: values.contact,
                telephone: values.telephone,
                photos,
                status: values.status || 'ACTIVE',
            };
            if (values.clientId) {
                payload.client = { id: values.clientId };
            }
            if (values.bateauId) {
                payload.bateau = { id: values.bateauId };
            }
            if (editing) {
                const res = await api.put(`/annonces/${editing.id}`, payload);
                message.success('Annonce mise a jour');
                setEditing(res.data);
            } else {
                const res = await api.post('/annonces', payload);
                message.success('Annonce creee');
                setEditing(res.data);
            }
            setFormDirty(false);
            fetchAnnonces();
        } catch {
            // validation error
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/annonces/${id}`);
            message.success('Annonce supprimee');
            fetchAnnonces();
        } catch {
            message.error('Erreur lors de la suppression');
        }
    };

    const openPublishModal = (annonce: Annonce) => {
        setPublishAnnonce(annonce);
        setPublishModalOpen(true);
    };

    const handlePublish = async (id: number, plateforme: string) => {
        try {
            await api.post(`/annonces/${id}/publier`, { plateforme });
            message.success(`Annonce publiee sur ${plateformes.find(p => p.key === plateforme)?.label || plateforme}`);
            fetchAnnonces();
        } catch {
            message.error('Erreur lors de la publication');
        }
    };

    const handleUnpublish = async (id: number, plateforme: string) => {
        try {
            await api.post(`/annonces/${id}/depublier`, { plateforme });
            message.success(`Annonce retiree de ${plateformes.find(p => p.key === plateforme)?.label || plateforme}`);
            fetchAnnonces();
        } catch {
            message.error('Erreur lors du retrait');
        }
    };

    const clientLabel = (c?: ClientEntity) => {
        if (!c) return '-';
        return `${c.prenom || ''} ${c.nom}`.trim();
    };

    const bateauLabel = (b?: BateauClientEntity) => {
        if (!b) return '-';
        const model = b.modele ? `${b.modele.marque || ''} ${b.modele.nom || ''}`.trim() : '';
        return b.name || model || b.immatriculation || `Bateau #${b.id}`;
    };

    const columns = [
        { title: 'Titre', dataIndex: 'titre', key: 'titre' },
        {
            title: 'Client',
            key: 'client',
            render: (_: unknown, record: Annonce) => clientLabel(record.client),
        },
        {
            title: 'Bateau',
            key: 'bateau',
            render: (_: unknown, record: Annonce) => bateauLabel(record.bateau),
        },
        {
            title: 'Prix',
            dataIndex: 'prix',
            key: 'prix',
            render: (val: number) => formatEuro(val),
        },
        { title: 'Contact', dataIndex: 'contact', key: 'contact' },
        { title: 'Telephone', dataIndex: 'telephone', key: 'telephone' },
        {
            title: 'Date',
            dataIndex: 'dateCreation',
            key: 'dateCreation',
            render: (val: string) => formatDate(val),
        },
        {
            title: 'Diffusion',
            key: 'publications',
            render: (_: unknown, record: Annonce) => {
                const pubs = record.publications || [];
                if (pubs.length === 0) return <Tag>Non diffusee</Tag>;
                return (
                    <Space wrap size={[4, 4]}>
                        {pubs.map((p) => {
                            const pf = plateformes.find(x => x.key === p);
                            return <Tag key={p} color={pf?.color || 'default'}>{pf?.label || p}</Tag>;
                        })}
                    </Space>
                );
            },
        },
        {
            title: 'Statut',
            dataIndex: 'status',
            key: 'status',
            render: (val: string) => <Tag color={statusColor[val]}>{statusLabel[val] || val}</Tag>,
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 280,
            render: (_: unknown, record: Annonce) => (
                <Space wrap size={[4, 4]}>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                    <Button size="small" icon={<SendOutlined />} onClick={() => openPublishModal(record)}>
                        Diffuser
                    </Button>
                    <Popconfirm title="Supprimer cette annonce ?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title="Petites annonces - Bateaux a vendre"
            extra={
                <Button type="primary" icon={<PlusCircleOutlined />} onClick={openCreate}>
                    Nouvelle annonce
                </Button>
            }
        >
            <Table
                rowKey="id"
                dataSource={annonces}
                columns={columns}
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
            />

            {/* Create / Edit modal */}
            <Modal
                title={editing ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
                open={modalOpen}
                onCancel={handleModalCancel}
                onOk={handleSave}
                okText={editing ? 'Mettre a jour' : 'Publier'}
                cancelText="Fermer"
                width={650}
            >
                <Form form={form} layout="vertical" onValuesChange={() => setFormDirty(true)}>
                    <Form.Item name="titre" label="Titre" rules={[{ required: true, message: 'Le titre est requis' }]}>
                        <Input placeholder="Ex: Beneteau Flyer 7.7 - Excellent etat" />
                    </Form.Item>
                    <Form.Item name="clientId" label="Client">
                        <Select
                            allowClear
                            showSearch
                            placeholder="Selectionner un client"
                            filterOption={(input, option) =>
                                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={clients.map((c) => ({
                                value: c.id,
                                label: clientLabel(c),
                            }))}
                        />
                    </Form.Item>
                    <Form.Item name="bateauId" label="Bateau associe">
                        <Select
                            allowClear
                            showSearch
                            placeholder="Selectionner un bateau"
                            filterOption={(input, option) =>
                                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={bateaux.map((b) => ({
                                value: b.id,
                                label: bateauLabel(b),
                            }))}
                        />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea rows={4} placeholder="Description detaillee du bateau, equipements, etat, ..." />
                    </Form.Item>
                    <Form.Item name="prix" label="Prix de vente (EUR)" rules={[{ required: true, message: 'Le prix est requis' }]}>
                        <InputNumber min={0} step={100} style={{ width: '100%' }} placeholder="Ex: 25000" />
                    </Form.Item>
                    <Form.Item name="contact" label="Email de contact">
                        <Input placeholder="contact@email.com" />
                    </Form.Item>
                    <Form.Item name="telephone" label="Telephone">
                        <Input placeholder="06 12 34 56 78" />
                    </Form.Item>
                    <Form.Item name="photos" label="Photos">
                        <ImageUpload />
                    </Form.Item>
                    <Form.Item name="status" label="Statut">
                        <Select
                            options={[
                                { value: 'ACTIVE', label: 'Active' },
                                { value: 'VENDU', label: 'Vendu' },
                                { value: 'EXPIRE', label: 'Expiree' },
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Detail modal */}
            <Modal
                title={detailAnnonce?.titre || 'Detail de l\'annonce'}
                open={detailOpen}
                onCancel={() => setDetailOpen(false)}
                footer={null}
                width={700}
            >
                {detailAnnonce && (
                    <div>
                        <p><strong>Client:</strong> {clientLabel(detailAnnonce.client)}</p>
                        <p><strong>Bateau:</strong> {bateauLabel(detailAnnonce.bateau)}</p>
                        <p><strong>Prix:</strong> <span style={{ fontSize: 18, color: '#1890ff' }}>{formatEuro(detailAnnonce.prix)}</span></p>
                        <p><strong>Description:</strong></p>
                        <p style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 4 }}>
                            {detailAnnonce.description || 'Pas de description'}
                        </p>
                        <p><strong>Contact:</strong> {detailAnnonce.contact || '-'}</p>
                        <p><strong>Telephone:</strong> {detailAnnonce.telephone || '-'}</p>
                        <p><strong>Date de publication:</strong> {formatDate(detailAnnonce.dateCreation)}</p>
                        <p><strong>Statut:</strong> <Tag color={statusColor[detailAnnonce.status || '']}>{statusLabel[detailAnnonce.status || ''] || detailAnnonce.status}</Tag></p>
                        {(detailAnnonce.publications || []).length > 0 && (
                            <>
                                <p><strong>Diffusee sur:</strong></p>
                                <Space wrap>
                                    {detailAnnonce.publications!.map((p) => {
                                        const pf = plateformes.find(x => x.key === p);
                                        return <Tag key={p} color={pf?.color || 'default'}>{pf?.label || p}</Tag>;
                                    })}
                                </Space>
                                <br /><br />
                            </>
                        )}
                        {(detailAnnonce.photos || []).length > 0 && (
                            <>
                                <p><strong>Photos:</strong></p>
                                <Space wrap>
                                    {detailAnnonce.photos!.map((url, i) => (
                                        <img key={i} width={150} src={url} style={{ borderRadius: 4, cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                                    ))}
                                </Space>
                            </>
                        )}
                    </div>
                )}
            </Modal>

            {/* Publish modal */}
            <Modal
                title={`Diffuser l'annonce : ${publishAnnonce?.titre || ''}`}
                open={publishModalOpen}
                onCancel={() => setPublishModalOpen(false)}
                footer={null}
                width={550}
            >
                {publishAnnonce && (
                    <div>
                        <p style={{ marginBottom: 16 }}>
                            Selectionnez les plateformes sur lesquelles publier ou retirer cette annonce.
                        </p>
                        {plateformes.map((pf) => {
                            const isPublished = (publishAnnonce.publications || []).includes(pf.key);
                            return (
                                <Card size="small" key={pf.key} style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Space>
                                            <Tag color={pf.color} style={{ fontSize: 14, padding: '2px 10px' }}>{pf.label}</Tag>
                                            {isPublished && <Tag color="green">En ligne</Tag>}
                                        </Space>
                                        {isPublished ? (
                                            <Popconfirm
                                                title={`Retirer de ${pf.label} ?`}
                                                onConfirm={async () => {
                                                    await handleUnpublish(publishAnnonce.id, pf.key);
                                                    setPublishAnnonce({
                                                        ...publishAnnonce,
                                                        publications: (publishAnnonce.publications || []).filter(p => p !== pf.key),
                                                    });
                                                }}
                                            >
                                                <Button size="small" icon={<StopOutlined />} danger>
                                                    Retirer
                                                </Button>
                                            </Popconfirm>
                                        ) : (
                                            <Button
                                                size="small"
                                                type="primary"
                                                icon={<SendOutlined />}
                                                onClick={async () => {
                                                    await handlePublish(publishAnnonce.id, pf.key);
                                                    setPublishAnnonce({
                                                        ...publishAnnonce,
                                                        publications: [...(publishAnnonce.publications || []), pf.key],
                                                    });
                                                }}
                                            >
                                                Publier
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </Modal>
        </Card>
    );
}
