import * as React from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { api } from "../api/client";
import { apiErrorToMessage } from "../api/error";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../ui/toast";

type CustomerOption = { id: number; label: string };

function buildCustomerLabel(c: any): string {
  const code = c?.code ? String(c.code) : "";
  const name = c?.name ? String(c.name) : "";
  const display = c?.display_name ? String(c.display_name) : "";
  const base = display || name;
  return code ? `${code} — ${base}` : base;
}

// ─── Password field con toggle visibilità ────────────────────────────────────
function PasswordField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const { label, value, onChange, error, disabled, autoComplete } = props;
  const [show, setShow] = React.useState(false);

  return (
    <TextField
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={!!error}
      helperText={error || undefined}
      disabled={disabled}
      fullWidth
      autoComplete={autoComplete}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={() => setShow((s) => !s)}
              onMouseDown={(e) => e.preventDefault()}
              edge="end"
              tabIndex={-1}
              aria-label={show ? "Nascondi password" : "Mostra password"}
            >
              {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}

// ─── Sezione cambio password ──────────────────────────────────────────────────
function ChangePasswordCard() {
  const toast = useToast();

  const [oldPwd, setOldPwd] = React.useState("");
  const [newPwd, setNewPwd] = React.useState("");
  const [newPwd2, setNewPwd2] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Errori per campo (dal backend) + validazione client-side
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!oldPwd) errs.old_password = "La password attuale è obbligatoria.";
    if (!newPwd) errs.new_password = "La nuova password è obbligatoria.";
    else if (newPwd.length < 8) errs.new_password = "Minimo 8 caratteri.";
    else if (newPwd === oldPwd) errs.new_password = "Deve essere diversa dalla password attuale.";
    if (newPwd && !newPwd2) errs.new_password2 = "Conferma la nuova password.";
    else if (newPwd && newPwd2 && newPwd !== newPwd2) errs.new_password2 = "Le password non coincidono.";
    return errs;
  };

  const handleSubmit = async () => {
    setSuccessMsg(null);
    const clientErrors = validate();
    if (Object.keys(clientErrors).length) {
      setFieldErrors(clientErrors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await api.post("/me/change-password/", {
        old_password: oldPwd,
        new_password: newPwd,
        new_password2: newPwd2,
      });
      // Reset form
      setOldPwd("");
      setNewPwd("");
      setNewPwd2("");
      setSuccessMsg("Password aggiornata con successo.");
      toast.success("Password aggiornata ✅");
    } catch (e: any) {
      // Il backend restituisce errori per campo in caso di 400
      const data = e?.response?.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const mapped: Record<string, string> = {};
        if (data.old_password) mapped.old_password = Array.isArray(data.old_password) ? data.old_password[0] : data.old_password;
        if (data.new_password) mapped.new_password = Array.isArray(data.new_password) ? data.new_password[0] : data.new_password;
        if (data.new_password2) mapped.new_password2 = Array.isArray(data.new_password2) ? data.new_password2[0] : data.new_password2;
        if (Object.keys(mapped).length) {
          setFieldErrors(mapped);
          return;
        }
      }
      toast.error(apiErrorToMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const hasValues = oldPwd || newPwd || newPwd2;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
          <LockOutlinedIcon sx={{ color: "primary.main", fontSize: 22 }} />
          <Typography variant="h6">
            Sicurezza
          </Typography>
        </Stack>

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
            {successMsg}
          </Alert>
        )}

        <Stack spacing={2} sx={{ maxWidth: 480 }}>
          <PasswordField
            label="Password attuale"
            value={oldPwd}
            onChange={(v) => { setOldPwd(v); setFieldErrors((e) => ({ ...e, old_password: "" })); setSuccessMsg(null); }}
            error={fieldErrors.old_password}
            disabled={saving}
            autoComplete="current-password"
          />

          <PasswordField
            label="Nuova password"
            value={newPwd}
            onChange={(v) => { setNewPwd(v); setFieldErrors((e) => ({ ...e, new_password: "" })); setSuccessMsg(null); }}
            error={fieldErrors.new_password}
            disabled={saving}
            autoComplete="new-password"
          />

          <PasswordField
            label="Conferma nuova password"
            value={newPwd2}
            onChange={(v) => { setNewPwd2(v); setFieldErrors((e) => ({ ...e, new_password2: "" })); setSuccessMsg(null); }}
            error={fieldErrors.new_password2}
            disabled={saving}
            autoComplete="new-password"
          />

          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            {hasValues && (
              <Button
                variant="text"
                disabled={saving}
                onClick={() => { setOldPwd(""); setNewPwd(""); setNewPwd2(""); setFieldErrors({}); setSuccessMsg(null); }}
              >
                Annulla
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={saving || !hasValues}
              sx={{ minWidth: 180 }}
            >
              {saving ? "Aggiornamento…" : "Aggiorna password"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────
export default function Profile() {
  const toast = useToast();
  const { me, refreshMe } = useAuth();

  const [email, setEmail] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [avatarUploading, setAvatarUploading] = React.useState(false);

  // Preferred customer autocomplete
  const [custValue, setCustValue] = React.useState<CustomerOption | null>(null);
  const [custInput, setCustInput] = React.useState("");
  const [custOptions, setCustOptions] = React.useState<CustomerOption[]>([]);
  const [custLoading, setCustLoading] = React.useState(false);

  // Initialize from me
  React.useEffect(() => {
    if (!me) return;
    setEmail(me.email || "");
    setFirstName(me.first_name || "");
    setLastName(me.last_name || "");

    const pcId = me.profile?.preferred_customer ?? null;
    const pcName = me.profile?.preferred_customer_name ?? null;
    if (pcId && pcName) {
      setCustValue({ id: pcId, label: pcName });
    } else if (!pcId) {
      setCustValue(null);
    }
  }, [me]);

  // Load customer options (non-deleted by default)
  React.useEffect(() => {
    let alive = true;
    const q = custInput.trim();

    const t = window.setTimeout(async () => {
      setCustLoading(true);
      try {
        const res = await api.get("/customers/", { params: { search: q || undefined, page_size: 25 } });
        const data = res.data;
        const results = Array.isArray(data) ? data : (data.results ?? []);
        const opts: CustomerOption[] = results.map((c: any) => ({ id: c.id, label: buildCustomerLabel(c) }));
        if (!alive) return;

        // Keep current selected option visible even if not in results
        const current = custValue;
        const merged = current && !opts.some((o) => o.id === current.id) ? [current, ...opts] : opts;
        setCustOptions(merged);
      } catch {
        // silenzioso
      } finally {
        if (alive) setCustLoading(false);
      }
    }, 300);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [custInput, custValue]);

  const avatarSrc = me?.profile?.avatar || undefined;
  const initials = React.useMemo(() => {
    const base =
      ((me?.first_name?.[0] || "") + (me?.last_name?.[0] || "")) ||
      (me?.username?.[0] || "U");
    return base.toUpperCase();
  }, [me]);

  const onSave = async () => {
    setSaving(true);
    try {
      await api.patch("/me/", {
        email,
        first_name: firstName,
        last_name: lastName,
        preferred_customer: custValue?.id ?? null,
      });
      await refreshMe();
      toast.success("Profilo aggiornato.");
    } catch (e: any) {
      toast.error("Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (file: File) => {
    const fd = new FormData();
    fd.append("avatar", file);
    // avatarUploading separato: il pulsante Salva resta disabilitato durante l'upload
    setAvatarUploading(true);
    try {
      await api.patch("/me/", fd);
      await refreshMe();
      toast.success("Avatar aggiornato.");
    } catch {
      toast.error("Errore durante upload avatar.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const onRemoveAvatar = async () => {
    setSaving(true);
    try {
      await api.patch("/me/", { avatar: "" });
      await refreshMe();
      toast.success("Avatar rimosso.");
    } catch {
      toast.error("Errore durante rimozione avatar.");
    } finally {
      setSaving(false);
    }
  };

  if (!me) return null;

  return (
    <Box sx={{ maxWidth: 920, mx: "auto" }}>
      <Typography variant="h5">
        Profilo
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
        Impostazioni account e cambio password.
      </Typography>

      {/* ── Card dati profilo ──────────────────────────────────────────────── */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "stretch", md: "flex-start" }}>
            {/* Left: avatar */}
            <Stack spacing={1.5} alignItems="center" sx={{ width: { xs: "100%", md: 240 } }}>
              <Avatar src={avatarSrc} sx={{ width: 96, height: 96 }}>
                {initials}
              </Avatar>

              <Stack direction="row" spacing={1}>
                <Button variant="outlined" component="label" disabled={saving || avatarUploading}>
                  {avatarUploading ? "Upload…" : "Carica"}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0];
                      if (f) onAvatarChange(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </Button>

                <Button variant="text" disabled={saving || avatarUploading || !me.profile?.avatar} onClick={onRemoveAvatar}>
                  Rimuovi
                </Button>
              </Stack>

              <Typography variant="caption" sx={{ opacity: 0.7, textAlign: "center" }}>
                PNG/JPG consigliato. (Solo customer non eliminati per il preferito)
              </Typography>
            </Stack>

            <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", md: "block" } }} />

            {/* Right: fields */}
            <Stack spacing={2} sx={{ flex: 1 }}>
              <TextField label="Username" value={me.username} disabled fullWidth />

              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                type="email"
              />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Cognome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                />
              </Stack>

              <Autocomplete
                value={custValue}
                onChange={(_, v) => setCustValue(v)}
                inputValue={custInput}
                onInputChange={(_, v) => setCustInput(v)}
                options={custOptions}
                loading={custLoading}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer preferito"
                    placeholder="Cerca customer…"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {custLoading ? <CircularProgress size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={onSave}
                  disabled={saving || avatarUploading}
                  sx={{ minWidth: 140 }}
                >
                  {saving ? "Salvataggio…" : "Salva"}
                </Button>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Card sicurezza / cambio password ──────────────────────────────── */}
      <ChangePasswordCard />
    </Box>
  );
}

