import { fetchWithAuth } from './api.ts';
import { useState, useEffect } from 'react';
import { Card, Row, Col, Space, Button, Form, Input, InputNumber, Switch, Spin, message, Divider } from 'antd';
import { PauseCircleOutlined, DeploymentUnitOutlined, SaveOutlined, MailOutlined } from '@ant-design/icons';
import { demo } from './workspace.tsx';
import ImageUpload from './ImageUpload.tsx';

const { TextArea } = Input;

export default function Societe(props) {

    const [ societe, setSociete ] = useState();

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
       })
    }, []);

    if (!societe) {
        return(<Spin/>);
    }

    const updateSocieteFunction = (values) => {
        let newSociete = values;
        fetchWithAuth('./societe', {
            method: 'PUT',
            body: JSON.stringify(newSociete),
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Erreur (code ' + response.status + ')');
            }
            return response.json();
        })
        .then((data) => {
            setSociete(data);
            message.info('La société a été mise à jour.')
        })
        .catch((error) => {
            message.error('Une erreur est survenue: ' + error.message);
            console.error(error)
        });
    };

    return(
      <>
      <Card title={<Space><DeploymentUnitOutlined/> Société</Space>}>
                <Form name="societe" labelCol={{ span: 8 }}
                    form={societeForm}
                    onFinish={updateSocieteFunction}
                    wrapperCol={{ span: 16 }}
                    style={{ width: '80%' }} initialValues={societe}>
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
                    <Form.Item name="bancaire" label="Coordonnées bancaires">
                        <TextArea rows={6} allowClear={true} />
                    </Form.Item>
                    <Form.Item name="images" label="Images">
                        <ImageUpload />
                    </Form.Item>

                    <Divider orientation="left"><MailOutlined /> Configuration SMTP</Divider>
                    <Form.Item name="smtpHost" label="Serveur SMTP">
                        <Input allowClear placeholder="smtp.exemple.com" />
                    </Form.Item>
                    <Form.Item name="smtpPort" label="Port SMTP">
                        <InputNumber min={1} max={65535} placeholder="587" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="smtpFrom" label="Adresse expéditeur">
                        <Input allowClear placeholder="noreply@exemple.com" />
                    </Form.Item>
                    <Form.Item name="smtpUser" label="Utilisateur SMTP">
                        <Input allowClear />
                    </Form.Item>
                    <Form.Item name="smtpPassword" label="Mot de passe SMTP">
                        <Input.Password allowClear />
                    </Form.Item>
                    <Form.Item name="smtpSsl" label="SSL" valuePropName="checked">
                        <Switch />
                    </Form.Item>

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