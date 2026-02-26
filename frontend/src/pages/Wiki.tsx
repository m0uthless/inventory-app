import * as React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";

import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

import { api } from "../api/client";

type ApiPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type Category = { id: number; name: string };

type PageRow = {
  id: number;
  title: string;
  slug: string;
  category?: number | null;
  category_name?: string | null;
  is_published: boolean;
  tags?: string[] | null;
  updated_at?: string | null;
};

type PageDetail = PageRow & {
  summary?: string | null;
  content_markdown: string;
  pdf_template_key: string;
  pdf_options?: any;
  created_at?: string | null;
  notes?: string | null;
};


type TreeNode = {
  id: number;
  title: string;
  slug: string;
  category?: number | null;
  category_name?: string | null;
  parent?: number | null;
  is_published: boolean;
  updated_at?: string | null;
  children: TreeNode[];
};

type TreeCategory = { id: number | null; name: string; pages: TreeNode[] };


async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function FieldRow(props: { label: string; value?: string | null; mono?: boolean }) {
  const { label, value, mono } = props;
  const v = value ?? "";
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75 }}>
      <Box sx={{ width: 120, opacity: 0.7 }}>
        <Typography variant="body2">{label}</Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : undefined,
            wordBreak: "break-word",
          }}
        >
          {v || "—"}
        </Typography>
      </Box>

      {v ? (
        <Tooltip title="Copia">
          <IconButton size="small" onClick={() => copyToClipboard(v)}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      ) : (
        <Box sx={{ width: 34 }} />
      )}
    </Stack>
  );
}

const asId = (v: unknown): number | "" => {
  const s = String(v);
  return s === "" ? "" : Number(s);
};

const cols: GridColDef<PageRow>[] = [
  { field: "title", headerName: "Title", flex: 1, minWidth: 320 },
  { field: "slug", headerName: "Slug", width: 220 },
  { field: "category_name", headerName: "Category", width: 200 },
  {
    field: "is_published",
    headerName: "Published",
    width: 130,
    valueGetter: (v, row) => { void v; return row.is_published ? "Yes" : "No"; },
  },
  {
    field: "tags",
    headerName: "Tags",
    width: 120,
    valueGetter: (v, row) => { void v; return row.tags ? String(row.tags.length) : "0"; },
  },
  { field: "updated_at", headerName: "Updated", width: 180 },
];

export default function Wiki() {
  const [rows, setRows] = React.useState<PageRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState("");

  const [categoryId, setCategoryId] = React.useState<number | "">("");
  const [published, setPublished] = React.useState<"" | "true" | "false">("");

  const [categories, setCategories] = React.useState<Category[]>([]);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<PageDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const [viewMode, setViewMode] = React.useState<"preview" | "markdown">("preview");
  const [renderHtml, setRenderHtml] = React.useState<string>("");
  const [renderLoading, setRenderLoading] = React.useState(false);

const [layout, setLayout] = React.useState<"list" | "tree">("tree");
const [tree, setTree] = React.useState<TreeCategory[]>([]);
const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});


  const loadCategories = React.useCallback(async () => {
    const res = await api.get<ApiPage<Category>>("/wiki-categories/", { params: { ordering: "sort_order,name", page_size: 200 } });
    setCategories(res.data.results ?? []);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (categoryId !== "") params.category = categoryId;
      if (published !== "") params.is_published = published;
      const res = await api.get<ApiPage<PageRow>>("/wiki-pages/", { params });
      setRows(res.data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, published]);

const loadTree = React.useCallback(async () => {
  setLoading(true);
  try {
    const params: any = {};
    if (search) params.search = search;
    if (categoryId !== "") params.category = categoryId;
    if (published !== "") params.is_published = published;
    const res = await api.get<TreeCategory[]>("/wiki-pages/tree/", { params });
    setTree(res.data ?? []);
  } finally {
    setLoading(false);
  }
}, [search, categoryId, published]);



  const loadDetail = React.useCallback(async (id: number) => {
    setDetailLoading(true);
    setRenderLoading(true);
    setDetail(null);
    setRenderHtml("");
    setViewMode("preview");
    try {
      const [d, r] = await Promise.all([
        api.get<PageDetail>(`/wiki-pages/${id}/`),
        api.get<{ html: string }>(`/wiki-pages/${id}/render/`),
      ]);
      setDetail(d.data);
      setRenderHtml(r.data?.html ?? "");
    } catch {
      // fallback: detail loader will surface errors in console; keep UI usable
    } finally {
      setDetailLoading(false);
      setRenderLoading(false);
    }
  }, []);

  const exportPdf = React.useCallback(async () => {
    if (!selectedId) return;
    const slug = detail?.slug || `wiki-page-${selectedId}`;
    const res = await api.get(`/wiki-pages/${selectedId}/export-pdf/`, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [selectedId, detail?.slug]);

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  React.useEffect(() => {
    if (layout === "tree") loadTree();
    else load();
  }, [load, loadTree, layout]);

  
const toggleExpanded = (id: number) => {
  setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
};

const renderNode = (node: TreeNode, depth: number) => {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isOpen = !!expanded[node.id];

  return (
    <React.Fragment key={node.id}>
      <ListItemButton
        dense
        sx={{ pl: 1 + depth * 2 }}
        onClick={() => {
          setSelectedId(node.id);
          setDrawerOpen(true);
          loadDetail(node.id);
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(node.id);
            }}
            sx={{ mr: 0.5 }}
          >
            {isOpen ? <ExpandMoreIcon fontSize="inherit" /> : <ChevronRightIcon fontSize="inherit" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}

        <ListItemText
          primaryTypographyProps={{ variant: "body2", noWrap: true }}
          primary={node.title}
          secondary={node.slug}
          secondaryTypographyProps={{ variant: "caption", noWrap: true, sx: { opacity: 0.7 } }}
        />
      </ListItemButton>

      {hasChildren ? (
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children.map((c) => renderNode(c, depth + 1))}
          </List>
        </Collapse>
      ) : null}
    </React.Fragment>
  );
};

return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">
          Wiki
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Pagine wiki: click su una riga per aprire contenuto.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }} alignItems="center">
            <TextField
              size="small"
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearch(q);
              }}
              sx={{ width: { xs: "100%", md: 340 } }}
            />

            <FormControl size="small" sx={{ minWidth: 220, width: { xs: "100%", md: 260 } }}>
              <InputLabel>Category</InputLabel>
              <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(asId(e.target.value))}>
                <MenuItem value="">All</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160, width: { xs: "100%", md: 180 } }}>
              <InputLabel>Published</InputLabel>
              <Select label="Published" value={published} onChange={(e) => setPublished(String(e.target.value) as any)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Published</MenuItem>
                <MenuItem value="false">Draft</MenuItem>
              </Select>
            </FormControl>


<FormControl size="small" sx={{ minWidth: 160, width: { xs: "100%", md: 180 } }}>
  <InputLabel>View</InputLabel>
  <Select label="View" value={layout} onChange={(e) => setLayout(e.target.value as any)}>
    <MenuItem value="tree">Tree</MenuItem>
    <MenuItem value="list">List</MenuItem>
  </Select>
</FormControl>

            <Button
              variant="outlined"
              onClick={() => {
                setQ("");
                setSearch("");
                setCategoryId("");
                setPublished("");
              }}
              sx={{ width: { xs: "100%", md: "auto" } }}
            >
              Reset
            </Button>
          </Stack>

          
{layout === "tree" ? (
  <Card variant="outlined" sx={{ height: 640, overflow: "auto" }}>
    <CardContent sx={{ py: 1 }}>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1}>
          {tree.map((c) => (
            <Box key={String(c.id ?? "uncat")}>
              <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, opacity: 0.8 }}>
                {c.name}
              </Typography>
              <List dense disablePadding>
                {c.pages.map((p) => renderNode(p, 0))}
              </List>
              <Divider sx={{ my: 1 }} />
            </Box>
          ))}
        </Stack>
      )}
    </CardContent>
  </Card>
) : (
  <Box sx={{ height: 640 }}>
    <DataGrid
      rows={rows}
      columns={cols}
      loading={loading}
      disableRowSelectionOnClick
      slots={{ toolbar: GridToolbar }}
      slotProps={{ toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } }}
      initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
      pageSizeOptions={[10, 25, 50, 100]}
      onRowClick={(params) => {
        const rowId = Number(params.row.id);
        setSelectedId(rowId);
        setDrawerOpen(true);
        loadDetail(rowId);
      }}
    />
  </Box>
)}

        </CardContent>
      </Card>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}
      >
        <Stack sx={{ p: 2 }} spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">
                {detail?.title || (selectedId ? `Page #${selectedId}` : "Page")}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                {detail?.category_name ? `${detail.category_name} • ${detail.slug}` : detail?.slug || " "}
              </Typography>
            </Box>

            <IconButton onClick={() => setDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Divider />

          {detailLoading ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Caricamento…
              </Typography>
            </Stack>
          ) : detail ? (
            <>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {detail.is_published ? <Chip size="small" label="Published" /> : <Chip size="small" label="Draft" />}
                {detail.tags?.slice(0, 6).map((t) => (
                  <Chip key={t} size="small" label={t} />
                ))}
                {detail.tags && detail.tags.length > 6 ? <Chip size="small" label={`+${detail.tags.length - 6}`} /> : null}
              </Stack>

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Metadata
              </Typography>
              <FieldRow label="Slug" value={detail.slug} mono />
              <FieldRow label="Category" value={detail.category_name ?? ""} />
              <FieldRow label="Template" value={detail.pdf_template_key} mono />

              <Divider />

              <Typography variant="subtitle2" sx={{ mt: 1, opacity: 0.75 }}>
                Summary
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {detail.summary || "—"}
              </Typography>

              <Divider />

              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                <Tabs
                  value={viewMode}
                  onChange={(_, v) => setViewMode(v)}
                  sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontWeight: 700 } }}
                >
                  <Tab value="preview" label="Preview" />
                  <Tab value="markdown" label="Markdown" />
                </Tabs>

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => copyToClipboard(detail.content_markdown)}
                    startIcon={<ContentCopyIcon />}
                  >
                    Copy
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={exportPdf}
                    startIcon={<PictureAsPdfRoundedIcon />}
                  >
                    Export PDF
                  </Button>
                </Stack>
              </Stack>

              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1,
                  mt: 1,
                  maxHeight: 380,
                  overflow: "auto",
                  bgcolor: "background.paper",
                }}
              >
                {viewMode === "preview" ? (
                  renderLoading ? (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" sx={{ opacity: 0.7 }}>
                        Rendering…
                      </Typography>
                    </Stack>
                  ) : (
                    <Box
                      sx={{
                        "& h1": { fontSize: 22, fontWeight: 900, mt: 1.5, mb: 1 },
                        "& h2": { fontSize: 18, fontWeight: 900, mt: 1.5, mb: 1 },
                        "& h3": { fontSize: 16, fontWeight: 900, mt: 1.25, mb: 0.75 },
                        "& p": { my: 1, lineHeight: 1.7 },
                        "& ul": { pl: 3, my: 1 },
                        "& ol": { pl: 3, my: 1 },
                        "& li": { my: 0.5 },
                        "& code": {
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontSize: 13,
                          bgcolor: "action.hover",
                          px: 0.5,
                          borderRadius: 1,
                        },
                        "& pre": {
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontSize: 13,
                          bgcolor: "action.hover",
                          p: 1,
                          borderRadius: 2,
                          overflow: "auto",
                        },
                        "& blockquote": {
                          borderLeft: "4px solid",
                          borderColor: "divider",
                          pl: 2,
                          ml: 0,
                          opacity: 0.9,
                        },
                        "& table": {
                          width: "100%",
                          borderCollapse: "collapse",
                          my: 1,
                        },
                        "& th, & td": {
                          border: "1px solid",
                          borderColor: "divider",
                          p: 0.75,
                          fontSize: 13,
                        },
                        "& th": { bgcolor: "action.hover", fontWeight: 900 },
                      }}
                      dangerouslySetInnerHTML={{ __html: renderHtml || "<em>—</em>" }}
                    />
                  )
                ) : (
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {detail.content_markdown || ""}
                  </Typography>
                )}
              </Box>
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Nessun dettaglio disponibile.
            </Typography>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}
