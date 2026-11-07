import { useState, useEffect } from 'react';
import { fetchWithAuth } from './api.ts';
import { Alert, Card, Space, Button, Form, Input, Table, Modal, Tag, Spin, message } from 'antd';
import { MailOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import EditeurEmail from './EditeurEmail.tsx';

// Libellés des modèles, dans leur ordre d'affichage : un modèle par relance (1 à 3), de paiement puis de devis/OR.
// RAPPEL est le nom historique du modèle de la relance de paiement 1.
const TYPE_LABELS = {
    RAPPEL: 'Relance de paiement 1',
    RELANCE_2: 'Relance de paiement 2',
    RELANCE_3: 'Relance de paiement 3',
    RELANCE_DEVIS: 'Relance de devis 1',
    RELANCE_DEVIS_2: 'Relance de devis 2',
    RELANCE_DEVIS_3: 'Relance de devis 3',
    FACTURE: 'Facture',
    AVOIR: 'Avoir',
    INCIDENT: 'Incident',
    PRET_A_RECUPERER: 'Prêt à récupérer'
};

const TYPE_COLORS = {
    RAPPEL: 'gold',
    RELANCE_2: 'orange',
    RELANCE_3: 'red',
    RELANCE_DEVIS: 'cyan',
    RELANCE_DEVIS_2: 'blue',
    RELANCE_DEVIS_3: 'geekblue',
    INCIDENT: 'red',
    FACTURE: 'green',
    AVOIR: 'purple',
    PRET_A_RECUPERER: 'orange'
};

const ORDRE_TYPES = Object.keys(TYPE_LABELS);
const rangType = (type) => (ORDRE_TYPES.includes(type) ? ORDRE_TYPES.indexOf(type) : ORDRE_TYPES.length);

export default function Emails() {

    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editVisible, setEditVisible] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [editForm] = Form.useForm();

    const loadTemplates = () => {
        setLoading(true);
        fetchWithAuth('./email-templates/init', { method: 'POST' })
            .then(() => fetchWithAuth('./email-templates'))
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Erreur (code ' + response.status + ')');
                }
                return response.json();
            })
            .then((data) => {
                setTemplates([...data].sort((a, b) => rangType(a.type) - rangType(b.type)));
            })
            .catch((error) => {
                message.error('Une erreur est survenue: ' + error.message);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    const handleEdit = (template) => {
        setEditingTemplate(template);
        editForm.setFieldsValue({
            sujet: template.sujet,
            contenu: template.contenu
        });
        setEditVisible(true);
    };

    const handleSave = (values) => {
        fetchWithAuth('./email-templates/' + editingTemplate.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...editingTemplate,
                sujet: values.sujet,
                contenu: values.contenu
            })
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            }
            return response.json();
        })
        .then(() => {
            message.success('Le modèle d\'email a été mis à jour.');
            setEditVisible(false);
            loadTemplates();
        })
        .catch((error) => {
            message.error('Une erreur est survenue: ' + error.message);
        });
    };

    const columns = [
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 190,
            sorter: (a, b) => rangType(a.type) - rangType(b.type),
            render: (type) => <Tag color={TYPE_COLORS[type]}>{TYPE_LABELS[type] || type}</Tag>
        },
        {
            title: 'Sujet',
            dataIndex: 'sujet',
            key: 'sujet',
            sorter: (a, b) => (a.sujet || '').localeCompare(b.sujet || ''),
        },
        {
            title: 'Variables disponibles',
            dataIndex: 'description',
            key: 'description',
            render: (desc) => <span style={{ fontSize: '0.85em', opacity: 0.7 }}>{desc}</span>
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (_, record) => (
                <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>Modifier</Button>
            )
        }
    ];

    if (loading) {
        return <Spin />;
    }

    return (
        <>
            <Card title={<Space><MailOutlined /> Modèles d'emails</Space>}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Space>
                        <InfoCircleOutlined />
                        <span style={{ opacity: 0.7 }}>
                            Personnalisez le contenu des emails envoyés automatiquement. Utilisez les variables entre accolades (ex: {'{client}'}, {'{societe}'}) qui seront remplacées par les valeurs réelles lors de l'envoi.
                            Chaque relance a son propre modèle ; leurs délais se règlent dans Paramétrage &gt; Société.
                        </span>
                    </Space>
                    <Table
                        dataSource={templates}
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
                </Space>
            </Card>

            <Modal
                open={editVisible}
                title={editingTemplate ? 'Modifier le modèle - ' + (TYPE_LABELS[editingTemplate.type] || editingTemplate.type) : 'Modifier le modèle'}
                okText="Enregistrer"
                cancelText="Fermer"
                width="95vw"
                onOk={() => editForm.submit()}
                onCancel={() => {
                    editForm.resetFields();
                    setEditVisible(false);
                }}
                destroyOnHidden
            >
                {editingTemplate && (
                    <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                        <Tag icon={<InfoCircleOutlined />} color="processing">
                            {editingTemplate.description}
                        </Tag>
                        {editingTemplate.type === 'RELANCE_3' && (
                            <Alert
                                type="info"
                                showIcon
                                title="Ce modèle sert aussi au courrier de mise en demeure"
                                description={'Quand la relance 3 est envoyée par courrier (Paramétrage > Société), '
                                    + 'le sujet devient l\'objet de la lettre et le contenu son texte.'}
                            />
                        )}
                    </Space>
                )}
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={handleSave}
                >
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
                        <EditeurEmail hauteur={400} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );

}
