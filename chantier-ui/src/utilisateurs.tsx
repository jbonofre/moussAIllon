import { fetchWithAuth } from './api.ts';
import MosaicTable from "./MosaicTable.tsx";
import React, { useEffect, useState } from 'react';
import { Space, Table, Button, Input, Form, Modal, Avatar, Spin, Checkbox, Tag, Popconfirm, message, Row, Col } from 'antd';
import { UserOutlined, PlusCircleOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { paginationConfig } from './pagination.ts';
import SearchAutoComplete from './SearchAutoComplete.tsx';
import { MODULES, MODULE_LABEL, MODULE_PARAMETRAGE, trierModules } from './modules.ts';

const style: React.CSSProperties = { padding: '8px 0' };

// User Form Modal component
const UserFormModal = ({ visible, onCancel, onSubmit, initialValues, loading, modulesSouscrits }) => {
    const [form] = Form.useForm();
    const [formDirty, setFormDirty] = useState(false);
    // L'utilisateur admin a toujours accès au module Paramétrage
    const estAdmin = initialValues?.name === 'admin';

    useEffect(() => {
        if (visible) {
            form.resetFields();
            form.setFieldsValue(initialValues || {});
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
                onOk: () => {
                    setFormDirty(false);
                    onCancel();
                },
            });
        } else {
            onCancel();
        }
    };

    return (
        <Modal
            open={visible}
            title={initialValues && initialValues.name ? "Modifier l'utilisateur" : "Créer un utilisateur"}
            onCancel={handleCancel}
            onOk={() => {
                form
                    .validateFields()
                    .then((values) => {
                        onSubmit(values);
                    })
                    .catch(() => {});
            }}
            confirmLoading={loading}
            destroyOnHidden
            okText="Enregistrer"
            cancelText="Fermer"
        >
            <Form form={form} layout="vertical" initialValues={initialValues} onValuesChange={() => setFormDirty(true)}>
                <Form.Item
                    label="Utilisateur"
                    name="name"
                    rules={[{ required: true, message: "Champ requis" }]}
                >
                    <Input disabled={!!(initialValues && initialValues.name)} />
                </Form.Item>
                <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                        { required: true, message: "Champ requis" },
                        { type: "email", message: "Email invalide" }
                    ]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    label="Mot de passe"
                    name="password"
                    rules={
                        initialValues && initialValues.name
                            ? []
                            : [{ required: true, message: "Champ requis" }]
                    }
                >
                    <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                    label="Modules"
                    name="modules"
                    rules={[{ required: true, type: 'array', min: 1, message: "Au moins un module est requis" }]}
                    extra="Seuls les modules souscrits par la société (Paramétrage > Facturation) sont proposés."
                >
                    <Checkbox.Group
                        options={MODULES
                            .filter(m => modulesSouscrits.includes(m.value))
                            .map(m => ({ ...m, disabled: estAdmin && m.value === MODULE_PARAMETRAGE }))}
                        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};


export default function Utilisateurs() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [modulesSouscrits, setModulesSouscrits] = useState<string[]>([]);

    // Fetch users
    const fetchUsers = (query = '') => {
        setLoading(true);
        let url = '/users';
        if (query) {
            url = `/users/search?q=${encodeURIComponent(query)}`;
        }
        fetchWithAuth(url)
            .then(r => {
                if (!r.ok) throw new Error("Erreur HTTP: " + r.status);
                return r.json();
            })
            .then(data => setUsers(data))
            .catch(e => {
                message.error("Erreur lors du chargement des utilisateurs: " + e.message);
                setUsers([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchUsers();
        fetchWithAuth('/societe')
            .then(r => {
                if (!r.ok) throw new Error("Erreur HTTP: " + r.status);
                return r.json();
            })
            .then(societe => setModulesSouscrits(societe.modules || []))
            .catch(e => message.error("Erreur lors du chargement des modules souscrits: " + e.message));
    }, []);

    // Create User
    const handleCreate = (data) => {
        setModalLoading(true);
        fetchWithAuth('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(async res => {
                if (!res.ok) {
                    const errTxt = await res.text();
                    throw new Error(errTxt || "Erreur réseau");
                }
                return res.json();
            })
            .then((created) => {
                message.success("Utilisateur créé !");
                setEditUser(created);
                fetchUsers();
            })
            .catch(e => message.error("Erreur création: " + e.message))
            .finally(() => setModalLoading(false));
    };

    // Update User
    const handleUpdate = (data) => {
        setModalLoading(true);
        fetchWithAuth(`/users/${encodeURIComponent(editUser.name)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...editUser, ...data })
        })
            .then(async res => {
                if (!res.ok) {
                    const errTxt = await res.text();
                    throw new Error(errTxt || "Erreur réseau");
                }
                return res.json();
            })
            .then((updated) => {
                message.success("Utilisateur modifié !");
                setEditUser(updated);
                fetchUsers();
            })
            .catch(e => message.error("Erreur modification: " + e.message))
            .finally(() => setModalLoading(false));
    };

    // Delete User
    const handleDelete = user => {
        fetchWithAuth(`/users/${encodeURIComponent(user.name)}`, { method: 'DELETE' })
            .then(res => {
                if (!res.ok) throw new Error("Erreur HTTP: " + res.status);
                message.success("Utilisateur supprimé");
                fetchUsers();
            })
            .catch(e => {
                message.error("Erreur suppression: " + e.message);
            });
    };

    // Table columns
    const columns = [
        {
            title: '',
            dataIndex: '',
            key: 'avatar',
            render: (_, r) => <Avatar icon={<UserOutlined />} />
        },
        {
            title: "Nom d'utilisateur",
            dataIndex: "name",
            key: "name",
            render: (text, record) => <b>{text}{record.name === 'admin' ? ' 👑' : ''}</b>,
            sorter: (a,b) => a.name.localeCompare(b.name),
        },
        {
            title: "Email",
            dataIndex: "email",
            key: "email",
            sorter: (a,b) => a.email.localeCompare(b.email),
        },
        {
            title: "Modules",
            dataIndex: "modules",
            key: "modules",
            render: (modules) => trierModules(modules).map(module => (
                <Tag key={module}>{MODULE_LABEL[module] || module}</Tag>
            )),
            sorter: (a, b) => (a.modules || []).length - (b.modules || []).length,
            filters: MODULES.map(m => ({ text: m.label, value: m.value })),
            onFilter: (value, record) => (record.modules || []).includes(value),
        },
        {
            title: "Actions",
            key: "actions",
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => {
                            setEditUser(record);
                            setModalOpen(true);
                        }}
                    />
                    <Popconfirm
                        title="Confirmer la suppression"
                        description={`Supprimer l'utilisateur ${record.name} ?`}
                        disabled={record.name === 'admin'}
                        onConfirm={() => handleDelete(record)}
                        okButtonProps={{ danger: true }}
                        okText="Supprimer"
                        cancelText="Fermer"
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            size="small"
                            danger
                            disabled={record.name === 'admin'}
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <>
            <Row gutter={[16,16]}>
                <Col span={24}>
                    <div style={style}>
                        <Space>
                            <SearchAutoComplete style={{ width: 600 }} onSearch={value => {
                                setSearch(value);
                                fetchUsers(value);
                            }} value={search} onChange={setSearch} searchUrl="/users/search" labelOf={(u) => u.name}/>
                            <Button type="primary" icon={<PlusCircleOutlined/>} onClick={() => {
                                setEditUser(null);
                                setModalOpen(true);
                            }} />
                            <Button title="Recharger" icon={<ReloadOutlined />} loading={loading} onClick={() => fetchUsers(search)} />
                        </Space>
                    </div>
                    </Col>
            </Row>
            <Row gutter={[16,16]}>
                <Col span={24}>
                {loading ? (
                    <Spin />
                ) : (
                    <MosaicTable
                        rowKey="name"
                        dataSource={users}
                        columns={columns}
                        pagination={paginationConfig()}
                        onRow={(record) => ({
                            onClick: (e) => {
                                if ((e.target as HTMLElement).closest('button, .ant-btn, [role="button"]')) return;
                                setEditUser(record);
                                setModalOpen(true);
                            },
                            style: { cursor: 'pointer' },
                        })}
                    />
                )}
                </Col>
            </Row>
            <UserFormModal
                visible={modalOpen}
                onCancel={() => { setModalOpen(false); setEditUser(null);} }
                onSubmit={editUser ? handleUpdate : handleCreate}
                initialValues={editUser}
                loading={modalLoading}
                modulesSouscrits={modulesSouscrits}
            />
            </>
    );
}
