import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  InputNumber,
  Input,
  Popconfirm,
  message,
  Space,
  Select,
  Card,
  Row,
  Col,
  Spin,
  Rate,
  AutoComplete,
  Image,
} from "antd";

const { TextArea } = Input;
import {
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import api from "./api.ts";
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import ImageUpload from './ImageUpload.tsx';

const { Option } = Select;

const defaultMoteurCatalogue = {
  modele: '',
  marque: '',
  type: '',
  description: '',
  evaluation: 0,
  images: [],
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

type Fournisseur = {
  id: number;
  nom: string;
};

type Moteur = {
  id: number;
  marque: string;
  modele: string;
};

type FournisseurMoteur = {
  id?: number;
  fournisseur: Fournisseur;
  moteur: Moteur;
  prixAchatHT?: number;
  tva?: number;
  montantTVA?: number;
  prixAchatTTC?: number;
  portForfaitaire?: number;
  portParUnite?: number;
  nombreMinACommander?: number;
  notes?: string;
};

const defaultFournisseurMoteur: Partial<FournisseurMoteur> = {
  prixAchatHT: 0,
  tva: 20,
  montantTVA: 0,
  prixAchatTTC: 0,
  portForfaitaire: 0,
  portParUnite: 0,
  nombreMinACommander: 1,
  notes: "",
};

const FournisseurMoteurs = ({
  fournisseurId,
  moteurId,
}: {
  fournisseurId?: number;
  moteurId?: number;
}) => {
  const moteurTypes = useReferenceValeurs('TYPE_MOTEUR');
  const [moteursAssocies, setMoteursAssocies] = useState<FournisseurMoteur[]>([]);
  const [moteursCatalogue, setMoteursCatalogue] = useState<Moteur[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurMoteur> | null>(null);
  const [form] = Form.useForm();
  const [fournisseurModalVisible, setFournisseurModalVisible] = useState(false);
  const [fournisseurForm] = Form.useForm();
  const [moteurModalVisible, setMoteurModalVisible] = useState(false);
  const [moteurForm] = Form.useForm();

  const CV_TO_KW_FACTOR = 0.735499;
  const roundPower = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

  const isMoteurMode = !!moteurId;
  const isFournisseurMode = !!fournisseurId;

  // Fetch associations
  const fetchAssocies = async () => {
    setLoading(true);
    try {
      let url = "";
      if (isMoteurMode && moteurId) {
        url = `/fournisseur-moteur/search?moteurId=${moteurId}`;
      } else if (isFournisseurMode && fournisseurId) {
        url = `/fournisseur-moteur/fournisseur/${fournisseurId}`;
      }
      if (url) {
        const { data } = await api.get(url);
        setMoteursAssocies(data);
      }
    } catch {
      message.error("Erreur lors du chargement des associations");
    } finally {
      setLoading(false);
    }
  };

  // Fetch all moteurs
  const fetchMoteursCatalogue = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/catalogue/moteurs");
      setMoteursCatalogue(data);
    } catch {
      message.error("Erreur lors du chargement du catalogue moteurs");
    } finally {
      setLoading(false);
    }
  };

  // Fetch all fournisseurs
  const fetchFournisseurs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/catalogue/fournisseurs");
      setFournisseurs(data);
    } catch {
      message.error("Erreur lors du chargement des fournisseurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fournisseurId || moteurId) {
      fetchAssocies();
      if (isMoteurMode) {
        fetchFournisseurs();
      } else {
        fetchMoteursCatalogue();
      }
    }
    // eslint-disable-next-line
  }, [fournisseurId, moteurId]);

  const handleMoteurAdd = async () => {
    try {
      const values = await moteurForm.validateFields();
      const res = await api.post("/catalogue/moteurs", values);
      message.success("Moteur créé");
      setMoteurModalVisible(false);
      moteurForm.resetFields();
      await fetchMoteursCatalogue();
      form.setFieldsValue({ moteurId: res.data.id });
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la création du moteur");
    }
  };

  const handleFournisseurAdd = async () => {
    try {
      const values = await fournisseurForm.validateFields();
      const res = await api.post("/catalogue/fournisseurs", values);
      message.success("Fournisseur créé");
      setFournisseurModalVisible(false);
      fournisseurForm.resetFields();
      await fetchFournisseurs();
      form.setFieldsValue({ fournisseurId: res.data.id });
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la création du fournisseur");
    }
  };

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

  // Create
  const handleNew = () => {
    setEditing({
      ...defaultFournisseurMoteur,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      moteur: isMoteurMode ? { id: moteurId!, marque: "", modele: "" } : undefined,
    });
    setFormDirty(false);
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  // Edit
  const handleEdit = (record: FournisseurMoteur) => {
    setEditing({ ...record, moteur: { ...record.moteur }, fournisseur: { ...record.fournisseur } });
    setFormDirty(false);
    setModalVisible(true);
    setTimeout(() => {
      if (isMoteurMode) {
        form.setFieldsValue({ ...record, fournisseurId: record.fournisseur.id });
      } else {
        form.setFieldsValue({ ...record, moteurId: record.moteur.id });
      }
    });
  };

  // Delete
  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`/fournisseur-moteur/${id}`);
      message.success("Supprimé avec succès");
      fetchAssocies();
    } catch {
      message.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  // Save (Create/Update)
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      let body: FournisseurMoteur;

      if (isMoteurMode) {
        let selectedFournisseur = fournisseurs.find((f) => f.id === values.fournisseurId);
        body = {
          ...editing,
          ...values,
          fournisseur: selectedFournisseur!,
          moteur: { id: moteurId!, marque: "", modele: "" },
        };
      } else {
        let selectedMoteur = moteursCatalogue.find((m) => m.id === values.moteurId);
        body = {
          ...editing,
          ...values,
          moteur: selectedMoteur!,
          fournisseur: { id: fournisseurId!, nom: "" },
        };
      }

      setLoading(true);
      if (editing && editing.id) {
        const res = await api.put(`/fournisseur-moteur/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        const res = await api.post("/fournisseur-moteur", body);
        message.success("Ajouté avec succès");
        setEditing(res.data);
      }
      setFormDirty(false);
      fetchAssocies();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    ...(isMoteurMode
      ? [
          {
            title: "Fournisseur",
            key: "fournisseur",
            sorter: (a, b) =>
              (a.fournisseur?.nom || "").localeCompare(b.fournisseur?.nom || ""),
            filters: fournisseurs.map((f) => ({ text: f.nom, value: f.id })),
            onFilter: (value, record) => record.fournisseur?.id === value,
            render: (_: any, record: FournisseurMoteur) => (
              <span>{record.fournisseur?.nom || "-"}</span>
            ),
          },
        ]
      : [
          {
            title: "Moteur",
            key: "moteur",
            sorter: (a, b) =>
              ((a.moteur?.marque || "") + (a.moteur?.modele || "")).localeCompare(
                (b.moteur?.marque || "") + (b.moteur?.modele || "")
              ),
            filters: moteursCatalogue.map((m) => ({
              text: `${m.marque} ${m.modele}`,
              value: m.id,
            })),
            onFilter: (value, record) => record.moteur?.id === value,
            render: (_: any, record: FournisseurMoteur) => (
              <span>
                {record.moteur?.marque || "-"} {record.moteur?.modele || ""}
              </span>
            ),
          },
        ]),
    {
      title: "Prix Achat HT",
      dataIndex: "prixAchatHT",
      key: "prixAchatHT",
      sorter: (a, b) => (a.prixAchatHT || 0) - (b.prixAchatHT || 0),
    },
    {
      title: "TVA (%)",
      dataIndex: "tva",
      key: "tva",
      sorter: (a, b) => (a.tva || 0) - (b.tva || 0),
    },
    {
      title: "Montant TVA",
      dataIndex: "montantTVA",
      key: "montantTVA",
      sorter: (a, b) => (a.montantTVA || 0) - (b.montantTVA || 0),
    },
    {
      title: "Prix Achat TTC",
      dataIndex: "prixAchatTTC",
      key: "prixAchatTTC",
      sorter: (a, b) => (a.prixAchatTTC || 0) - (b.prixAchatTTC || 0),
    },
    {
      title: "Port forfaitaire",
      dataIndex: "portForfaitaire",
      key: "portForfaitaire",
      sorter: (a, b) => (a.portForfaitaire || 0) - (b.portForfaitaire || 0),
    },
    {
      title: "Port/unité",
      dataIndex: "portParUnite",
      key: "portParUnite",
      sorter: (a, b) => (a.portParUnite || 0) - (b.portParUnite || 0),
    },
    {
      title: "Qte min. commande",
      dataIndex: "nombreMinACommander",
      key: "nombreMinACommander",
      sorter: (a, b) =>
        (a.nombreMinACommander || 0) - (b.nombreMinACommander || 0),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: FournisseurMoteur) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Popconfirm
            title="Confirmer la suppression ?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 110,
    },
  ];

  return (
    <Card
      title={
        isMoteurMode
          ? "Fournisseurs pour ce moteur"
          : "Catalogue Moteurs"
      }
      extra={
        <Button
          type="primary"
          icon={<ShrinkOutlined />}
          onClick={handleNew}
        >
          {isMoteurMode
            ? "Associer un fournisseur"
            : "Associer un moteur"}
        </Button>
      }
      style={{ marginTop: 24 }}
    >
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={moteursAssocies}
          bordered
          pagination={{ pageSize: 10 }}
        />
      </Spin>

      <Modal
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleModalOk}
        destroyOnHidden
        title={
          editing && editing.id
            ? "Modifier l'association"
            : isMoteurMode
            ? "Associer un Fournisseur"
            : "Associer un Moteur"
        }
        okText="Enregistrer"
        cancelText="Fermer"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurMoteur}
          onValuesChange={(changed, all) => {
            setFormDirty(true);
            // Calcul dynamique du montant TVA et TTC
            if ("prixAchatHT" in changed || "tva" in changed) {
              let prixAchatHT = all.prixAchatHT ?? 0;
              let tva = all.tva ?? 20;
              let montantTVA = prixAchatHT * (tva / 100);
              let prixAchatTTC = prixAchatHT + montantTVA;
              form.setFieldsValue({ montantTVA, prixAchatTTC });
            }
          }}
        >
          {isMoteurMode ? (
            <Form.Item label="Fournisseur" style={{ marginBottom: 0 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="fournisseurId"
                  rules={[{ required: true, message: "Sélectionnez un fournisseur" }]}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <Select
                    showSearch
                    placeholder="Choisissez un fournisseur"
                    optionFilterProp="children"
                    filterOption={(input, option: any) =>
                      `${option.children}`.toLowerCase().includes(input.toLowerCase())
                    }
                    disabled={!!(editing && editing.id)}
                  >
                    {fournisseurs.map((f) => (
                      <Option key={f.id} value={f.id}>
                        {f.nom}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    fournisseurForm.resetFields();
                    setFournisseurModalVisible(true);
                  }}
                />
              </Space.Compact>
            </Form.Item>
          ) : (
            <Form.Item label="Moteur catalogue" style={{ marginBottom: 0 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="moteurId"
                  rules={[{ required: true, message: "Sélectionnez un moteur du catalogue" }]}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <Select
                    showSearch
                    placeholder="Choisissez un moteur"
                    optionFilterProp="children"
                    filterOption={(input, option: any) =>
                      `${option.children}`.toLowerCase().includes(input.toLowerCase())
                    }
                    disabled={!!(editing && editing.id)}
                  >
                    {moteursCatalogue.map((m) => (
                      <Option key={m.id} value={m.id}>
                        {m.marque} {m.modele}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    moteurForm.resetFields();
                    setMoteurModalVisible(true);
                  }}
                />
              </Space.Compact>
            </Form.Item>
          )}

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item
                label="Prix Achat HT (€)"
                name="prixAchatHT"
                rules={[{ required: true, message: "Prix achat HT requis" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="TVA (%)"
                name="tva"
                rules={[{ required: true }]}
                initialValue={20}
              >
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Montant TVA (€)" name="montantTVA">
                <InputNumber min={0} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item label="Prix Achat TTC (€)" name="prixAchatTTC">
                <InputNumber min={0} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Qte min. à commander"
                name="nombreMinACommander"
                rules={[
                  {
                    required: true,
                    type: "number",
                    message: "Quantité min. requise",
                  },
                ]}
              >
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item label="Port forfaitaire (€)" name="portForfaitaire">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Port par unité (€)" name="portParUnite">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={fournisseurModalVisible}
        title="Nouveau Fournisseur"
        onCancel={() => setFournisseurModalVisible(false)}
        onOk={handleFournisseurAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={fournisseurForm} initialValues={{ evaluation: 0 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Nom" name="nom" rules={[{ required: true, message: "Champ requis" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Évaluation" name="evaluation">
                <Rate allowHalf />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Image (URL)" name="image">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Email" name="email">
                <Input type="email" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Téléphone" name="telephone">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Connexion" name="connexion">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Adresse" name="adresse">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="SIREN" name="siren">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="SIRET" name="siret">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="TVA" name="tva">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="NAF" name="naf">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={moteurModalVisible}
        title="Nouveau Moteur"
        onCancel={() => setMoteurModalVisible(false)}
        onOk={handleMoteurAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
        maskClosable={false}
      >
        <Form
          layout="vertical"
          form={moteurForm}
          initialValues={defaultMoteurCatalogue}
          onValuesChange={(changedValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, 'puissanceCv')
              && !Object.prototype.hasOwnProperty.call(changedValues, 'puissanceKw')) {
              const puissanceCv = Number(moteurForm.getFieldValue('puissanceCv')) || 0;
              moteurForm.setFieldValue('puissanceKw', roundPower(puissanceCv * CV_TO_KW_FACTOR));
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, 'puissanceKw')
              && !Object.prototype.hasOwnProperty.call(changedValues, 'puissanceCv')) {
              const puissanceKw = Number(moteurForm.getFieldValue('puissanceKw')) || 0;
              moteurForm.setFieldValue('puissanceCv', roundPower(puissanceKw / CV_TO_KW_FACTOR));
            }
            if (changedValues.prixVenteHT || changedValues.tva) {
              const prixVenteHT = moteurForm.getFieldValue('prixVenteHT');
              const tva = moteurForm.getFieldValue('tva');
              const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
              moteurForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
              moteurForm.setFieldValue('prixVenteTTC', prixVenteTTC);
            }
            if (changedValues.prixVenteTTC) {
              const prixVenteTTC = moteurForm.getFieldValue('prixVenteTTC');
              const tva = moteurForm.getFieldValue('tva');
              const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
              moteurForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
              moteurForm.setFieldValue('prixVenteHT', prixVenteHT);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="marque" label="Marque" rules={[{ required: true }]}>
                <AutoComplete
                  allowClear
                  options={moteursCatalogue.map(m => ({ value: m.marque })).filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)}
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="puissanceCv" label="Puissance">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="cv" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="puissanceKw" label="Puissance">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="kW" />
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
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="cm3" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="regime" label="Régime Max">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="tr/min" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="huileRecommandee" label="Huile recommandée">
                <Input />
              </Form.Item>
            </Col>
          </Row>
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
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="frais" label="Frais">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
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
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
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
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prixVenteTTC" label="Prix de vente TTC">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  );
};

export default FournisseurMoteurs;
