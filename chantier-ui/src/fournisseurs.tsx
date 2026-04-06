import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Rate,
  Spin,
  Popconfirm,
  message,
  Row,
  Col,
  Card,
  Select,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import api, { fetchWithAuth } from './api.ts';
import DocumentUpload from "./DocumentUpload.tsx";
import FournisseurBateaux from "./fournisseur-bateaux.tsx";
import FournisseurHelices from "./fournisseur-helices.tsx";
import FournisseurMoteurs from "./fournisseur-moteurs.tsx";
import FournisseurRemorques from "./fournisseur-remorques.tsx";
import FournisseurProduits from "./fournisseur-produits.tsx";
import CommandesFournisseur from "./commandes-fournisseur.tsx";

const style: React.CSSProperties = { padding: '8px 0' };
const { TextArea } = Input;
const { Search } = Input;

type Fournisseur = {
  id?: number;
  nom?: string;
  image?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  evaluation?: number;
  siren?: string;
  siret?: string;
  tva?: string;
  naf?: string;
  connexion?: string;
  documents?: string[];
};

const defaultFournisseur: Fournisseur = {
  nom: "",
  image: "",
  email: "",
  telephone: "",
  adresse: "",
  evaluation: 0,
  siren: "",
  siret: "",
  tva: "",
  naf: "",
  connexion: "",
  documents: [],
};

const Fournisseurs = () => {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editing, setEditing] = useState<Fournisseur | null>(null);
  const [form] = Form.useForm();
  const [formDirty, setFormDirty] = useState(false);

  // Fetch list
  const fetchFournisseurs = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/catalogue/fournisseurs");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      setFournisseurs(await res.json());
    } catch {
      message.error("Erreur lors du chargement des fournisseurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFournisseurs();
  }, []);

  const handleNew = () => {
    setEditing(null);
    form.resetFields();
    setFormDirty(false);
    setModalVisible(true);
  };

  const handleEdit = (record: Fournisseur) => {
    setEditing(record);
    form.setFieldsValue(record);
    setFormDirty(false);
    setModalVisible(true);
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

  const handleDelete = async (id?: number) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/catalogue/fournisseurs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      message.success("Fournisseur supprimé");
      fetchFournisseurs();
    } catch {
      message.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (editing) {
        // Update
        const res = await fetchWithAuth(`/catalogue/fournisseurs/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...editing, ...values }),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        message.success("Fournisseur modifié");
        setFormDirty(false);
        setEditing(updated);
        form.setFieldsValue(updated);
      } else {
        // Create
        const res = await fetchWithAuth("/catalogue/fournisseurs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        message.success("Fournisseur créé");
        setFormDirty(false);
        setEditing(created);
        form.setFieldsValue(created);
      }
      fetchFournisseurs();
    } catch (e: any) {
      if (e.errorFields) return; // Validation error
      message.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    setLoading(true);
    try {
      const response = await api.get("/catalogue/fournisseurs/search", { params: { q: value } });
      setFournisseurs(response.data);
    } catch {
      message.error("Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Nom", dataIndex: "nom", key: "nom",
      sorter: (a, b) => (a.nom || "").localeCompare(b.nom || ""),
    },
    {
      title: "Évaluation",
      dataIndex: "evaluation",
      key: "evaluation",
      render: (val: number) => <Rate allowHalf value={val} disabled style={{ fontSize: 14 }} />,
      width: 120,
      sorter: (a, b) => a.evaluation - b.evaluation,
    },
    { title: "Email", dataIndex: "email", key: "email", sorter: (a, b) => (a.email || "").localeCompare(b.email || "") },
    { title: "Téléphone", dataIndex: "telephone", key: "telephone", sorter: (a, b) => (a.telephone || "").localeCompare(b.telephone || "") },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: Fournisseur) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Confirmer la suppression ?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
            />
          </Popconfirm>
        </Space>
      ),
      width: 120,
    },
  ];

  return (
    <>
      <Card title="Fournisseurs">
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={style}>
              <Space>
                <Search allowClear placeholder="Rechercher" enterButton={<SearchOutlined />} style={{ width: 600 }} onSearch={handleSearch} />
                <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleNew} />
              </Space>
            </div>
          </Col>
        </Row>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Table rowKey="id" columns={columns} dataSource={fournisseurs} loading={loading} bordered pagination={{ pageSize: 10 }} />
          </Col>
        </Row>
      </Card>
      <Modal
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleModalOk}
        destroyOnHidden
        title={editing ? "Modifier Fournisseur" : "Nouveau Fournisseur"}
        okText="Enregistrer"
        cancelText="Fermer"
        width={1024}
        maskClosable={false}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={defaultFournisseur}
          onValuesChange={() => setFormDirty(true)}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Nom"
                name="nom"
                rules={[{ required: true, message: "Champ requis" }]}
              >
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
          <Form.Item label="Documents" name="documents">
            <DocumentUpload />
          </Form.Item>
        </Form>
        {editing && <FournisseurBateaux fournisseurId={editing.id!} />}
        {editing && <FournisseurMoteurs fournisseurId={editing.id!} />}
        {editing && <FournisseurHelices fournisseurId={editing.id!} />}
        {editing && <FournisseurRemorques fournisseurId={editing.id!} />}
        {editing && <FournisseurProduits fournisseurId={editing.id!} />}
        {editing && <CommandesFournisseur fournisseurId={editing.id!} />}
      </Modal>
    </>
  );
};

export default Fournisseurs;
