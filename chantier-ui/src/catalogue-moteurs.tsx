import React, { useEffect, useState } from 'react';
import { Row, Col, AutoComplete, Table, Button, Modal, Form, Input, InputNumber, Rate, Space, Popconfirm, message, Select, Image, Card } from 'antd';
import { EditOutlined, DeleteOutlined, PlusCircleOutlined } from '@ant-design/icons';
import api from './api.ts';
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import FournisseurMoteurs from './fournisseur-moteurs.tsx';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';

const style: React.CSSProperties = { padding: '8px 0' };
const { Search } = Input;

type CatalogueImage = string;

interface Helice {
  id?: number;
  modele: string;
  marque: string;
  description: string;
  evaluation: number;
  diametre: number;
  moteursCompatibles?: Array<Pick<Moteur, 'id' | 'modele' | 'marque' | 'type'>>;
}

interface Moteur {
  id?: number;
  modele: string;
  marque: string;
  type: string;
  description: string;
  evaluation: number;
  images: CatalogueImage[];
  puissanceCv: number;
  puissanceKw: number;
  longueurArbre: string;
  arbre: number;
  demarrage: string;
  direction: string;
  cylindres: number;
  cylindree: number;
  regime: string;
  huileRecommandee: string;
  helicesCompatibles: Helice[];
  stock: number;
  stockAlerte: number;
  emplacement: string;
  prixPublic: number;
  frais: number;
  tauxMarge: number;
  tauxMarque: number;
  prixVenteHT: number;
  tva: number;
  montantTVA: number;
  prixVenteTTC: number;
}

const defaultMoteur: Moteur = {
  modele: '',
  marque: '',
  type: '',
  description: '',
  evaluation: 0,
  images: [],
  documents: [],
  puissanceCv: 0,
  puissanceKw: 0,
  longueurArbre: '',
  arbre: 0,
  demarrage: '',
  direction: '',
  cylindres: 0,
  cylindree: 0,
  regime: '',
  huileRecommandee: '',
  helicesCompatibles: [],
  stock: 0,
  stockAlerte: 0,
  emplacement: '',
  prixPublic: 0,
  frais: 0,
  tauxMarge: 0,
  tauxMarque: 0,
  prixVenteHT: 0,
  tva: 20,
  montantTVA: 0,
  prixVenteTTC: 0,
};

const summarizeMoteur = (moteur: Moteur) => ({
  id: moteur.id,
  modele: moteur.modele,
  marque: moteur.marque,
  type: moteur.type,
});

const attachMoteursToHelices = (helicesList: Helice[], moteursList: Moteur[]) =>
  helicesList.map((helice) => {
    if (!helice.id) {
      return helice;
    }
    const moteursCompatibles = moteursList
      .filter((moteur) => (moteur.helicesCompatibles || []).some((linkedHelice) => linkedHelice.id === helice.id))
      .map(summarizeMoteur);
    return { ...helice, moteursCompatibles };
  });

const MoteurCatalogue = () => {
  const moteurTypes = useReferenceValeurs('TYPE_MOTEUR');
  const CV_TO_KW_FACTOR = 0.735499;

  const roundPower = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [moteurs, setMoteurs] = useState<Moteur[]>([]);
  const [helices, setHelices] = useState<Helice[]>([]);
  const [form] = Form.useForm();
  const [editingMoteur, setEditingMoteur] = useState<Moteur | null>(null);
  const [formDirty, setFormDirty] = useState(false);

  const fetchMoteurs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/catalogue/moteurs');
      const data = res.data ?? [];
      setMoteurs(data);
      setHelices((prev) => attachMoteursToHelices(prev, data));
    } catch {
      message.error('Erreur lors du chargement des moteurs');
    } finally {
      setLoading(false);
    }
  };

  const fetchHelices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/catalogue/helices');
      const data = res.data ?? [];
      setHelices(attachMoteursToHelices(data, moteurs));
    } catch {
      message.error('Erreur lors du chargement des hélices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoteurs();
    fetchHelices();
  }, []);

  const handleModalCancel = () => {
    if (formDirty) {
      Modal.confirm({
        title: "Modifications non enregistrées",
        content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
        okText: "Fermer",
        cancelText: "Annuler",
        onOk: () => {
          setFormDirty(false);
          setModalVisible(false);
        },
      });
    } else {
      setModalVisible(false);
    }
  };

  const openModal = (record = null) => {
    setEditingMoteur(record);
    setFormDirty(false);
    setModalVisible(true);
    if (record) {
      form.setFieldsValue({
        ...(record as object),
        helicesCompatibles: (record as any)?.helicesCompatibles
          ? (record as any).helicesCompatibles.map((h: { id: number }) => h.id)
          : [],
      });
    } else {
      form.resetFields();
      form.setFieldsValue(defaultMoteur);
    }
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    try {
      await api.delete(`/catalogue/moteurs/${id}`);
      message.success('Moteur supprimé avec succès');
      fetchMoteurs();
    } catch {
      message.error('Erreur lors de la suppression.');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      // handle helices compatibles
      const selectedHelices = helices.filter(h => (values.helicesCompatibles || []).includes(h.id));
      let moteurToSave = {
        ...values,
        helicesCompatibles: selectedHelices,
      };

      if (editingMoteur && editingMoteur.id != null) {
        const res = await api.put(`/catalogue/moteurs/${editingMoteur.id}`, moteurToSave);
        message.success('Moteur modifié avec succès');
        setEditingMoteur(res.data);
        form.setFieldsValue({
          ...res.data,
          helicesCompatibles: (res.data.helicesCompatibles || []).map((h: { id: number }) => h.id),
        });
      } else {
        const res = await api.post('/catalogue/moteurs', moteurToSave);
        message.success('Moteur ajouté avec succès');
        setEditingMoteur(res.data);
        form.setFieldsValue({
          ...res.data,
          helicesCompatibles: (res.data.helicesCompatibles || []).map((h: { id: number }) => h.id),
        });
      }
      setFormDirty(false);
      await fetchMoteurs();
      await fetchHelices();
    } catch (err) {
      // Already shown by Form.Item
    }
  };

  const columns = [
    {
      title: 'Marque',
      dataIndex: 'marque',
      sorter: (a, b) => a.marque.localeCompare(b.marque),
    },
    {
      title: 'Modèle',
      dataIndex: 'modele',
      render: (_: any, record: any) => (
        <Space>
          {record.images && record.images[0] && (
            <Image width={50} src={record.images[0]} />
          )}
          {record.modele}
        </Space>
      ),
      sorter: (a, b) => a.modele.localeCompare(b.modele),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      sorter: (a, b) => (a.type || '').localeCompare(b.type),
      filters: moteurTypes,
      onFilter: (value, record) => record.type === value,
    },
    {
      title: 'Évaluation',
      dataIndex: 'evaluation',
      render: (_: any, record: any) => <Rate value={record.evaluation} disabled allowHalf={true} />,
      sorter: (a, b) => (a.evaluation || 0) - (b.evaluation || 0),
    },
    { title: 'Stock', dataIndex: 'stock',
      sorter: (a, b) => a.stock - b.stock,
    },
    { title: 'Prix TTC', dataIndex: 'prixVenteTTC', key: 'prixVenteTTC',
      sorter: (a, b) => a.prixVenteTTC - b.prixVenteTTC,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button onClick={() => openModal(record)} icon={<EditOutlined />} />
          <Popconfirm
            title="Supprimer ce moteur ?"
            onConfirm={() => handleDelete(record.id)}
            okText="Oui"
            cancelText="Non"
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const onValuesChange = (changedValues, allValues) => {
    setFormDirty(true);
    if (Object.prototype.hasOwnProperty.call(changedValues, 'puissanceCv')
      && !Object.prototype.hasOwnProperty.call(changedValues, 'puissanceKw')) {
      const puissanceCv = Number(form.getFieldValue('puissanceCv')) || 0;
      form.setFieldValue('puissanceKw', roundPower(puissanceCv * CV_TO_KW_FACTOR));
    }

    if (Object.prototype.hasOwnProperty.call(changedValues, 'puissanceKw')
      && !Object.prototype.hasOwnProperty.call(changedValues, 'puissanceCv')) {
      const puissanceKw = Number(form.getFieldValue('puissanceKw')) || 0;
      form.setFieldValue('puissanceCv', roundPower(puissanceKw / CV_TO_KW_FACTOR));
    }

    if (changedValues.prixVenteHT || changedValues.tva) {
      const prixVenteHT = form.getFieldValue('prixVenteHT');
      const tva = form.getFieldValue('tva');
      const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
      form.setFieldValue('montantTVA', montantTVA);
      const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
      form.setFieldValue('prixVenteTTC', prixVenteTTC);
    }
    if (changedValues.prixVenteTTC) {
      const prixVenteTTC = form.getFieldValue('prixVenteTTC');
      const tva = form.getFieldValue('tva');
      const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
      form.setFieldValue('montantTVA', montantTVA);
      const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
      form.setFieldValue('prixVenteHT', prixVenteHT);
    }
  };

  return (
    <>
      <Card title="Catalogue Moteurs">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div style={style}>
            <Space>
              <Search
                placeholder="Recherche"
                enterButton
                allowClear={true}
                onSearch={async (value) => {
                  setLoading(true);
                  try {
                    const response = await api.get('/catalogue/moteurs/search', { params: { q: value } });
                    setMoteurs(response.data);
                  } catch (error) {
                    message.error('Erreur lors de la recherche');
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ width: 600 }} />
              <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => openModal()} />
            </Space>
          </div>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={moteurs}
            loading={loading}
            pagination={{ pageSize: 10 }}
            bordered
          />
          <Modal
            open={modalVisible}
            title={editingMoteur ? 'Modifier un moteur' : 'Ajouter un moteur'}
            onOk={handleModalOk}
            onCancel={handleModalCancel}
            maskClosable={false}
            okText="Enregistrer"
            cancelText="Fermer"
            destroyOnHidden
            width={1024}
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={defaultMoteur}
              onValuesChange={onValuesChange}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="marque" label="Marque" rules={[{ required: true }]}>
                    <AutoComplete
                      allowClear
                      options={
                        Array.from(
                          new Set(moteurs.map((m: any) => m.marque).filter((m: any) => !!m))
                        ).map((marque: string) => ({ value: marque }))
                      }
                      placeholder="Saisir ou sélectionner une marque"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="modele" label="Modèle" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                    <Select options={moteurTypes.map((t) => ({ label: t.text, value: t.value }))} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="evaluation" label="Évaluation">
                    <Rate allowHalf />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="images" label="Images">
                <ImageUpload />
              </Form.Item>
              <Form.Item name="documents" label="Documents">
                <DocumentUpload />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="puissanceCv" label="Puissance">
                    <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="cv" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="puissanceKw" label="Puissance">
                    <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="kW"/>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="longueurArbre" label="Longueur arbre">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="arbre" label="Arbre">
                    <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="cm" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="demarrage" label="Démarrage">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="direction" label="Direction">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="cylindres" label="Nombre de cylindres">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="cylindree" label="Cylindrée">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="cm3"/>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="regime" label="Régime Max">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="tr/min"/>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="huileRecommandee" label="Huile recommandée">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="helicesCompatibles" label="Hélices compatibles">
                <Select mode="multiple" optionFilterProp="children" showSearch>
                  {helices.map(h => (
                    <Select.Option key={h.id} value={h.id}>
                    {h.marque + " " + h.modele}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="stock" label="Stock">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="stockAlerte" label="Stock alerte">
                    <InputNumber min={0} step={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="emplacement" label="Emplacement">
                <Input />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="prixPublic" label="Prix public">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="frais" label="Frais">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="tauxMarge" label="Taux de marge">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tauxMarque" label="Taux de marque">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="prixVenteHT" label="Prix de vente HT">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tva" label="TVA">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="montantTVA" label="Montant TVA">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="prixVenteTTC" label="Prix de vente TTC">
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€"/>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            {editingMoteur && <FournisseurMoteurs moteurId={editingMoteur.id} />}
          </Modal>
        </Col>
      </Row>
    </Card>
    </>
  );
};

export default MoteurCatalogue;
