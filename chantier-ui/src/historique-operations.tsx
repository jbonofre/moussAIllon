import React, { useEffect, useState } from "react";
import { Table, Card, Space, Tag, Tooltip, Empty, message } from "antd";
import { HistoryOutlined, WarningOutlined } from "@ant-design/icons";
import api from "./api.ts";

interface Operation {
  key: string;
  nom: string;
  prixTTC: number;
  techniciens: string;
  type: "forfait" | "service";
  venteId: number;
  date?: string;
  status?: string;
  incidentDate?: string;
  incidentDetails?: string;
}

const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente",
  PLANIFIEE: "Planifiée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  INCIDENT: "Incident",
  ANNULEE: "Annulée",
};

const STATUS_COLOR: Record<string, string> = {
  EN_ATTENTE: "default",
  PLANIFIEE: "blue",
  EN_COURS: "processing",
  TERMINEE: "success",
  INCIDENT: "error",
  ANNULEE: "warning",
};

const formatEuro = (value?: number) =>
  `${(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const formatDate = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
};

interface Props {
  clientId?: number;
  bateauId?: number;
  moteurId?: number;
  remorqueId?: number;
}

function HistoriqueOperations({ clientId, bateauId, moteurId, remorqueId }: Props) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "5" });
    if (clientId) params.set("clientId", String(clientId));
    if (bateauId) params.set("bateauId", String(bateauId));
    if (moteurId) params.set("moteurId", String(moteurId));
    if (remorqueId) params.set("remorqueId", String(remorqueId));

    if (!clientId && !bateauId && !moteurId && !remorqueId) return;

    let cancelled = false;
    setLoading(true);
    api
      .get(`/ventes/search?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        const ventes: any[] = Array.isArray(res.data) ? res.data : [];
        const ops: Operation[] = [];
        for (const vente of ventes) {
          for (const vf of vente.venteForfaits ?? []) {
            ops.push({
              key: `f-${vente.id}-${vf.id ?? ops.length}`,
              nom: vf.forfait?.nom ?? "(Sans nom)",
              prixTTC: vf.forfait?.prixTTC ?? 0,
              techniciens: (vf.techniciens ?? [])
                .map((t: any) => `${t.prenom ?? ""} ${t.nom ?? ""}`.trim())
                .filter(Boolean)
                .join(", ") || "—",
              type: "forfait",
              venteId: vente.id,
              date: vente.date,
              status: vf.status ?? undefined,
              incidentDate: vf.incidentDate ?? undefined,
              incidentDetails: vf.incidentDetails ?? undefined,
            });
          }
          for (const vs of vente.venteServices ?? []) {
            ops.push({
              key: `s-${vente.id}-${vs.id ?? ops.length}`,
              nom: vs.service?.nom ?? "(Sans nom)",
              prixTTC: vs.service?.prixTTC ?? 0,
              techniciens: (vs.techniciens ?? [])
                .map((t: any) => `${t.prenom ?? ""} ${t.nom ?? ""}`.trim())
                .filter(Boolean)
                .join(", ") || "—",
              type: "service",
              venteId: vente.id,
              date: vente.date,
              status: vs.status ?? undefined,
              incidentDate: vs.incidentDate ?? undefined,
              incidentDetails: vs.incidentDetails ?? undefined,
            });
          }
        }
        setOperations(ops.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) message.error("Erreur lors du chargement de l'historique");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, bateauId, moteurId, remorqueId]);

  const columns = [
    {
      title: "Opération",
      dataIndex: "nom",
      render: (nom: string, r: Operation) => (
        <Space>
          <Tag color={r.type === "forfait" ? "purple" : "geekblue"}>
            {r.type === "forfait" ? "Forfait" : "Service"}
          </Tag>
          {nom}
        </Space>
      ),
    },
    {
      title: "Statut",
      dataIndex: "status",
      width: 120,
      render: (v: string) =>
        v ? (
          <Tag color={STATUS_COLOR[v] ?? "default"}>{STATUS_LABEL[v] ?? v}</Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Incident",
      key: "incident",
      width: 90,
      render: (_: unknown, r: Operation) => {
        if (!r.incidentDate && !r.incidentDetails) return "—";
        const label = r.incidentDate ? formatDate(r.incidentDate) : "Oui";
        const tooltipContent = r.incidentDetails
          ? `${label} — ${r.incidentDetails}`
          : label;
        return (
          <Tooltip title={tooltipContent}>
            <Tag icon={<WarningOutlined />} color="error" style={{ cursor: "help" }}>
              {label}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Prix TTC",
      dataIndex: "prixTTC",
      align: "right" as const,
      width: 110,
      render: (v: number) => formatEuro(v),
    },
    {
      title: "Technicien(s)",
      dataIndex: "techniciens",
    },
    {
      title: "Prestation",
      dataIndex: "venteId",
      width: 100,
      render: (v: number) => `#${v}`,
    },
  ];

  return (
    <Card
      size="small"
      title={<Space><HistoryOutlined /> Historique (5 dernières opérations)</Space>}
      styles={{ body: { padding: operations.length === 0 && !loading ? 24 : 0 } }}
    >
      <Table
        rowKey="key"
        size="small"
        loading={loading}
        dataSource={operations}
        columns={columns}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description="Aucune opération enregistrée"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />
    </Card>
  );
}

export default HistoriqueOperations;
