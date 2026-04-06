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

const { TextArea } = Input;
import {
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  SaveOutlined,
  SearchOutlined,
  ShrinkOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import api from "./api.ts";
import { useReferenceValeurs } from './useReferenceValeurs.ts';
import ImageUpload from './ImageUpload.tsx';

const { Option } = Select;

const defaultProduitCatalogue = {
  nom: '',
  marque: '',
  categorie: '',
  ref: '',
  refs: [],
  images: [],
  description: '',
  evaluation: 0,
  stock: 0,
  stockMini: 0,
  emplacement: '',
  prixPublic: 0,
  frais: 0,
  tauxMarge: 0,
  tauxMarque: 0,
  prixVenteHT: 0,
  tva: 20,
  montantTVA: 0,
  prixVenteTTC: 0,
};

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
  const CATEGORIES = useReferenceValeurs('CATEGORIE_PRODUIT');
  const [associes, setAssocies] = useState<FournisseurProduit[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurProduit> | null>(null);
  const [form] = Form.useForm();
  const [fournisseurModalVisible, setFournisseurModalVisible] = useState(false);
  const [fournisseurForm] = Form.useForm();
  const [produitModalVisible, setProduitModalVisible] = useState(false);
  const [produitForm] = Form.useForm();

  const isProduitMode = !!produitId;
  const isFournisseurMode = !!fournisseurId;

  const fetchAssocies = async () => {
    setLoading(true);
    try {
      let url = "";
      if (isProduitMode && produitId) {
        url = `/catalogue/produits/${produitId}/fournisseurs`;
      } else if (isFournisseurMode && fournisseurId) {
        url = `/fournisseur-produit/fournisseur/${fournisseurId}`;
      }
      if (url) {
        const { data } = await api.get(url);
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
      const { data } = await api.get("/catalogue/produits");
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
      const { data } = await api.get("/catalogue/fournisseurs");
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

  const handleProduitAdd = async () => {
    try {
      const values = await produitForm.validateFields();
      values.images = values.images || [];
      const res = await api.post("/catalogue/produits", values);
      message.success("Produit créé");
      setProduitModalVisible(false);
      produitForm.resetFields();
      await fetchProduits();
      form.setFieldsValue({ produitId: res.data.id });
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la création du produit");
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
      ...defaultFournisseurProduit,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      produit: isProduitMode ? { id: produitId!, nom: "" } : undefined,
    });
    setFormDirty(false);
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  // Edit
  const handleEdit = (record: FournisseurProduit) => {
    setEditing({ ...record, produit: { ...record.produit }, fournisseur: { ...record.fournisseur } });
    setFormDirty(false);
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
      await api.delete(`/fournisseur-produit/${id}`);
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
        const res = await api.put(`/fournisseur-produit/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        // create
        const res = await api.post("/fournisseur-produit", body);
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

  const handleCommander = async (record: FournisseurProduit) => {
    const qte = record.nombreMinACommander || 1;
    const prixUnitaireHT = record.prixAchatHT || 0;
    const tvaRate = record.tva || 20;
    const prixTotalHT = Math.round(prixUnitaireHT * qte * 100) / 100;
    const montantTVALigne = Math.round(prixTotalHT * (tvaRate / 100) * 100) / 100;
    const prixTotalTTC = Math.round((prixTotalHT + montantTVALigne) * 100) / 100;
    const portTotal = Math.round(((record.portForfaitaire || 0) + (record.portParUnite || 0) * qte) * 100) / 100;

    const body = {
      status: "BROUILLON",
      fournisseur: record.fournisseur,
      montantHT: prixTotalHT,
      tva: tvaRate,
      montantTVA: montantTVALigne,
      montantTTC: Math.round((prixTotalTTC + portTotal) * 100) / 100,
      portTotal,
      lignes: [{
        produit: { id: record.produit.id },
        quantite: qte,
        prixUnitaireHT,
        tva: tvaRate,
        montantTVA: montantTVALigne,
        prixTotalHT,
        prixTotalTTC,
      }],
    };

    try {
      await api.post("/commandes-fournisseur", body);
      message.success(`Commande brouillon créée pour ${record.produit.nom} (x${qte})`);
    } catch {
      message.error("Erreur lors de la création de la commande");
    }
  };

  const columns = [
    ...(isProduitMode
      ? [
          {
            title: "Fournisseur",
            key: "fournisseur",
            sorter: (a, b) => (a.fournisseur?.nom || "").localeCompare(b.fournisseur?.nom || ""),
            filters: fournisseurs.map((f) => ({ text: f.nom, value: f.id })),
            onFilter: (value, record) => record.fournisseur?.id === value,
            render: (_: any, record: FournisseurProduit) => <span>{record.fournisseur?.nom || "-"}</span>,
          },
        ]
      : [
          {
            title: "Produit",
            key: "produit",
            sorter: (a, b) => (a.produit?.nom || "").localeCompare(b.produit?.nom || ""),
            filters: produits.map((p) => ({ text: p.nom, value: p.id })),
            onFilter: (value, record) => record.produit?.id === value,
            render: (_: any, record: FournisseurProduit) => (
              <span>
                {record.produit?.nom || "-"}
                {record.produit?.marque ? ` (${record.produit.marque})` : ""}
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
          <Button icon={<ShoppingCartOutlined />} onClick={() => handleCommander(record)} size="small" title="Créer une commande fournisseur" />
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" />
          <Popconfirm title="Confirmer la suppression ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 150,
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
        onCancel={handleModalCancel}
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
        cancelText="Fermer"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurProduit}
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
          {isProduitMode ? (
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
                    {fournisseurs.map((f) => (
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
            <Form.Item label="Produit catalogue" style={{ marginBottom: 0 }}>
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="produitId"
                  rules={[{ required: true, message: "Sélectionnez un produit du catalogue" }]}
                  style={{ flex: 1, marginBottom: 0 }}
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
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    produitForm.resetFields();
                    setProduitModalVisible(true);
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
        open={produitModalVisible}
        title="Nouveau Produit"
        onCancel={() => setProduitModalVisible(false)}
        onOk={handleProduitAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
        maskClosable={false}
      >
        <Form
          layout="vertical"
          form={produitForm}
          initialValues={defaultProduitCatalogue}
          onValuesChange={(changedValues) => {
            if (changedValues.prixVenteHT !== undefined || changedValues.tva !== undefined) {
              const prixVenteHT = produitForm.getFieldValue('prixVenteHT') || 0;
              const tva = produitForm.getFieldValue('tva') || 0;
              const montantTVA = Math.round(((prixVenteHT * (tva / 100)) + Number.EPSILON) * 100) / 100;
              produitForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteTTC = Math.round(((prixVenteHT + montantTVA) + Number.EPSILON) * 100) / 100;
              produitForm.setFieldValue('prixVenteTTC', prixVenteTTC);
            }
            if (changedValues.prixVenteTTC !== undefined) {
              const prixVenteTTC = produitForm.getFieldValue('prixVenteTTC') || 0;
              const tva = produitForm.getFieldValue('tva') || 0;
              const montantTVA = Math.round((((prixVenteTTC / (100 + tva)) * tva) + Number.EPSILON) * 100) / 100;
              produitForm.setFieldValue('montantTVA', montantTVA);
              const prixVenteHT = Math.round(((prixVenteTTC - montantTVA) + Number.EPSILON) * 100) / 100;
              produitForm.setFieldValue('prixVenteHT', prixVenteHT);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="marque" label="Marque">
                <AutoComplete
                  allowClear
                  options={produits.map(p => ({ value: p.marque })).filter((v, i, a) => v.value && a.findIndex(t => t.value === v.value) === i)}
                  placeholder="Saisir/select. une marque"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nom" label="Nom" rules={[{ required: true, message: "Le nom est requis" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="categorie" label="Catégorie" rules={[{ required: true, message: "La catégorie est requise" }]}>
                <Select options={CATEGORIES} placeholder="Choisir une catégorie" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ref" label="Référence interne">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="images" label="Images">
            <ImageUpload />
          </Form.Item>
          <Form.Item name="refs" label="Références complémentaires">
            <Form.List name="refs">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline">
                      <Form.Item
                        {...field}
                        name={[field.name]}
                        fieldKey={[field.fieldKey ?? field.key]}
                        style={{ flex: 1 }}
                      >
                        <Input placeholder="Réf. complémentaire" style={{ width: 200 }} />
                      </Form.Item>
                      <Button icon={<DeleteOutlined />} danger onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block style={{ marginTop: 8 }}>
                    Ajouter une référence
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Description du produit" allowClear />
          </Form.Item>
          <Form.Item name="evaluation" label="Évaluation">
            <Rate allowHalf />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="stock" label="Stock">
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="stockMini" label="Stock minimal d'alerte">
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
              <Form.Item name="tauxMarge" label="Taux de marge (%)">
                <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tauxMarque" label="Taux de marque (%)">
                <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
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
              <Form.Item name="tva" label="TVA (%)">
                <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} addonAfter="%" />
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

export default FournisseurProduits;

