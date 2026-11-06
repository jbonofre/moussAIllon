import React, { useEffect, useState } from 'react';
import { Form, Button, Input, Image, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons';
import { codeChantierInitial, enteteChantier, memoriserChantier } from './chantier.ts';
import Inscription, { Connexion } from './inscription.tsx';

const { Title, Text } = Typography;

export default function Login(props) {

    const [ loginForm ] = Form.useForm();
    const [ loading, setLoading ] = useState(false);
    // Inscription ouverte sur l'instance (durée de l'essai gratuit), sinon null : l'écran ne la propose pas.
    const [ inscription, setInscription ] = useState<{ essaiMois: number } | null>(null);
    const [ modeInscription, setModeInscription ] = useState(false);

    useEffect(() => {
        Promise.resolve()
            .then(() => fetch('/api/inscription'))
            .then((response) => (response && response.ok ? response.json() : null))
            .then((configuration) => setInscription(configuration && configuration.active
                ? { essaiMois: configuration.essaiMois || 1 } : null))
            .catch(() => setInscription(null));
    }, []);

    const handleLogin = (values) => {
        setLoading(true);
        fetch('/api/users/authenticate', {
            method: 'POST',
            body: JSON.stringify({ name: values.name, password: values.password }),
            headers: {
                'Content-Type': 'application/json',
                ...enteteChantier(values.chantier),
            }
        })
        .then(async (response) => {
            if (!response.ok) {
                // Code chantier inconnu, identifiants invalides, accès bloqué (chantier suspendu, abonnement
                // résilié, non activé ou impayé) : le serveur en donne la raison
                const raison = [400, 401, 403].includes(response.status) ? await response.text() : '';
                throw new Error(raison || 'Erreur (code ' + response.status + ')');
            }
            return response.json();
        })
        .then((data) => {
            memoriserChantier(values.chantier);
            localStorage.setItem('moussaillon-token', data.token);
            const user = {
                name: data.name,
                modules: data.modules || [],
                theme: data.theme,
                accesLimiteFacturation: !!data.accesLimiteFacturation,
                abonnementActif: data.abonnementActif !== false,
                chantier: data.chantier,
            };
            localStorage.setItem('moussaillon-user', JSON.stringify(user));
            props.setUser(user);
        })
        .catch((error) => {
            message.error('Une erreur est survenue: ' + error.message);
            console.error(error);
        })
        .finally(() => {
            setLoading(false);
        });
    };

    // Chantier créé : son premier utilisateur se connecte aussitôt (et retrouve son code s'il doit se reconnecter).
    const apresInscription = (connexion: Connexion) => {
        memoriserChantier(connexion.chantier);
        setModeInscription(false);
        message.success(`Chantier ${connexion.chantier} créé : bienvenue sur moussAIllon !`);
        handleLogin(connexion);
    };

    return (
        <div className="login-background">
            <div className="login-card">
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
                    <div style={{ textAlign: 'center', marginBottom: modeInscription ? 16 : 32 }}>
                        <Image src={process.env.PUBLIC_URL + '/logo.png'} preview={false} width={modeInscription ? 56 : 80} style={{ marginBottom: modeInscription ? 8 : 16 }} />
                        <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                            mouss<span style={{ color: '#1668dc' }}>AI</span>llon
                        </Title>
                        {!modeInscription && (
                            <Text type="secondary" style={{ fontSize: '0.95em' }}>
                                Espace de gestion chantier
                            </Text>
                        )}
                    </div>
                    {modeInscription && inscription ? (
                        <Inscription
                            essaiMois={inscription.essaiMois}
                            onInscrit={apresInscription}
                            onAnnuler={() => setModeInscription(false)}
                        />
                    ) : (
                        <>
                            <Form
                                name="login"
                                form={loginForm}
                                layout="vertical"
                                autoComplete="off"
                                initialValues={{ chantier: codeChantierInitial() }}
                                onFinish={handleLogin}
                                onKeyUp={(event) => {
                                    if (event.keyCode === 13) {
                                        loginForm.submit();
                                    }
                                }}
                            >
                                <Form.Item
                                    name="chantier"
                                    rules={[{ required: true, whitespace: true, message: 'Le code chantier est requis' }]}
                                >
                                    <Input
                                        prefix={<ShopOutlined style={{ color: '#bfbfbf' }} />}
                                        placeholder="Code chantier"
                                        aria-label="Code chantier"
                                        size="large"
                                        autoCapitalize="none"
                                        style={{ borderRadius: 10, height: 48 }}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="name"
                                    rules={[{ required: true, message: "L'utilisateur est requis" }]}
                                >
                                    <Input
                                        prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                                        placeholder="Utilisateur"
                                        size="large"
                                        style={{ borderRadius: 10, height: 48 }}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: 'Le mot de passe est requis' }]}
                                >
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
                            {inscription && (
                                <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                                    <Text type="secondary">Nouveau sur moussAIllon ?</Text>
                                    <Button type="link" block style={{ fontWeight: 600 }} onClick={() => setModeInscription(true)}>
                                        Créez votre chantier en 1 minute !
                                    </Button>
                                    <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                        {inscription.essaiMois > 1 ? `Les ${inscription.essaiMois} premiers mois sont gratuits` : 'Le premier mois est gratuit'}, sans carte bancaire.
                                    </Text>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

}
