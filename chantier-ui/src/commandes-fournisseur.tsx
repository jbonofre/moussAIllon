import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  InputNumber,
  Input,
  Select,
  Popconfirm,
  message,
  Space,
  Card,
  Row,
  Col,

  Tag,
  DatePicker,
  Divider,
  Rate,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import api from "./api.ts";
import dayjs from "dayjs";

const { Option } = Select;
const { TextArea, Search } = Input;

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

type Bateau = {
  id: number;
  marque: string;
  modele: string;
};

type Moteur = {
  id: number;
  marque: string;
  modele: string;
};

type Helice = {
  id: number;
  marque: string;
  modele: string;
};

type FournisseurProduit = {
  id: number;
  produit: Produit;
  prixAchatHT: number;
  tva: number;
  montantTVA: number;
  prixAchatTTC: number;
  portForfaitaire: number;
  portParUnite: number;
  nombreMinACommander: number;
};

type FournisseurBateau = {
  id: number;
  bateau: Bateau;
  prixAchatHT: number;
  tva: number;
};

type FournisseurMoteur = {
  id: number;
  moteur: Moteur;
  prixAchatHT: number;
  tva: number;
};

type FournisseurHelice = {
  id: number;
  helice: Helice;
  prixAchatHT: number;
  tva: number;
};

type ArticleType = "produit" | "bateau" | "moteur" | "helice";

type ArticleItem = {
  key: string;
  type: ArticleType;
  id: number;
  label: string;
  prixAchatHT: number;
  tva: number;
};

type CommandeFournisseurLigne = {
  id?: number;
  produit?: Produit;
  bateau?: Bateau;
  moteur?: Moteur;
  helice?: Helice;
  articleKey?: string;
  quantite: number;
  prixUnitaireHT: number;
  tva: number;
  montantTVA: number;
  prixTotalHT: number;
  prixTotalTTC: number;
};

type CommandeFournisseurStatus = "BROUILLON" | "EN_ATTENTE" | "CONFIRMEE" | "EXPEDIEE" | "RECUE" | "ANNULEE";

type CommandeFournisseur = {
  id?: number;
  status: CommandeFournisseurStatus;
  fournisseur: Fournisseur;
  date?: string;
  dateReception?: string;
  reference?: string;
  referenceFournisseur?: string;
  lignes: CommandeFournisseurLigne[];
  montantHT: number;
  tva: number;
  montantTVA: number;
  montantTTC: number;
  portTotal: number;
  notes?: string;
  stockIncremented: boolean;
};

const statusColors: Record<CommandeFournisseurStatus, string> = {
  BROUILLON: "default",
  EN_ATTENTE: "orange",
  CONFIRMEE: "blue",
  EXPEDIEE: "cyan",
  RECUE: "green",
  ANNULEE: "red",
};

const statusLabels: Record<CommandeFournisseurStatus, string> = {
  BROUILLON: "Brouillon",
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  RECUE: "Reçue",
  ANNULEE: "Annulée",
};

const CommandesFournisseur = ({ fournisseurId }: { fournisseurId?: number }) => {
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<CommandeFournisseur | null>(null);
  const [lignes, setLignes] = useState<CommandeFournisseurLigne[]>([]);
  const [selectedFournisseurId, setSelectedFournisseurId] = useState<number | undefined>(fournisseurId);
  const [form] = Form.useForm();
  const [formDirty, setFormDirty] = useState(false);
  const [fournisseurModalVisible, setFournisseurModalVisible] = useState(false);
  const [fournisseurForm] = Form.useForm();
  const [fournisseurFormDirty, setFournisseurFormDirty] = useState(false);

  const fetchCommandes = async () => {
    setLoading(true);
    try {
      const url = fournisseurId
        ? `/commandes-fournisseur/search?fournisseurId=${fournisseurId}`
        : "/commandes-fournisseur";
      const { data } = await api.get(url);
      setCommandes(data);
    } catch {
      message.error("Erreur lors du chargement des commandes fournisseur");
    } finally {
      setLoading(false);
    }
  };

  const fetchFournisseurs = async () => {
    try {
      const { data } = await api.get("/catalogue/fournisseurs");
      setFournisseurs(data);
    } catch {
      message.error("Erreur lors du chargement des fournisseurs");
    }
  };

  const fetchFournisseurArticles = async (fId: number) => {
    try {
      const [produits, bateaux, moteurs, helices] = await Promise.all([
        api.get(`/fournisseur-produit/fournisseur/${fId}`),
        api.get(`/fournisseur-bateau/fournisseur/${fId}`),
        api.get(`/fournisseur-moteur/fournisseur/${fId}`),
        api.get(`/fournisseur-helice/fournisseur/${fId}`),
      ]);
      const items: ArticleItem[] = [
        ...(produits.data as FournisseurProduit[]).filter((fp) => fp.produit).map((fp) => ({
          key: `produit-${fp.produit.id}`,
          type: "produit" as ArticleType,
          id: fp.produit.id,
          label: `${fp.produit.nom}${fp.produit.marque ? ` (${fp.produit.marque})` : ""}`,
          prixAchatHT: fp.prixAchatHT,
          tva: fp.tva,
        })),
        ...(bateaux.data as FournisseurBateau[]).filter((fb) => fb.bateau).map((fb) => ({
          key: `bateau-${fb.bateau.id}`,
          type: "bateau" as ArticleType,
          id: fb.bateau.id,
          label: `${fb.bateau.marque} ${fb.bateau.modele}`,
          prixAchatHT: fb.prixAchatHT,
          tva: fb.tva,
        })),
        ...(moteurs.data as FournisseurMoteur[]).filter((fm) => fm.moteur).map((fm) => ({
          key: `moteur-${fm.moteur.id}`,
          type: "moteur" as ArticleType,
          id: fm.moteur.id,
          label: `${fm.moteur.marque} ${fm.moteur.modele}`,
          prixAchatHT: fm.prixAchatHT,
          tva: fm.tva,
        })),
        ...(helices.data as FournisseurHelice[]).filter((fh) => fh.helice).map((fh) => ({
          key: `helice-${fh.helice.id}`,
          type: "helice" as ArticleType,
          id: fh.helice.id,
          label: `${fh.helice.marque} ${fh.helice.modele}`,
          prixAchatHT: fh.prixAchatHT,
          tva: fh.tva,
        })),
      ];
      setArticles(items);
    } catch {
      message.error("Erreur lors du chargement des articles du fournisseur");
    }
  };

  const handleFournisseurAdd = async () => {
    try {
      const values = await fournisseurForm.validateFields();
      const res = await api.post("/catalogue/fournisseurs", values);
      message.success("Fournisseur créé");
      setFournisseurFormDirty(false);
      setFournisseurModalVisible(false);
      fournisseurForm.resetFields();
      await fetchFournisseurs();
      form.setFieldsValue({ fournisseurId: res.data.id });
      handleFournisseurChange(res.data.id);
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la création du fournisseur");
    }
  };

  useEffect(() => {
    fetchCommandes();
    if (fournisseurId) {
      fetchFournisseurArticles(fournisseurId);
    } else {
      fetchFournisseurs();
    }
  }, [fournisseurId]);

  const recalcTotals = (currentLignes: CommandeFournisseurLigne[], portOverride?: number) => {
    const montantHT = currentLignes.reduce((sum, l) => sum + l.prixTotalHT, 0);
    const montantTVA = currentLignes.reduce((sum, l) => sum + l.montantTVA, 0);
    const montantTTC = currentLignes.reduce((sum, l) => sum + l.prixTotalTTC, 0);
    const portTotal = portOverride !== undefined ? portOverride : (form.getFieldValue("portTotal") || 0);
    form.setFieldsValue({
      montantHT: Math.round(montantHT * 100) / 100,
      montantTVA: Math.round(montantTVA * 100) / 100,
      montantTTC: Math.round((montantTTC + portTotal) * 100) / 100,
    });
  };

  const handleFournisseurChange = (fId: number) => {
    setSelectedFournisseurId(fId);
    setLignes([emptyLigne()]);
    setArticles([]);
    fetchFournisseurArticles(fId);
  };

  const handleSearch = async (value: string) => {
    setLoading(true);
    try {
      const params: any = { q: value };
      if (fournisseurId) params.fournisseurId = fournisseurId;
      const { data } = await api.get("/commandes-fournisseur/search", { params });
      setCommandes(data);
    } catch {
      message.error("Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditing(null);
    setLignes([emptyLigne()]);
    setArticles([]);
    if (!fournisseurId) {
      setSelectedFournisseurId(undefined);
    } else {
      fetchFournisseurArticles(fournisseurId);
    }
    form.resetFields();
    form.setFieldsValue({
      status: "BROUILLON",
      date: dayjs(),
      portTotal: 0,
      montantHT: 0,
      montantTVA: 0,
      montantTTC: 0,
      tva: 20,
    });
    setFormDirty(false);
    setModalVisible(true);
  };

  const handleEdit = (record: CommandeFournisseur) => {
    setEditing(record);
    const editLignes = (record.lignes || []).map((l) => {
      let articleKey: string | undefined;
      if (l.produit?.id) articleKey = `produit-${l.produit.id}`;
      else if (l.bateau?.id) articleKey = `bateau-${l.bateau.id}`;
      else if (l.moteur?.id) articleKey = `moteur-${l.moteur.id}`;
      else if (l.helice?.id) articleKey = `helice-${l.helice.id}`;
      return { ...l, articleKey };
    });
    setLignes([...editLignes, emptyLigne()]);
    if (record.fournisseur?.id) {
      setSelectedFournisseurId(record.fournisseur.id);
      fetchFournisseurArticles(record.fournisseur.id);
    }
    form.setFieldsValue({
      ...record,
      fournisseurId: record.fournisseur?.id,
      date: record.date ? dayjs(record.date) : undefined,
      dateReception: record.dateReception ? dayjs(record.dateReception) : undefined,
    });
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

  const handleFournisseurModalCancel = () => {
    if (fournisseurFormDirty) {
      Modal.confirm({
        title: "Modifications non enregistrées",
        content: "Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?",
        okText: "Fermer",
        cancelText: "Annuler",
        onOk: () => {
          setFournisseurFormDirty(false);
          setFournisseurModalVisible(false);
        },
      });
    } else {
      setFournisseurModalVisible(false);
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    setLoading(true);
    try {
      await api.delete(`/commandes-fournisseur/${id}`);
      message.success("Commande supprimée");
      fetchCommandes();
    } catch {
      message.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  const emptyLigne = (): CommandeFournisseurLigne => ({ quantite: 0, prixUnitaireHT: 0, tva: 20, montantTVA: 0, prixTotalHT: 0, prixTotalTTC: 0 });

  const isLigneComplete = (l: CommandeFournisseurLigne) => !!l.articleKey && l.quantite > 0;

  const handleRemoveLigne = (index: number) => {
    const updated = lignes.filter((_, i) => i !== index);
    if (updated.length === 0) {
      setLignes([emptyLigne()]);
      recalcTotals([]);
    } else {
      setLignes(updated);
      recalcTotals(updated);
    }
  };

  const handleLigneChange = (index: number, field: string, value: any) => {
    const updated = [...lignes];
    const ligne = { ...updated[index], [field]: value };

    if (field === "articleKey") {
      const article = articles.find((a) => a.key === value);
      if (article) {
        ligne.articleKey = article.key;
        ligne.produit = undefined;
        ligne.bateau = undefined;
        ligne.moteur = undefined;
        ligne.helice = undefined;
        if (article.type === "produit") ligne.produit = { id: article.id, nom: article.label };
        else if (article.type === "bateau") ligne.bateau = { id: article.id, marque: "", modele: article.label };
        else if (article.type === "moteur") ligne.moteur = { id: article.id, marque: "", modele: article.label };
        else if (article.type === "helice") ligne.helice = { id: article.id, marque: "", modele: article.label };
        ligne.prixUnitaireHT = article.prixAchatHT;
        ligne.tva = article.tva;
      }
    }

    // Recalculate line totals
    ligne.prixTotalHT = Math.round(ligne.prixUnitaireHT * ligne.quantite * 100) / 100;
    ligne.montantTVA = Math.round(ligne.prixTotalHT * (ligne.tva / 100) * 100) / 100;
    ligne.prixTotalTTC = Math.round((ligne.prixTotalHT + ligne.montantTVA) * 100) / 100;

    updated[index] = ligne;

    // Auto-add a new empty line when the last line is complete
    const lastLine = updated[updated.length - 1];
    if (isLigneComplete(lastLine)) {
      updated.push(emptyLigne());
    }

    setLignes(updated);
    recalcTotals(updated);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const body: any = {
        ...values,
        fournisseur: { id: fournisseurId || values.fournisseurId },
        date: values.date ? values.date.format("YYYY-MM-DD HH:mm:ss") : null,
        dateReception: values.dateReception ? values.dateReception.format("YYYY-MM-DD HH:mm:ss") : null,
        lignes: lignes.filter((l) => l.articleKey && l.quantite > 0).map((l) => ({
          produit: l.produit ? { id: l.produit.id } : null,
          bateau: l.bateau ? { id: l.bateau.id } : null,
          moteur: l.moteur ? { id: l.moteur.id } : null,
          helice: l.helice ? { id: l.helice.id } : null,
          quantite: l.quantite,
          prixUnitaireHT: l.prixUnitaireHT,
          tva: l.tva,
          montantTVA: l.montantTVA,
          prixTotalHT: l.prixTotalHT,
          prixTotalTTC: l.prixTotalTTC,
        })),
        stockIncremented: editing?.stockIncremented || false,
      };
      delete body.fournisseurId;

      setLoading(true);
      if (editing && editing.id) {
        await api.put(`/commandes-fournisseur/${editing.id}`, body);
        message.success("Commande modifiée");
      } else {
        await api.post("/commandes-fournisseur", body);
        message.success("Commande créée");
      }
      setFormDirty(false);
      setModalVisible(false);
      fetchCommandes();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Référence", dataIndex: "reference", key: "reference", sorter: (a: any, b: any) => (a.reference || "").localeCompare(b.reference || "") },
    ...(!fournisseurId
      ? [{
          title: "Fournisseur",
          key: "fournisseur",
          render: (_: any, record: CommandeFournisseur) => record.fournisseur?.nom || "-",
          sorter: (a: any, b: any) => (a.fournisseur?.nom || "").localeCompare(b.fournisseur?.nom || ""),
        }]
      : []),
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (val: string) => (val ? dayjs(val).format("DD/MM/YYYY") : "-"),
      sorter: (a: any, b: any) => (a.date || "").localeCompare(b.date || ""),
    },
    {
      title: "Statut",
      dataIndex: "status",
      key: "status",
      render: (val: CommandeFournisseurStatus) => (
        <Tag color={statusColors[val]}>{statusLabels[val] || val}</Tag>
      ),
      filters: Object.keys(statusLabels).map((k) => ({ text: statusLabels[k as CommandeFournisseurStatus], value: k })),
      onFilter: (value: any, record: any) => record.status === value,
    },
    {
      title: "Nb lignes",
      key: "nbLignes",
      render: (_: any, record: CommandeFournisseur) => record.lignes?.length || 0,
    },
    {
      title: "Montant TTC",
      dataIndex: "montantTTC",
      key: "montantTTC",
      render: (val: number) => `${(val || 0).toFixed(2)} €`,
      sorter: (a: any, b: any) => (a.montantTTC || 0) - (b.montantTTC || 0),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: CommandeFournisseur) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" />
          <Popconfirm title="Confirmer la suppression ?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
      width: 110,
    },
  ];

  return (
    <Card
      title="Commandes Fournisseur"
      style={fournisseurId ? { marginTop: 24 } : undefined}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div style={{ paddingBottom: 16 }}>
            <Space>
              <Search allowClear placeholder="Rechercher" enterButton={<SearchOutlined />} style={{ width: 600 }} onSearch={handleSearch} />
              <Button type="primary" icon={<PlusCircleOutlined />} onClick={handleNew} />
            </Space>
          </div>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={commandes}
            loading={loading}
            bordered
            pagination={{ pageSize: 10 }}
          />
        </Col>
      </Row>

      <Modal
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleModalOk}
        destroyOnHidden
        width={1024}
        title={editing ? "Modifier la commande" : "Nouvelle commande fournisseur"}
        okText="Enregistrer"
        cancelText="Fermer"
        maskClosable={false}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" onValuesChange={() => setFormDirty(true)}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Statut"
                name="status"
                rules={[{ required: true, message: "Statut requis" }]}
              >
                <Select>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Référence" name="reference">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Réf. fournisseur" name="referenceFournisseur">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          {!fournisseurId && (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item label="Fournisseur" style={{ marginBottom: 0 }}>
                  <Space.Compact style={{ width: "100%" }}>
                    <Form.Item
                      name="fournisseurId"
                      rules={[{ required: true, message: "Fournisseur requis" }]}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <Select
                        showSearch
                        placeholder="Sélectionner un fournisseur"
                        optionFilterProp="children"
                        filterOption={(input, option: any) =>
                          `${option.children}`.toLowerCase().includes(input.toLowerCase())
                        }
                        onChange={handleFournisseurChange}
                      >
                        {fournisseurs.map((f) => (
                          <Option key={f.id} value={f.id}>{f.nom}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Button
                      icon={<PlusCircleOutlined />}
                      onClick={() => {
                        fournisseurForm.resetFields();
                        setFournisseurFormDirty(false);
                        setFournisseurModalVisible(true);
                      }}
                    />
                  </Space.Compact>
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Date" name="date">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date de réception" name="dateReception">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Lignes de commande</Divider>

          {lignes.map((ligne, index) => (
            <Row gutter={8} key={index} align="middle" style={{ marginBottom: 8 }}>
              <Col span={8}>
                <Select
                  showSearch
                  placeholder="Article"
                  optionFilterProp="label"
                  value={ligne.articleKey}
                  onChange={(val) => handleLigneChange(index, "articleKey", val)}
                  style={{ width: "100%" }}
                  options={[
                    { label: "Produits", options: articles.filter((a) => a.type === "produit").map((a) => ({ value: a.key, label: a.label })) },
                    { label: "Bateaux", options: articles.filter((a) => a.type === "bateau").map((a) => ({ value: a.key, label: a.label })) },
                    { label: "Moteurs", options: articles.filter((a) => a.type === "moteur").map((a) => ({ value: a.key, label: a.label })) },
                    { label: "Hélices", options: articles.filter((a) => a.type === "helice").map((a) => ({ value: a.key, label: a.label })) },
                  ].filter((g) => g.options.length > 0)}
                />
              </Col>
              <Col span={3}>
                <InputNumber
                  min={0}
                  placeholder="Qté"
                  value={ligne.quantite || undefined}
                  onChange={(val) => handleLigneChange(index, "quantite", val || 0)}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={4}>
                <InputNumber
                  min={0}
                  placeholder="Prix unit. HT"
                  value={ligne.prixUnitaireHT}
                  onChange={(val) => handleLigneChange(index, "prixUnitaireHT", val || 0)}
                  style={{ width: "100%" }}
                  addonAfter="€"
                />
              </Col>
              <Col span={3}>
                <InputNumber
                  min={0}
                  max={100}
                  placeholder="TVA %"
                  value={ligne.tva}
                  onChange={(val) => handleLigneChange(index, "tva", val || 0)}
                  style={{ width: "100%" }}
                  addonAfter="%"
                />
              </Col>
              <Col span={4}>
                <InputNumber
                  value={ligne.prixTotalTTC}
                  disabled
                  style={{ width: "100%" }}
                  addonAfter="€"
                />
              </Col>
              <Col span={2}>
                <Button
                  icon={<MinusCircleOutlined />}
                  danger
                  onClick={() => handleRemoveLigne(index)}
                  size="small"
                />
              </Col>
            </Row>
          ))}


          <Divider orientation="left">Totaux</Divider>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="Port total (€)" name="portTotal">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  onChange={(val) => recalcTotals(lignes, val || 0)}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Montant HT (€)" name="montantHT">
                <InputNumber disabled style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Montant TVA (€)" name="montantTVA">
                <InputNumber disabled style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Montant TTC (€)" name="montantTTC">
                <InputNumber disabled style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Notes" name="notes">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={fournisseurModalVisible}
        title="Nouveau Fournisseur"
        onCancel={handleFournisseurModalCancel}
        onOk={handleFournisseurAdd}
        okText="Ajouter"
        cancelText="Fermer"
        destroyOnHidden
        width={1024}
      >
        <Form layout="vertical" form={fournisseurForm} initialValues={{ evaluation: 0 }} onValuesChange={() => setFournisseurFormDirty(true)}>
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
    </Card>
  );
};

export default CommandesFournisseur;
