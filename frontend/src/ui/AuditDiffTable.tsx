import * as React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

export type AuditChange = { from: unknown; to: unknown };
export type AuditChanges = Record<string, AuditChange>;

type Props = {
  changes: AuditChanges;
  emptyLabel?: string;
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);

  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.repr === "string" && obj.repr) return obj.repr;
    if (typeof obj.id === "number" || typeof obj.id === "string") {
      const rid = String(obj.id);
      return obj.repr ? `${String(obj.repr)} (#${rid})` : `#${rid}`;
    }

    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  return String(v);
}

function toComparable(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (v === "") return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return `${typeof v}:${String(v)}`;
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const hasId = typeof obj.id === "number" || typeof obj.id === "string";
    const hasRepr = typeof obj.repr === "string";
    if (hasId || hasRepr) {
      return `id:${hasId ? String(obj.id) : ""}|repr:${hasRepr ? String(obj.repr) : ""}`;
    }
    try {
      return `json:${JSON.stringify(v)}`;
    } catch {
      return `obj:${String(v)}`;
    }
  }
  return `other:${String(v)}`;
}

function isSame(a: unknown, b: unknown): boolean {
  return toComparable(a) === toComparable(b);
}

function fieldLabel(field: string): string {
  // quick nicety for known fields
  const m: Record<string, string> = {
    deleted_at: "Eliminazione",
    display_name: "Nome visualizzato",
    vat_number: "P.IVA",
    tax_code: "Codice fiscale",
    serial_number: "Serial",
    knumber: "K-Number",
  };
  return m[field] ?? field;
}

export default function AuditDiffTable(props: Props) {
  const { changes, emptyLabel = "Nessuna differenza registrata." } = props;

  const rows = React.useMemo(() => {
    // Show only real diffs (some backends may include unchanged fields).
    return Object.entries(changes || {})
      .filter(([, ch]) => !isSame(ch?.from, ch?.to))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [changes]);

  if (!rows.length) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.7 }}>
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 520 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 180 }}>Campo</TableCell>
            <TableCell>Prima</TableCell>
            <TableCell>Dopo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(([field, ch]) => (
            <TableRow key={field}>
              <TableCell sx={{ fontWeight: 700 }}>{fieldLabel(field)}</TableCell>
              <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                {fmtValue(ch?.from)}
              </TableCell>
              <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                {fmtValue(ch?.to)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
