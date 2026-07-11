import React, { useState } from "react";
import { Card, Upload, Button, Select, message, Table, Tag, Collapse, Typography, Space, Alert } from "antd";
import { InboxOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import api from "./api.ts";

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

interface RowError {
  ligne: number;
  message: string;
}

interface SheetReport {
  type: string;
  crees: number;
  misAJour: number;
  erreurs: RowError[];
}

interface ImportReport {
  onglets: SheetReport[];
}

const typeOptions = [
  { value: "clients", label: "Clients" },
  { value: "produits", label: "Produits" },
  { value: "bateaux", label: "Bateaux" },
  { value: "moteurs", label: "Moteurs" },
  { value: "remorques", label: "Remorques" },
];

const columnsHelp = [
  {
    key: "clients",
    label: "Clients",
    colonnes: "Prénom, Nom (requis), Type (Particulier/Professionnel/Professionnel_Mer), Email, Téléphone, Adresse, Consentement (oui/non), Canal Acquisition, Notes",
    cle: "Déduplication par Email : une ligne avec un email déjà connu met à jour le client existant.",
  },
  {
    key: "produits",
    label: "Produits",
    colonnes: "Nom (requis, unique), Marque, Catégorie (requis), Ref, Description, Stock, Stock Mini, Emplacement, Prix Vente HT, TVA",
    cle: "Déduplication par Nom : une ligne avec un nom déjà connu met à jour le produit existant.",
  },
  {
    key: "bateaux",
    label: "Bateaux",
    colonnes: "Nom (requis), Immatriculation, Numéro Série, Numéro Clef, Date MES, Date Achat, Localisation, Email Client (requis)",
    cle: "Email Client doit correspondre à un client existant ou présent dans l'onglet Clients du même fichier.",
  },
  {
    key: "moteurs",
    label: "Moteurs",
    colonnes: "Numéro Série, Numéro Clef, Date MES, Date Achat, Email Client (requis)",
    cle: "Email Client doit correspondre à un client existant ou présent dans l'onglet Clients du même fichier.",
  },
  {
    key: "remorques",
    label: "Remorques",
    colonnes: "Immatriculation, Date MES, Date Achat, Email Client (requis)",
    cle: "Email Client doit correspondre à un client existant ou présent dans l'onglet Clients du même fichier.",
  },
];

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [csvType, setCsvType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const isCsv = file ? file.name.toLowerCase().endsWith(".csv") : false;

  const uploadProps: UploadProps = {
    multiple: false,
    fileList: file ? [{ uid: "1", name: file.name, status: "done" }] : [],
    beforeUpload: (selected) => {
      setFile(selected);
      setReport(null);
      return false;
    },
    onRemove: () => {
      setFile(null);
      setCsvType(undefined);
    },
    accept: ".xlsx,.xls,.csv",
  };

  const handleImport = async () => {
    if (!file) {
      message.warning("Veuillez sélectionner un fichier");
      return;
    }
    if (isCsv && !csvType) {
      message.warning("Veuillez préciser le type de données pour un fichier CSV");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (isCsv && csvType) {
      formData.append("type", csvType);
    }

    setLoading(true);
    try {
      const res = await api.post("/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReport(res.data);
      message.success("Import terminé");
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Erreur lors de l'import");
    } finally {
      setLoading(false);
    }
  };

  const errorColumns = [
    { title: "Ligne", dataIndex: "ligne", key: "ligne", width: 80 },
    { title: "Erreur", dataIndex: "message", key: "message" },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card title="Import de fichier">
        <Paragraph>
          Importez un classeur Excel (.xlsx) avec un onglet par type de données
          (<Text code>Clients</Text>, <Text code>Produits</Text>, <Text code>Bateaux</Text>,{" "}
          <Text code>Moteurs</Text>, <Text code>Remorques</Text>), ou un fichier CSV pour un seul type à la fois.
        </Paragraph>
        <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Cliquer ou glisser-déposer un fichier ici</p>
          <p className="ant-upload-hint">Formats acceptés : XLSX, XLS, CSV</p>
        </Dragger>

        {isCsv && (
          <Select
            placeholder="Type de données du fichier CSV"
            options={typeOptions}
            value={csvType}
            onChange={setCsvType}
            style={{ width: 300, marginBottom: 16 }}
          />
        )}

        <div>
          <Button type="primary" icon={<UploadOutlined />} loading={loading} disabled={!file} onClick={handleImport}>
            Importer
          </Button>
        </div>
      </Card>

      {report && (
        <Card title="Résultat de l'import">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {report.onglets.length === 0 && (
              <Alert type="warning" showIcon message="Aucun onglet reconnu dans le fichier (attendu : Clients, Produits, Bateaux, Moteurs, Remorques)." />
            )}
            {report.onglets.map((sheet) => (
              <Card key={sheet.type} type="inner" title={sheet.type}>
                <Space style={{ marginBottom: sheet.erreurs.length > 0 ? 12 : 0 }}>
                  <Tag color="success">{sheet.crees} créé(s)</Tag>
                  <Tag color="processing">{sheet.misAJour} mis à jour</Tag>
                  {sheet.erreurs.length > 0 && <Tag color="error">{sheet.erreurs.length} erreur(s)</Tag>}
                </Space>
                {sheet.erreurs.length > 0 && (
                  <Table
                    size="small"
                    rowKey="ligne"
                    dataSource={sheet.erreurs}
                    columns={errorColumns}
                    pagination={false}
                  />
                )}
              </Card>
            ))}
          </Space>
        </Card>
      )}

      <Card title="Format attendu des colonnes">
        <Collapse
          items={columnsHelp.map((h) => ({
            key: h.key,
            label: h.label,
            children: (
              <Space direction="vertical">
                <Text>{h.colonnes}</Text>
                <Text type="secondary">{h.cle}</Text>
              </Space>
            ),
          }))}
        />
      </Card>
    </Space>
  );
}
