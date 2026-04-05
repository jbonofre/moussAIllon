import React, { useState } from 'react';
import { Form, Button, Input, Image, message, Typography } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

interface Technicien {
    id: number;
    prenom?: string;
    nom: string;
    email?: string;
    telephone?: string;
    couleur?: string;
}

interface LoginProps {
    setUser: (technicien: Technicien) => void;
}

export default function Login({ setUser }: LoginProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleLogin = async (values: { email: string; motDePasse?: string }) => {
        setLoading(true);
        try {
            const res = await axios.post('/api/technicien-portal/login', {
                email: values.email,
                motDePasse: values.motDePasse || ''
            });
            const { token, ...userData } = res.data;
            localStorage.setItem('moussaillon-technicien-token', token);
            localStorage.setItem('moussaillon-technicien-user', JSON.stringify(userData));
            setUser(userData);
        } catch {
            message.error("Identifiants invalides.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundImage: 'url(./login-background.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        }}>
            <div className="login-overlay" />
            <div style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
            }}>
                <div style={{
                    width: 420,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: 20,
                    padding: '48px 40px 36px',
                    boxShadow: '0 25px 70px rgba(0, 0, 0, 0.25)',
                    animation: 'fadeInUp 0.5s ease-out',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <Image src="./logo.png" preview={false} width={80} style={{ marginBottom: 16 }} />
                        <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                            Espace Technicien
                        </Title>
                        <Text type="secondary" style={{ fontSize: '0.95em' }}>
                            mouss<span style={{ color: '#1668dc', fontWeight: 600 }}>AI</span>llon
                        </Text>
                    </div>
                    <Form
                        name="login"
                        form={form}
                        layout="vertical"
                        autoComplete="off"
                        onFinish={handleLogin}
                        onKeyUp={(event: React.KeyboardEvent) => {
                            if (event.key === 'Enter') {
                                form.submit();
                            }
                        }}
                    >
                        <Form.Item
                            name="email"
                            rules={[
                                { required: true, message: "L'email est requis" },
                                { type: 'email', message: "Format d'email invalide" },
                            ]}
                        >
                            <Input
                                prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="Email"
                                size="large"
                                style={{ borderRadius: 10, height: 48 }}
                            />
                        </Form.Item>
                        <Form.Item name="motDePasse">
                            <Input.Password
                                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="Mot de passe"
                                size="large"
                                style={{ borderRadius: 10, height: 48 }}
                            />
                        </Form.Item>
                        <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                size="large"
                                loading={loading}
                                style={{
                                    height: 48,
                                    borderRadius: 10,
                                    fontWeight: 600,
                                    fontSize: '1em',
                                    background: 'linear-gradient(135deg, #1668dc 0%, #4096ff 100%)',
                                    border: 'none',
                                    boxShadow: '0 4px 14px rgba(22, 104, 220, 0.35)',
                                }}
                            >
                                Se connecter
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
            </div>
        </div>
    );
}
