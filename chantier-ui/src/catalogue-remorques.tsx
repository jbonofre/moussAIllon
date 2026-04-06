import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  message,
  Popconfirm,
  Row,
  Col,
  Select,
  Rate,
  Spin,
  Card,
} from "antd";
import { PlusCircleOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import api from "./api.ts";
import ImageUpload from "./ImageUpload.tsx";
import DocumentUpload from "./DocumentUpload.tsx";
import FournisseurRemorques from "./fournisseur-remorques.tsx";

const style: React.CSSProperties = { padding: '8px 0' };
const { Search } = Input;

// Defaults for a Remorque
const defaultRemorque = {
  modele: "",
  marque: "",
  description: "",
  images: [],
  documents: [],
  evaluation: 0,
  ptac: 0,
  chargeAVide: 0,
  chargeUtile: 0,
  longueur: 0,
  largeur: 0,
  longueurMaxBateau: 0,
  largeurMaxBateau: 0,
  fleche: "",
  typeChassis: "",
  roues: "",
  equipement: "",
  stock: 0,
  stockAlerte: 0,
  emplacement: "",
  prixPublic: 0,
  frais: 0,
  tauxMarge: 0,
  tauxMarque: 0,
  prixVenteHT: 0,
  tva: 20,
  montantTVA: 0,
  prixVenteTTC: 0,
};

const typeChassisList = [
  { label: "Standard", value: "Standard" },
  { label: "Renforcé", value: "Renforcé" },
];

const rouesList = [
  { label: "Simple", value: "Simple" },
  { label: "Double", value: "Double" },
];

const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const getPricingFromHT = (prixVenteHT: number, tva: number) => {
  const montantTVA = roundAmount(prixVenteHT * (tva / 100));
  const prixVenteTTC = roundAmount(prixVenteHT + montantTVA);
  return { prixVenteHT, tva, montantTVA, prixVenteTTC };
};

const getPricingFromTTC = (prixVenteTTC: number, tva: number) => {
  const montantTVA = roundAmount((prixVenteTTC / (100 + tva)) * tva);
  const prixVenteHT = roundAmount(prixVenteTTC - montantTVA);
  return { prixVenteHT, tva, montantTVA, prixVenteTTC };
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const RemorqueCatalogue: React.FC = () => {
  const [remorques, setRemorques] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [editingRemorque, setEditingRemorque] = useState<any>(null);
  const [formDirty, setFormDirty] = useState(false);

  // Fetch all remorques
  const fetchRemorques = async () => {
    setLoading(true);
    try {
      const response = await api.get("/catalogue/remorques");
      setRemorques(response.data || []);
    } catch (e) {
      message.error("Erreur lors du chargement des remorques");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRemorques();
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

  // Modal open for add/edit
  const openModal = (remorque: any = null) => {
    setEditingRemorque(remorque);
    if (remorque) {
      form.setFieldsValue(remorque);
    } else {
      form.setFieldsValue(defaultRemorque);
    }
    setFormDirty(false);
    setModalVisible(true);
  };

  // Delete remorque
  const handleDelete = async (id: number) => {
    setLoading(true);
    try {
      await api.delete(`/catalogue/remorques/${id}`);
      message.success("Remorque supprimée");
      fetchRemorques();
    } catch {
      message.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  // Add/edit submit
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const tva = toNumber(values.tva, 20);
      const prixVenteHT = toNumber(values.prixVenteHT, 0);
      const synchronizedPricing = getPricingFromHT(prixVenteHT, tva);
      values.tva = synchronizedPricing.tva;
      values.prixVenteHT = synchronizedPricing.prixVenteHT;
      values.montantTVA = synchronizedPricing.montantTVA;
      values.prixVenteTTC = synchronizedPricing.prixVenteTTC;

      setLoading(true);
      if (editingRemorque && editingRemorque.id) {
        const res = await api.put(`/catalogue/remorques/${editingRemorque.id}`, { ...editingRemorque, ...values });
        message.success("Remorque modifiée");
        setEditingRemorque(res.data);
        form.setFieldsValue(res.data);
      } else {
        const res = await api.post("/catalogue/remorques", values);
        message.success("Remorque ajoutée");
        setEditingRemorque(res.data);
        form.setFieldsValue(res.data);
      }
      setFormDirty(false);
      fetchRemorques();
    } catch (e: any) {
      if (e?.errorFields) return; // Ant design form error
      message.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  // When change TTC/TVA
  const onValuesChange = (changed: any, all: any) => {
    setFormDirty(true);
    const hasChanged = (key: string) => Object.prototype.hasOwnProperty.call(changed, key);
    const currentTva = toNumber(all.tva, 20);
    const currentHT = toNumber(all.prixVenteHT, 0);
    const currentTTC = toNumber(all.prixVenteTTC, 0);
    const currentMontantTVA = toNumber(all.montantTVA, 0);

    let pricingUpdate: { prixVenteHT: number; tva: number; montantTVA: number; prixVenteTTC: number } | null = null;

    if (hasChanged("prixVenteHT")) {
      pricingUpdate = getPricingFromHT(currentHT, currentTva);
    } else if (hasChanged("prixVenteTTC")) {
      pricingUpdate = getPricingFromTTC(currentTTC, currentTva);
    } else if (hasChanged("montantTVA")) {
      const prixVenteTTC = roundAmount(currentHT + currentMontantTVA);
      const tva = currentHT > 0 ? roundAmount((currentMontantTVA / currentHT) * 100) : 0;
      pricingUpdate = {
        prixVenteHT: currentHT,
        tva,
        montantTVA: currentMontantTVA,
        prixVenteTTC,
      };
    } else if (hasChanged("tva")) {
      pricingUpdate = currentHT > 0 || currentTTC === 0
        ? getPricingFromHT(currentHT, currentTva)
        : getPricingFromTTC(currentTTC, currentTva);
    }

    if (!pricingUpdate) {
      return;
    }

    const fieldsToSync: any = {};
    if (toNumber(all.prixVenteHT, 0) !== pricingUpdate.prixVenteHT) fieldsToSync.prixVenteHT = pricingUpdate.prixVenteHT;
    if (toNumber(all.tva, 20) !== pricingUpdate.tva) fieldsToSync.tva = pricingUpdate.tva;
    if (toNumber(all.montantTVA, 0) !== pricingUpdate.montantTVA) fieldsToSync.montantTVA = pricingUpdate.montantTVA;
    if (toNumber(all.prixVenteTTC, 0) !== pricingUpdate.prixVenteTTC) fieldsToSync.prixVenteTTC = pricingUpdate.prixVenteTTC;

    if (Object.keys(fieldsToSync).length > 0) {
      form.setFieldsValue(fieldsToSync);
    }
  };

  // Search
  const handleSearch = async (value: string) => {
    setLoading(true);
    try {
      const response = await api.get("/catalogue/remorques/search", {
        params: value
          ? {
              modele: value,
              marque: value,
              description: value,
            }
          : {},
      });
      setRemorques(response.data);
    } catch {
      message.error("Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Marque", dataIndex: "marque", key: "marque" },
    { title: "Modèle", dataIndex: "modele", key: "modele" },
    {
      title: "Évaluation",
      dataIndex: "evaluation",
      key: "evaluation",
      render: (rate: number) => <Rate allowHalf disabled value={rate} />,
      width: 130,
    },
    { title: "Longueur", dataIndex: "longueur", key: "longueur" },
    { title: "Stock", dataIndex: "stock", key: "stock" },
    { title: "Prix TTC", dataIndex: "prixVenteTTC", key: "prixVenteTTC" },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openModal(record)}
          />
          <Popconfirm
            title="Confirmer la suppression ?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
      width: 100,
    },
  ];

  return (
    <>
    <Card title="Catalogue Remorques">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div style={style}>
          <Space>
            <Search
              allowClear
              placeholder="Rechercher"
              onSearch={handleSearch}
              style={{ width: 600 }} 
              enterButton={<SearchOutlined />}
            />
            <Button
              icon={<PlusCircleOutlined />}
              type="primary"
              onClick={() => openModal()}
            / >
            {loading && <Spin />}
          </Space>
          </div>
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={remorques}
            loading={loading}
            pagination={{ pageSize: 10 }}
            bordered
          />
        </Col>
      </Row>
      <Modal
        open={modalVisible}
        title={editingRemorque ? "Modifier une remorque" : "Ajouter une remorque"}
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
          initialValues={defaultRemorque}
          onValuesChange={onValuesChange}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="marque"
                label="Marque"
                rules={[{ required: true, message: "Champ requis" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="modele"
                label="Modèle"
                rules={[{ required: true, message: "Champ requis" }]}
              >
                <Input />
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
          <Form.Item name="evaluation" label="Évaluation">
            <Rate allowHalf />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ptac" label="PTAC">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="kg"/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="chargeAVide" label="Charge à vide">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="kg"  />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="chargeUtile" label="Charge utile">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="kg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="longueur" label="Longueur">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="largeur" label="Largeur">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="longueurMaxBateau" label="Long. Max. Bateau">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="largeurMaxBateau" label="Larg. Max. Bateau"> 
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="fleche" label="Flèche">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="typeChassis" label="Type de châssis">
                <Select options={typeChassisList} allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="roues" label="Roues">
                <Select options={rouesList} allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="equipement" label="Équipement">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="emplacement" label="Emplacement">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="stock" label="Stock">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="stockAlerte" label="Stock alerte">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prixPublic" label="Prix public">
                <InputNumber min={0} style={{ width: "100%" }} step={100} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="frais" label="Frais">
                <InputNumber min={0} style={{ width: "100%" }} step={10} addonAfter="€" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tauxMarge" label="Taux de marge">
                <InputNumber min={0} max={100} style={{ width: "100%" }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tauxMarque" label="Taux de marque">
                <InputNumber min={0} max={100} style={{ width: "100%" }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prixVenteHT" label="Prix Vente HT">
                <InputNumber min={0} style={{ width: "100%" }} step={100} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tva" label="TVA">
                <InputNumber min={0} max={100} style={{ width: "100%" }} step={1} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="montantTVA" label="Montant TVA">
                <InputNumber min={0} style={{ width: "100%" }} step={1} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prixVenteTTC" label="Prix Vente TTC">
                <InputNumber min={0} style={{ width: "100%" }} step={100} addonAfter="€" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {editingRemorque && editingRemorque.id && (
          <FournisseurRemorques remorqueId={editingRemorque.id} />
        )}
      </Modal>
    </Card>
    </>
  );
};

export default RemorqueCatalogue;
