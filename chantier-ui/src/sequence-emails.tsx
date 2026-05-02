import { useState, useEffect } from 'react';
import { fetchWithAuth } from './api.ts';
import { Card, Space, Button, Form, Input, InputNumber, Table, Modal, Tag, Spin, Switch, Tabs, message, Popconfirm } from 'antd';
import { SendOutlined, PlusCircleOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface Etape {
    id?: number;
    cible: string;
    ordre: number;
    delaiJours: number;
    sujet: string;
    contenu: string;
    description?: string;
    actif: boolean;
}

const CIBLE_OPTIONS = [
    { key: 'CLIENT', label: 'Clients', variables: '{client}, {societe}, {email}, {telephone}' },
    { key: 'BATEAU', label: 'Bateaux', variables: '{client}, {societe}, {equipement}, {email}, {telephone}' },
    { key: 'MOTEUR', label: 'Moteurs', variables: '{client}, {societe}, {equipement}, {email}, {telephone}' },
    { key: 'REMORQUE', label: 'Remorques', variables: '{client}, {societe}, {equipement}, {email}, {telephone}' },
];

function SequenceTable({ cible, variables }: { cible: string; variables: string }) {

    const [etapes, setEtapes] = useState<Etape[]>([]);
    const [loading, setLoading] = useState(true);
    const [editVisible, setEditVisible] = useState(false);
    const [editing, setEditing] = useState<Etape | null>(null);
    const [form] = Form.useForm();

    const loadEtapes = () => {
        setLoading(true);
        fetchWithAuth('./email-sequences?cible=' + cible)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Erreur (code ' + response.status + ')');
                }
                return response.json();
            })
            .then((data) => {
                setEtapes(data);
            })
            .catch((error) => {
                message.error('Une erreur est survenue: ' + error.message);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        loadEtapes();
    }, [cible]);

    const handleAdd = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            ordre: etapes.length + 1,
            delaiJours: 0,
            sujet: '',
            contenu: '',
            description: '',
            actif: true
        });
        setEditVisible(true);
    };

    const handleEdit = (etape: Etape) => {
        setEditing(etape);
        form.setFieldsValue({
            ordre: etape.ordre,
            delaiJours: etape.delaiJours,
            sujet: etape.sujet,
            contenu: etape.contenu,
            description: etape.description,
            actif: etape.actif
        });
        setEditVisible(true);
    };

    const handleDelete = (id: number) => {
        fetchWithAuth('./email-sequences/' + id, { method: 'DELETE' })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Erreur (code ' + response.status + ')');
                }
                message.success('Étape supprimée.');
                loadEtapes();
            })
            .catch((error) => {
                message.error('Une erreur est survenue: ' + error.message);
            });
    };

    const handleSave = (values: any) => {
        const payload = {
            ...(editing || {}),
            cible,
            ordre: values.ordre,
            delaiJours: values.delaiJours,
            sujet: values.sujet,
            contenu: values.contenu,
            description: values.description,
            actif: values.actif
        };

        const url = editing && editing.id
            ? './email-sequences/' + editing.id
            : './email-sequences';
        const method = editing && editing.id ? 'PUT' : 'POST';

        fetchWithAuth(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            }
            return response.json();
        })
        .then(() => {
            message.success(editing && editing.id ? 'Étape mise à jour.' : 'Étape créée.');
            setEditVisible(false);
            loadEtapes();
        })
        .catch((error) => {
            message.error('Une erreur est survenue: ' + error.message);
        });
    };

    const handleToggleActif = (etape: Etape) => {
        fetchWithAuth('./email-sequences/' + etape.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...etape, actif: !etape.actif })
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            }
            return response.json();
        })
        .then(() => {
            message.success(etape.actif ? 'Étape désactivée.' : 'Étape activée.');
            loadEtapes();
        })
        .catch((error) => {
            message.error('Une erreur est survenue: ' + error.message);
        });
    };

    const columns = [
        {
            title: 'Ordre',
            dataIndex: 'ordre',
            key: 'ordre',
            width: 80,
            sorter: (a: Etape, b: Etape) => a.ordre - b.ordre
        },
        {
            title: 'Délai (jours)',
            dataIndex: 'delaiJours',
            key: 'delaiJours',
            width: 120,
            sorter: (a: Etape, b: Etape) => a.delaiJours - b.delaiJours,
            render: (val: number) => val === 0 ? <Tag color="green">Immédiat</Tag> : <Tag color="blue">J+{val}</Tag>
        },
        {
            title: 'Sujet',
            dataIndex: 'sujet',
            key: 'sujet',
            sorter: (a: Etape, b: Etape) => (a.sujet || '').localeCompare(b.sujet || ''),
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            sorter: (a: Etape, b: Etape) => (a.description || '').localeCompare(b.description || ''),
            render: (desc: string) => <span style={{ fontSize: '0.85em', opacity: 0.7 }}>{desc}</span>
        },
        {
            title: 'Actif',
            dataIndex: 'actif',
            key: 'actif',
            width: 80,
            sorter: (a: Etape, b: Etape) => (a.actif === b.actif ? 0 : a.actif ? -1 : 1),
            render: (actif: boolean, record: Etape) => (
                <Switch checked={actif} onChange={() => handleToggleActif(record)} size="small" />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 120,
            render: (_: any, record: Etape) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
                    <Popconfirm title="Supprimer cette étape ?" onConfirm={() => handleDelete(record.id!)}>
                        <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Space>
                        <InfoCircleOutlined />
                        <span style={{ opacity: 0.7 }}>
                            Variables disponibles : {variables}
                        </span>
                    </Space>
                    <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleAdd}>Ajouter une étape</Button>
                </Space>
                <Spin spinning={loading}>
                    <Table
                        dataSource={etapes}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        onRow={(record) => ({
                            onClick: (e) => {
                                if ((e.target as HTMLElement).closest('button, .ant-btn, [role="button"]')) return;
                                handleEdit(record);
                            },
                            style: { cursor: 'pointer' },
                        })}
                    />
                </Spin>
            </Space>

            <Modal
                open={editVisible}
                title={editing && editing.id ? 'Modifier l\'étape' : 'Ajouter une étape'}
                okText="Enregistrer"
                cancelText="Fermer"
                width={900}
                onOk={() => form.submit()}
                onCancel={() => {
                    form.resetFields();
                    setEditVisible(false);
                }}
                destroyOnHidden
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                >
                    <Space style={{ width: '100%' }} size="middle">
                        <Form.Item
                            name="ordre"
                            label="Ordre"
                            rules={[{ required: true, message: 'L\'ordre est requis' }]}
                        >
                            <InputNumber min={1} />
                        </Form.Item>
                        <Form.Item
                            name="delaiJours"
                            label="Délai (jours après création)"
                            rules={[{ required: true, message: 'Le délai est requis' }]}
                        >
                            <InputNumber min={0} />
                        </Form.Item>
                        <Form.Item
                            name="actif"
                            label="Actif"
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>
                    </Space>
                    <Form.Item
                        name="description"
                        label="Description (usage interne)"
                    >
                        <Input placeholder="Ex: Email de bienvenue, Confirmation d'enregistrement..." />
                    </Form.Item>
                    <Form.Item
                        name="sujet"
                        label="Sujet de l'email"
                        rules={[{ required: true, message: 'Le sujet est requis' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="contenu"
                        label="Contenu de l'email"
                        rules={[{ required: true, message: 'Le contenu est requis' }]}
                    >
                        <ReactQuill theme="snow" style={{ height: 300, marginBottom: 42 }} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}

export default function SequenceEmails() {

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWithAuth('./email-sequences/init', { method: 'POST' })
            .then(() => setLoading(false))
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return <Spin />;
    }

    const tabItems = CIBLE_OPTIONS.map((opt) => ({
        key: opt.key,
        label: opt.label,
        children: <SequenceTable cible={opt.key} variables={opt.variables} />
    }));

    return (
        <Card title={<Space><SendOutlined /> Séquences d'emails automatiques</Space>}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
                <span style={{ opacity: 0.7 }}>
                    <InfoCircleOutlined /> Configurez les séquences d'emails envoyés automatiquement lors de la création d'un nouveau client, bateau, moteur ou remorque.
                    Chaque étape est envoyée après le délai indiqué (en jours) à partir de la date de création.
                </span>
                <Tabs items={tabItems} />
            </Space>
        </Card>
    );

}
