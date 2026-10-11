import React, { useEffect, useMemo, useState } from "react";
import { Table, Segmented, Card, Pagination, Empty, Image } from "antd";
import type { TableProps } from "antd";
import { UnorderedListOutlined, AppstoreOutlined, PictureOutlined } from "@ant-design/icons";

type Mode = "list" | "mosaic";

export interface MosaicTableProps<T> extends TableProps<T> {
  /** Clé de persistance du mode (par défaut déduite de l'URL et des colonnes). */
  storageKey?: string;
  /** Retourne l'URL de la vignette d'un enregistrement (par défaut: images[0], image, imageUrl). */
  imageOf?: (record: T) => string | undefined;
  /** Affiche une vignette à côté de la première colonne en mode liste. */
  thumbnail?: boolean;
}

const getValue = (record: any, dataIndex: any) => {
  if (dataIndex === undefined || dataIndex === null) return undefined;
  if (Array.isArray(dataIndex)) return dataIndex.reduce((acc, k) => (acc == null ? acc : acc[k]), record);
  return record?.[dataIndex];
};

const defaultImageOf = (record: any): string | undefined => {
  const img = record?.images?.[0] ?? record?.image ?? record?.imageUrl ?? record?.photo ?? record?.logo;
  return typeof img === "string" && img ? img : undefined;
};

const isActionsColumn = (col: any) =>
  col.key === "actions" || col.dataIndex === "actions" || col.title === "Actions";

function MosaicTable<T extends object>(props: MosaicTableProps<T>) {
  const { storageKey, imageOf, thumbnail, columns = [], dataSource = [], pagination, onRow, rowKey, loading, rowSelection, expandable, ...rest } = props;

  const key = useMemo(() => {
    const cols = (columns as any[]).map((c) => String(c.key ?? c.dataIndex ?? "")).join(",");
    return `mosaic-view:${storageKey ?? `${window.location.pathname}${window.location.hash}|${cols}`}`;
  }, [storageKey, columns]);

  const [mode, setMode] = useState<Mode>(() => {
    try {
      return localStorage.getItem(key) === "mosaic" ? "mosaic" : "list";
    } catch {
      return "list";
    }
  });
  const [page, setPage] = useState(1);
  const pageSizeCfg = pagination && typeof pagination === "object" ? pagination.pageSize ?? 10 : 10;
  const [pageSize, setPageSize] = useState<number>(pageSizeCfg);

  useEffect(() => {
    try {
      localStorage.setItem(key, mode);
    } catch {
      /* stockage indisponible */
    }
  }, [key, mode]);

  const data = (dataSource as any[]) || [];
  useEffect(() => {
    setPage(1);
  }, [data.length]);

  const canMosaic = !rowSelection && !expandable;
  const toggle = canMosaic ? (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <Segmented
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        options={[
          { value: "list", icon: <UnorderedListOutlined />, label: "Liste" },
          { value: "mosaic", icon: <AppstoreOutlined />, label: "Mosaïque" },
        ]}
      />
    </div>
  ) : null;

  if (!canMosaic || mode === "list") {
    let listColumns: any = columns;
    if (thumbnail) {
      const firstIdx = (columns as any[]).findIndex((c) => !isActionsColumn(c));
      if (firstIdx >= 0) {
        listColumns = (columns as any[]).map((c, i) =>
          i !== firstIdx
            ? c
            : {
                ...c,
                render: (value: any, record: any, index: number) => {
                  const url = (imageOf ?? defaultImageOf)(record);
                  const content = c.render ? c.render(value, record, index) : value;
                  return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {url ? (
                        <Image src={url} preview={false} width={40} height={40} style={{ objectFit: "cover", borderRadius: 4 }} />
                      ) : (
                        <span style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.04)", color: "rgba(0,0,0,0.25)", borderRadius: 4 }}>
                          <PictureOutlined />
                        </span>
                      )}
                      <span>{content}</span>
                    </span>
                  );
                },
              }
        );
      }
    }
    return (
      <>
        {toggle}
        <Table<T>
          {...rest}
          columns={listColumns}
          dataSource={dataSource}
          pagination={pagination}
          onRow={onRow}
          rowKey={rowKey}
          loading={loading}
          rowSelection={rowSelection}
          expandable={expandable}
        />
      </>
    );
  }

  const cols = (columns as any[]).filter((c) => !c.hidden);
  const actionCol = cols.find(isActionsColumn);
  const dataCols = cols.filter((c) => !isActionsColumn(c));
  const [titleCol, ...otherCols] = dataCols;

  const renderCell = (col: any, record: any, index: number) => {
    const value = getValue(record, col.dataIndex);
    const out = col.render ? col.render(value, record, index) : value;
    if (out && typeof out === "object" && !React.isValidElement(out) && "children" in out) return (out as any).children;
    return out;
  };
  const isEmpty = (v: any) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

  const rowKeyOf = (record: any, index: number) =>
    typeof rowKey === "function" ? rowKey(record) : rowKey ? record[rowKey as string] : index;

  const paginated = pagination !== false;
  const start = (page - 1) * pageSize;
  const visible = paginated ? data.slice(start, start + pageSize) : data;

  return (
    <>
      {toggle}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
          opacity: loading ? 0.5 : 1,
        }}
      >
        {visible.map((record, i) => {
          const index = start + i;
          const url = (imageOf ?? defaultImageOf)(record);
          const rowProps: any = onRow ? onRow(record, index) || {} : {};
          const { style: rowStyle, onClick, ...restRow } = rowProps;
          return (
            <Card
              key={rowKeyOf(record, index)}
              hoverable={!!onClick}
              size="small"
              styles={{ body: { padding: 12 } }}
              style={{ overflow: "hidden", ...rowStyle }}
              onClick={onClick}
              cover={
                url ? (
                  <Image
                    src={url}
                    preview={false}
                    height={160}
                    width="100%"
                    style={{ objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div
                    style={{
                      height: 160,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.04)",
                      color: "rgba(0,0,0,0.25)",
                      fontSize: 40,
                    }}
                  >
                    <PictureOutlined />
                  </div>
                )
              }
              {...restRow}
            >
              {titleCol && (
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, wordBreak: "break-word" }}>
                  {renderCell(titleCol, record, index)}
                </div>
              )}
              {otherCols.slice(0, 3).map((col, ci) => {
                const cell = renderCell(col, record, index);
                if (isEmpty(cell)) return null;
                return (
                  <div key={String(col.key ?? col.dataIndex ?? ci)} style={{ fontSize: 13, color: "rgba(0,0,0,0.65)" }}>
                    {cell}
                  </div>
                );
              })}
              {actionCol && (
                <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                  {renderCell(actionCol, record, index)}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {data.length === 0 && !loading && <Empty style={{ margin: 24 }} />}
      {paginated && data.length > pageSize && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={data.length}
            showSizeChanger={false}
            onChange={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
          />
        </div>
      )}
    </>
  );
}

export default MosaicTable;
