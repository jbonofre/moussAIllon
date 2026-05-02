import { useState, useEffect } from 'react';
import { fetchWithAuth } from './api.ts';
import { Card, Space, Button, Form, Input, Table, Modal, Tag, Spin, message } from 'antd';
import { MailOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const TYPE_LABELS = {
    RAPPEL: 'Rappel',
    INCIDENT: 'Incident',
    FACTURE: 'Facture'
};

const TYPE_COLORS = {
    RAPPEL: 'blue',
    INCIDENT: 'red',
    FACTURE: 'green'
};

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
                setTemplates(data);
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
            width: 120,
            sorter: (a, b) => (a.type || '').localeCompare(b.type || ''),
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
                width={900}
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
                        <ReactQuill theme="snow" style={{ height: 300, marginBottom: 42 }} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );

}
