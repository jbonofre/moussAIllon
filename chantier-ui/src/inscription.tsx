import React, { useState } from 'react';
import { Button, Form, Input, Typography, message } from 'antd';
import { HomeOutlined, LockOutlined, MailOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { FORMAT_CODE, codeDepuisNom } from './chantier.ts';

const { Title, Text } = Typography;

export interface Connexion {
    chantier: string;
    name: string;
    password: string;
}

interface InscriptionProps {
    // Durée de l'essai gratuit, en mois.
    essaiMois: number;
    // Chantier créé : on s'y connecte aussitôt.
    onInscrit: (connexion: Connexion) => void;
    onAnnuler: () => void;
}

const champ = { size: 'large' as const, style: { borderRadius: 10, height: 48 } };
const icone = { color: '#bfbfbf' };

/** Inscription d'un chantier : créé aussitôt, avec un essai gratuit, puis connexion de son premier utilisateur. */
export default function Inscription({ essaiMois, onInscrit, onAnnuler }: InscriptionProps) {
    const [ form ] = Form.useForm();
    const [ loading, setLoading ] = useState(false);
    // Code saisi par l'utilisateur : il ne suit plus le nom du chantier.
    const [ codeSaisi, setCodeSaisi ] = useState(false);

    const inscrire = async (values: any) => {
        setLoading(true);
        try {
            // Sans en-tête X-Chantier : le chantier n'existe pas encore.
            const response = await fetch('/api/inscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nom: values.nom,
                    code: values.code,
                    email: values.email,
                    utilisateur: values.utilisateur,
                    motDePasse: values.motDePasse,
                }),
            });
            if (!response.ok) {
                // Code déjà pris ou invalide, inscriptions fermées, trop d'inscriptions : le serveur en donne la raison
                const raison = [400, 403, 429].includes(response.status) ? await response.text() : '';
                throw new Error(raison || 'Erreur (code ' + response.status + ')');
            }
            const resultat = await response.json();
            onInscrit({ chantier: resultat.code, name: resultat.utilisateur, password: values.motDePasse });
        } catch (error: any) {
            message.error(error.message);
            setLoading(false);
        }
    };

    return (
        <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Title level={4} style={{ margin: 0 }}>Créez votre chantier sur moussAIllon en 1 minute !</Title>
                <Text type="secondary">
                    {essaiMois > 1 ? `Les ${essaiMois} premiers mois sont gratuits` : 'Le premier mois est gratuit'}, sans carte bancaire.
                </Text>
            </div>
            <Form
                name="inscription"
                form={form}
                layout="vertical"
                autoComplete="off"
                initialValues={{ utilisateur: 'admin' }}
                onFinish={inscrire}
                onValuesChange={(modifie) => {
                    if ('code' in modifie) {
                        setCodeSaisi(true);
                    } else if ('nom' in modifie && !codeSaisi) {
                        form.setFieldsValue({ code: codeDepuisNom(modifie.nom) });
                    }
                }}
            >
                <Form.Item name="nom" rules={[{ required: true, whitespace: true, message: 'Le nom du chantier est requis' }]}>
                    <Input {...champ} prefix={<HomeOutlined style={icone} />} placeholder="Nom du chantier" aria-label="Nom du chantier" />
                </Form.Item>
                <Form.Item
                    name="code"
                    extra="Demandé à chaque connexion : lettres minuscules, chiffres et tirets."
                    normalize={(valeur: string) => (valeur || '').toLowerCase()}
                    rules={[
                        { required: true, message: 'Le code chantier est requis' },
                        { pattern: FORMAT_CODE, message: '2 à 40 caractères : lettres minuscules, chiffres et tirets, sans tiret au début' },
                    ]}
                >
                    <Input {...champ} prefix={<ShopOutlined style={icone} />} placeholder="Code chantier" aria-label="Code du nouveau chantier" autoCapitalize="none" />
                </Form.Item>
                <Form.Item
                    name="email"
                    rules={[
                        { required: true, message: "L'email est requis" },
                        { type: 'email', message: "Format d'email invalide" },
                    ]}
                >
                    <Input {...champ} prefix={<MailOutlined style={icone} />} placeholder="Email" aria-label="Email" />
                </Form.Item>
                <Form.Item name="utilisateur" rules={[{ required: true, whitespace: true, message: "L'utilisateur est requis" }]}>
                    <Input {...champ} prefix={<UserOutlined style={icone} />} placeholder="Utilisateur" aria-label="Votre utilisateur" />
                </Form.Item>
                <Form.Item
                    name="motDePasse"
                    rules={[
                        { required: true, message: 'Le mot de passe est requis' },
                        { min: 8, message: 'Au moins 8 caractères' },
                    ]}
                >
                    <Input.Password {...champ} prefix={<LockOutlined style={icone} />} placeholder="Mot de passe" aria-label="Choisissez un mot de passe" />
                </Form.Item>
                <Form.Item
                    name="confirmation"
                    dependencies={['motDePasse']}
                    rules={[
                        { required: true, message: 'Confirmez le mot de passe' },
                        ({ getFieldValue }) => ({
                            validator: (_, valeur) => !valeur || valeur === getFieldValue('motDePasse')
                                ? Promise.resolve()
                                : Promise.reject(new Error('Les mots de passe sont différents')),
                        }),
                    ]}
                >
                    <Input.Password {...champ} prefix={<LockOutlined style={icone} />} placeholder="Confirmation du mot de passe" aria-label="Confirmation du mot de passe" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 8, marginTop: 8 }}>
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
                            background: 'linear-gradient(135deg, #1668dc 0%, #4096ff 100%)',
                            border: 'none',
                            boxShadow: '0 4px 14px rgba(22, 104, 220, 0.35)',
                        }}
                    >
                        Créer mon chantier
                    </Button>
                </Form.Item>
            </Form>
            <div style={{ textAlign: 'center' }}>
                <Button type="link" onClick={onAnnuler}>J'ai déjà un chantier : me connecter</Button>
            </div>
        </>
    );
}
