import React, { useEffect, useState } from "react";
import { Table, Card, Space, Tag, Empty, message } from "antd";
import { RollbackOutlined } from "@ant-design/icons";
import api from "./api.ts";

interface Avoir {
  id?: number;
  status?: string;
  montantTTC?: number;
  dateCreation?: string;
}

const STATUS_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  EMIS: "Émis",
  REMBOURSE: "Remboursé",
  ANNULE: "Annulé",
};

const STATUS_COLOR: Record<string, string> = {
  BROUILLON: "default",
  EMIS: "blue",
  REMBOURSE: "green",
  ANNULE: "red",
};

const formatEuro = (value?: number) =>
  `${(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const formatDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR");
};

function ClientsAvoirs({ clientId }: { clientId: number }) {
  const [avoirs, setAvoirs] = useState<Avoir[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    api
      .get(`/avoirs/search?clientId=${clientId}`)
      .then((res) => {
        if (!cancelled) setAvoirs(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) message.error("Erreur lors du chargement des avoirs");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const columns = [
    {
      title: "#",
      dataIndex: "id",
      width: 70,
      sorter: (a: Avoir, b: Avoir) => (a.id || 0) - (b.id || 0),
      render: (v: number) => `#${v}`,
    },
    {
      title: "Prix",
      dataIndex: "montantTTC",
      align: "right" as const,
      sorter: (a: Avoir, b: Avoir) => (a.montantTTC || 0) - (b.montantTTC || 0),
      render: (v: number) => formatEuro(v),
    },
    {
      title: "Date de création",
      dataIndex: "dateCreation",
      sorter: (a: Avoir, b: Avoir) => (a.dateCreation || "").localeCompare(b.dateCreation || ""),
      render: (v: string) => formatDate(v),
    },
    {
      title: "Statut",
      dataIndex: "status",
      width: 130,
      sorter: (a: Avoir, b: Avoir) => (a.status || "").localeCompare(b.status || ""),
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? "default"}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
  ];

  return (
    <Card
      size="small"
      title={<Space><RollbackOutlined /> Avoirs</Space>}
      styles={{ body: { padding: avoirs.length === 0 && !loading ? 24 : 0 } }}
    >
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={avoirs}
        columns={columns}
        pagination={false}
        locale={{ emptyText: <Empty description="Aucun avoir pour ce client" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </Card>
  );
}

export default ClientsAvoirs;
