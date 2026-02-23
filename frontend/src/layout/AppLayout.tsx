import * as React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";

import FolderIcon from "@mui/icons-material/FolderOutlined";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import BusinessIcon from "@mui/icons-material/Business";
import ContactsIcon from "@mui/icons-material/Contacts";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import HistoryIcon from "@mui/icons-material/History";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import HandymanIcon from "@mui/icons-material/Handyman";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { Backdrop, Fade, Zoom } from "@mui/material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import AppFooter from "./AppFooter";
import WeatherWidget from "./WeatherWidget";
import PhilosophicalCalendarWidget from "./PhilosophicalCalendarWidget";

const drawerWidth = 260;
const collapsedWidth = 72;

type NavItem = { label: string; path: string; icon: React.ReactNode; perm?: string; permAny?: string[] };

const NAV: NavItem[] = [
  { label: "Dashboard", path: "/", icon: <DashboardIcon /> },

  { label: "Clienti", path: "/customers", icon: <PeopleIcon />, perm: "crm.view_customer" },
  { label: "Siti", path: "/sites", icon: <BusinessIcon />, perm: "crm.view_site" },
  { label: "Contatti", path: "/contacts", icon: <ContactsIcon />, perm: "crm.view_contact" },

  { label: "Inventari", path: "/inventory", icon: <Inventory2Icon />, perm: "inventory.view_inventory" },

  { label: "Audit", path: "/audit", icon: <HistoryIcon />, perm: "audit.view_auditevent" },

  { label: "Cestino", path: "/trash", icon: <DeleteSweepIcon />, permAny: ["crm.view_customer","crm.view_site","crm.view_contact","inventory.view_inventory"] },

  { label: "Manutenzione", path: "/maintenance", icon: <HandymanIcon />, permAny: ["maintenance.view_maintenanceplan","maintenance.view_maintenanceevent","maintenance.view_tech"] },

  { label: "Drive", path: "/drive", icon: <FolderIcon />, permAny: ["drive.view_drivefolder", "drive.view_drivefile"] },
  { label: "Wiki", path: "/wiki", icon: <MenuBookIcon />, perm: "wiki.view_wikipage" },
];

function isSelected(currentPath: string, itemPath: string) {
  if (itemPath === "/") return currentPath === "/";
  return currentPath.startsWith(itemPath);
}

type CreateAction = {
  label: string;
  to: string;
  perm?: string;
  icon: React.ReactNode;
};

export function AppLayout() {
  const { me, logout, hasPerm } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

const EGG_TRIGGER = "supertennis";
const [eggOpen, setEggOpen] = React.useState(false);
const eggTimerRef = React.useRef<number | null>(null);

const openEgg = React.useCallback(() => {
  setEggOpen(true);

  if (eggTimerRef.current) {
    window.clearTimeout(eggTimerRef.current);
  }
  eggTimerRef.current = window.setTimeout(() => setEggOpen(false), 5000);
}, []);

React.useEffect(() => {
  return () => {
    if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current);
  };
}, []);

React.useEffect(() => {
  if (!eggOpen) return;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setEggOpen(false);
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [eggOpen]);


  // Global search
  const [globalQ, setGlobalQ] = React.useState("");
  const goGlobalSearch = React.useCallback(() => {
    const q = globalQ.trim();
if (q.toLowerCase() === EGG_TRIGGER) {
  openEgg();
  setGlobalQ(""); // opzionale: pulisce la barra
  return;         // non naviga alla search
}
    if (!q) {
      nav("/search");
      return;
    }
    nav(`/search?q=${encodeURIComponent(q)}&search=${encodeURIComponent(q)}`);
  }, [globalQ, nav]);

  // Drawer mobile
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // ── Maintenance notifications ─────────────────────────────────────────────
  type DuePlan = { id: number; name: string; customer_name?: string; next_due_date: string; days_left: number };
  const [duePlans, setDuePlans] = React.useState<DuePlan[]>([]);
  const [notifAnchor, setNotifAnchor] = React.useState<null | HTMLElement>(null);

  React.useEffect(() => {
    const fetchDue = () => {
      api.get("/maintenance-plans/", { params: { due: "soon", page_size: 20, ordering: "next_due_date" } })
        .then((r) => {
          const plans = r.data?.results ?? r.data ?? [];
          const today = new Date();
          const enriched = plans.map((p: any) => {
            const due = new Date(p.next_due_date);
            const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return { ...p, days_left: diff };
          });
          setDuePlans(enriched);
        })
        .catch(() => {});
    };
    fetchDue();
    const interval = setInterval(fetchDue, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  // Sidebar mini-variant (desktop) persistita
  const [desktopOpen, setDesktopOpen] = React.useState(() => {
    const v = localStorage.getItem("sidebar_open");
    return v ? v === "1" : true;
  });

  React.useEffect(() => {
    localStorage.setItem("sidebar_open", desktopOpen ? "1" : "0");
  }, [desktopOpen]);

  const mini = !desktopOpen;
  const sidebarWidth = mini ? collapsedWidth : drawerWidth;

  // User menu (ancorato all'avatar in topbar)
  const [userAnchorEl, setUserAnchorEl] = React.useState<null | HTMLElement>(null);
  const userMenuOpen = Boolean(userAnchorEl);

  const initials = React.useMemo(() => {
    const base =
      ((me?.first_name?.[0] || "") + (me?.last_name?.[0] || "")) ||
      (me?.username?.[0] || "U");
    return base.toUpperCase();
  }, [me]);

  const displayName = React.useMemo(() => {
    const name = [me?.first_name, me?.last_name].filter(Boolean).join(" ").trim();
    return name || me?.username || "User";
  }, [me]);

  const groupsLabel = React.useMemo(() => {
    const g = me?.groups || [];
    if (!g.length) return "—";
    return g.join(", ");
  }, [me]);

  const handleLogout = async () => {
    await logout();
    nav("/login", { replace: true });
  };

  const visibleNav = React.useMemo(
    () => NAV.filter((it) => !it.perm || hasPerm(it.perm)),
    [hasPerm]
  );

  // Quick Create (+)
  const [createAnchorEl, setCreateAnchorEl] = React.useState<null | HTMLElement>(null);
  const createMenuOpen = Boolean(createAnchorEl);

  const createActions: CreateAction[] = React.useMemo(
    () => [
      {
        label: "Nuovo cliente",
        to: "/customers",
        perm: "crm.add_customer",
        icon: <PeopleIcon fontSize="small" />,
      },
      {
        label: "Nuovo sito",
        to: "/sites",
        perm: "crm.add_site",
        icon: <BusinessIcon fontSize="small" />,
      },
      {
        label: "Nuovo contatto",
        to: "/contacts",
        perm: "crm.add_contact",
        icon: <ContactsIcon fontSize="small" />,
      },
      {
        label: "Nuovo inventario",
        to: "/inventory",
        perm: "inventory.add_inventory",
        icon: <Inventory2Icon fontSize="small" />,
      },
    ],
    []
  );

  const visibleCreateActions = React.useMemo(
    () => createActions.filter((a) => !a.perm || hasPerm(a.perm)),
    [createActions, hasPerm]
  );

  const goCreate = (to: string) => {
    setCreateAnchorEl(null);
    // state.openCreate verrà letto dalla pagina di destinazione per aprire il drawer/modal
    nav(to, { state: { openCreate: true } });
  };

  const renderNavItem = (it: NavItem, isMini: boolean) => {
    const selected = isSelected(loc.pathname, it.path);

    const btn = (
      <ListItemButton
        key={it.path}
        selected={selected}
        onClick={() => {
          nav(it.path);
          setMobileOpen(false);
        }}
        sx={{
          borderRadius: 2,
          mb: 0.5,
          px: isMini ? 1 : 1.25,
          py: 0.9,
          justifyContent: isMini ? "center" : "flex-start",
          transition: "padding 200ms ease",

          "&:hover": { backgroundColor: "rgba(15,118,110,0.06)" },

          "& .MuiListItemIcon-root": {
            minWidth: isMini ? "auto" : 38,
            color: selected ? "#fff" : "rgba(15,118,110,0.95)",
            justifyContent: "center",
          },

          "&.Mui-selected": {
            backgroundColor: "#0f766e",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.08) 100%)",
            color: "#fff",
            boxShadow: "0 2px 6px rgba(15,118,110,0.45)",
          },
          "&.Mui-selected .MuiListItemIcon-root": { color: "#fff" },
          "&.Mui-selected:hover": {
            backgroundColor: alpha("#0f766e", 0.92),
            backgroundImage: "linear-gradient(rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.08) 100%)",
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: isMini ? "auto" : 38 }}>{it.icon}</ListItemIcon>

        <ListItemText
          primary={it.label}
          primaryTypographyProps={{ fontWeight: selected ? 700 : 500, noWrap: true }}
          sx={{
            ml: 0.25,
            overflow: "hidden",
            whiteSpace: "nowrap",
            opacity: isMini ? 0 : 1,
            maxWidth: isMini ? 0 : 220,
            flex: isMini ? "0 0 auto" : "1 1 auto",
            transition: "opacity 150ms ease, max-width 200ms ease",
          }}
        />
      </ListItemButton>
    );

    return isMini ? (
      <Tooltip key={it.path} title={it.label} placement="right">
        {btn}
      </Tooltip>
    ) : (
      btn
    );
  };

  const drawer = (isMini: boolean) => (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toolbar anche qui => divider allineato con la topbar */}
      <Toolbar
        sx={{
          px: isMini ? 1 : 2,
          display: "flex",
          alignItems: "center",
          justifyContent: isMini ? "center" : "space-between",
        }}
      >
        {!isMini ? (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: 0.2 }} noWrap>
              Repository
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }} noWrap>
              {me ? `Loggato come ${me.username}` : ""}
            </Typography>
          </Box>
        ) : (
          <span />
        )}

        <Tooltip title={isMini ? "Apri sidebar" : "Chiudi sidebar"}>
          <IconButton onClick={() => setDesktopOpen((v) => !v)} aria-label="Toggle sidebar">
            {isMini ? <MenuIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Toolbar>

      <Divider />

      <List sx={{ px: isMini ? 0.75 : 1, py: 1 }}>
        {visibleNav.map((it) => renderNavItem(it, isMini))}
      </List>

      <Box sx={{ flex: 1 }} />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "background.default" }}>
      {/* AppBar FULL WIDTH */}
      <AppBar
        position="fixed"
        elevation={0}
        color="transparent"
        sx={{
          width: "100%",
          left: 0,
          backgroundImage: "none",
          backgroundColor: "background.paper",
          color: "text.primary",
          borderBottom: "3px solid #0f766e",
        }}
      >
        <Toolbar sx={{ px: 2, gap: 1, position: "relative" }}>
          {/* spacer: allinea contenuti dopo la sidebar su desktop */}
          <Box sx={{ display: { xs: "none", md: "block" }, width: sidebarWidth, flexShrink: 0 }} />

          {/* LEFT */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: "none" } }}
              aria-label="Apri menu"
            >
              <MenuIcon />
            </IconButton>

            {/* Weather a sinistra */}
            <Box sx={{ display: { xs: "none", sm: "block" }, lineHeight: 0 }}>
              <WeatherWidget city="Bologna" />
            </Box>
          </Box>

          {/* CENTER (absolute, non spinge la search) */}
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              display: { xs: "none", md: "block" },
              pointerEvents: "none",
            }}
          >
            <PhilosophicalCalendarWidget />
          </Box>

          {/* RIGHT */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
            {/* Global search (desktop) */}
            <Box sx={{ display: { xs: "none", sm: "flex" }, width: { sm: 270, md: 390 } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Cerca…"
                value={globalQ}
                onChange={(e) => setGlobalQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    goGlobalSearch();
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: globalQ ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label="Cancella ricerca"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setGlobalQ("")}
                        edge="end"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    backgroundColor: "rgba(15,118,110,0.04)",
                  },
                }}
              />
            </Box>

            {/* Global search (mobile) */}
            <IconButton
              onClick={() => nav("/search")}
              sx={{ display: { xs: "inline-flex", sm: "none" } }}
                aria-label="Ricerca"
            >
              <SearchIcon />
            </IconButton>

            {/* ✅ Quick Create (+) */}
            {visibleCreateActions.length > 0 && (
              <Tooltip title="Crea nuovo">
                <IconButton
                  onClick={(e) => setCreateAnchorEl(e.currentTarget)}
                    aria-label="Crea nuovo"
                >
                  <AddIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* Maintenance notification bell */}
            <Tooltip title={duePlans.length ? `${duePlans.length} piani in scadenza` : "Nessuna scadenza imminente"}>
              <IconButton onClick={(e) => setNotifAnchor(e.currentTarget)} size="small">
                <Badge badgeContent={duePlans.length || null} color="warning" max={9}>
                  <NotificationsOutlinedIcon fontSize="small" sx={{ color: duePlans.length ? "warning.main" : "inherit" }} />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* User avatar dopo search/+ */}
            <Tooltip title={displayName}>
              <IconButton onClick={(e) => setUserAnchorEl(e.currentTarget)} aria-label="User menu">
                <Avatar sx={{ width: 34, height: 34, fontWeight: 800 }}>{initials}</Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Maintenance notifications popover */}
      <Popover
        open={Boolean(notifAnchor)}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 340, borderRadius: 2.5, mt: 0.5 } }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Scadenze manutenzione</Typography>
          <Typography variant="caption" sx={{ color: "text.disabled" }}>Piani in scadenza entro 30 giorni</Typography>
        </Box>
        {duePlans.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "text.disabled" }}>✅ Nessuna scadenza imminente</Typography>
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {duePlans.map((p) => (
              <ListItemButton key={p.id} onClick={() => { setNotifAnchor(null); nav("/maintenance"); }}
                sx={{ px: 2, py: 1.25 }}>
                <BuildOutlinedIcon sx={{ fontSize: 18, color: p.days_left <= 7 ? "error.main" : "warning.main", mr: 1.5, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{p.name}</Typography>
                  {p.customer_name && (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>{p.customer_name}</Typography>
                  )}
                </Box>
                <Chip
                  size="small"
                  label={p.days_left <= 0 ? "Scaduto" : p.days_left === 1 ? "Domani" : `${p.days_left}gg`}
                  color={p.days_left <= 0 ? "error" : p.days_left <= 7 ? "warning" : "default"}
                  sx={{ fontSize: 10, ml: 1, flexShrink: 0 }}
                />
              </ListItemButton>
            ))}
          </Stack>
        )}
        <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>
          <ListItemButton onClick={() => { setNotifAnchor(null); nav("/maintenance"); }}
            sx={{ borderRadius: 1.5, justifyContent: "center" }}>
            <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700 }}>
              Vai alla Manutenzione →
            </Typography>
          </ListItemButton>
        </Box>
      </Popover>

      {/* Quick Create menu */}
      <Menu
        anchorEl={createAnchorEl}
        open={createMenuOpen}
        onClose={() => setCreateAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {visibleCreateActions.map((a) => (
          <MenuItem key={a.label} onClick={() => goCreate(a.to)}>
            <ListItemIcon sx={{ minWidth: 34 }}>{a.icon}</ListItemIcon>
            {a.label}
          </MenuItem>
        ))}
      </Menu>

      {/* User menu */}
      <Menu
        anchorEl={userAnchorEl}
        open={userMenuOpen}
        onClose={() => setUserAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 800 }}>{displayName}</Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {me?.username} • {groupsLabel}
          </Typography>
        </Box>

        <MenuItem
          onClick={() => {
            setUserAnchorEl(null);
            nav("/profile");
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          Profilo
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={async () => {
            setUserAnchorEl(null);
            await handleLogout();
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Drawer desktop (mini-variant) */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: sidebarWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: sidebarWidth,
            boxSizing: "border-box",
            borderRight: "1px solid rgba(0,0,0,0.08)",
            backgroundImage: "none",
            overflowX: "hidden",
            transition: "width 200ms ease",
          },
        }}
        open
      >
        {drawer(mini)}
      </Drawer>

      {/* Drawer mobile (sempre full) */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: drawerWidth },
        }}
      >
        {drawer(false)}
      </Drawer>

      {/* Content + footer sticky */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <Toolbar sx={{ flexShrink: 0 }} />

        <Box sx={{ p: { xs: 2, md: 3 }, flex: 1, overflowY: "auto", minHeight: 0 }}>
          <Outlet />
        </Box>

        <AppFooter />
      </Box>
<Backdrop
  open={eggOpen}
  onClick={() => setEggOpen(false)}
  sx={{
    zIndex: (t) => t.zIndex.modal + 20,
    bgcolor: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(2px)",
  }}
>
  <Fade in={eggOpen} timeout={{ enter: 250, exit: 350 }}>
    <Box sx={{ outline: "none" }}>
      <Zoom in={eggOpen} timeout={{ enter: 350, exit: 200 }}>
        <Box
          sx={{
            position: "relative",
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: 24,
            transform: "rotate(-1deg)",
            width: { xs: "85vw", sm: 520 },
            maxWidth: 720,
            "@keyframes eggPop": {
              "0%": { transform: "scale(0.92) rotate(-2deg)" },
              "40%": { transform: "scale(1.02) rotate(1deg)" },
              "100%": { transform: "scale(1.0) rotate(-1deg)" },
            },
            animation: "eggPop 650ms ease-out",
          }}
          onClick={(e) => e.stopPropagation()} // evita chiusura se clicchi sull’immagine
        >
          <Box
            component="img"
            src="/supertennis.jpeg"
            alt="supertennis"
            sx={{ display: "block", width: "100%" }}
          />

          {/* cornice teal “glow” */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              border: "2px solid rgba(14,165,164,0.75)",
              boxShadow: "0 0 0 2px rgba(15,118,110,0.25) inset",
              pointerEvents: "none",
            }}
          />
        </Box>
      </Zoom>
    </Box>
  </Fade>
</Backdrop>
<Backdrop
  open={eggOpen}
  onClick={() => setEggOpen(false)}
  sx={{
    zIndex: (t) => t.zIndex.modal + 20,
    bgcolor: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(2px)",
  }}
>
  <Fade in={eggOpen} timeout={{ enter: 250, exit: 350 }}>
    <Box sx={{ outline: "none" }}>
      <Zoom in={eggOpen} timeout={{ enter: 350, exit: 200 }}>
        <Box
          sx={{
            position: "relative",
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: 24,
            transform: "rotate(-1deg)",
            width: { xs: "85vw", sm: 520 },
            maxWidth: 720,
            "@keyframes eggPop": {
              "0%": { transform: "scale(0.92) rotate(-2deg)" },
              "40%": { transform: "scale(1.02) rotate(1deg)" },
              "100%": { transform: "scale(1.0) rotate(-1deg)" },
            },
            animation: "eggPop 650ms ease-out",
          }}
          onClick={(e) => e.stopPropagation()} // evita chiusura se clicchi sull’immagine
        >
          <Box
            component="img"
            src="/supertennis.jpeg"
            alt="supertennis"
            sx={{ display: "block", width: "100%" }}
          />

          {/* cornice teal “glow” */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              border: "2px solid rgba(14,165,164,0.75)",
              boxShadow: "0 0 0 2px rgba(15,118,110,0.25) inset",
              pointerEvents: "none",
            }}
          />
        </Box>
      </Zoom>
    </Box>
  </Fade>
</Backdrop>

    </Box>
  );
}
