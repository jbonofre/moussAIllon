import { fetchWithAuth } from './api.ts';
import { useState, useEffect } from 'react';
import { Card, Row, Col, Space, Button, Divider, Form, Input, InputNumber, Radio, Spin, Typography, message } from 'antd';
import { PauseCircleOutlined, DeploymentUnitOutlined, SaveOutlined } from '@ant-design/icons';
import { demo } from './workspace.tsx';
import ImageUpload from './ImageUpload.tsx';
import { useNavigation } from './navigation-context.tsx';

const { TextArea } = Input;

// Délais des relances de paiement, communs à toutes les transactions.
const RELANCES = [
    { name: 'relance1Jours', label: 'Relance 1', placeholder: 'Ex : 15', precedents: [] as string[] },
    { name: 'relance2Jours', label: 'Relance 2', placeholder: 'Ex : 30', precedents: ['relance1Jours'] },
    { name: 'relance3Jours', label: 'Relance 3', placeholder: 'Ex : 45', precedents: ['relance1Jours', 'relance2Jours'] },
];

// Délais des relances des devis/OR en attente de signature, comptés à partir de la date du devis.
const RELANCES_DEVIS = [
    { name: 'relanceDevis1Jours', label: 'Relance 1', placeholder: 'Ex : 7', precedents: [] as string[] },
    { name: 'relanceDevis2Jours', label: 'Relance 2', placeholder: 'Ex : 15', precedents: ['relanceDevis1Jours'] },
    { name: 'relanceDevis3Jours', label: 'Relance 3', placeholder: 'Ex : 30', precedents: ['relanceDevis1Jours', 'relanceDevis2Jours'] },
];

// Délais croissants d'une série de relances (J+N), vides pour désactiver une relance
const champsDelais = (relances) => relances.map(({ name, label, placeholder, precedents }) => (
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
));

export default function Societe(props) {

    const [ societe, setSociete ] = useState();
    const { navigate } = useNavigation();

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
    }, []);

    if (!societe) {
        return(<Spin/>);
    }

    // Les textes des relances (un modèle d'email par relance) se modifient dans Paramétrage > Emails
    const lienModeles = <Typography.Link onClick={() => navigate('/emails')}>Paramétrage &gt; Emails</Typography.Link>;

    const updateSocieteFunction = async (values) => {
        try {
            const response = await fetchWithAuth('./societe', {
                method: 'PUT',
                body: JSON.stringify(values),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            }
            setSociete(await response.json());
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
                    initialValues={societe}>
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
                    <Divider titlePlacement="start">Envoi des relances</Divider>
                    <Form.Item name="relancesAutomatiques" label="Relances de paiement et de devis">
                        <Radio.Group>
                            <Space orientation="vertical">
                                <Radio value={false}>À valider chaque matin dans le journal des relances (Vente &gt; Relances)</Radio>
                                <Radio value={true}>Envoyées automatiquement chaque matin à 8h</Radio>
                            </Space>
                        </Radio.Group>
                    </Form.Item>
                    <Divider titlePlacement="start">Relances de paiement</Divider>
                    <Form.Item label={null}>
                        <Typography.Text type="secondary">
                            Relances par email des factures émises non soldées, aux clients qui ont donné leur consentement.
                            Les délais sont comptés à partir de la date d'échéance de la facture, ou de sa date d'émission
                            si aucune échéance n'est renseignée. Laisser vide pour désactiver une relance.
                            Le texte de chaque relance se modifie dans {lienModeles}.
                        </Typography.Text>
                    </Form.Item>
                    {champsDelais(RELANCES)}
                    <Form.Item name="relance3Courrier" label="Envoi de la relance 3">
                        <Radio.Group>
                            <Space orientation="vertical">
                                <Radio value={false}>Par email</Radio>
                                <Radio value={true}>
                                    Par courrier : mise en demeure à imprimer depuis le journal des relances,
                                    y compris pour les clients sans email
                                </Radio>
                            </Space>
                        </Radio.Group>
                    </Form.Item>
                    <Divider titlePlacement="start">Relances des devis</Divider>
                    <Form.Item label={null}>
                        <Typography.Text type="secondary">
                            Relances par email des devis/OR en attente de signature, ni acceptés
                            ni refusés, aux clients qui ont donné leur consentement. Les délais sont comptés à partir de la
                            date du devis. Laisser vide pour désactiver une relance.
                            Le texte de chaque relance se modifie dans {lienModeles}.
                        </Typography.Text>
                    </Form.Item>
                    {champsDelais(RELANCES_DEVIS)}
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