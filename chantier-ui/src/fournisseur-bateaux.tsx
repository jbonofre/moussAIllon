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
  AutoComplete,
  Image,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  SaveOutlined,
  SearchOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";

const { TextArea } = Input;
import api from "./api.ts";
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import ImageUpload from './ImageUpload.tsx';

const { Option } = Select;

const defaultBateauCatalogue = {
  modele: '',
  marque: '',
  annee: 2025,
  images: [],
  type: '',
  longueurExterieure: 0,
  longueurCoque: 0,
  hauteur: 0,
  largeur: 0,
  tirantAir: 0,
  tirantEau: 0,
  poidsVide: 0,
  poidsMoteurMax: 0,
  chargeMax: 0,
  longueurArbre: '',
  puissanceMax: '',
  reservoirEau: 0,
  reservoirCarburant: 0,
  nombrePassagersMax: 0,
  categorieCe: '',
  tva: 20,
  montantTVA: 0,
  prixVenteTTC: 0,
  prixVenteHT: 0,
  tauxMarge: 0,
  tauxMarque: 0,
  prixPublic: 0,
  frais: 0,
  stock: 0,
  stockAlerte: 0,
  emplacement: '',
  evaluation: 0,
  description: '',
};

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
  const bateauTypes = useReferenceValeurs('TYPE_BATEAU');
  const [bateauxAssocies, setBateauxAssocies] = useState<FournisseurBateau[]>([]);
  const [bateauxCatalogue, setBateauxCatalogue] = useState<Bateau[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurBateau> | null>(null);
  const [form] = Form.useForm();
  const [fournisseurModalVisible, setFournisseurModalVisible] = useState(false);
  const [fournisseurForm] = Form.useForm();
  const [bateauModalVisible, setBateauModalVisible] = useState(false);
  const [bateauForm] = Form.useForm();

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
        const { data } = await api.get(url);
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
      const { data } = await api.get("/catalogue/bateaux");
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
      const { data } = await api.get("/catalogue/fournisseurs");
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

  const handleBateauAdd = async () => {
    try {
      const values = await bateauForm.validateFields();
      const res = await api.post("/catalogue/bateaux", values);
      message.success("Bateau créé");
      setBateauModalVisible(false);
      bateauForm.resetFields();
      await fetchBateauxCatalogue();
      form.setFieldsValue({ bateauId: res.data.id });
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la création du bateau");
    }
  };

  const handleFournisseurAdd = async () => {
    try {
      const values = await fournisseurForm.validateFields();
      const res = await api.post("/catalogue/fournisseurs", values);
      message.success("Fournisseur créé");
      setFournisseurModalVisible(false);
      fournisseurForm.resetFields();
      await fetchFournisseurs();
      form.setFieldsValue({ fournisseurId: res.data.id });
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la création du fournisseur");
    }
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

  // Add
  const handleNew = () => {
    setEditing({
      ...defaultFournisseurBateau,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      bateau: isBateauMode ? { id: bateauId!, marque: "", modele: "" } : undefined,
    });
    setFormDirty(false);
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  // Edit
  const handleEdit = (record: FournisseurBateau) => {
    setEditing({ ...record, bateau: { ...record.bateau }, fournisseur: { ...record.fournisseur } });
    setFormDirty(false);
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
      await api.delete(`/fournisseur-bateau/${id}`);
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
        const res = await api.put(`/fournisseur-bateau/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        // create
        const res = await api.post("/fournisseur-bateau", body);
        message.success("Ajouté avec succès");
        setEditing(res.data);
      }
      setFormDirty(false);
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
      key: "fournisseur",
      sorter: (a, b) => (a.fournisseur?.nom || "").localeCompare(b.fournisseur?.nom || ""),
      filters: fournisseurs.map(f => ({ text: f.nom, value: f.id })),
      onFilter: (value, record) => record.fournisseur?.id === value,
      render: (_: any, record: FournisseurBateau) =>
        <span>{record.fournisseur?.nom || "-"}</span>
    }] : [{
      title: "Bateau",
      key: "bateau",
      sorter: (a, b) => (a.bateau?.marque || "").localeCompare(b.bateau?.marque || "") || (a.bateau?.modele || "").localeCompare(b.bateau?.modele || ""),
      filters: bateauxCatalogue.map(b => ({ text: b.marque + " " + b.modele, value: b.id })),
      onFilter: (value, record) => record.bateau?.id === value,
      render: (_: any, record: FournisseurBateau) =>
        <span>{record.bateau?.marque || "-"} {record.bateau?.modele || ""}</span>
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
        onCancel={handleModalCancel}
        onOk={handleModalOk}
        destroyOnHidden
        title={editing && editing.id ? "Modifier l'association" : (isBateauMode ? "Associer un Fournisseur" : "Associer un Bateau")}
        okText="Enregistrer"
        cancelText="Fermer"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurBateau}
          onValuesChange={(changed, all) => {
            setFormDirty(true);
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
            <Form.Item label="Fournisseur" style={{ marginBottom: 0 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="fournisseurId"
                  rules={[{ required: true, message: "Sélectionnez un fournisseur" }]}
                  style={{ flex: 1, marginBottom: 0 }}
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
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    fournisseurForm.resetFields();
                    setFournisseurModalVisible(true);
                  }}
                />
              </Space.Compact>
            </Form.Item>
          ) : (
            <Form.Item label="Bateau catalogue" style={{ marginBottom: 0 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="bateauId"
                  rules={[{ required: true, message: "Sélectionnez un bateau du catalogue" }]}
                  style={{ flex: 1, marginBottom: 0 }}
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
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    bateauForm.resetFields();
                    setBateauModalVisible(true);
                  }}
                />
              </Space.Compact>
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

      <Modal
        open={fournisseurModalVisible}
        title="Nouveau Fournisseur"
        onCancel={() => setFournisseurModalVisible(false)}
        onOk={handleFournisseurAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={fournisseurForm} initialValues={{ evaluation: 0 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Nom" name="nom" rules={[{ required: true, message: "Champ requis" }]}>
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
        </Form>
      </Modal>

      <Modal
        open={bateauModalVisible}
        title="Nouveau Bateau"
        onCancel={() => setBateauModalVisible(false)}
        onOk={handleBateauAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
        maskClosable={false}
      >
        <Form
          layout="vertical"
          form={bateauForm}
          initialValues={defaultBateauCatalogue}
          onValuesChange={(changedValues) => {
            if (changedValues.prixVenteHT || changedValues.tva) {
              const prixVenteHT = bateauForm.getFieldValue('prixVenteHT');
              const tva = bateauForm.getFieldValue('tva');
              const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
              bateauForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
              bateauForm.setFieldValue('prixVenteTTC', prixVenteTTC);
            }
            if (changedValues.prixVenteTTC) {
              const prixVenteTTC = bateauForm.getFieldValue('prixVenteTTC');
              const tva = bateauForm.getFieldValue('tva');
              const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
              bateauForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
              bateauForm.setFieldValue('prixVenteHT', prixVenteHT);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="marque" label="Marque" rules={[{ required: true }]}>
                <AutoComplete
                  allowClear
                  options={bateauxCatalogue.map(b => ({ value: b.marque })).filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)}
                  placeholder="Saisir ou sélectionner une marque"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="modele" label="Modèle" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
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
    </Card>
  );
};

export default FournisseurBateaux;
