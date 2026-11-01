import { fetchWithAuth } from './api.ts';
import { useState, useEffect } from 'react';
import { Card, Row, Col, Space, Button, Divider, Form, Input, InputNumber, Spin, Typography, message } from 'antd';
import { PauseCircleOutlined, DeploymentUnitOutlined, SaveOutlined } from '@ant-design/icons';
import { demo } from './workspace.tsx';
import ImageUpload from './ImageUpload.tsx';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const { TextArea } = Input;

// Délais des relances de paiement, communs à toutes les transactions.
const RELANCES = [
    { name: 'relance1Jours', label: 'Relance 1', placeholder: 'Ex : 15', precedents: [] as string[] },
    { name: 'relance2Jours', label: 'Relance 2', placeholder: 'Ex : 30', precedents: ['relance1Jours'] },
    { name: 'relance3Jours', label: 'Relance 3', placeholder: 'Ex : 45', precedents: ['relance1Jours', 'relance2Jours'] },
];

export default function Societe(props) {

    const [ societe, setSociete ] = useState();
    // Modèle d'email des relances de paiement (type RAPPEL), modifiable avec le reste du paramétrage
    const [ modeleRelance, setModeleRelance ] = useState(null);
    const [ modeleCharge, setModeleCharge ] = useState(false);

    const [ societeForm ] = Form.useForm();

    useEffect(() => {
       fetchWithAuth('./societe')
       .then((response) => {
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            };
            return response.json();
       })
       .then(data => {
           setSociete(data);
       })
       .catch((error) => {
            message.error('Une erreur est survenue: ' + error.message);
            console.error(error)
       });
       // L'initialisation crée les modèles d'email manquants
       fetchWithAuth('./email-templates/init', { method: 'POST' })
       .then(() => fetchWithAuth('./email-templates'))
       .then((response) => {
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            }
            return response.json();
       })
       .then((modeles) => {
           setModeleRelance(modeles.find((m) => m.type === 'RAPPEL') || null);
       })
       .catch((error) => {
            message.error('Le modèle d\'email de relance n\'a pas pu être chargé : ' + error.message);
       })
       .finally(() => setModeleCharge(true));
    }, []);

    if (!societe || !modeleCharge) {
        return(<Spin/>);
    }

    const updateSocieteFunction = async (values) => {
        const { relanceSujet, relanceContenu, ...newSociete } = values;
        try {
            const response = await fetchWithAuth('./societe', {
                method: 'PUT',
                body: JSON.stringify(newSociete),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            }
            setSociete(await response.json());
            if (modeleRelance && (relanceSujet !== modeleRelance.sujet || relanceContenu !== modeleRelance.contenu)) {
                const reponseModele = await fetchWithAuth('./email-templates/' + modeleRelance.id, {
                    method: 'PUT',
                    body: JSON.stringify({ ...modeleRelance, sujet: relanceSujet, contenu: relanceContenu }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                if (!reponseModele.ok) {
                    throw new Error('Erreur (code ' + reponseModele.status + ') sur le modèle d\'email de relance');
                }
                setModeleRelance(await reponseModele.json());
            }
            message.info('La société a été mise à jour.');
        } catch (error) {
            message.error('Une erreur est survenue: ' + error.message);
            console.error(error);
        }
    };

    return(
      <>
      <Card title={<Space><DeploymentUnitOutlined/> Société</Space>}>
                <Form name="societe" labelCol={{ span: 8 }}
                    form={societeForm}
                    onFinish={updateSocieteFunction}
                    wrapperCol={{ span: 16 }}
                    style={{ width: '80%' }}
                    initialValues={{ ...societe, relanceSujet: modeleRelance?.sujet, relanceContenu: modeleRelance?.contenu }}>
                    <Form.Item name="nom" label="Nom" rules={[{required: true, message: 'Le nom est requis'}]}>
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="siren" label="SIREN" rules={[{required: true, message: 'Le SIREN est requis'}]}>
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="siret" label="SIRET">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="ape" label="APE">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="rcs" label="RCS">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="forme" label="Forme juridique">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="capital" label="Capital">
                        <InputNumber addonAfter="€" allowClear={true} />
                    </Form.Item>
                    <Form.Item name="numerotva" label="Numéro de TVA">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="adresse" label="Adresse" rules={[{ required: true, message: 'L\'adresse est requise' }]}>
                        <TextArea rows={6} allowClear={true} />
                    </Form.Item>
                    <Form.Item name="telephone" label="Numéro de téléphone">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="email" label="Email">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="banque" label="Banque">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="iban" label="IBAN">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="bic" label="BIC">
                        <Input allowClear={true} />
                    </Form.Item>
                    <Form.Item name="bancaire" label="Coordonnées bancaires (texte libre)">
                        <TextArea rows={6} allowClear={true} />
                    </Form.Item>
                    <Form.Item name="images" label="Images">
                        <ImageUpload />
                    </Form.Item>
                    <Divider titlePlacement="start">Conditions de paiement</Divider>
                    <Form.Item label={null}>
                        <Typography.Text type="secondary">
                            Mentions communes à toutes les transactions, imprimées sur les devis et les factures.
                            Une facture émise conserve les conditions en vigueur à la date de son émission.
                        </Typography.Text>
                    </Form.Item>
                    <Form.Item name="conditionsPaiement" label="Conditions de paiement">
                        <Input allowClear={true} placeholder="Ex : 30 jours nets, paiement comptant…" />
                    </Form.Item>
                    <Form.Item name="penalitesRetard" label="Pénalités de retard">
                        <Input allowClear={true} placeholder="Ex : 3 fois le taux d'intérêt légal en vigueur" />
                    </Form.Item>
                    <Form.Item name="indemniteForfaitaire" label="Indemnité forfaitaire de recouvrement"
                        rules={[{ required: true, message: 'L\'indemnité forfaitaire est requise' }]}>
                        <InputNumber min={0} step={1} addonAfter="€" style={{ width: 200 }} />
                    </Form.Item>
                    <Divider titlePlacement="start">Relances de paiement</Divider>
                    <Form.Item label={null}>
                        <Typography.Text type="secondary">
                            Relances envoyées automatiquement par email pour toutes les factures émises non soldées.
                            Les délais sont comptés à partir de la date d'échéance de la facture, ou de sa date d'émission
                            si aucune échéance n'est renseignée. Laisser vide pour désactiver une relance.
                        </Typography.Text>
                    </Form.Item>
                    {RELANCES.map(({ name, label, placeholder, precedents }) => (
                        <Form.Item
                            key={name}
                            name={name}
                            label={label}
                            dependencies={precedents}
                            rules={[({ getFieldValue }) => ({
                                validator(_, value) {
                                    const precedent = precedents.map(p => getFieldValue(p)).filter(v => v != null).pop();
                                    if (value == null || precedent == null || value > precedent) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Le délai doit être supérieur à celui de la relance précédente'));
                                },
                            })]}
                        >
                            <InputNumber min={0} step={1} precision={0} prefix="J+" addonAfter="jours" placeholder={placeholder} style={{ width: 200 }} />
                        </Form.Item>
                    ))}
                    {modeleRelance ? (
                        <>
                            <Form.Item name="relanceSujet" label="Sujet de l'email de relance"
                                rules={[{ required: true, message: 'Le sujet est requis' }]}>
                                <Input />
                            </Form.Item>
                            <Form.Item name="relanceContenu" label="Message de relance"
                                rules={[{ required: true, message: 'Le message est requis' }]}>
                                <ReactQuill theme="snow" style={{ height: 260, marginBottom: 42 }} />
                            </Form.Item>
                            <Form.Item label={null}>
                                <Typography.Text type="secondary">
                                    {modeleRelance.description}. Les variables entre accolades sont remplacées
                                    à l'envoi par les valeurs de la facture relancée.
                                </Typography.Text>
                            </Form.Item>
                        </>
                    ) : (
                        <Form.Item label={null}>
                            <Typography.Text type="warning">
                                Le modèle d'email de relance n'a pas pu être chargé : rechargez la page pour le modifier.
                            </Typography.Text>
                        </Form.Item>
                    )}
                    <Form.Item label={null}>
                        <Space>
                            <Button onClick={() => societeForm.submit()} type="primary" icon={<SaveOutlined/>}>Enregistrer</Button>
                            <Button onClick={() => societeForm.resetFields()} icon={<PauseCircleOutlined/>}>Annuler</Button>
                        </Space>
                    </Form.Item>
                </Form>
      </Card>
      </>
    );

}