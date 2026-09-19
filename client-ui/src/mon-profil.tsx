import React, { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Form, Input, Spin, Switch, Tag, message } from 'antd';
import { LockOutlined, MailOutlined, ReloadOutlined } from '@ant-design/icons';
import api from './api.ts';

interface Client {
    id: number;
    nom: string;
    type: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    consentement?: boolean;
    siren?: string;
    siret?: string;
    tva?: string;
    naf?: string;
}

interface MonProfilProps {
    clientId: number;
}

const typeLabel: Record<string, string> = {
    PARTICULIER: 'Particulier',
    PROFESSIONNEL: 'Professionnel',
    PROFESSIONNEL_MER: 'Professionnel de la Mer',
};

export default function MonProfil({ clientId }: MonProfilProps) {
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(false);
    const [passwordForm] = Form.useForm();
    const [changingPassword, setChangingPassword] = useState(false);

    const fetchProfile = () => {
        setLoading(true);
        api.get(`/portal/clients/${clientId}`)
            .then((res) => setClient(res.data))
            .catch(() => message.error('Erreur lors du chargement du profil'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchProfile();
    }, [clientId]);

    const handleChangePassword = async (values: { currentPassword: string; newPassword: string }) => {
        setChangingPassword(true);
        try {
            await api.post(`/portal/clients/${clientId}/change-password`, {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
            });
            message.success('Mot de passe modifie avec succes');
            passwordForm.resetFields();
        } catch (err: any) {
            const msg = err?.response?.data || 'Erreur lors du changement de mot de passe';
            message.error(typeof msg === 'string' ? msg : 'Erreur lors du changement de mot de passe');
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <Card
            title="Mon profil"
            extra={<Button icon={<ReloadOutlined />} onClick={fetchProfile}>Actualiser</Button>}
        >
            <Spin spinning={loading}>
                {client && (
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="Nom">{client.nom}</Descriptions.Item>
                        <Descriptions.Item label="Type">
                            <Tag>{typeLabel[client.type] || client.type}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Email">{client.email || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Telephone">{client.telephone || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Adresse">{client.adresse || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Consentement emails">
                            <Switch
                                checkedChildren={<MailOutlined />}
                                unCheckedChildren={<MailOutlined />}
                                checked={client.consentement}
                                onChange={(checked) => {
                                    api.put(`/portal/clients/${clientId}/consentement`, { consentement: checked })
                                        .then(() => {
                                            setClient({ ...client, consentement: checked });
                                            message.success(checked ? 'Consentement active' : 'Consentement desactive');
                                        })
                                        .catch(() => message.error('Erreur lors de la mise a jour du consentement'));
                                }}
                            />
                        </Descriptions.Item>
                        {client.type !== 'PARTICULIER' && (
                            <>
                                <Descriptions.Item label="SIREN">{client.siren || '-'}</Descriptions.Item>
                                <Descriptions.Item label="SIRET">{client.siret || '-'}</Descriptions.Item>
                                <Descriptions.Item label="TVA">{client.tva || '-'}</Descriptions.Item>
                                <Descriptions.Item label="NAF">{client.naf || '-'}</Descriptions.Item>
                            </>
                        )}
                    </Descriptions>
                )}
            </Spin>
            <Card title="Changer le mot de passe" style={{ marginTop: 16 }} size="small">
                <Form
                    form={passwordForm}
                    layout="inline"
                    onFinish={handleChangePassword}
                >
                    <Form.Item
                        name="currentPassword"
                        rules={[{ required: true, message: 'Requis' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Mot de passe actuel" />
                    </Form.Item>
                    <Form.Item
                        name="newPassword"
                        rules={[{ required: true, message: 'Requis' }, { min: 4, message: 'Minimum 4 caracteres' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Nouveau mot de passe" />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        dependencies={['newPassword']}
                        rules={[
                            { required: true, message: 'Requis' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Les mots de passe ne correspondent pas'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Confirmer le mot de passe" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={changingPassword}>
                            Modifier
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Card>
    );
}
