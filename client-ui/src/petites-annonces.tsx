import React, { useEffect, useState } from 'react';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    Tag,
    Space,
    Spin,
    message,
    Popconfirm,
    Image,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
} from '@ant-design/icons';
import axios from 'axios';

interface BateauClientEntity {
    id: number;
    name?: string;
    immatriculation?: string;
    modele?: { nom?: string; marque?: string };
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
    client?: { id: number };
    bateau?: BateauClientEntity;
}

const plateformesLabel: Record<string, string> = {
    YOUBOAT: 'YouBoat',
    LEBONCOIN: 'Leboncoin',
    BAND_OF_BOATS: 'Band of Boats',
    BOAT24: 'Boat24',
    YACHTWORLD: 'YachtWorld',
};
const plateformesColor: Record<string, string> = {
    YOUBOAT: '#0070c0',
    LEBONCOIN: '#f56a00',
    BAND_OF_BOATS: '#1a3c5e',
    BOAT24: '#006837',
    YACHTWORLD: '#003366',
};

interface PetitesAnnoncesProps {
    clientId: number;
}

const statusColor: Record<string, string> = { ACTIVE: 'green', VENDU: 'blue', EXPIRE: 'red' };
const statusLabel: Record<string, string> = { ACTIVE: 'Active', VENDU: 'Vendu', EXPIRE: 'Expiree' };

const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('fr-FR');
};

const formatEuro = (value?: number) => value != null ? `${value.toFixed(2)} EUR` : '-';

export default function PetitesAnnonces({ clientId }: PetitesAnnoncesProps) {
    const [annonces, setAnnonces] = useState<Annonce[]>([]);
    const [allAnnonces, setAllAnnonces] = useState<Annonce[]>([]);
    const [bateaux, setBateaux] = useState<BateauClientEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailAnnonce, setDetailAnnonce] = useState<Annonce | null>(null);
    const [editing, setEditing] = useState<Annonce | null>(null);
    const [viewAll, setViewAll] = useState(true);
    const [form] = Form.useForm();

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            axios.get('/annonces/active'),
            axios.get(`/annonces/client/${clientId}`),
            axios.get(`/portal/clients/${clientId}/bateaux`),
        ])
            .then(([allRes, myRes, bateauxRes]) => {
                setAllAnnonces(allRes.data || []);
                setAnnonces(myRes.data || []);
                setBateaux(bateauxRes.data || []);
            })
            .catch(() => message.error('Erreur lors du chargement des annonces'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
    }, [clientId]);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ status: 'ACTIVE' });
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
            photos: (annonce.photos || []).join('\n'),
            status: annonce.status,
            bateauId: annonce.bateau?.id,
        });
        setModalOpen(true);
    };

    const openDetail = (annonce: Annonce) => {
        setDetailAnnonce(annonce);
        setDetailOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const photos = values.photos
                ? values.photos.split('\n').map((s: string) => s.trim()).filter((s: string) => s)
                : [];
            const payload: any = {
                titre: values.titre,
                description: values.description,
                prix: values.prix || 0,
                contact: values.contact,
                telephone: values.telephone,
                photos,
                status: values.status || 'ACTIVE',
                client: { id: clientId },
            };
            if (values.bateauId) {
                payload.bateau = { id: values.bateauId };
            }
            if (editing) {
                const res = await axios.put(`/annonces/${editing.id}`, payload);
                message.success('Annonce mise a jour');
                setEditing(res.data);
            } else {
                const res = await axios.post('/annonces', payload);
                message.success('Annonce creee');
                setEditing(res.data);
            }
            fetchData();
        } catch {
            // validation error
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await axios.delete(`/annonces/${id}`);
            message.success('Annonce supprimee');
            fetchData();
        } catch {
            message.error('Erreur lors de la suppression');
        }
    };

    const bateauLabel = (b?: BateauClientEntity) => {
        if (!b) return '-';
        const model = b.modele ? `${b.modele.marque || ''} ${b.modele.nom || ''}`.trim() : '';
        return b.name || model || b.immatriculation || `Bateau #${b.id}`;
    };

    const displayedAnnonces = viewAll ? allAnnonces : annonces;

    const columns = [
        { title: 'Titre', dataIndex: 'titre', key: 'titre' },
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
                if (pubs.length === 0) return <Tag>-</Tag>;
                return (
                    <Space wrap size={[4, 4]}>
                        {pubs.map((p) => (
                            <Tag key={p} color={plateformesColor[p] || 'default'}>{plateformesLabel[p] || p}</Tag>
                        ))}
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
            render: (_: unknown, record: Annonce) => (
                <Space>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
                    {record.client?.id === clientId && (
                        <>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                            <Popconfirm title="Supprimer cette annonce ?" onConfirm={() => handleDelete(record.id)}>
                                <Button size="small" icon={<DeleteOutlined />} danger />
                            </Popconfirm>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card
            title="Petites annonces - Bateaux a vendre"
            extra={
                <Space>
                    <Select
                        value={viewAll ? 'all' : 'mine'}
                        onChange={(v) => setViewAll(v === 'all')}
                        style={{ width: 180 }}
                        options={[
                            { value: 'all', label: 'Toutes les annonces' },
                            { value: 'mine', label: 'Mes annonces' },
                        ]}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                        Mettre en vente
                    </Button>
                </Space>
            }
        >
            <Spin spinning={loading}>
                <Table
                    rowKey="id"
                    dataSource={displayedAnnonces}
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                    bordered
                />
            </Spin>

            {/* Create / Edit modal */}
            <Modal
                title={editing ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                okText={editing ? 'Mettre a jour' : 'Publier'}
                cancelText="Annuler"
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="titre" label="Titre" rules={[{ required: true, message: 'Le titre est requis' }]}>
                        <Input placeholder="Ex: Bateau Beneteau Flyer 7.7 - Excellent etat" />
                    </Form.Item>
                    <Form.Item name="bateauId" label="Bateau associe">
                        <Select
                            allowClear
                            placeholder="Selectionner un de vos bateaux"
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
                        <Input placeholder="votre@email.com" />
                    </Form.Item>
                    <Form.Item name="telephone" label="Telephone">
                        <Input placeholder="06 12 34 56 78" />
                    </Form.Item>
                    <Form.Item name="photos" label="Photos (une URL par ligne)">
                        <Input.TextArea rows={3} placeholder={"https://exemple.com/photo1.jpg\nhttps://exemple.com/photo2.jpg"} />
                    </Form.Item>
                    {editing && (
                        <Form.Item name="status" label="Statut">
                            <Select
                                options={[
                                    { value: 'ACTIVE', label: 'Active' },
                                    { value: 'VENDU', label: 'Vendu' },
                                    { value: 'EXPIRE', label: 'Expiree' },
                                ]}
                            />
                        </Form.Item>
                    )}
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
                                <Space wrap style={{ marginBottom: 12 }}>
                                    {detailAnnonce.publications!.map((p) => (
                                        <Tag key={p} color={plateformesColor[p] || 'default'}>{plateformesLabel[p] || p}</Tag>
                                    ))}
                                </Space>
                            </>
                        )}
                        {(detailAnnonce.photos || []).length > 0 && (
                            <>
                                <p><strong>Photos:</strong></p>
                                <Image.PreviewGroup>
                                    <Space wrap>
                                        {detailAnnonce.photos!.map((url, i) => (
                                            <Image key={i} width={150} src={url} style={{ borderRadius: 4 }} />
                                        ))}
                                    </Space>
                                </Image.PreviewGroup>
                            </>
                        )}
                    </div>
                )}
            </Modal>
        </Card>
    );
}
