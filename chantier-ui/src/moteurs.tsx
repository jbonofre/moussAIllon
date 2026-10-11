import React, { useState } from 'react';
import MosaicTable from "./MosaicTable.tsx";
import { useNavigation } from './navigation-context.tsx';
import { Breadcrumb, Space, Button, Row, Col, AutoComplete, Table, Card, Form, Input, Image, Select, InputNumber, Collapse, DatePicker } from 'antd';
import { HomeOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined, LinkOutlined, LeftCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { demo } from './workspace.tsx';
import dayjs from 'dayjs';

const style: React.CSSProperties = { padding: '8px 0' };

const { Search } = Input;
const { TextArea } = Input;

function List(props) {

    const columns = [
        { title: 'Numéro de série', dataIndex: 'numeroserie', key: 'numeroserie' },
        { title: 'Dénomination', dataIndex: 'denomination', key: 'denomination' },
        { title: 'Propriétaire', dataIndex: 'proprietaire', key: 'proprietaire' },
        {
            title: '',
            key: 'action',
            render: (_,record) => (
                <Space>
                    <Button onClick={() => props.setMoteur(record.numeroserie)}><EditOutlined /></Button>
                    <Button><LinkOutlined /></Button>
                    <Button onClick={() => demo()}><DeleteOutlined /></Button>
                </Space>
            )
        }
    ];

    return(
      <>
            <Row gutter={[16,16]}>
                <Col span={24}>
                    <div style={style}>
                        <Space>
                            <AutoComplete style={{ width: 350 }} placeholder="Recherche" />
                            <Button type="primary" icon={<PlusCircleOutlined/>} onClick={() => demo()}>Nouveau Moteur</Button>
                        </Space>
                    </div>
                </Col>
            </Row>
            <Row gutter={[16,16]}>
                <Col span={24}>
                    <MosaicTable columns={columns} dataSource={props.moteurs} onRow={(record, rowIndex) => {
                        return {
                            onClick: (event) => { props.setMoteur(record.numeroserie) }
                        };
                    }}/>
                </Col>
            </Row>
      </>
    );
}

function Specifications(props) {
    return(
        <>
         <Form.Item label="Puissance">
            <Space>
                <Input value={props.moteurDetail.puissancecv} addonAfter="cv"/>
                <Input value={props.moteurDetail.puissancekw} addonAfter="kw"/>
            </Space>
         </Form.Item>
         <Form.Item label="Longueur d'arbre">
            <Space>
                <Select options={[
                    { label: 'S', value: 'S' },
                    { label: 'M', value: 'M' },
                    { label: 'L', value: 'L' },
                    { label: 'XL', value: 'XL' },
                    { label: 'XXL', value: 'XXL' }
                ]} value={props.moteurDetail.longueurarbre} />
                <InputNumber value={props.moteurDetail.arbre} addonAfter="cm"/>
            </Space>
         </Form.Item>
         <Form.Item label="Démarrage">
            <Select options={[
                { label: 'Manuel', value: 'Manuel' },
                { label: 'Electrique', value: 'Electrique' }
                ]} value={props.moteurDetail.demarrage} />
         </Form.Item>
         <Form.Item label="Barre">
            <Select options={[
                { label: 'Franche', value: 'Franche' },
                { label: 'Déportée', value: 'Déportée' }
                ]} value={props.moteurDetail.barre} />
         </Form.Item>
         <Form.Item label="Cylindres">
            <InputNumber value={props.moteurDetail.cylindres} />
         </Form.Item>
         <Form.Item label="Cylindrée">
            <InputNumber value={props.moteurDetail.cylindree} />
         </Form.Item>
         <Form.Item label="Régime Moteur">
            <Input value={props.moteurDetail.regime} />
         </Form.Item>
         <Form.Item label="Huile recommandée">
            <Input value={props.moteurDetail.huilerecommandee} />
         </Form.Item>
        </>
    );
}

function Helice(props) {
    return(
        <>
        <Form.Item label="Dénomination">
            <Input value={props.moteurDetail.helice} />
        </Form.Item>
        <Form.Item label="Diamétre">
            <Input value={props.moteurDetail.diametre} />
        </Form.Item>
        <Form.Item label="Pas">
            <Input value={props.moteurDetail.pas} />
        </Form.Item>
        <Form.Item label="Nombre de Pales">
            <InputNumber value={props.moteurDetail.lame} />
        </Form.Item>
        </>
    );
}

function Moteur(props) {
    const { navigate } = useNavigation();
    const moteurDetail = props.moteurs.filter(record => record.numeroserie === props.moteur)[0];

    return(
      <>
        <Breadcrumb items={[
            { title: <a onClick={() => navigate('/')}><HomeOutlined/></a> },
            { title: <Button type="text" size="small" onClick={() => props.setMoteur(null) }>Moteurs</Button> }
        ]} />
        <Card title={<Space><img width='60px' src={moteurDetail.imageUrl} /> {moteurDetail.denomination}</Space>} style={{ width: '100%' }}>
            <Row gutter={[16,16]}>
                <Col span={19}>
                    <Form name="moteur" labelCol={{ span: 8 }}
                                    wrapperCol={{ span: 16 }}
                                    style={{ width: '80%' }}
                                    initialValues={{ remember: true }} >
                        <Form.Item label="Numéro de série">
                            <Input value={moteurDetail.numeroserie} disabled={true} />
                        </Form.Item>
                        <Form.Item label="Dénomination">
                            <Input value={moteurDetail.denomination} />
                        </Form.Item>
                        <Form.Item label="Marque">
                            <Input value={moteurDetail.marque} />
                        </Form.Item>
                        <Form.Item label="Type">
                            <Select options={[
                                { label: 'Hors-Bord', value: 'Hors-Bord' },
                                { label: 'Inboard', value: 'Inboard'}
                            ]} value={moteurDetail.type} />
                        </Form.Item>
                        <Form.Item label="Propriétaire">
                            <Search value={moteurDetail.proprietaire} />
                        </Form.Item>
                        <Form.Item label="Date d'Achat">
                            <DatePicker defaultValue={dayjs(moteurDetail.dateachat, 'DD-MM-YYYY')} format='DD-MM-YYYY'/>
                        </Form.Item>
                        <Form.Item label="Date de Mise en Service">
                            <DatePicker defaultValue={dayjs(moteurDetail.datemes, 'DD-MM-YYYY')} format='DD-MM-YYYY'/>
                        </Form.Item>
                        <Form.Item label="Nombre d'heures">
                            <InputNumber value={moteurDetail.heures} addonAfter="h"/>
                        </Form.Item>
                        <Form.Item label="Notes">
                            <TextArea rows={6} value={moteurDetail.notes} />
                        </Form.Item>
                        <Collapse style={{ margin: '0 0 24px 0' }} items={[
                            { key: '1', label: 'Spécifications', children: <Specifications moteurDetail={moteurDetail} /> },
                            { key: '2', label: 'Hélice', children: <Helice moteurDetail={moteurDetail} /> },

                        ]} />
                        <Form.Item label={null}>
                            <Space>
                                <Button type="primary" htmlType="submit" icon={<PlusCircleOutlined/>}>Enregistrer</Button>
                                <Button type="primary" icon={<DeleteOutlined/>}>Supprimer</Button>
                                <Button onClick={() => props.setMoteur(null)} icon={<PauseCircleOutlined/>}>Annuler</Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Col>
                <Col span={5}>
                    <Space direction="vertical" align="center">
                        <Space><Image width={200} src={moteurDetail.imageUrl} /><Button onClick={() => demo()} icon={<DeleteOutlined/>} /></Space>
                        <Button onClick={() => demo()} icon={<PlusCircleOutlined />}>Ajouter une image</Button>
                    </Space>
                </Col>
            </Row>
        </Card>
      </>
    );
}

export default function Moteurs(props) {

    const [ moteur, setMoteur ] = useState();

    if (moteur) {
        return(
          <Moteur moteurs={props.moteurs} moteur={moteur} setMoteur={setMoteur}/>
        );
    } else {
        return(
            <List moteurs={props.moteurs} setMoteur={setMoteur} />
        );
    }
}