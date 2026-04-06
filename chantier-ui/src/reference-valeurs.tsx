import { fetchWithAuth } from './api.ts';
import React, { useEffect, useState } from 'react';
import { Space, Table, Button, Input, Form, Modal, Select, Popconfirm, message, Row, Col, InputNumber } from 'antd';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const style: React.CSSProperties = { padding: '8px 0' };

const TYPES = [
    { label: 'Catégorie Produit', value: 'CATEGORIE_PRODUIT' },
    { label: 'Type Bateau', value: 'TYPE_BATEAU' },
    { label: 'Type Moteur', value: 'TYPE_MOTEUR' },
];

const typeLabels = Object.fromEntries(TYPES.map(t => [t.value, t.label]));

const ValeurFormModal = ({ visible, onCancel, onSubmit, initialValues, loading, currentType }) => {
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);

    useEffect(() => {
        if (visible) {
            form.resetFields();
            form.setFieldsValue(initialValues || { type: currentType, ordre: 10 });
            setFormDirty(false);
        }
    }, [visible, initialValues]);

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

    return (
        <Modal
            open={visible}
            title={initialValues && initialValues.id ? "Modifier la valeur" : "Créer une valeur"}
            onCancel={handleCancel}
            onOk={() => {
                form.validateFields().then(values => onSubmit(values)).catch(() => {});
            }}
            confirmLoading={loading}
            destroyOnHidden
            okText="Enregistrer"
            cancelText="Fermer"
        >
            <Form form={form} layout="vertical" onValuesChange={() => setFormDirty(true)}>
                <Form.Item label="Type" name="type" rules={[{ required: true, message: "Champ requis" }]}>
                    <Select options={TYPES} disabled={!!(initialValues && initialValues.id)} />
                </Form.Item>
                <Form.Item label="Valeur" name="valeur" rules={[{ required: true, message: "Champ requis" }]}>
                    <Input />
                </Form.Item>
                <Form.Item label="Ordre" name="ordre" rules={[{ required: true, message: "Champ requis" }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default function ReferenceValeurs() {
    const [valeurs, setValeurs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [editValeur, setEditValeur] = useState(null);
    const [selectedType, setSelectedType] = useState('CATEGORIE_PRODUIT');

    const fetchValeurs = () => {
        setLoading(true);
        fetchWithAuth(`/reference-valeurs?type=${encodeURIComponent(selectedType)}`)
            .then(r => {
                if (!r.ok) throw new Error("Erreur HTTP: " + r.status);
                return r.json();
            })
            .then(data => setValeurs(data))
            .catch(e => {
                message.error("Erreur lors du chargement: " + e.message);
                setValeurs([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchValeurs();
    }, [selectedType]);

    const handleCreate = (data) => {
        setModalLoading(true);
        fetchWithAuth('/reference-valeurs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
            .then(async res => {
                if (!res.ok) throw new Error(await res.text() || "Erreur réseau");
                return res.json();
            })
            .then(() => {
                message.success("Valeur créée !");
                setModalOpen(false);
                setEditValeur(null);
                fetchValeurs();
            })
            .catch(e => message.error("Erreur création: " + e.message))
            .finally(() => setModalLoading(false));
    };

    const handleUpdate = (data) => {
        setModalLoading(true);
        fetchWithAuth(`/reference-valeurs/${editValeur.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...editValeur, ...data }),
        })
            .then(async res => {
                if (!res.ok) throw new Error(await res.text() || "Erreur réseau");
                return res.json();
            })
            .then(() => {
                message.success("Valeur modifiée !");
                setModalOpen(false);
                setEditValeur(null);
                fetchValeurs();
            })
            .catch(e => message.error("Erreur modification: " + e.message))
            .finally(() => setModalLoading(false));
    };

    const handleDelete = (record) => {
        fetchWithAuth(`/reference-valeurs/${record.id}`, { method: 'DELETE' })
            .then(res => {
                if (!res.ok) throw new Error("Erreur HTTP: " + res.status);
                message.success("Valeur supprimée");
                fetchValeurs();
            })
            .catch(e => message.error("Erreur suppression: " + e.message));
    };

    const columns = [
        {
            title: 'Valeur',
            dataIndex: 'valeur',
            key: 'valeur',
            sorter: (a, b) => a.valeur.localeCompare(b.valeur),
        },
        {
            title: 'Ordre',
            dataIndex: 'ordre',
            key: 'ordre',
            sorter: (a, b) => a.ordre - b.ordre,
            defaultSortOrder: 'ascend' as const,
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => { setEditValeur(record); setModalOpen(true); }}
                    />
                    <Popconfirm
                        title="Confirmer la suppression"
                        description={`Supprimer "${record.valeur}" ?`}
                        onConfirm={() => handleDelete(record)}
                        okButtonProps={{ danger: true }}
                        okText="Supprimer"
                        cancelText="Fermer"
                    >
                        <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <div style={style}>
                        <Space>
                            <Select
                                options={TYPES}
                                value={selectedType}
                                onChange={setSelectedType}
                                style={{ width: 250 }}
                            />
                            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => {
                                setEditValeur(null);
                                setModalOpen(true);
                            }} />
                        </Space>
                    </div>
                </Col>
            </Row>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Table
                        rowKey="id"
                        dataSource={valeurs}
                        columns={columns}
                        loading={loading}
                        pagination={{ pageSize: 20, showSizeChanger: false }}
                    />
                </Col>
            </Row>
            <ValeurFormModal
                visible={modalOpen}
                onCancel={() => { setModalOpen(false); setEditValeur(null); }}
                onSubmit={editValeur ? handleUpdate : handleCreate}
                initialValues={editValeur}
                loading={modalLoading}
                currentType={selectedType}
            />
        </>
    );
}
