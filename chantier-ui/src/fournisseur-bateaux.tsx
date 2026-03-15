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
}

type Bateau = {
  id: number;
  marque: string;
  modele: string;
};

type FournisseurBateau = {
  id?: number;
  fournisseur: Fournisseur;
  bateau: Bateau;
  prixAchatHT?: number;
  tva?: number;
  montantTVA?: number;
  prixAchatTTC?: number;
  portForfaitaire?: number;
  portParUnite?: number;
  nombreMinACommander?: number;
  notes?: string;
}

const defaultFournisseurBateau: Partial<FournisseurBateau> = {
  prixAchatHT: 0,
  tva: 20,
  montantTVA: 0,
  prixAchatTTC: 0,
  portForfaitaire: 0,
  portParUnite: 0,
  nombreMinACommander: 1,
  notes: "",
};

const FournisseurBateaux = ({ fournisseurId, bateauId }: { fournisseurId?: number; bateauId?: number }) => {
  const [bateauxAssocies, setBateauxAssocies] = useState<FournisseurBateau[]>([]);
  const [bateauxCatalogue, setBateauxCatalogue] = useState<Bateau[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurBateau> | null>(null);
  const [form] = Form.useForm();

  const isBateauMode = !!bateauId;
  const isFournisseurMode = !!fournisseurId;

  // Fetch all association entries for this fournisseur or bateau
  const fetchAssocies = async () => {
    setLoading(true);
    try {
      let url = '';
      if (isBateauMode && bateauId) {
        url = `/fournisseur-bateau/search?bateauId=${bateauId}`;
      } else if (isFournisseurMode && fournisseurId) {
        url = `/fournisseur-bateau/fournisseur/${fournisseurId}`;
      }
      if (url) {
        const { data } = await axios.get(url);
        setBateauxAssocies(data);
      }
    } catch {
      message.error("Erreur lors du chargement des associations");
    } finally {
      setLoading(false);
    }
  };

  const fetchBateauxCatalogue = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/catalogue/bateaux");
      setBateauxCatalogue(data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de bateaux");
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
    if (fournisseurId || bateauId) {
      fetchAssocies();
      if (isBateauMode) {
        fetchFournisseurs();
      } else {
        fetchBateauxCatalogue();
      }
    }
  }, [fournisseurId, bateauId]);

  // Add
  const handleNew = () => {
    setEditing({
      ...defaultFournisseurBateau,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      bateau: isBateauMode ? { id: bateauId!, marque: "", modele: "" } : undefined,
    });
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  // Edit
  const handleEdit = (record: FournisseurBateau) => {
    setEditing({ ...record, bateau: { ...record.bateau }, fournisseur: { ...record.fournisseur } });
    setModalVisible(true);
    setTimeout(() => {
      if (isBateauMode) {
        form.setFieldsValue({ ...record, fournisseurId: record.fournisseur.id });
      } else {
        form.setFieldsValue({ ...record, bateauId: record.bateau.id });
      }
    });
  };

  // Delete
  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await axios.delete(`/fournisseur-bateau/${id}`);
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
      let body: FournisseurBateau;
      
      if (isBateauMode) {
        let selectedFournisseur = fournisseurs.find((f) => f.id === values.fournisseurId);
        body = {
          ...editing,
          ...values,
          fournisseur: selectedFournisseur!,
          bateau: { id: bateauId!, marque: "", modele: "" },
        };
      } else {
        let selectedBateau = bateauxCatalogue.find((b) => b.id === values.bateauId);
        body = {
          ...editing,
          ...values,
          bateau: selectedBateau!,
          fournisseur: { id: fournisseurId!, nom: "" },
        };
      }
      
      setLoading(true);

      if (editing && editing.id) {
        // update
        const res = await axios.put(`/fournisseur-bateau/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        // create
        const res = await axios.post("/fournisseur-bateau", body);
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
    ...(isBateauMode ? [{
      title: "Fournisseur",
      dataIndex: ["fournisseur", "id"],
      key: "fournisseur",
      sorter: (a, b) => a.fournisseur.nom.localeCompare(b.fournisseur.nom),
      filters: fournisseurs.map(f => ({ text: f.nom, value: f.id })),
      onFilter: (value, record) => record.fournisseur.id === value,
      render: (_: any, record: FournisseurBateau) =>
        <span>{record.fournisseur.nom}</span>
    }] : [{
      title: "Bateau",
      dataIndex: ["bateau", "id"],
      key: "bateau",
      sorter: (a, b) => a.bateau.marque.localeCompare(b.bateau.marque) + a.bateau.modele.localeCompare(b.bateau.modele),
      filters: bateauxCatalogue.map(b => ({ text: b.marque + " " + b.modele, value: b.id })),
      onFilter: (value, record) => record.bateau.id === value,
      render: (_: any, record: FournisseurBateau) =>
        <span>{record.bateau.marque} {record.bateau.modele}</span>
    }]),
    { title: "Prix Achat HT", dataIndex: "prixAchatHT", key: "prixAchatHT", sorter: (a, b) => a.prixAchatHT - b.prixAchatHT },
    { title: "TVA (%)", dataIndex: "tva", key: "tva", sorter: (a, b) => a.tva - b.tva },
    { title: "Montant TVA", dataIndex: "montantTVA", key: "montantTVA", sorter: (a, b) => a.montantTVA - b.montantTVA },
    { title: "Prix Achat TTC", dataIndex: "prixAchatTTC", key: "prixAchatTTC", sorter: (a, b) => a.prixAchatTTC - b.prixAchatTTC },
    { title: "Port forfaitaire", dataIndex: "portForfaitaire", key: "portForfaitaire", sorter: (a, b) => a.portForfaitaire - b.portForfaitaire },
    { title: "Port/unité", dataIndex: "portParUnite", key: "portParUnite", sorter: (a, b) => a.portParUnite - b.portParUnite },
    { title: "Qte min. commande", dataIndex: "nombreMinACommander", key: "nombreMinACommander", sorter: (a, b) => a.nombreMinACommander - b.nombreMinACommander },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: FournisseurBateau) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" />
          <Popconfirm title="Confirmer la suppression ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 110,
    }
  ];

  return (
    <Card
      title={isBateauMode ? "Fournisseurs pour ce bateau" : "Catalogue Bateaux"}
      extra={<Button type="primary" icon={<ShrinkOutlined />} onClick={handleNew}>
        {isBateauMode ? "Associer un fournisseur" : "Associer un bateau"}
      </Button>}
      style={{ marginTop: 24 }}
    >
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={bateauxAssocies}
          bordered
          pagination={{ pageSize: 10 }}
        />
      </Spin>

      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalOk}
        destroyOnHidden
        title={editing && editing.id ? "Modifier l'association" : (isBateauMode ? "Associer un Fournisseur" : "Associer un Bateau")}
        okText="Enregistrer"
        cancelText="Annuler"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurBateau}
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
          {isBateauMode ? (
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
                {fournisseurs.map(f => (
                  <Option key={f.id} value={f.id}>
                    {f.nom}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item
              label="Bateau catalogue"
              name="bateauId"
              rules={[{ required: true, message: "Sélectionnez un bateau du catalogue" }]}
            >
              <Select
                showSearch
                placeholder="Choisissez un bateau"
                optionFilterProp="children"
                filterOption={(input, option: any) =>
                  `${option.children}`.toLowerCase().includes(input.toLowerCase())
                }
                disabled={!!(editing && editing.id)}
              >
                {bateauxCatalogue.map(b => (
                  <Option key={b.id} value={b.id}>
                    {b.marque} {b.modele}
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
    </Card>
  );
};

export default FournisseurBateaux;
