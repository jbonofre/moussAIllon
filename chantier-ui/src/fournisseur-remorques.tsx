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
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Option } = Select;

type Fournisseur = {
  id: number;
  nom: string;
};

type Remorque = {
  id: number;
  marque: string;
  modele: string;
};

type FournisseurRemorque = {
  id?: number;
  fournisseur: Fournisseur;
  remorque: Remorque;
  prixAchatHT?: number;
  tva?: number;
  montantTVA?: number;
  prixAchatTTC?: number;
  portForfaitaire?: number;
  portParUnite?: number;
  nombreMinACommander?: number;
  notes?: string;
};

const defaultFournisseurRemorque: Partial<FournisseurRemorque> = {
  prixAchatHT: 0,
  tva: 20,
  montantTVA: 0,
  prixAchatTTC: 0,
  portForfaitaire: 0,
  portParUnite: 0,
  nombreMinACommander: 1,
  notes: "",
};

const FournisseurRemorques = ({
  fournisseurId,
  remorqueId,
}: {
  fournisseurId?: number;
  remorqueId?: number;
}) => {
  const [remorquesAssocies, setRemorquesAssocies] = useState<FournisseurRemorque[]>([]);
  const [remorquesCatalogue, setRemorquesCatalogue] = useState<Remorque[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Partial<FournisseurRemorque> | null>(null);
  const [form] = Form.useForm();

  const isRemorqueMode = !!remorqueId;
  const isFournisseurMode = !!fournisseurId;

  const fetchAssocies = async () => {
    setLoading(true);
    try {
      let url = "";
      if (isRemorqueMode && remorqueId) {
        url = `/fournisseur-remorque/search?remorqueId=${remorqueId}`;
      } else if (isFournisseurMode && fournisseurId) {
        url = `/fournisseur-remorque/fournisseur/${fournisseurId}`;
      }
      if (url) {
        const { data } = await axios.get(url);
        setRemorquesAssocies(data);
      }
    } catch {
      message.error("Erreur lors du chargement des associations");
    } finally {
      setLoading(false);
    }
  };

  const fetchRemorquesCatalogue = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/catalogue/remorques");
      setRemorquesCatalogue(data);
    } catch {
      message.error("Erreur lors du chargement du catalogue de remorques");
    } finally {
      setLoading(false);
    }
  };

  const fetchFournisseurs = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/catalogue/fournisseurs");
      setFournisseurs(data);
    } catch {
      message.error("Erreur lors du chargement des fournisseurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fournisseurId || remorqueId) {
      fetchAssocies();
      if (isRemorqueMode) {
        fetchFournisseurs();
      } else {
        fetchRemorquesCatalogue();
      }
    }
  }, [fournisseurId, remorqueId]);

  const handleNew = () => {
    setEditing({
      ...defaultFournisseurRemorque,
      fournisseur: isFournisseurMode ? { id: fournisseurId!, nom: "" } : undefined,
      remorque: isRemorqueMode ? { id: remorqueId!, marque: "", modele: "" } : undefined,
    });
    setModalVisible(true);
    setTimeout(() => form.resetFields());
  };

  const handleEdit = (record: FournisseurRemorque) => {
    setEditing({
      ...record,
      remorque: { ...record.remorque },
      fournisseur: { ...record.fournisseur },
    });
    setModalVisible(true);
    setTimeout(() => {
      if (isRemorqueMode) {
        form.setFieldsValue({ ...record, fournisseurId: record.fournisseur.id });
      } else {
        form.setFieldsValue({ ...record, remorqueId: record.remorque.id });
      }
    });
  };

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    setLoading(true);
    try {
      await axios.delete(`/fournisseur-remorque/${id}`);
      message.success("Supprimé avec succès");
      fetchAssocies();
    } catch {
      message.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      let body: FournisseurRemorque;

      if (isRemorqueMode) {
        const selectedFournisseur = fournisseurs.find((f) => f.id === values.fournisseurId);
        body = {
          ...editing,
          ...values,
          fournisseur: selectedFournisseur!,
          remorque: { id: remorqueId!, marque: "", modele: "" },
        };
      } else {
        const selectedRemorque = remorquesCatalogue.find((r) => r.id === values.remorqueId);
        body = {
          ...editing,
          ...values,
          remorque: selectedRemorque!,
          fournisseur: { id: fournisseurId!, nom: "" },
        };
      }

      setLoading(true);

      if (editing && editing.id) {
        const res = await axios.put(`/fournisseur-remorque/${editing.id}`, body);
        message.success("Modifié avec succès");
        setEditing(res.data);
      } else {
        const res = await axios.post("/fournisseur-remorque", body);
        message.success("Ajouté avec succès");
        setEditing(res.data);
      }
      fetchAssocies();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    ...(isRemorqueMode
      ? [
          {
            title: "Fournisseur",
            dataIndex: ["fournisseur", "id"],
            key: "fournisseur",
            sorter: (a: FournisseurRemorque, b: FournisseurRemorque) =>
              (a.fournisseur.nom || "").localeCompare(b.fournisseur.nom || ""),
            filters: fournisseurs.map((f) => ({ text: f.nom, value: f.id })),
            onFilter: (value: any, record: FournisseurRemorque) => record.fournisseur.id === value,
            render: (_: any, record: FournisseurRemorque) => <span>{record.fournisseur.nom}</span>,
          },
        ]
      : [
          {
            title: "Remorque",
            dataIndex: ["remorque", "id"],
            key: "remorque",
            sorter: (a: FournisseurRemorque, b: FournisseurRemorque) =>
              (a.remorque.marque + " " + a.remorque.modele).localeCompare(
                b.remorque.marque + " " + b.remorque.modele
              ),
            filters: remorquesCatalogue.map((r) => ({
              text: r.marque + " " + r.modele,
              value: r.id,
            })),
            onFilter: (value: any, record: FournisseurRemorque) => record.remorque.id === value,
            render: (_: any, record: FournisseurRemorque) => (
              <span>
                {record.remorque.marque} {record.remorque.modele}
              </span>
            ),
          },
        ]),
    { title: "Prix Achat HT", dataIndex: "prixAchatHT", key: "prixAchatHT", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.prixAchatHT ?? 0) - (b.prixAchatHT ?? 0) },
    { title: "TVA (%)", dataIndex: "tva", key: "tva", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.tva ?? 0) - (b.tva ?? 0) },
    { title: "Montant TVA", dataIndex: "montantTVA", key: "montantTVA", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.montantTVA ?? 0) - (b.montantTVA ?? 0) },
    { title: "Prix Achat TTC", dataIndex: "prixAchatTTC", key: "prixAchatTTC", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.prixAchatTTC ?? 0) - (b.prixAchatTTC ?? 0) },
    { title: "Port forfaitaire", dataIndex: "portForfaitaire", key: "portForfaitaire", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.portForfaitaire ?? 0) - (b.portForfaitaire ?? 0) },
    { title: "Port/unité", dataIndex: "portParUnite", key: "portParUnite", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.portParUnite ?? 0) - (b.portParUnite ?? 0) },
    { title: "Qte min. commande", dataIndex: "nombreMinACommander", key: "nombreMinACommander", sorter: (a: FournisseurRemorque, b: FournisseurRemorque) => (a.nombreMinACommander ?? 0) - (b.nombreMinACommander ?? 0) },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: FournisseurRemorque) => (
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
      title={isRemorqueMode ? "Fournisseurs pour cette remorque" : "Catalogue Remorques"}
      extra={
        <Button type="primary" icon={<ShrinkOutlined />} onClick={handleNew}>
          {isRemorqueMode ? "Associer un fournisseur" : "Associer une remorque"}
        </Button>
      }
      style={{ marginTop: 24 }}
    >
      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={remorquesAssocies}
          bordered
          pagination={{ pageSize: 10 }}
        />
      </Spin>

      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalOk}
        destroyOnHidden
        title={
          editing && editing.id
            ? "Modifier l'association"
            : isRemorqueMode
            ? "Associer un Fournisseur"
            : "Associer une Remorque"
        }
        okText="Enregistrer"
        cancelText="Annuler"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={editing || defaultFournisseurRemorque}
          onValuesChange={(changed, all) => {
            if ("prixAchatHT" in changed || "tva" in changed) {
              let prixAchatHT = all.prixAchatHT ?? 0;
              let tva = all.tva ?? 20;
              let montantTVA = prixAchatHT * (tva / 100);
              let prixAchatTTC = prixAchatHT + montantTVA;
              form.setFieldsValue({ montantTVA, prixAchatTTC });
            }
          }}
        >
          {isRemorqueMode ? (
            <Form.Item
              label="Fournisseur"
              name="fournisseurId"
              rules={[{ required: true, message: "Sélectionnez un fournisseur" }]}
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
          ) : (
            <Form.Item
              label="Remorque catalogue"
              name="remorqueId"
              rules={[{ required: true, message: "Sélectionnez une remorque du catalogue" }]}
            >
              <Select
                showSearch
                placeholder="Choisissez une remorque"
                optionFilterProp="children"
                filterOption={(input, option: any) =>
                  `${option.children}`.toLowerCase().includes(input.toLowerCase())
                }
                disabled={!!(editing && editing.id)}
              >
                {remorquesCatalogue.map((r) => (
                  <Option key={r.id} value={r.id}>
                    {r.marque} {r.modele}
                  </Option>
                ))}
              </Select>
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
    </Card>
  );
};

export default FournisseurRemorques;
