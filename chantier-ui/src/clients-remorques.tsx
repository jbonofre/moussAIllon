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
  DeleteOutlined as DeleteIcon,
} from "@ant-design/icons";
import axios from "axios";

const { Option } = Select;
const { Search } = Input;

// Typings for RemorqueClientEntity
interface RemorqueClient {
  id?: number;
  images?: string[];
  immatriculation?: string;
  dateMeS?: string;
  dateAchat?: string;
  dateFinDeGuarantie?: string;
  proprietaire?: any;
  modele?: any;
}

const defaultRemorque: RemorqueClient = {
  images: [],
  immatriculation: "",
  dateMeS: "",
  dateAchat: "",
  dateFinDeGuarantie: "",
  proprietaire: null,
  modele: null,
};

interface RemorquesClientsProps {
  clientId?: number;
}

function RemorquesClients({ clientId }: RemorquesClientsProps) {
  const [remorques, setRemorques] = useState<RemorqueClient[]>([]);
  const [remorquesCatalogue, setRemorquesCatalogue] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<RemorqueClient | null>(null);
  const [form] = Form.useForm();

  const fetchRemorques = async (q = "") => {
    setLoading(true);
    try {
      let url = "/remorques";
      if (q && q.trim() !== "") {
        url = `/remorques/search?q=${encodeURIComponent(q)}`;
      }
      const res = await axios.get(url);
      let remorquesData = res.data;
      // Filter by clientId if provided (property: proprietaire.id)
      if (clientId) {
        remorquesData = remorquesData.filter(
          (remorque: RemorqueClient) =>
            remorque.proprietaire && (remorque.proprietaire.id === clientId)
        );
      }
      setRemorques(remorquesData);
    } catch {
      message.error("Erreur lors du chargement des remorques");
    }
    setLoading(false);
  };

  const fetchRemorquesCatalogue = async () => {
    try {
      const res = await axios.get("/catalogue/remorques");
      setRemorquesCatalogue(res.data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de remorques");
      setRemorquesCatalogue([]);
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
    fetchRemorques();
    fetchRemorquesCatalogue();
    fetchClients();
    // eslint-disable-next-line
  }, [clientId]);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: RemorqueClient) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      modeleId: record.modele?.id || undefined,
      proprietaireId: record.proprietaire?.id || undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await axios.delete(`/remorques/${id}`);
      message.success("Remorque supprimée");
      fetchRemorques();
    } catch {
      message.error("Erreur lors de la suppression");
    }
    setLoading(false);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const { modeleId, proprietaireId, images, ...restValues } = values;
      const payload = {
        ...restValues,
        images: Array.isArray(images) ? images : [],
        modele: modeleId ? { id: modeleId } : null,
        proprietaire: proprietaireId ? { id: proprietaireId } : null,
      };
      if (editing && editing.id) {
        // update
        const res = await axios.put(`/remorques/${editing.id}`, payload);
        message.success("Remorque modifiée");
        const updated = res.data;
        setEditing(updated);
        form.setFieldsValue({
          ...updated,
          modeleId: updated.modele?.id || undefined,
          proprietaireId: updated.proprietaire?.id || undefined,
        });
      } else {
        // create
        const res = await axios.post("/remorques", payload);
        message.success("Remorque ajoutée");
        const created = res.data;
        setEditing(created);
        form.setFieldsValue({
          ...created,
          modeleId: created.modele?.id || undefined,
          proprietaireId: created.proprietaire?.id || undefined,
        });
      }
      fetchRemorques();
    } catch (e) {
      if (e && e.response) {
        message.error("Erreur lors de la sauvegarde");
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Immatriculation", dataIndex: "immatriculation", key: "immatriculation", sorter: (a, b) => a.immatriculation.localeCompare(b.immatriculation) },
    {
      title: "Propriétaire", dataIndex: "proprietaire", key: "proprietaire",
      render: (proprietaire: any) =>
        proprietaire ? `${proprietaire.prenom || ""} ${proprietaire.nom || ""}`.trim() : "",
      sorter: (a, b) => a.proprietaire?.prenom.localeCompare(b.proprietaire?.prenom || "") || a.proprietaire?.nom.localeCompare(b.proprietaire?.nom || ""),
    },
    {
      title: "Modèle", dataIndex: "modele", key: "modele",
      render: (modele: any) =>
        modele ? [modele?.marque, modele?.modele, modele?.annee ? `(${modele.annee})` : ""].filter(Boolean).join(" ") : "",
      sorter: (a, b) => a.modele?.marque.localeCompare(b.modele?.marque || "") || a.modele?.modele.localeCompare(b.modele?.modele || "") || a.modele?.annee.localeCompare(b.modele?.annee || ""),
      filters: remorquesCatalogue.map((remorque) => ({ text: `${remorque.marque} ${remorque.modele} ${remorque.annee ? `(${remorque.annee})` : ""}`, value: remorque.id })),
      onFilter: (value, record) => record.modele?.id === value,
    },
    { title: "Date achat", dataIndex: "dateAchat", key: "dateAchat", sorter: (a, b) => a.dateAchat.localeCompare(b.dateAchat) },
    { title: "Date fin garantie", dataIndex: "dateFinDeGuarantie", key: "dateFinDeGuarantie", sorter: (a, b) => a.dateFinDeGuarantie.localeCompare(b.dateFinDeGuarantie) },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: RemorqueClient) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm title="Supprimer cette remorque ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteIcon />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 120,
    },
  ];

  return (
    <Card title="Remorques Clients">
      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="Recherche"
          enterButton
          allowClear={true}
          style={{ width: 600 }}
          onSearch={(q: string) => fetchRemorques(q)}
        />
        <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleAdd} />
      </Space>
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={remorques}
          bordered
          pagination={{ pageSize: 10 }}
        />
      </Spin>
      <Modal
        open={modalVisible}
        title={editing ? "Modifier la remorque" : "Ajouter une remorque"}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalOk}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={form} initialValues={defaultRemorque}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Immatriculation" name="immatriculation" rules={[{ required: true, message: "Immatriculation requise" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date MeS" name="dateMeS">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Date achat" name="dateAchat">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date fin garantie" name="dateFinDeGuarantie">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Images" name="images">
            <Form.List name="images">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Space key={field.key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                      <Form.Item
                        {...field}
                        name={[field.name]}
                        fieldKey={[field.fieldKey ?? field.key]}
                        rules={[{ required: true, message: "Veuillez entrer une URL d'image" }]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="URL de l'image" style={{ width: "100%" }} />
                      </Form.Item>
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => remove(field.name)}
                      />
                      {form.getFieldValue(['images', index]) &&
                        <img
                          src={form.getFieldValue(['images', index])}
                          alt={`Remorque img ${index + 1}`}
                          style={{ width: 60, marginLeft: 8, objectFit: "cover" }}
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
          {/* Association avec un modèle du catalogue */}
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
              {remorquesCatalogue.map((remorque) => (
                <Select.Option key={remorque.id} value={remorque.id}>
                  {remorque.marque} {remorque.modele} {remorque.annee ? `(${remorque.annee})` : ""}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Propriétaire" name="proprietaireId">
            <Select
              showSearch
              placeholder="Choisir le propriétaire"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option as any)?.children?.toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            >
              {clients.map((client: any) => (
                <Select.Option key={client.id} value={client.id}>
                  {client.prenom} {client.nom}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default RemorquesClients;
