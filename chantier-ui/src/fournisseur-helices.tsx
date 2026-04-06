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
  Image,
} from "antd";

const { TextArea } = Input;
import {
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  SaveOutlined,
  SearchOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import api from "./api.ts";
import ImageUpload from './ImageUpload.tsx';

const { Option } = Select;

const defaultHeliceCatalogue = {
  modele: '',
  marque: '',
  description: '',
  images: [],
  evaluation: 0,
  diametre: 0,
  pas: '',
  pales: 0,
  cannelures: 0,
  moteursCompatibles: [],
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

type Helice = {
  id: number;
  modele: string;
  marque: string;
};

type FournisseurHelice = {
  id?: number;
  fournisseur: Fournisseur;
  helice: Helice;
  prixAchatHT?: number;
  tva?: number;
  montantTVA?: number;
  prixAchatTTC?: number;
  portForfaitaire?: number;
  portParUnite?: number;
  nombreMinACommander?: number;
  notes?: string;
};

const defaultFournisseurHelice: Partial<FournisseurHelice> = {
  prixAchatHT: 0,
  tva: 20,
  montantTVA: 0,
  prixAchatTTC: 0,
  portForfaitaire: 0,
  portParUnite: 0,
  nombreMinACommander: 1,
  notes: "",
};

const FournisseurHelices = ({
  fournisseurId,
  heliceId,
}: {
  fournisseurId?: number;
  heliceId?: number;
}) => {
  const [helicesAssociees, setHelicesAssociees] = useState<FournisseurHelice[]>([]);
  const [helicesCatalogue, setHelicesCatalogue] = useState<Helice[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurHelice> | null>(null);
  const [form] = Form.useForm();
  const [fournisseurModalVisible, setFournisseurModalVisible] = useState(false);
  const [fournisseurForm] = Form.useForm();
  const [heliceModalVisible, setHeliceModalVisible] = useState(false);
  const [heliceForm] = Form.useForm();

  const isHeliceMode = !!heliceId;
  const isFournisseurMode = !!fournisseurId;

  // Fetch associations depending on context
  const fetchAssociees = async () => {
    setLoading(true);
    try {
      let url = "";
      if (isHeliceMode && heliceId) {
        url = `/fournisseur-helice/search?heliceId=${heliceId}`;
      } else if (isFournisseurMode && fournisseurId) {
        url = `/fournisseur-helice/fournisseur/${fournisseurId}`;
      }
      if (url) {
        const { data } = await api.get(url);
        setHelicesAssociees(data);
      }
    } catch {
      message.error("Erreur lors du chargement des associations");
    } finally {
      setLoading(false);
    }
  };

  const fetchHelicesCatalogue = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/catalogue/helices");
      setHelicesCatalogue(data);
    } catch {
      message.error("Erreur lors du chargement du catalogue des hélices");
    } finally {
      setLoading(false);
    }
  };

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
    if (fournisseurId || heliceId) {
      fetchAssociees();
      if (isHeliceMode) {
        fetchFournisseurs();
      } else {
        fetchHelicesCatalogue();
      }
    }
    // eslint-disable-next-line
  }, [fournisseurId, heliceId]);

  const handleHeliceAdd = async () => {
    try {
      const values = await heliceForm.validateFields();
      const res = await api.post("/catalogue/helices", values);
      message.success("Hélice créée");
      setHeliceModalVisible(false);
      heliceForm.resetFields();
      await fetchHelicesCatalogue();
      form.setFieldsValue({ heliceId: res.data.id });
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la création de l'hélice");
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

  // Add
  const handleNew = () => {
    setEditing({
      ...defaultFournisseurHelice,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      helice: isHeliceMode ? { id: heliceId!, marque: "", modele: "" } : undefined,
    });
    setFormDirty(false);
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  // Edit
  const handleEdit = (record: FournisseurHelice) => {
    setEditing({
      ...record,
      helice: { ...record.helice },
      fournisseur: { ...record.fournisseur },
    });
    setFormDirty(false);
    setModalVisible(true);
    setTimeout(() => {
      if (isHeliceMode) {
        form.setFieldsValue({ ...record, fournisseurId: record.fournisseur.id });
      } else {
        form.setFieldsValue({ ...record, heliceId: record.helice.id });
      }
    });
  };

  // Delete
  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`/fournisseur-helice/${id}`);
      message.success("Supprimé avec succès");
      fetchAssociees();
    } catch {
      message.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  // Create / Update
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      let body: FournisseurHelice;

      if (isHeliceMode) {
        let selectedFournisseur = fournisseurs.find(f => f.id === values.fournisseurId);
        body = {
          ...editing,
          ...values,
          fournisseur: selectedFournisseur!,
          helice: { id: heliceId!, marque: "", modele: "" },
        };
      } else {
        let selectedHelice = helicesCatalogue.find(h => h.id === values.heliceId);
        body = {
          ...editing,
          ...values,
          helice: selectedHelice!,
          fournisseur: { id: fournisseurId!, nom: "" },
        };
      }

      setLoading(true);

      if (editing && editing.id) {
        // update
        const res = await api.put(`/fournisseur-helice/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        // create
        const res = await api.post("/fournisseur-helice", body);
        message.success("Ajouté avec succès");
        setEditing(res.data);
      }
      setFormDirty(false);
      fetchAssociees();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    ...(isHeliceMode
      ? [
          {
            title: "Fournisseur",
            key: "fournisseur",
            sorter: (a, b) => (a.fournisseur?.nom || "").localeCompare(b.fournisseur?.nom || ""),
            filters: fournisseurs.map((f) => ({ text: f.nom, value: f.id })),
            onFilter: (value, record) => record.fournisseur?.id === value,
            render: (_: any, record: FournisseurHelice) => <span>{record.fournisseur?.nom || "-"}</span>,
          },
        ]
      : [
          {
            title: "Hélice",
            key: "helice",
            sorter: (a, b) => {
              let marque = (a.helice?.marque || "").localeCompare(b.helice?.marque || "");
              let modele = (a.helice?.modele || "").localeCompare(b.helice?.modele || "");
              return marque !== 0 ? marque : modele;
            },
            filters: helicesCatalogue.map((h) => ({
              text: `${h.marque} ${h.modele}`,
              value: h.id,
            })),
            onFilter: (value, record) => record.helice?.id === value,
            render: (_: any, record: FournisseurHelice) => (
              <span>
                {record.helice?.marque || "-"} {record.helice?.modele || ""}
              </span>
            ),
          },
        ]),
    { title: "Prix Achat HT", dataIndex: "prixAchatHT", key: "prixAchatHT", sorter: (a, b) => (a.prixAchatHT || 0) - (b.prixAchatHT || 0) },
    { title: "TVA (%)", dataIndex: "tva", key: "tva", sorter: (a, b) => (a.tva || 0) - (b.tva || 0) },
    { title: "Montant TVA", dataIndex: "montantTVA", key: "montantTVA", sorter: (a, b) => (a.montantTVA || 0) - (b.montantTVA || 0) },
    { title: "Prix Achat TTC", dataIndex: "prixAchatTTC", key: "prixAchatTTC", sorter: (a, b) => (a.prixAchatTTC || 0) - (b.prixAchatTTC || 0) },
    { title: "Port forfaitaire", dataIndex: "portForfaitaire", key: "portForfaitaire", sorter: (a, b) => (a.portForfaitaire || 0) - (b.portForfaitaire || 0) },
    { title: "Port/unité", dataIndex: "portParUnite", key: "portParUnite", sorter: (a, b) => (a.portParUnite || 0) - (b.portParUnite || 0) },
    { title: "Qte min. commande", dataIndex: "nombreMinACommander", key: "nombreMinACommander", sorter: (a, b) => (a.nombreMinACommander || 0) - (b.nombreMinACommander || 0) },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: FournisseurHelice) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" />
          <Popconfirm title="Confirmer la suppression ?" onConfirm={() => handleDelete(record.id)}>
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
        isHeliceMode
          ? "Fournisseurs pour cette hélice"
          : "Catalogue Hélices"
      }
      extra={
        <Button type="primary" icon={<ShrinkOutlined />} onClick={handleNew}>
          {isHeliceMode ? "Associer un fournisseur" : "Associer une hélice"}
        </Button>
      }
      style={{ marginTop: 24 }}
    >
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={helicesAssociees}
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
            : isHeliceMode
            ? "Associer un Fournisseur"
            : "Associer une Hélice"
        }
        okText="Enregistrer"
        cancelText="Fermer"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurHelice}
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
          {isHeliceMode ? (
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
            <Form.Item label="Hélice catalogue" style={{ marginBottom: 0 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="heliceId"
                  rules={[{ required: true, message: "Sélectionnez une hélice du catalogue" }]}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <Select
                    showSearch
                    placeholder="Choisissez une hélice"
                    optionFilterProp="children"
                    filterOption={(input, option: any) =>
                      `${option.children}`.toLowerCase().includes(input.toLowerCase())
                    }
                    disabled={!!(editing && editing.id)}
                  >
                    {helicesCatalogue.map((h) => (
                      <Option key={h.id} value={h.id}>
                        {h.marque} {h.modele}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    heliceForm.resetFields();
                    setHeliceModalVisible(true);
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
              <Form.Item
                label="Prix Achat TTC (€)"
                name="prixAchatTTC"
              >
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
        open={heliceModalVisible}
        title="Nouvelle Hélice"
        onCancel={() => setHeliceModalVisible(false)}
        onOk={handleHeliceAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
        maskClosable={false}
      >
        <Form
          layout="vertical"
          form={heliceForm}
          initialValues={defaultHeliceCatalogue}
          onValuesChange={(changedValues) => {
            if (changedValues.prixVenteHT || changedValues.tva) {
              const prixVenteHT = heliceForm.getFieldValue('prixVenteHT');
              const tva = heliceForm.getFieldValue('tva');
              const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
              heliceForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
              heliceForm.setFieldValue('prixVenteTTC', prixVenteTTC);
            }
            if (changedValues.prixVenteTTC) {
              const prixVenteTTC = heliceForm.getFieldValue('prixVenteTTC');
              const tva = heliceForm.getFieldValue('tva');
              const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
              heliceForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
              heliceForm.setFieldValue('prixVenteHT', prixVenteHT);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="marque" label="Marque" rules={[{ required: true, message: "Champ obligatoire" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="modele" label="Modèle" rules={[{ required: true, message: "Champ obligatoire" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="images" label="Images">
            <ImageUpload />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="evaluation" label="Évaluation">
                <Rate allowHalf />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="diametre" label="Diamètre">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="pas" label="Pas">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pales" label="Pales">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="cannelures" label="Cannelures">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prixPublic" label="Prix Public">
                <InputNumber min={0} step={0.01} addonAfter="€" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="frais" label="Frais">
                <InputNumber min={0} step={0.01} addonAfter="€" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tauxMarge" label="Taux Marge">
                <InputNumber min={0} max={100} step={0.01} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tauxMarque" label="Taux Marque">
                <InputNumber min={0} max={100} step={0.01} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prixVenteHT" label="Prix Vente HT">
                <InputNumber min={0} step={0.01} addonAfter="€" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tva" label="TVA">
                <InputNumber min={0} max={100} step={0.01} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="montantTVA" label="Montant TVA">
                <InputNumber min={0} step={0.01} addonAfter="€" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prixVenteTTC" label="Prix Vente TTC">
                <InputNumber min={0} step={0.01} addonAfter="€" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  );
};

export default FournisseurHelices;

