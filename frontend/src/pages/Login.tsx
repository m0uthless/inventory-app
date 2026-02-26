import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const onSubmit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await login(username, password);
      // Dopo il login portiamo sempre alla Dashboard (/) e non all'ultima pagina visitata.
      nav("/", { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Login fallito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", p: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 420, borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5" align="center">Login</Typography>
            </Box>

            <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            />

            {err ? (
              <Typography variant="body2" sx={{ color: "error.main" }}>{err}</Typography>
            ) : null}

            <Button variant="contained" onClick={onSubmit} disabled={busy}>
              {busy ? "..." : "Login"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
