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
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  SaveOutlined,
  SearchOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Option } = Select;

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
  const [editing, setEditing] = useState<Partial<FournisseurHelice> | null>(null);
  const [form] = Form.useForm();

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
        const { data } = await axios.get(url);
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
      const { data } = await axios.get("/catalogue/helices");
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
      const { data } = await axios.get("/catalogue/fournisseurs");
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

  // Add
  const handleNew = () => {
    setEditing({
      ...defaultFournisseurHelice,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      helice: isHeliceMode ? { id: heliceId!, marque: "", modele: "" } : undefined,
    });
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
      await axios.delete(`/fournisseur-helice/${id}`);
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
        const res = await axios.put(`/fournisseur-helice/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        // create
        const res = await axios.post("/fournisseur-helice", body);
        message.success("Ajouté avec succès");
        setEditing(res.data);
      }
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
            dataIndex: ["fournisseur", "id"],
            key: "fournisseur",
            sorter: (a, b) => (a.fournisseur.nom || "").localeCompare(b.fournisseur.nom || ""),
            filters: fournisseurs.map((f) => ({ text: f.nom, value: f.id })),
            onFilter: (value, record) => record.fournisseur.id === value,
            render: (_: any, record: FournisseurHelice) => <span>{record.fournisseur.nom}</span>,
          },
        ]
      : [
          {
            title: "Hélice",
            dataIndex: ["helice", "id"],
            key: "helice",
            sorter: (a, b) => {
              let marque = a.helice?.marque?.localeCompare(b.helice?.marque || "") || 0;
              let modele = a.helice?.modele?.localeCompare(b.helice?.modele || "") || 0;
              return marque !== 0 ? marque : modele;
            },
            filters: helicesCatalogue.map((h) => ({
              text: `${h.marque} ${h.modele}`,
              value: h.id,
            })),
            onFilter: (value, record) => record.helice.id === value,
            render: (_: any, record: FournisseurHelice) => (
              <span>
                {record.helice.marque} {record.helice.modele}
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
        onCancel={() => setModalVisible(false)}
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
        cancelText="Annuler"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurHelice}
          onValuesChange={(changed, all) => {
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
            <Form.Item
              label="Fournisseur"
              name="fournisseurId"
              rules={[{ required: true, message: "Sélectionnez un fournisseur" }]}
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
          ) : (
            <Form.Item
              label="Hélice catalogue"
              name="heliceId"
              rules={[{ required: true, message: "Sélectionnez une hélice du catalogue" }]}
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
    </Card>
  );
};

export default FournisseurHelices;

