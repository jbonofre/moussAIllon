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
import clients from "./clients";

const { Option } = Select;
const { Search } = Input;

// Define minimal typing for BateauClientEntity
interface BateauClient {
  id?: number;
  name: string;
  images?: string[];
  immatriculation?: string;
  numeroSerie?: string;
  numeroClef?: string;
  dateMeS?: string;
  dateAchat?: string;
  dateFinDeGuarantie?: string;
  proprietaires?: any[];
  modele?: any;
  localisation?: string;
  localisationGps?: string;
  moteurs?: any[];
  remorque?: any;
  equipements?: any[];
}

const defaultBateau: BateauClient = {
  name: "",
  images: [],
  immatriculation: "",
  numeroSerie: "",
  numeroClef: "",
  dateMeS: "",
  dateAchat: "",
  dateFinDeGuarantie: "",
  proprietaires: [],
  modele: null,
  localisation: "",
  localisationGps: "",
  moteurs: [],
  remorque: null,
  equipements: [],
};

interface BateauxClientsProps {
  clientId?: number;
}

function BateauxClients({ clientId }: BateauxClientsProps) {
  const [bateaux, setBateaux] = useState<BateauClient[]>([]);
  const [bateauxCatalogue, setBateauxCatalogue] = useState<any[]>([]);
  const [moteursCatalogue, setMoteursCatalogue] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<BateauClient | null>(null);
  const [search, setSearch] = useState("");
  const [form] = Form.useForm();

  const fetchBateaux = async (q = "") => {
    setLoading(true);
    try {
      let url = "/bateaux";
      if (q && q.trim() !== "") {
        url = `/bateaux/search?q=${encodeURIComponent(q)}`;
      }
      const res = await axios.get(url);
      let bateauxData = res.data;
      // Filter by clientId if provided
      if (clientId) {
        bateauxData = bateauxData.filter((bateau: BateauClient) =>
          bateau.proprietaires?.some((p: any) => (p.id || p) === clientId)
        );
      }
      setBateaux(bateauxData);
    } catch {
      message.error("Erreur lors du chargement des bateaux");
    }
    setLoading(false);
  };

  const fetchBateauxCatalogue = async () => {
    try {
      const res = await axios.get('/catalogue/bateaux');
      setBateauxCatalogue(res.data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de bateaux");
      setBateauxCatalogue([]);
    }
  };

  const fetchMoteursCatalogue = async () => {
    try {
      const res = await axios.get('/catalogue/moteurs');
      setMoteursCatalogue(res.data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de moteurs");
      setMoteursCatalogue([]);
    }
  };

  useEffect(() => {
    fetchBateaux();
    fetchBateauxCatalogue();
    fetchMoteursCatalogue();
    fetchClients();
  }, [clientId]);

  const fetchClients = async () => {
    const res = await axios.get('/clients');
    setClients(res.data);
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: BateauClient) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      modeleId: record.modele?.id || undefined,
      proprietaires: record.proprietaires?.map((p: any) => p.id || p) || [],
      moteurs: record.moteurs?.map((m: any) => m.id || m) || [],
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await axios.delete(`/bateaux/${id}`);
      message.success("Bateau supprimé");
      fetchBateaux();
    } catch {
      message.error("Erreur lors de la suppression");
    }
    setLoading(false);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      // Transform modeleId to modele object and proprietaires/moteurs IDs to objects
      const { modeleId, proprietaires, moteurs, ...restValues } = values;
      const payload = {
        ...restValues,
        modele: modeleId ? { id: modeleId } : null,
        proprietaires: proprietaires && Array.isArray(proprietaires) 
          ? proprietaires.map((id: number) => ({ id }))
          : [],
        moteurs: moteurs && Array.isArray(moteurs) 
          ? moteurs.map((id: number) => ({ id }))
          : [],
      };
      if (editing && editing.id) {
        // update
        const res = await axios.put(`/bateaux/${editing.id}`, payload);
        message.success("Bateau modifié");
        const updated = res.data;
        setEditing(updated);
        form.setFieldsValue({
          ...updated,
          modeleId: updated.modele?.id || undefined,
          proprietaires: updated.proprietaires?.map((p: any) => p.id || p) || [],
          moteurs: updated.moteurs?.map((m: any) => m.id || m) || [],
        });
      } else {
        // create
        const res = await axios.post("/bateaux", payload);
        message.success("Bateau ajouté");
        const created = res.data;
        setEditing(created);
        form.setFieldsValue({
          ...created,
          modeleId: created.modele?.id || undefined,
          proprietaires: created.proprietaires?.map((p: any) => p.id || p) || [],
          moteurs: created.moteurs?.map((m: any) => m.id || m) || [],
        });
      }
      fetchBateaux();
    } catch (e) {
      if (e && e.response) {
        message.error("Erreur lors de la sauvegarde");
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Nom", dataIndex: "name", key: "name", sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: "Immatriculation", dataIndex: "immatriculation", key: "immatriculation", sorter: (a, b) => a.immatriculation.localeCompare(b.immatriculation) },
    { title: "Propriétaires", dataIndex: "proprietaires", key: "proprietaires",
      render: (proprietaires: any[]) => (proprietaires && proprietaires.length ? proprietaires.map(p => (p.prenom + " " + p.nom)).join(", ") : ""),
      filters: clients.map((client: any) => ({ text: `${client.prenom} ${client.nom}`, value: client.id })),
      onFilter: (value, record) => record.proprietaires?.some((p: any) => p.id === value),
    },
    { title: "Modèle", dataIndex: "modele", key: "modele",
      render: (modele: any) => (modele ? (modele.marque) + " " + (modele.modele) + " (" + (modele.annee) + ")" : ""),
      filters: bateauxCatalogue.map((bateau) => ({ text: `${bateau.marque} ${bateau.modele} ${bateau.annee ? `(${bateau.annee})` : ""}`, value: bateau.id })),
      onFilter: (value, record) => record.modele?.id === value,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: BateauClient) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm title="Supprimer ce bateau ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 120,
    },
  ];

  return (
    <Card title="Bateaux Clients">
      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="Recherche"
          enterButton
          allowClear={true}
          style={{ width: 600 }}
          onSearch={fetchBateaux}
        />
        <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleAdd} />
      </Space>
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={bateaux}
          bordered
          pagination={{ pageSize: 10 }}
        />
      </Spin>
      <Modal
        open={modalVisible}
        title={editing ? "Modifier le bateau" : "Ajouter un bateau"}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalOk}
        okText="Enregistrer"
        cancelText="Annuler"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={form} initialValues={defaultBateau}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Nom" name="name" rules={[{ required: true, message: "Nom requis" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Immatriculation" name="immatriculation">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Numéro de série" name="numeroSerie">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Numéro clef" name="numeroClef">
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Date fin garantie" name="dateFinDeGuarantie">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Localisation" name="localisation">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Localisation GPS" name="localisationGps">
            <Input />
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
                          alt={`Bateau img ${index + 1}`}
                          style={{ width: 80, marginLeft: 8, objectFit: 'cover' }}
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
          {/* Association avec un bateau du catalogue */}
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
              {bateauxCatalogue.map((bateau) => (
                <Select.Option key={bateau.id} value={bateau.id}>
                  {bateau.marque} {bateau.modele} {bateau.annee ? `(${bateau.annee})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Propriétaires" name="proprietaires">
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="Entrer les noms des propriétaires"
              tokenSeparators={[',']}
              allowClear
            >
                {clients.map((client: any) => (
                    <Select.Option key={client.id} value={client.id}>
                        {client.prenom} {client.nom}
                    </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item label="Moteurs" name="moteurs">
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="Sélectionner les moteurs à associer"
              optionFilterProp="children"
              allowClear
              showSearch
              filterOption={(input, option) =>
                `${option?.children ?? ""}`.toLowerCase().includes(input.toLowerCase())
              }
            >
              {moteursCatalogue && moteursCatalogue.map((moteur: any) => (
                <Select.Option key={moteur.id} value={moteur.id}>
                  {moteur.marque} {moteur.modele} {moteur.annee ? `(${moteur.annee})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {/* moteurs, équipements could be handled by extra fields/components if needed */}
        </Form>
      </Modal>
    </Card>
  );
}

export default BateauxClients;
