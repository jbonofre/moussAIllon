import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  AutoComplete,
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
  PictureOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import api from "./api.ts";
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import ImageUpload from './ImageUpload.tsx';
import DocumentUpload from './DocumentUpload.tsx';
import dayjs from "dayjs";
import LocationPicker from "./LocationPicker.tsx";
import { useHistory } from "react-router-dom";

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
  documents: [],
  immatriculation: "",
  numeroSerie: "",
  numeroClef: "",
  dateMeS: dayjs(),
  dateAchat: dayjs(),
  dateFinDeGuarantie: null,
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
  const bateauTypes = useReferenceValeurs('TYPE_BATEAU');
  const moteurTypes = useReferenceValeurs('TYPE_MOTEUR');
  const [bateaux, setBateaux] = useState<BateauClient[]>([]);
  const [bateauxCatalogue, setBateauxCatalogue] = useState<any[]>([]);
  const [moteursCatalogue, setMoteursCatalogue] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [editing, setEditing] = useState<BateauClient | null>(null);
  const [search, setSearch] = useState("");
  const [form] = Form.useForm();
  const [catalogueModalVisible, setCatalogueModalVisible] = useState(false);
  const [catalogueForm] = Form.useForm();
  const [moteurModalVisible, setMoteurModalVisible] = useState(false);
  const [moteurForm] = Form.useForm();
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientForm] = Form.useForm();
  const [annonceImageModalVisible, setAnnonceImageModalVisible] = useState(false);
  const [annonceImageBateau, setAnnonceImageBateau] = useState<BateauClient | null>(null);
  const [annonceSelectedImages, setAnnonceSelectedImages] = useState<Set<string>>(new Set());
  const history = useHistory();

  const openAnnonceImageModal = (bateau: BateauClient) => {
    setAnnonceImageBateau(bateau);
    setAnnonceSelectedImages(new Set(bateau.images || []));
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
    history.push("/annonces", {
      photos: Array.from(annonceSelectedImages),
      bateauId: annonceImageBateau?.id,
      clientId: annonceImageBateau?.proprietaires?.[0]?.id,
    });
  };

  const fetchBateaux = async (q = "") => {
    setLoading(true);
    try {
      let url = "/bateaux";
      if (q && q.trim() !== "") {
        url = `/bateaux/search?q=${encodeURIComponent(q)}`;
      }
      const res = await api.get(url);
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
      const res = await api.get('/catalogue/bateaux');
      setBateauxCatalogue(res.data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de bateaux");
      setBateauxCatalogue([]);
    }
  };

  const fetchMoteursCatalogue = async () => {
    try {
      const res = await api.get('/catalogue/moteurs');
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
    const res = await api.get('/clients');
    setClients(res.data);
  };

  const handleModalCancel = () => {
    if (formDirty) {
      Modal.confirm({
        title: "Modifications non enregistrées",
        content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
        okText: "Fermer",
        cancelText: "Fermer",
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
      form.setFieldsValue({ proprietaires: [clientId] });
    }
    setModalVisible(true);
  };

  const handleEdit = (record: BateauClient) => {
    setEditing(record);
    setFormDirty(false);
    form.setFieldsValue({
      ...record,
      dateMeS: record.dateMeS ? dayjs(record.dateMeS) : null,
      dateAchat: record.dateAchat ? dayjs(record.dateAchat) : null,
      dateFinDeGuarantie: record.dateFinDeGuarantie ? dayjs(record.dateFinDeGuarantie) : null,
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
      await api.delete(`/bateaux/${id}`);
      message.success("Bateau supprimé");
      fetchBateaux();
    } catch {
      message.error("Erreur lors de la suppression");
    }
    setLoading(false);
  };

  const handleCatalogueAdd = async () => {
    try {
      const values = await catalogueForm.validateFields();
      const res = await api.post("/catalogue/bateaux", values);
      message.success("Modèle catalogue ajouté");
      setCatalogueModalVisible(false);
      catalogueForm.resetFields();
      await fetchBateauxCatalogue();
      form.setFieldsValue({ modeleId: res.data.id });
    } catch (e) {
      if (e && e.response) {
        message.error("Erreur lors de l'ajout du modèle catalogue");
      }
    }
  };

  const handleMoteurAdd = async () => {
    try {
      const values = await moteurForm.validateFields();
      const res = await api.post("/catalogue/moteurs", values);
      message.success("Moteur catalogue ajouté");
      setMoteurModalVisible(false);
      moteurForm.resetFields();
      await fetchMoteursCatalogue();
      // Add the new moteur to the current selection
      const currentMoteurs = form.getFieldValue("moteurs") || [];
      form.setFieldsValue({ moteurs: [...currentMoteurs, res.data.id] });
    } catch (e) {
      if (e && e.response) {
        message.error("Erreur lors de l'ajout du moteur catalogue");
      }
    }
  };

  const handleClientAdd = async () => {
    try {
      const values = await clientForm.validateFields();
      const res = await api.post("/clients", values);
      message.success("Client ajouté");
      setClientModalVisible(false);
      clientForm.resetFields();
      await fetchClients();
      const currentProprietaires = form.getFieldValue("proprietaires") || [];
      form.setFieldsValue({ proprietaires: [...currentProprietaires, res.data.id] });
    } catch (e) {
      if (e && e.response) {
        message.error("Erreur lors de l'ajout du client");
      }
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      // Transform modeleId to modele object and proprietaires/moteurs IDs to objects
      const { modeleId, proprietaires, moteurs, dateMeS, dateAchat, dateFinDeGuarantie, ...restValues } = values;
      const payload = {
        ...restValues,
        dateMeS: dateMeS ? dateMeS.format("YYYY-MM-DD") : null,
        dateAchat: dateAchat ? dateAchat.format("YYYY-MM-DD") : null,
        dateFinDeGuarantie: dateFinDeGuarantie ? dateFinDeGuarantie.format("YYYY-MM-DD") : null,
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
        const res = await api.put(`/bateaux/${editing.id}`, payload);
        message.success("Bateau modifié");
        const updated = res.data;
        setEditing(updated);
        form.setFieldsValue({
          ...updated,
          dateMeS: updated.dateMeS ? dayjs(updated.dateMeS) : null,
          dateAchat: updated.dateAchat ? dayjs(updated.dateAchat) : null,
          dateFinDeGuarantie: updated.dateFinDeGuarantie ? dayjs(updated.dateFinDeGuarantie) : null,
          modeleId: updated.modele?.id || undefined,
          proprietaires: updated.proprietaires?.map((p: any) => p.id || p) || [],
          moteurs: updated.moteurs?.map((m: any) => m.id || m) || [],
        });
      } else {
        // create
        const res = await api.post("/bateaux", payload);
        message.success("Bateau ajouté");
        const created = res.data;
        setEditing(created);
        form.setFieldsValue({
          ...created,
          dateMeS: created.dateMeS ? dayjs(created.dateMeS) : null,
          dateAchat: created.dateAchat ? dayjs(created.dateAchat) : null,
          dateFinDeGuarantie: created.dateFinDeGuarantie ? dayjs(created.dateFinDeGuarantie) : null,
          modeleId: created.modele?.id || undefined,
          proprietaires: created.proprietaires?.map((p: any) => p.id || p) || [],
          moteurs: created.moteurs?.map((m: any) => m.id || m) || [],
        });
      }
      setFormDirty(false);
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
          {(record.images || []).length > 0 && (
            <Button icon={<TagsOutlined />} size="small" onClick={() => openAnnonceImageModal(record)} title="Creer une annonce" />
          )}
          <Popconfirm title="Supprimer ce bateau ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 160,
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
        title={
          editing ? (
            <Space>
              <span>Modifier le bateau</span>
              {(editing.images || []).length > 0 && (
                <Button
                  size="small"
                  icon={<TagsOutlined />}
                  onClick={() => {
                    setModalVisible(false);
                    openAnnonceImageModal(editing);
                  }}
                >
                  Petites annonces
                </Button>
              )}
            </Space>
          ) : "Ajouter un bateau"
        }
        onCancel={handleModalCancel}
        onOk={handleModalOk}
        okText="Enregistrer"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={form} initialValues={defaultBateau} onValuesChange={(changedValues) => {
            setFormDirty(true);
            if (changedValues.localisationGps) {
              form.setFieldsValue({ localisation: changedValues.localisationGps });
            }
          }}>
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
                <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date achat" name="dateAchat">
                <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Date fin garantie" name="dateFinDeGuarantie">
                <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Localisation" name="localisation">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Localisation GPS" name="localisationGps">
            <LocationPicker />
          </Form.Item>
          {editing && (
            <>
              <Form.Item label="Images" name="images">
                <ImageUpload />
              </Form.Item>
              <Form.Item label="Documents" name="documents">
                <DocumentUpload />
              </Form.Item>
            </>
          )}
          {/* Association avec un bateau du catalogue */}
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
                  {bateauxCatalogue.map((bateau) => (
                    <Select.Option key={bateau.id} value={bateau.id}>
                      {bateau.marque} {bateau.modele} {bateau.annee ? `(${bateau.annee})` : ''}
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
          <Form.Item label="Propriétaires" style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="proprietaires" noStyle>
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
              <Button
                icon={<PlusCircleOutlined />}
                onClick={() => {
                  clientForm.resetFields();
                  setClientModalVisible(true);
                }}
              />
            </Space.Compact>
          </Form.Item>
          <Form.Item label="Moteurs" style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="moteurs" noStyle>
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
              <Button
                icon={<PlusCircleOutlined />}
                onClick={() => {
                  moteurForm.resetFields();
                  setMoteurModalVisible(true);
                }}
              />
            </Space.Compact>
          </Form.Item>
          {/* moteurs, équipements could be handled by extra fields/components if needed */}
        </Form>
      </Modal>
      <Modal
        open={catalogueModalVisible}
        title="Ajouter un modèle catalogue"
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
          initialValues={{ annee: new Date().getFullYear(), tva: 20 }}
          onValuesChange={(changedValues) => {
            if (changedValues.prixVenteHT || changedValues.tva) {
              const prixVenteHT = catalogueForm.getFieldValue('prixVenteHT');
              const tva = catalogueForm.getFieldValue('tva');
              const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
              catalogueForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
              catalogueForm.setFieldValue('prixVenteTTC', prixVenteTTC);
            }
            if (changedValues.prixVenteTTC) {
              const prixVenteTTC = catalogueForm.getFieldValue('prixVenteTTC');
              const tva = catalogueForm.getFieldValue('tva');
              const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
              catalogueForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
              catalogueForm.setFieldValue('prixVenteHT', prixVenteHT);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="marque" label="Marque" rules={[{ required: true, message: "La marque est requise" }]}>
                <AutoComplete
                  allowClear
                  options={bateauxCatalogue.map((b) => ({ value: b.marque })).filter((v, i, a) => a.findIndex((t) => t.value === v.value) === i)}
                  placeholder="Saisir ou sélectionner une marque"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="modele" label="Modèle" rules={[{ required: true, message: "Le modèle est requis" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true, message: "Le type est requis" }]}>
                <Select options={bateauTypes} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="annee" label="Année">
                <InputNumber min={1900} max={new Date().getFullYear()} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Description du bateau" />
          </Form.Item>
          <Form.Item name="evaluation" label="Évaluation">
            <Rate allowHalf />
          </Form.Item>
          <Form.Item name="images" label="Images">
            <ImageUpload />
          </Form.Item>
          <Form.Item name="documents" label="Documents">
            <DocumentUpload />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="longueurExterieure" label="Longueur extérieure">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="longueurCoque" label="Longueur coque">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="hauteur" label="Hauteur">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="largeur" label="Largeur">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tirantAir" label="Tirant d'air">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tirantEau" label="Tirant d'eau">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="m" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="poidsVide" label="Poids à vide">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="poidsMoteurMax" label="Poids moteur max">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="chargeMax" label="Charge max">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="kg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="longueurArbre" label="Longueur arbre">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="puissanceMax" label="Puissance max">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reservoirEau" label="Réservoir eau">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="l" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="reservoirCarburant" label="Réservoir carburant">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="l" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nombrePassagersMax" label="Nombre passagers max">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="categorieCe" label="Catégorie CE">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="stock" label="Stock">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="stockAlerte" label="Stock alerte">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="emplacement" label="Emplacement">
                <Input.TextArea rows={3} placeholder="Emplacement du stock bateau" allowClear={true} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prixPublic" label="Prix public">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="frais" label="Frais">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tauxMarge" label="Taux de marge">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tauxMarque" label="Taux de marque">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prixVenteHT" label="Prix de vente HT">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tva" label="TVA">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="montantTVA" label="Montant TVA">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prixVenteTTC" label="Prix de vente TTC">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Modal
        open={moteurModalVisible}
        title="Ajouter un moteur catalogue"
        onCancel={() => setMoteurModalVisible(false)}
        onOk={handleMoteurAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
      >
        <Form
          layout="vertical"
          form={moteurForm}
          initialValues={{ tva: 20 }}
          onValuesChange={(changedValues) => {
            const CV_TO_KW_FACTOR = 0.735499;
            const roundPower = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
            if (Object.prototype.hasOwnProperty.call(changedValues, 'puissanceCv')
              && !Object.prototype.hasOwnProperty.call(changedValues, 'puissanceKw')) {
              const puissanceCv = Number(moteurForm.getFieldValue('puissanceCv')) || 0;
              moteurForm.setFieldValue('puissanceKw', roundPower(puissanceCv * CV_TO_KW_FACTOR));
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, 'puissanceKw')
              && !Object.prototype.hasOwnProperty.call(changedValues, 'puissanceCv')) {
              const puissanceKw = Number(moteurForm.getFieldValue('puissanceKw')) || 0;
              moteurForm.setFieldValue('puissanceCv', roundPower(puissanceKw / CV_TO_KW_FACTOR));
            }
            if (changedValues.prixVenteHT || changedValues.tva) {
              const prixVenteHT = moteurForm.getFieldValue('prixVenteHT');
              const tva = moteurForm.getFieldValue('tva');
              const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
              moteurForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
              moteurForm.setFieldValue('prixVenteTTC', prixVenteTTC);
            }
            if (changedValues.prixVenteTTC) {
              const prixVenteTTC = moteurForm.getFieldValue('prixVenteTTC');
              const tva = moteurForm.getFieldValue('tva');
              const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
              moteurForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
              moteurForm.setFieldValue('prixVenteHT', prixVenteHT);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="marque" label="Marque" rules={[{ required: true, message: "La marque est requise" }]}>
                <AutoComplete
                  allowClear
                  options={moteursCatalogue.map((m) => ({ value: m.marque })).filter((v, i, a) => a.findIndex((t) => t.value === v.value) === i)}
                  placeholder="Saisir ou sélectionner une marque"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="modele" label="Modèle" rules={[{ required: true, message: "Le modèle est requis" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true, message: "Le type est requis" }]}>
                <Select options={moteurTypes} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="evaluation" label="Évaluation">
                <Rate allowHalf />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="images" label="Images">
            <ImageUpload />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="puissanceCv" label="Puissance">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="cv" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="puissanceKw" label="Puissance">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="kW" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="longueurArbre" label="Longueur arbre">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="arbre" label="Arbre">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} addonAfter="cm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="demarrage" label="Démarrage">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="direction" label="Direction">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cylindres" label="Nombre de cylindres">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cylindree" label="Cylindrée">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="cm3" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="regime" label="Régime Max">
                <InputNumber min={0} step={1} style={{ width: '100%' }} addonAfter="tr/min" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="huileRecommandee" label="Huile recommandée">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="stock" label="Stock">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="stockAlerte" label="Stock alerte">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="emplacement" label="Emplacement">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prixPublic" label="Prix public">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="frais" label="Frais">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tauxMarge" label="Taux de marge">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tauxMarque" label="Taux de marque">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prixVenteHT" label="Prix de vente HT">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tva" label="TVA">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="montantTVA" label="Montant TVA">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prixVenteTTC" label="Prix de vente TTC">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonAfter="€" />
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
        title={`Selectionner des photos pour l'annonce - ${annonceImageBateau?.name || ''}`}
        open={annonceImageModalVisible}
        onCancel={() => setAnnonceImageModalVisible(false)}
        onOk={handleCreateAnnonceFromImages}
        okText={`Creer une annonce (${annonceSelectedImages.size} photo(s))`}
        okButtonProps={{ disabled: annonceSelectedImages.size === 0 }}
        cancelText="Fermer"
        width={700}
      >
        {annonceImageBateau && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Checkbox
                checked={(annonceImageBateau.images || []).length > 0 && annonceSelectedImages.size === (annonceImageBateau.images || []).length}
                indeterminate={annonceSelectedImages.size > 0 && annonceSelectedImages.size < (annonceImageBateau.images || []).length}
                onChange={() => {
                  const imgs = annonceImageBateau.images || [];
                  const allSelected = imgs.every((img) => annonceSelectedImages.has(img));
                  setAnnonceSelectedImages(allSelected ? new Set() : new Set(imgs));
                }}
              >
                Tout selectionner ({annonceSelectedImages.size}/{(annonceImageBateau.images || []).length})
              </Checkbox>
            </div>
            <Image.PreviewGroup>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(annonceImageBateau.images || []).map((url, i) => (
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

export default BateauxClients;
