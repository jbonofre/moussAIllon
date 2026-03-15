import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Popconfirm,
  Card,
  Rate,
  Spin,
  Divider,
  Row,
  Col,
  Checkbox,
} from "antd";
import {
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  MailOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import axios from "axios";
import BateauxClients from "./clients-bateaux.tsx";
import ClientsMoteurs from "./clients-moteurs.tsx";
import RemorquesClients from "./clients-remorques.tsx";

const { Option } = Select;
const { Search } = Input;

interface Client {
  id?: number;
  prenom?: string;
  nom: string;
  type: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  consentement?: boolean;
  date?: string;
  evaluation?: number;
  notes?: string;
  remise?: number;
  siren?: string;
  siret?: string;
  tva?: string;
  naf?: string;
}

const defaultClient = {
  prenom: "",
  nom: "",
  type: "PARTICULIER",
  email: "",
  telephone: "",
  adresse: "",
  consentement: false,
  date: "",
  evaluation: 0,
  notes: "",
  remise: 0,
  siren: "",
  siret: "",
  tva: "",
  naf: "",
};

const typeOptions = [
  { value: "PARTICULIER", label: "Particulier" },
  { value: "PROFESSIONNEL", label: "Professionnel" },
  { value: "PROFESSIONNEL_MER", label: "Professionnel de la Mer" },
];

function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [searchNom, setSearchNom] = useState("");
  const [searchType, setSearchType] = useState("");
  const [form] = Form.useForm();

  const fetchClients = async (params: { nom?: string; type?: string } = {}) => {
    setLoading(true);
    try {
      let url = "/clients";
      const searchParams: string[] = [];
      if (params.nom) searchParams.push(`nom=${encodeURIComponent(params.nom)}`);
      if (params.type) searchParams.push(`type=${encodeURIComponent(params.type)}`);
      if (searchParams.length) url += `/search?${searchParams.join("&")}`;
      const res = await axios.get(url);
      setClients(res.data);
    } catch {
      message.error("Erreur lors du chargement des clients");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSearch = () => {
    fetchClients({ nom: searchNom, type: searchType });
  };

  const handleResetSearch = () => {
    setSearchNom("");
    setSearchType("");
    fetchClients();
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    setLoading(true);
    try {
      await axios.delete(`/clients/${id}`);
      message.success("Client supprimé");
      fetchClients();
    } catch {
      message.error("Erreur lors de la suppression");
    }
    setLoading(false);
  };

  const handleSendPassword = async (record: Client) => {
    if (!record.email) {
      message.warning("Ce client n'a pas d'adresse email.");
      return;
    }
    try {
      await axios.post(`/clients/${record.id}/send-password`);
      message.success(`Mot de passe envoye a ${record.email}`);
    } catch {
      message.error("Erreur lors de l'envoi du mot de passe");
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (editing && editing.id) {
        // update
        const res = await axios.put(`/clients/${editing.id}`, values);
        message.success("Client modifié");
        const updated = res.data;
        setEditing(updated);
        form.setFieldsValue(updated);
      } else {
        // create
        const res = await axios.post("/clients", values);
        message.success("Client ajouté");
        const created = res.data;
        setEditing(created);
        form.setFieldsValue(created);
      }
      fetchClients();
    } catch (e) {
      // fields errors managed by antd form, API errors generic
      if (e && e.response) {
        message.error("Erreur lors de la sauvegarde");
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Nom", dataIndex: "nom", key: "nom", sorter: (a, b) => a.nom.localeCompare(b.nom) },
    { title: "Prénom", dataIndex: "prenom", key: "prenom", sorter: (a, b) => a.prenom?.localeCompare(b.prenom || "") },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      filters: [
        { text: "Particulier", value: "PARTICULIER" },
        { text: "Professionnel", value: "PROFESSIONNEL" },
        { text: "Professionnel de la Mer", value: "PROFESSIONNEL_MER" },
      ],
      onFilter: (value, record) => record.type === value,
      render: (type) => (type === "PROFESSIONNEL" ? "Professionnel" : "Particulier"),
    },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Téléphone", dataIndex: "telephone", key: "telephone" },
    {
      title: "Évaluation",
      dataIndex: "evaluation",
      key: "evaluation",
      render: (val) => <Rate disabled value={val || 0} />,
      sorter: (a, b) => (a.evaluation || 0) - (b.evaluation || 0),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm
            title="Generer un mot de passe et l'envoyer par email ?"
            onConfirm={() => handleSendPassword(record)}
            disabled={!record.email}
          >
            <Button
              icon={<MailOutlined />}
              size="small"
              disabled={!record.email}
              title="Envoyer mot de passe"
            />
          </Popconfirm>
          <Popconfirm title="Supprimer ce client ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 160,
    },
  ];

  return (
    <Card title="Clients">
      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="Recherche"
          enterButton
          style={{ width: 600 }}
          allowClear={true}
          onSearch={async (value) => {
            setLoading(true);
            try {
              const response = await axios.get('/clients/search', { params: { q: value } });
              setClients(response.data);
            } catch (error) {
              message.error('Erreur lors de la recherche');
            } finally {
              setLoading(false);
            }
          }}
        />
        <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleAdd} />
      </Space>
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={clients}
          bordered
          pagination={{ pageSize: 10 }}
        />
      </Spin>

      <Modal
        open={modalVisible}
        title={editing ? "Modifier le client" : "Ajouter un client"}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalOk}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={form} initialValues={defaultClient}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Type" name="type" rules={[{ required: true }]}>
                <Select>
                  {typeOptions.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nom" name="nom" rules={[{ required: true, message: "Le nom est requis" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Prénom" name="prenom">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Email" name="email">
                <Input />
              </Form.Item>
              {editing && editing.id && (
                <Popconfirm
                  title="Générer un mot de passe et l'envoyer par email ?"
                  onConfirm={() => handleSendPassword(editing)}
                  disabled={!editing.email}
                >
                  <Button
                    icon={<KeyOutlined />}
                    disabled={!editing.email}
                    size="small"
                    style={{ marginTop: -12 }}
                  >
                    Générer et envoyer le mot de passe par email
                  </Button>
                </Popconfirm>
              )}
              <Form.Item name="consentement" valuePropName="checked" style={{ marginTop: 8 }}>
                <Checkbox>Consentement</Checkbox>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Téléphone" name="telephone">
            <Input style={{ width: "50%" }}/>
          </Form.Item>
          <Form.Item label="Adresse" name="adresse">
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Remise (%)" name="remise" initialValue={0}>
                <Input type="number" min={0} max={100}/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Évaluation" name="evaluation">
                <Rate allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
        {editing && editing.id && (
          <>
            <Divider />
            {/* Affiche la liste des bateaux pour ce client */}
            <BateauxClients clientId={editing.id} />
            <Divider />
            <ClientsMoteurs clientId={editing.id} />
            <Divider />
            <RemorquesClients clientId={editing.id} />
          </>
        )}
      </Modal>
    </Card>
  );
}

export default Clients;
