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

type Produit = {
  id: number;
  nom: string;
  marque?: string;
  categorie?: string;
};

type FournisseurProduit = {
  id?: number;
  fournisseur: Fournisseur;
  produit: Produit;
  prixAchatHT?: number;
  tva?: number;
  montantTVA?: number;
  prixAchatTTC?: number;
  portForfaitaire?: number;
  portParUnite?: number;
  nombreMinACommander?: number;
  delaiLivraison?: string;
  referenceFournisseur?: string;
  notes?: string;
};

const defaultFournisseurProduit: Partial<FournisseurProduit> = {
  prixAchatHT: 0,
  tva: 20,
  montantTVA: 0,
  prixAchatTTC: 0,
  portForfaitaire: 0,
  portParUnite: 0,
  nombreMinACommander: 1,
  delaiLivraison: "",
  referenceFournisseur: "",
  notes: "",
};

const FournisseurProduits = ({
  fournisseurId,
  produitId,
}: {
  fournisseurId?: number;
  produitId?: number;
}) => {
  const [associes, setAssocies] = useState<FournisseurProduit[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurProduit> | null>(null);
  const [form] = Form.useForm();

  const isProduitMode = !!produitId;
  const isFournisseurMode = !!fournisseurId;

  const fetchAssocies = async () => {
    setLoading(true);
    try {
      let url = "";
      if (isProduitMode && produitId) {
        url = `/catalogue/produits/${produitId}/fournisseurs`;
      } else if (isFournisseurMode && fournisseurId) {
        url = `/fournisseur-produit/fournisseur/${fournisseurId}/produits`;
      }
      if (url) {
        const { data } = await axios.get(url);
        setAssocies(data);
      }
    } catch {
      message.error("Erreur lors du chargement des associations");
    } finally {
      setLoading(false);
    }
  };

  const fetchProduits = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/catalogue/produits");
      setProduits(data);
    } catch {
      message.error("Erreur lors du chargement des produits catalogue");
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
    if (fournisseurId || produitId) {
      fetchAssocies();
      if (isProduitMode) {
        fetchFournisseurs();
      } else {
        fetchProduits();
      }
    }
  }, [fournisseurId, produitId]);

  // Add
  const handleNew = () => {
    setEditing({
      ...defaultFournisseurProduit,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      produit: isProduitMode ? { id: produitId!, nom: "" } : undefined,
    });
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  // Edit
  const handleEdit = (record: FournisseurProduit) => {
    setEditing({ ...record, produit: { ...record.produit }, fournisseur: { ...record.fournisseur } });
    setModalVisible(true);
    setTimeout(() => {
      if (isProduitMode) {
        form.setFieldsValue({ ...record, fournisseurId: record.fournisseur.id });
      } else {
        form.setFieldsValue({ ...record, produitId: record.produit.id });
      }
    });
  };

  // Delete
  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await axios.delete(`/fournisseur-produit/${id}`);
      message.success("Supprimé avec succès");
      fetchAssocies();
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
      let body: FournisseurProduit;

      if (isProduitMode) {
        let selectedFournisseur = fournisseurs.find((f) => f.id === values.fournisseurId);
        body = {
          ...editing,
          ...values,
          fournisseur: selectedFournisseur!,
          produit: { id: produitId!, nom: "" },
        };
      } else {
        let selectedProduit = produits.find((p) => p.id === values.produitId);
        body = {
          ...editing,
          ...values,
          produit: selectedProduit!,
          fournisseur: { id: fournisseurId!, nom: "" },
        };
      }

      setLoading(true);

      if (editing && editing.id) {
        // update
        const res = await axios.put(`/fournisseur-produit/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        // create
        const res = await axios.post("/fournisseur-produit", body);
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
    ...(isProduitMode
      ? [
          {
            title: "Fournisseur",
            dataIndex: ["fournisseur", "id"],
            key: "fournisseur",
            sorter: (a, b) => a.fournisseur.nom.localeCompare(b.fournisseur.nom),
            filters: fournisseurs.map((f) => ({ text: f.nom, value: f.id })),
            onFilter: (value, record) => record.fournisseur.id === value,
            render: (_: any, record: FournisseurProduit) => <span>{record.fournisseur.nom}</span>,
          },
        ]
      : [
          {
            title: "Produit",
            dataIndex: ["produit", "id"],
            key: "produit",
            sorter: (a, b) => a.produit.nom.localeCompare(b.produit.nom),
            filters: produits.map((p) => ({ text: p.nom, value: p.id })),
            onFilter: (value, record) => record.produit.id === value,
            render: (_: any, record: FournisseurProduit) => (
              <span>
                {record.produit.nom}
                {record.produit.marque ? ` (${record.produit.marque})` : ""}
              </span>
            ),
          },
        ]),
    { title: "Prix Achat HT", dataIndex: "prixAchatHT", key: "prixAchatHT", sorter: (a, b) => a.prixAchatHT - b.prixAchatHT },
    { title: "TVA (%)", dataIndex: "tva", key: "tva", sorter: (a, b) => (a.tva ?? 0) - (b.tva ?? 0) },
    { title: "Montant TVA", dataIndex: "montantTVA", key: "montantTVA", sorter: (a, b) => (a.montantTVA ?? 0) - (b.montantTVA ?? 0) },
    { title: "Prix Achat TTC", dataIndex: "prixAchatTTC", key: "prixAchatTTC", sorter: (a, b) => (a.prixAchatTTC ?? 0) - (b.prixAchatTTC ?? 0) },
    { title: "Port forfaitaire", dataIndex: "portForfaitaire", key: "portForfaitaire", sorter: (a, b) => (a.portForfaitaire ?? 0) - (b.portForfaitaire ?? 0) },
    { title: "Port/unité", dataIndex: "portParUnite", key: "portParUnite", sorter: (a, b) => (a.portParUnite ?? 0) - (b.portParUnite ?? 0) },
    { title: "Qte min. commande", dataIndex: "nombreMinACommander", key: "nombreMinACommander", sorter: (a, b) => (a.nombreMinACommander ?? 1) - (b.nombreMinACommander ?? 1) },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: FournisseurProduit) => (
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
      title={isProduitMode ? "Fournisseurs pour ce produit" : "Catalogue Produits"}
      extra={
        <Button type="primary" icon={<ShrinkOutlined />} onClick={handleNew}>
          {isProduitMode ? "Associer un fournisseur" : "Associer un produit"}
        </Button>
      }
      style={{ marginTop: 24 }}
    >
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={associes}
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
            : isProduitMode
            ? "Associer un Fournisseur"
            : "Associer un Produit"
        }
        okText="Enregistrer"
        cancelText="Annuler"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurProduit}
          onValuesChange={(changed, all) => {
            // Compute montantTVA et TTC dynamiquement
            if ("prixAchatHT" in changed || "tva" in changed) {
              let prixAchatHT = all.prixAchatHT ?? 0;
              let tva = all.tva ?? 20;
              let montantTVA = prixAchatHT * (tva / 100);
              let prixAchatTTC = prixAchatHT + montantTVA;
              form.setFieldsValue({ montantTVA, prixAchatTTC });
            }
          }}
        >
          {isProduitMode ? (
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
              label="Produit catalogue"
              name="produitId"
              rules={[{ required: true, message: "Sélectionnez un produit du catalogue" }]}
            >
              <Select
                showSearch
                placeholder="Choisissez un produit"
                optionFilterProp="children"
                filterOption={(input, option: any) =>
                  `${option.children}`.toLowerCase().includes(input.toLowerCase())
                }
                disabled={!!(editing && editing.id)}
              >
                {produits.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.nom}
                    {p.marque ? ` (${p.marque})` : ""}
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
                  { required: true, type: "number", message: "Quantité min. requise" },
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
          <Form.Item label="Délai de livraison" name="delaiLivraison">
            <Input />
          </Form.Item>
          <Form.Item label="Référence Fournisseur" name="referenceFournisseur">
            <Input />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default FournisseurProduits;

