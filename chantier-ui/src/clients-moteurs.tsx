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
  Spin,
  Row,
  Col,
} from "antd";
import {
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Option } = Select;
const { Search } = Input;

// Minimal typing for MoteurClient
interface MoteurClient {
  id?: number;
  images?: string[];
  numeroSerie?: string;
  numeroClef?: string;
  dateMeS?: string;
  dateAchat?: string;
  dateFinDeGuarantie?: string;
  proprietaire?: any;
  modele?: any;
}

const defaultMoteur: MoteurClient = {
  images: [],
  numeroSerie: "",
  numeroClef: "",
  dateMeS: "",
  dateAchat: "",
  dateFinDeGuarantie: "",
  proprietaire: null,
  modele: null,
};

interface ClientsMoteursProps {
  clientId?: number;
}

const ClientsMoteurs: React.FC<ClientsMoteursProps> = ({ clientId }) => {
  const [moteurs, setMoteurs] = useState<MoteurClient[]>([]);
  const [catalogueMoteurs, setCatalogueMoteurs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<MoteurClient | null>(null);
  const [form] = Form.useForm();

  const fetchMoteurs = async (q = "") => {
    setLoading(true);
    try {
      let url = "/moteurs";
      if (q && q.trim() !== "") {
        url = `/moteurs/search?q=${encodeURIComponent(q)}`;
      }
      const res = await axios.get(url);
      let moteursData = res.data;
      // Filter by clientId if provided
      if (clientId) {
        moteursData = moteursData.filter((moteur: MoteurClient) =>
          moteur.proprietaire && ((moteur.proprietaire.id || moteur.proprietaire) === clientId)
        );
      }
      setMoteurs(moteursData);
    } catch {
      message.error("Erreur lors du chargement des moteurs");
    }
    setLoading(false);
  };

  const fetchCatalogueMoteurs = async () => {
    try {
      const res = await axios.get("/catalogue/moteurs");
      setCatalogueMoteurs(res.data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de moteurs");
      setCatalogueMoteurs([]);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await axios.get("/clients");
      setClients(res.data);
    } catch {
      setClients([]);
    }
  };

  useEffect(() => {
    fetchMoteurs();
    fetchCatalogueMoteurs();
    fetchClients();
    // eslint-disable-next-line
  }, [clientId]);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: MoteurClient) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      modeleId: record.modele?.id || undefined,
      proprietaireId: record.proprietaire?.id || record.proprietaire || undefined,
      images: record.images ?? [],
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await axios.delete(`/moteurs/${id}`);
      message.success("Moteur supprimé");
      fetchMoteurs();
    } catch {
      message.error("Erreur lors de la suppression");
    }
    setLoading(false);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const { modeleId, proprietaireId, ...restValues } = values;
      const payload = {
        ...restValues,
        modele: modeleId ? { id: modeleId } : null,
        proprietaire: proprietaireId ? { id: proprietaireId } : null,
      };
      if (editing && editing.id) {
        // update
        const res = await axios.put(`/moteurs/${editing.id}`, payload);
        message.success("Moteur modifié");
        const updated = res.data;
        setEditing(updated);
        form.setFieldsValue({
          ...updated,
          modeleId: updated.modele?.id || undefined,
          proprietaireId: updated.proprietaire?.id || undefined,
          images: updated.images ?? [],
        });
      } else {
        // create
        const res = await axios.post("/moteurs", payload);
        message.success("Moteur ajouté");
        const created = res.data;
        setEditing(created);
        form.setFieldsValue({
          ...created,
          modeleId: created.modele?.id || undefined,
          proprietaireId: created.proprietaire?.id || undefined,
          images: created.images ?? [],
        });
      }
      fetchMoteurs();
    } catch (e: any) {
      if (e && e.response) {
        message.error("Erreur lors de la sauvegarde");
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Numéro de série", dataIndex: "numeroSerie", key: "numeroSerie", sorter: (a, b) => a.numeroSerie.localeCompare(b.numeroSerie) },
    {
      title: "Propriétaire",
      dataIndex: "proprietaire",
      key: "proprietaire",
      render: (proprietaire: any) => proprietaire ? `${proprietaire.prenom ?? ""} ${proprietaire.nom ?? ""}` : "",
      filters: clients.map((client: any) => ({ text: `${client.prenom} ${client.nom}`, value: client.id })),
      onFilter: (value, record) => record.proprietaire?.id === value,
    },
    {
      title: "Modèle",
      dataIndex: "modele",
      key: "modele",
      render: (modele: any) =>
        modele
          ? [
              modele.marque,
              modele.modele,
              modele.annee && `(${modele.annee})`
            ].filter(Boolean).join(" ")
          : "",
      filters: catalogueMoteurs.map((modele) => ({ text: `${modele.marque} ${modele.modele} ${modele.annee ? `(${modele.annee})` : ""}`, value: modele.id })),
      onFilter: (value, record) => record.modele?.id === value,
    },
    {
      title: "Date achat",
      dataIndex: "dateAchat",
      key: "dateAchat",
      sorter: (a, b) => a.dateAchat.localeCompare(b.dateAchat),
    },
    {
      title: "Date fin garantie",
      dataIndex: "dateFinDeGuarantie",
      key: "dateFinDeGuarantie",
      sorter: (a, b) => a.dateFinDeGuarantie.localeCompare(b.dateFinDeGuarantie),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: MoteurClient) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm title="Supprimer ce moteur ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 120,
    },
  ];

  return (
    <Card title="Moteurs Clients">
      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="Recherche"
          enterButton
          allowClear={true}
          style={{ width: 600 }}
          onSearch={fetchMoteurs}
        />
        <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleAdd} />
      </Space>
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={moteurs}
          bordered
          pagination={{ pageSize: 10 }}
        />
      </Spin>
      <Modal
        open={modalVisible}
        title={editing ? "Modifier le moteur" : "Ajouter un moteur"}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalOk}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={form} initialValues={defaultMoteur}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Numéro de série" name="numeroSerie" rules={[{ required: true, message: "Numéro de série requis" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Numéro de clef" name="numeroClef">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Date MeS" name="dateMeS">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date achat" name="dateAchat">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Date fin garantie" name="dateFinDeGuarantie">
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item label="Modèle catalogue" name="modeleId">
            <Select
              showSearch
              placeholder="Associer à un modèle du catalogue"
              optionFilterProp="children"
              filterOption={(input, option) =>
                `${option?.children ?? ""}`.toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            >
              {catalogueMoteurs.map((modele) => (
                <Option key={modele.id} value={modele.id}>
                  {modele.marque} {modele.modele} {modele.annee ? `(${modele.annee})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Propriétaire" name="proprietaireId">
            <Select
              showSearch
              placeholder="Sélectionner le client propriétaire"
              optionFilterProp="children"
              filterOption={(input, option) =>
                `${option?.children ?? ""}`.toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            >
              {clients.map((client: any) => (
                <Option key={client.id} value={client.id}>
                  {client.prenom} {client.nom}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Images" name="images">
            <Form.List name="images">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item
                        {...field}
                        name={[field.name]}
                        fieldKey={[field.fieldKey ?? field.key]}
                        rules={[{ required: true, message: "Veuillez entrer une URL d'image" }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="URL de l'image" style={{ width: '100%' }} />
                      </Form.Item>
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => remove(field.name)}
                      />
                      {form.getFieldValue(['images', index]) &&
                        <img
                          src={form.getFieldValue(['images', index])}
                          alt={`Moteur img ${index + 1}`}
                          style={{ width: 60, marginLeft: 8, objectFit: 'cover' }}
                        />
                      }
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusCircleOutlined />}>
                    Ajouter une image
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ClientsMoteurs;

