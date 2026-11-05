import React, { useState } from 'react';
import { Form, Button, Input, Image, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';
import { CLE_ADMIN, CLE_JETON, messageErreur } from './api.ts';

const { Title, Text } = Typography;

export interface Administrateur {
    name: string;
    email?: string;
}

interface LoginProps {
    setAdmin: (admin: Administrateur) => void;
}

export default function Login({ setAdmin }: LoginProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleLogin = async (values: { name: string; password: string }) => {
        setLoading(true);
        try {
            const res = await axios.post('/api/admin/authenticate', values);
            const { token, ...admin } = res.data;
            localStorage.setItem(CLE_JETON, token);
            localStorage.setItem(CLE_ADMIN, JSON.stringify(admin));
            setAdmin(admin);
        } catch (error) {
            message.error(messageErreur(error, 'Identifiants invalides.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page" style={{
            backgroundImage: `linear-gradient(rgba(0, 21, 41, 0.55), rgba(0, 21, 41, 0.55)), url(${process.env.PUBLIC_URL}/login-background.jpg)`,
        }}>
            <div className="login-card">
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <Image src={process.env.PUBLIC_URL + '/logo.png'} preview={false} width={80} style={{ marginBottom: 16 }} />
                    <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                        Administration
                    </Title>
                    <Text type="secondary">
                        mouss<span style={{ color: '#1668dc', fontWeight: 600 }}>AI</span>llon
                    </Text>
                </div>
                <Form form={form} name="login" layout="vertical" autoComplete="off" onFinish={handleLogin}>
                    <Form.Item name="name" rules={[{ required: true, message: "L'utilisateur est requis" }]}>
                        <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="Utilisateur" size="large" />
                    </Form.Item>
                    <Form.Item name="password" rules={[{ required: true, message: 'Le mot de passe est requis' }]}>
                        <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="Mot de passe" size="large" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                            Se connecter
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
}
