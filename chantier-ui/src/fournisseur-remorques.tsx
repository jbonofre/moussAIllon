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
} from "antd";

const { TextArea } = Input;
import {
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import api from "./api.ts";

const { Option } = Select;

const typeChassisList = [
  { label: "Standard", value: "Standard" },
  { label: "Renforcé", value: "Renforcé" },
];

const rouesList = [
  { label: "Simple", value: "Simple" },
  { label: "Double", value: "Double" },
];

const defaultRemorqueCatalogue = {
  modele: "",
  marque: "",
  description: "",
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

type Fournisseur = {
  id: number;
  nom: string;
};

type Remorque = {
  id: number;
  marque: string;
  modele: string;
};

type FournisseurRemorque = {
  id?: number;
  fournisseur: Fournisseur;
  remorque: Remorque;
  prixAchatHT?: number;
  tva?: number;
  montantTVA?: number;
  prixAchatTTC?: number;
  portForfaitaire?: number;
  portParUnite?: number;
  nombreMinACommander?: number;
  notes?: string;
};

const defaultFournisseurRemorque: Partial<FournisseurRemorque> = {
  prixAchatHT: 0,
  tva: 20,
  montantTVA: 0,
  prixAchatTTC: 0,
  portForfaitaire: 0,
  portParUnite: 0,
  nombreMinACommander: 1,
  notes: "",
};

const FournisseurRemorques = ({
  fournisseurId,
  remorqueId,
}: {
  fournisseurId?: number;
  remorqueId?: number;
}) => {
  const [remorquesAssocies, setRemorquesAssocies] = useState<FournisseurRemorque[]>([]);
  const [remorquesCatalogue, setRemorquesCatalogue] = useState<Remorque[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurRemorque> | null>(null);
  const [form] = Form.useForm();
  const [fournisseurModalVisible, setFournisseurModalVisible] = useState(false);
  const [fournisseurForm] = Form.useForm();
  const [remorqueModalVisible, setRemorqueModalVisible] = useState(false);
  const [remorqueForm] = Form.useForm();

  const isRemorqueMode = !!remorqueId;
  const isFournisseurMode = !!fournisseurId;

  const fetchAssocies = async () => {
    setLoading(true);
    try {
      let url = "";
      if (isRemorqueMode && remorqueId) {
        url = `/fournisseur-remorque/search?remorqueId=${remorqueId}`;
      } else if (isFournisseurMode && fournisseurId) {
        url = `/fournisseur-remorque/fournisseur/${fournisseurId}`;
      }
      if (url) {
        const { data } = await api.get(url);
        setRemorquesAssocies(data);
      }
    } catch {
      message.error("Erreur lors du chargement des associations");
    } finally {
      setLoading(false);
    }
  };

  const fetchRemorquesCatalogue = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/catalogue/remorques");
      setRemorquesCatalogue(data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de remorques");
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
    if (fournisseurId || remorqueId) {
      fetchAssocies();
      if (isRemorqueMode) {
        fetchFournisseurs();
      } else {
        fetchRemorquesCatalogue();
      }
    }
  }, [fournisseurId, remorqueId]);

  const handleRemorqueAdd = async () => {
    try {
      const values = await remorqueForm.validateFields();
      const res = await api.post("/catalogue/remorques", values);
      message.success("Remorque créée");
      setRemorqueModalVisible(false);
      remorqueForm.resetFields();
      await fetchRemorquesCatalogue();
      form.setFieldsValue({ remorqueId: res.data.id });
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la création de la remorque");
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

  const handleNew = () => {
    setEditing({
      ...defaultFournisseurRemorque,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      remorque: isRemorqueMode ? { id: remorqueId!, marque: "", modele: "" } : undefined,
    });
    setFormDirty(false);
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  const handleEdit = (record: FournisseurRemorque) => {
    setEditing({
      ...record,
      remorque: { ...record.remorque },
      fournisseur: { ...record.fournisseur },
    });
    setFormDirty(false);
    setModalVisible(true);
    setTimeout(() => {
      if (isRemorqueMode) {
        form.setFieldsValue({ ...record, fournisseurId: record.fournisseur.id });
      } else {
        form.setFieldsValue({ ...record, remorqueId: record.remorque.id });
      }
    });
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`/fournisseur-remorque/${id}`);
      message.success("Supprimé avec succès");
      fetchAssocies();
    } catch {
      message.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      let body: FournisseurRemorque;

      if (isRemorqueMode) {
        const selectedFournisseur = fournisseurs.find((f) => f.id === values.fournisseurId);
        body = {
          ...editing,
          ...values,
          fournisseur: selectedFournisseur!,
          remorque: { id: remorqueId!, marque: "", modele: "" },
        };
      } else {
        const selectedRemorque = remorquesCatalogue.find((r) => r.id === values.remorqueId);
        body = {
          ...editing,
          ...values,
          remorque: selectedRemorque!,
          fournisseur: { id: fournisseurId!, nom: "" },
        };
      }

      setLoading(true);

      if (editing && editing.id) {
        const res = await api.put(`/fournisseur-remorque/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        const res = await api.post("/fournisseur-remorque", body);
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
    ...(isRemorqueMode
      ? [
          {
            title: "Fournisseur",
            key: "fournisseur",
            sorter: (a: FournisseurRemorque, b: FournisseurRemorque) =>
              (a.fournisseur?.nom || "").localeCompare(b.fournisseur?.nom || ""),
            filters: fournisseurs.map((f) => ({ text: f.nom, value: f.id })),
            onFilter: (value: any, record: FournisseurRemorque) => record.fournisseur?.id === value,
            render: (_: any, record: FournisseurRemorque) => <span>{record.fournisseur?.nom || "-"}</span>,
          },
        ]
      : [
          {
            title: "Remorque",
            key: "remorque",
            sorter: (a: FournisseurRemorque, b: FournisseurRemorque) =>
              ((a.remorque?.marque || "") + " " + (a.remorque?.modele || "")).localeCompare(
                (b.remorque?.marque || "") + " " + (b.remorque?.modele || "")
              ),
            filters: remorquesCatalogue.map((r) => ({
              text: r.marque + " " + r.modele,
              value: r.id,
            })),
            onFilter: (value: any, record: FournisseurRemorque) => record.remorque?.id === value,
            render: (_: any, record: FournisseurRemorque) => (
              <span>
                {record.remorque?.marque || "-"} {record.remorque?.modele || ""}
              </span>
            ),
          },
        ]),
    { title: "Prix Achat HT", dataIndex: "prixAchatHT", key: "prixAchatHT", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.prixAchatHT ?? 0) - (b.prixAchatHT ?? 0) },
    { title: "TVA (%)", dataIndex: "tva", key: "tva", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.tva ?? 0) - (b.tva ?? 0) },
    { title: "Montant TVA", dataIndex: "montantTVA", key: "montantTVA", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.montantTVA ?? 0) - (b.montantTVA ?? 0) },
    { title: "Prix Achat TTC", dataIndex: "prixAchatTTC", key: "prixAchatTTC", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.prixAchatTTC ?? 0) - (b.prixAchatTTC ?? 0) },
    { title: "Port forfaitaire", dataIndex: "portForfaitaire", key: "portForfaitaire", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.portForfaitaire ?? 0) - (b.portForfaitaire ?? 0) },
    { title: "Port/unité", dataIndex: "portParUnite", key: "portParUnite", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.portParUnite ?? 0) - (b.portParUnite ?? 0) },
    { title: "Qte min. commande", dataIndex: "nombreMinACommander", key: "nombreMinACommander", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.nombreMinACommander ?? 0) - (b.nombreMinACommander ?? 0) },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: FournisseurRemorque) => (
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
      title={isRemorqueMode ? "Fournisseurs pour cette remorque" : "Catalogue Remorques"}
      extra={
        <Button type="primary" icon={<ShrinkOutlined />} onClick={handleNew}>
          {isRemorqueMode ? "Associer un fournisseur" : "Associer une remorque"}
        </Button>
      }
      style={{ marginTop: 24 }}
    >
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={remorquesAssocies}
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
            : isRemorqueMode
            ? "Associer un Fournisseur"
            : "Associer une Remorque"
        }
        okText="Enregistrer"
        cancelText="Fermer"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurRemorque}
          onValuesChange={(changed, all) => {
            setFormDirty(true);
            if ("prixAchatHT" in changed || "tva" in changed) {
              let prixAchatHT = all.prixAchatHT ?? 0;
              let tva = all.tva ?? 20;
              let montantTVA = prixAchatHT * (tva / 100);
              let prixAchatTTC = prixAchatHT + montantTVA;
              form.setFieldsValue({ montantTVA, prixAchatTTC });
            }
          }}
        >
          {isRemorqueMode ? (
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
            <Form.Item label="Remorque catalogue" style={{ marginBottom: 0 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="remorqueId"
                  rules={[{ required: true, message: "Sélectionnez une remorque du catalogue" }]}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <Select
                    showSearch
                    placeholder="Choisissez une remorque"
                    optionFilterProp="children"
                    filterOption={(input, option: any) =>
                      `${option.children}`.toLowerCase().includes(input.toLowerCase())
                    }
                    disabled={!!(editing && editing.id)}
                  >
                    {remorquesCatalogue.map((r) => (
                      <Option key={r.id} value={r.id}>
                        {r.marque} {r.modele}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    remorqueForm.resetFields();
                    setRemorqueModalVisible(true);
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
                rules={[{ required: true, type: "number", message: "Quantité min. requise" }]}
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
        open={remorqueModalVisible}
        title="Nouvelle Remorque"
        onCancel={() => setRemorqueModalVisible(false)}
        onOk={handleRemorqueAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
        maskClosable={false}
      >
        <Form
          layout="vertical"
          form={remorqueForm}
          initialValues={defaultRemorqueCatalogue}
          onValuesChange={(changed, all) => {
            const toNumber = (v: unknown, fb = 0) => { const p = Number(v); return Number.isFinite(p) ? p : fb; };
            const roundAmount = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
            const hasChanged = (key: string) => Object.prototype.hasOwnProperty.call(changed, key);
            const currentTva = toNumber(all.tva, 20);
            const currentHT = toNumber(all.prixVenteHT, 0);
            const currentTTC = toNumber(all.prixVenteTTC, 0);
            const currentMontantTVA = toNumber(all.montantTVA, 0);

            if (hasChanged("prixVenteHT") || hasChanged("tva")) {
              const montantTVA = roundAmount(currentHT * (currentTva / 100));
              const prixVenteTTC = roundAmount(currentHT + montantTVA);
              remorqueForm.setFieldsValue({ montantTVA, prixVenteTTC });
            } else if (hasChanged("prixVenteTTC")) {
              const montantTVA = roundAmount((currentTTC / (100 + currentTva)) * currentTva);
              const prixVenteHT = roundAmount(currentTTC - montantTVA);
              remorqueForm.setFieldsValue({ montantTVA, prixVenteHT });
            } else if (hasChanged("montantTVA")) {
              const prixVenteTTC = roundAmount(currentHT + currentMontantTVA);
              remorqueForm.setFieldsValue({ prixVenteTTC });
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="marque" label="Marque" rules={[{ required: true, message: "Champ requis" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="modele" label="Modèle" rules={[{ required: true, message: "Champ requis" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="evaluation" label="Évaluation">
            <Rate allowHalf />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ptac" label="PTAC">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="kg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="chargeAVide" label="Charge à vide">
                <InputNumber min={0} style={{ width: "100%" }} addonAfter="kg" />
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
      </Modal>
    </Card>
  );
};

export default FournisseurRemorques;
