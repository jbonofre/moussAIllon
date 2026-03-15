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
  ShrinkOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Option } = Select;

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
  const [moteursAssocies, setMoteursAssocies] = useState<FournisseurMoteur[]>([]);
  const [moteursCatalogue, setMoteursCatalogue] = useState<Moteur[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurMoteur> | null>(null);
  const [form] = Form.useForm();

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
        const { data } = await axios.get(url);
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
      const { data } = await axios.get("/catalogue/moteurs");
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
      const { data } = await axios.get("/catalogue/fournisseurs");
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

  // Create
  const handleNew = () => {
    setEditing({
      ...defaultFournisseurMoteur,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      moteur: isMoteurMode ? { id: moteurId!, marque: "", modele: "" } : undefined,
    });
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  // Edit
  const handleEdit = (record: FournisseurMoteur) => {
    setEditing({ ...record, moteur: { ...record.moteur }, fournisseur: { ...record.fournisseur } });
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
      await axios.delete(`/fournisseur-moteur/${id}`);
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
        const res = await axios.put(`/fournisseur-moteur/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        const res = await axios.post("/fournisseur-moteur", body);
        message.success("Ajouté avec succès");
        setEditing(res.data);
      }
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
            dataIndex: ["fournisseur", "id"],
            key: "fournisseur",
            sorter: (a, b) =>
              a.fournisseur.nom.localeCompare(b.fournisseur.nom),
            filters: fournisseurs.map((f) => ({ text: f.nom, value: f.id })),
            onFilter: (value, record) => record.fournisseur.id === value,
            render: (_: any, record: FournisseurMoteur) => (
              <span>{record.fournisseur.nom}</span>
            ),
          },
        ]
      : [
          {
            title: "Moteur",
            dataIndex: ["moteur", "id"],
            key: "moteur",
            sorter: (a, b) =>
              (a.moteur.marque + a.moteur.modele).localeCompare(
                b.moteur.marque + b.moteur.modele
              ),
            filters: moteursCatalogue.map((m) => ({
              text: `${m.marque} ${m.modele}`,
              value: m.id,
            })),
            onFilter: (value, record) => record.moteur.id === value,
            render: (_: any, record: FournisseurMoteur) => (
              <span>
                {record.moteur.marque} {record.moteur.modele}
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
        onCancel={() => setModalVisible(false)}
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
        cancelText="Annuler"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurMoteur}
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
          {isMoteurMode ? (
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
              label="Moteur catalogue"
              name="moteurId"
              rules={[{ required: true, message: "Sélectionnez un moteur du catalogue" }]}
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
    </Card>
  );
};

export default FournisseurMoteurs;
