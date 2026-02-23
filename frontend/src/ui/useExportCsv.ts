/**
 * useExportCsv — hook riutilizzabile per esportare dati in CSV.
 *
 * Uso:
 *   const { exporting, exportCsv } = useExportCsv();
 *   exportCsv({ url: "/customers/", params: { ... }, filename: "clienti", columns: [...] });
 *
 * Recupera TUTTE le pagine (page_size 500 per volta) e genera un CSV lato client.
 */
import * as React from "react";
import { api } from "../api/client";
import { useToast } from "./toast";

export type CsvColumn<T = any> = {
  label: string;
  getValue: (row: T) => string | number | null | undefined;
};

type ExportOptions<T = any> = {
  url: string;
  params?: Record<string, any>;
  filename?: string;
  columns: CsvColumn<T>[];
};

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      const s = v == null ? "" : String(v);
      // Escape: wrap in quotes if contains comma, newline or quote
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

async function fetchAllPages<T>(url: string, params: Record<string, any> = {}): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  while (true) {
    const res = await api.get(url, { params: { ...params, page, page_size: 500 } });
    const data = res.data;
    const rows: T[] = data?.results ?? data ?? [];
    results.push(...rows);
    if (!data?.next || rows.length === 0) break;
    page++;
  }
  return results;
}

export function useExportCsv() {
  const toast = useToast();
  const [exporting, setExporting] = React.useState(false);

  const exportCsv = React.useCallback(async <T>(opts: ExportOptions<T>) => {
    const { url, params = {}, filename = "export", columns } = opts;
    setExporting(true);
    try {
      const rows = await fetchAllPages<T>(url, params);
      if (rows.length === 0) {
        toast.info?.("Nessun dato da esportare.");
        return;
      }

      const header = toCsvRow(columns.map((c) => c.label));
      const body   = rows.map((row) => toCsvRow(columns.map((c) => c.getValue(row))));
      const csv    = [header, ...body].join("\n");
      const bom    = "\uFEFF"; // BOM per Excel UTF-8

      const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success(`Esportati ${rows.length} record ✅`);
    } catch {
      toast.error("Errore durante l'esportazione.");
    } finally {
      setExporting(false);
    }
  }, [toast]);

  return { exporting, exportCsv };
}
