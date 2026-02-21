import * as React from "react";
import { Navigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { useAuth } from "./AuthProvider";

export function RequirePerm({
  perm,
  children,
}: {
  perm: string;
  children: React.ReactNode;
}) {
  const { me, loading, hasPerm } = useAuth();

  if (loading) return null; // RequireAuth mostra già lo spinner
  if (!me) return <Navigate to="/login" replace />;

  if (!hasPerm(perm)) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          403 — Non autorizzato
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Non hai i permessi per accedere a questa pagina.
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
}
