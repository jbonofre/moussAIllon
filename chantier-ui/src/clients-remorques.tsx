import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Image,
  Space,
  message,
  Popconfirm,
  Card,
  Spin,
  Rate,
  Row,
  Col,
  DatePicker,
  Checkbox,
} from "antd";
import {
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  DeleteOutlined as DeleteIcon,
  TagsOutlined,
} from "@ant-design/icons";
import api from "./api.ts";
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';
import dayjs from "dayjs";
import { useNavigation } from './navigation-context.tsx';

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
  documents: [],
  immatriculation: "",
  dateMeS: dayjs(),
  dateAchat: dayjs(),
  dateFinDeGuarantie: null,
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
  const [formDirty, setFormDirty] = useState(false);
  const [editing, setEditing] = useState<RemorqueClient | null>(null);
  const [form] = Form.useForm();
  const [catalogueModalVisible, setCatalogueModalVisible] = useState(false);
  const [catalogueForm] = Form.useForm();
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientForm] = Form.useForm();
  const [annonceImageModalVisible, setAnnonceImageModalVisible] = useState(false);
  const [annonceImageRemorque, setAnnonceImageRemorque] = useState<RemorqueClient | null>(null);
  const [annonceSelectedImages, setAnnonceSelectedImages] = useState<Set<string>>(new Set());
  const { navigate } = useNavigation();

  const openAnnonceImageModal = (remorque: RemorqueClient) => {
    setAnnonceImageRemorque(remorque);
    setAnnonceSelectedImages(new Set(remorque.images || []));
    setAnnonceImageModalVisible(true);
  };

  const toggleAnnonceImage = (url: string) => {
    setAnnonceSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleCreateAnnonceFromImages = () => {
    if (annonceSelectedImages.size === 0) {
      message.warning("Veuillez selectionner au moins une image");
      return;
    }
    setAnnonceImageModalVisible(false);
    navigate("/annonces", {
      photos: Array.from(annonceSelectedImages),
      clientId: annonceImageRemorque?.proprietaire?.id,
    });
  };

  const fetchRemorques = async (q = "") => {
    setLoading(true);
    try {
      let url = "/remorques";
      if (q && q.trim() !== "") {
        url = `/remorques/search?q=${encodeURIComponent(q)}`;
      }
      const res = await api.get(url);
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
      const res = await api.get("/catalogue/remorques");
      setRemorquesCatalogue(res.data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de remorques");
      setRemorquesCatalogue([]);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get("/clients");
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

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setFormDirty(false);
    if (clientId) {
      form.setFieldsValue({ proprietaireId: clientId });
    }
    setModalVisible(true);
  };

  const handleEdit = (record: RemorqueClient) => {
    setEditing(record);
    setFormDirty(false);
    form.setFieldsValue({
      ...record,
      dateMeS: record.dateMeS ? dayjs(record.dateMeS) : null,
      dateAchat: record.dateAchat ? dayjs(record.dateAchat) : null,
      dateFinDeGuarantie: record.dateFinDeGuarantie ? dayjs(record.dateFinDeGuarantie) : null,
      modeleId: record.modele?.id || undefined,
      proprietaireId: record.proprietaire?.id || undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`/remorques/${id}`);
      message.success("Remorque supprimée");
      fetchRemorques();
    } catch {
      message.error("Erreur lors de la suppression");
    }
    setLoading(false);
  };

  const handleClientAdd = async () => {
    try {
      const values = await clientForm.validateFields();
      const res = await api.post("/clients", values);
      message.success("Client ajouté");
      setClientModalVisible(false);
      clientForm.resetFields();
      await fetchClients();
      form.setFieldsValue({ proprietaireId: res.data.id });
    } catch (e: any) {
      if (e && e.response) {
        message.error("Erreur lors de l'ajout du client");
      }
    }
  };

  const handleCatalogueAdd = async () => {
    try {
      const values = await catalogueForm.validateFields();
      const res = await api.post("/catalogue/remorques", values);
      message.success("Remorque catalogue ajoutée");
      setCatalogueModalVisible(false);
      catalogueForm.resetFields();
      await fetchRemorquesCatalogue();
      form.setFieldsValue({ modeleId: res.data.id });
    } catch (e: any) {
      if (e && e.response) {
        message.error("Erreur lors de l'ajout de la remorque catalogue");
      }
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const { modeleId, proprietaireId, images, dateMeS, dateAchat, dateFinDeGuarantie, ...restValues } = values;
      const payload = {
        ...restValues,
        dateMeS: dateMeS ? dateMeS.format("YYYY-MM-DD") : null,
        dateAchat: dateAchat ? dateAchat.format("YYYY-MM-DD") : null,
        dateFinDeGuarantie: dateFinDeGuarantie ? dateFinDeGuarantie.format("YYYY-MM-DD") : null,
        images: Array.isArray(images) ? images : [],
        modele: modeleId ? { id: modeleId } : null,
        proprietaire: proprietaireId ? { id: proprietaireId } : null,
      };
      if (editing && editing.id) {
        // update
        const res = await api.put(`/remorques/${editing.id}`, payload);
        message.success("Remorque modifiée");
        const updated = res.data;
        setEditing(updated);
        form.setFieldsValue({
          ...updated,
          dateMeS: updated.dateMeS ? dayjs(updated.dateMeS) : null,
          dateAchat: updated.dateAchat ? dayjs(updated.dateAchat) : null,
          dateFinDeGuarantie: updated.dateFinDeGuarantie ? dayjs(updated.dateFinDeGuarantie) : null,
          modeleId: updated.modele?.id || undefined,
          proprietaireId: updated.proprietaire?.id || undefined,
        });
      } else {
        // create
        const res = await api.post("/remorques", payload);
        message.success("Remorque ajoutée");
        const created = res.data;
        setEditing(created);
        form.setFieldsValue({
          ...created,
          dateMeS: created.dateMeS ? dayjs(created.dateMeS) : null,
          dateAchat: created.dateAchat ? dayjs(created.dateAchat) : null,
          dateFinDeGuarantie: created.dateFinDeGuarantie ? dayjs(created.dateFinDeGuarantie) : null,
          modeleId: created.modele?.id || undefined,
          proprietaireId: created.proprietaire?.id || undefined,
        });
      }
      setFormDirty(false);
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
          {(record.images || []).length > 0 && (
            <Button icon={<TagsOutlined />} size="small" onClick={() => openAnnonceImageModal(record)} title="Creer une annonce" />
          )}
          <Popconfirm title="Supprimer cette remorque ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteIcon />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 160,
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
        onCancel={handleModalCancel}
        onOk={handleModalOk}
        okText="Enregistrer"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={form} initialValues={defaultRemorque} onValuesChange={() => setFormDirty(true)}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Immatriculation" name="immatriculation" rules={[{ required: true, message: "Immatriculation requise" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date MeS" name="dateMeS">
                <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Date achat" name="dateAchat">
                <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date fin garantie" name="dateFinDeGuarantie">
                <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Images" name="images">
            <ImageUpload />
          </Form.Item>
          <Form.Item label="Documents" name="documents">
            <DocumentUpload />
          </Form.Item>
          {/* Association avec un modèle du catalogue */}
          <Form.Item label="Modèle catalogue" style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="modeleId" noStyle>
                <Select
                  showSearch
                  placeholder="Associer à un modèle du catalogue"
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    `${option?.children ?? ""}`.toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                  style={{ width: "100%" }}
                >
                  {remorquesCatalogue.map((remorque) => (
                    <Select.Option key={remorque.id} value={remorque.id}>
                      {remorque.marque} {remorque.modele} {remorque.annee ? `(${remorque.annee})` : ""}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Button
                icon={<PlusCircleOutlined />}
                onClick={() => {
                  catalogueForm.resetFields();
                  setCatalogueModalVisible(true);
                }}
              />
            </Space.Compact>
          </Form.Item>
          <Form.Item label="Propriétaire" style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="proprietaireId" noStyle>
                <Select
                  showSearch
                  placeholder="Choisir le propriétaire"
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option as any)?.children?.toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                  style={{ width: "100%" }}
                >
                  {clients.map((client: any) => (
                    <Select.Option key={client.id} value={client.id}>
                      {client.prenom} {client.nom}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Button
                icon={<PlusCircleOutlined />}
                onClick={() => {
                  clientForm.resetFields();
                  setClientModalVisible(true);
                }}
              />
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={catalogueModalVisible}
        title="Ajouter une remorque catalogue"
        onCancel={() => setCatalogueModalVisible(false)}
        onOk={handleCatalogueAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
      >
        <Form
          layout="vertical"
          form={catalogueForm}
          initialValues={{ tva: 20 }}
          onValuesChange={(changed, all) => {
            const roundAmount = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
            const toNumber = (v: unknown, fb = 0) => { const p = Number(v); return Number.isFinite(p) ? p : fb; };
            const hasChanged = (key: string) => Object.prototype.hasOwnProperty.call(changed, key);
            const tva = toNumber(all.tva, 20);
            const ht = toNumber(all.prixVenteHT, 0);
            const ttc = toNumber(all.prixVenteTTC, 0);
            if (hasChanged("prixVenteHT") || hasChanged("tva")) {
              const montantTVA = roundAmount(ht * (tva / 100));
              catalogueForm.setFieldsValue({ montantTVA, prixVenteTTC: roundAmount(ht + montantTVA) });
            } else if (hasChanged("prixVenteTTC")) {
              const montantTVA = roundAmount((ttc / (100 + tva)) * tva);
              catalogueForm.setFieldsValue({ montantTVA, prixVenteHT: roundAmount(ttc - montantTVA) });
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
                <Select allowClear>
                  <Select.Option value="Standard">Standard</Select.Option>
                  <Select.Option value="Renforcé">Renforcé</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="roues" label="Roues">
                <Select allowClear>
                  <Select.Option value="Simple">Simple</Select.Option>
                  <Select.Option value="Double">Double</Select.Option>
                </Select>
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
      <Modal
        open={clientModalVisible}
        title="Ajouter un client"
        onCancel={() => setClientModalVisible(false)}
        onOk={handleClientAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={clientForm} initialValues={{ type: "PARTICULIER", consentement: false, remise: 0 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Type" name="type" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="PARTICULIER">Particulier</Select.Option>
                  <Select.Option value="PROFESSIONNEL">Professionnel</Select.Option>
                  <Select.Option value="PROFESSIONNEL_MER">Professionnel de la Mer</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
              {({ getFieldValue }) =>
                getFieldValue("type") === "PARTICULIER" && (
                  <Col span={12}>
                    <Form.Item label="Prénom" name="prenom">
                      <Input />
                    </Form.Item>
                  </Col>
                )
              }
            </Form.Item>
            <Col span={12}>
              <Form.Item label="Nom" name="nom" rules={[{ required: true, message: "Le nom est requis" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Email" name="email">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="consentement" valuePropName="checked">
                <Checkbox>Consentement</Checkbox>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Téléphone" name="telephone">
            <Input style={{ width: "50%" }} />
          </Form.Item>
          <Form.Item label="Adresse" name="adresse">
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) =>
              getFieldValue("type") !== "PARTICULIER" && (
                <>
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
                </>
              )
            }
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Remise (%)" name="remise">
                <Input type="number" min={0} max={100} />
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
      </Modal>

      {/* Image selection for annonce */}
      <Modal
        title={`Selectionner des photos pour l'annonce - Remorque ${annonceImageRemorque?.immatriculation || ''}`}
        open={annonceImageModalVisible}
        onCancel={() => setAnnonceImageModalVisible(false)}
        onOk={handleCreateAnnonceFromImages}
        okText={`Creer une annonce (${annonceSelectedImages.size} photo(s))`}
        okButtonProps={{ disabled: annonceSelectedImages.size === 0 }}
        cancelText="Fermer"
        width={700}
      >
        {annonceImageRemorque && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Checkbox
                checked={(annonceImageRemorque.images || []).length > 0 && annonceSelectedImages.size === (annonceImageRemorque.images || []).length}
                indeterminate={annonceSelectedImages.size > 0 && annonceSelectedImages.size < (annonceImageRemorque.images || []).length}
                onChange={() => {
                  const imgs = annonceImageRemorque.images || [];
                  const allSelected = imgs.every((img) => annonceSelectedImages.has(img));
                  setAnnonceSelectedImages(allSelected ? new Set() : new Set(imgs));
                }}
              >
                Tout selectionner ({annonceSelectedImages.size}/{(annonceImageRemorque.images || []).length})
              </Checkbox>
            </div>
            <Image.PreviewGroup>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(annonceImageRemorque.images || []).map((url, i) => (
                  <div
                    key={i}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('.ant-image-mask')) {
                        toggleAnnonceImage(url);
                      }
                    }}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: annonceSelectedImages.has(url) ? '3px solid #1890ff' : '3px solid transparent',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      width={120}
                      height={120}
                      src={url}
                      style={{ objectFit: 'cover', display: 'block' }}
                      preview={{ mask: 'Agrandir' }}
                    />
                    <Checkbox
                      checked={annonceSelectedImages.has(url)}
                      onChange={() => toggleAnnonceImage(url)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ position: 'absolute', top: 4, left: 4, zIndex: 1 }}
                    />
                  </div>
                ))}
              </div>
            </Image.PreviewGroup>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export default RemorquesClients;
