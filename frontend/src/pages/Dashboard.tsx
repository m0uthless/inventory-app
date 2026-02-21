import { Box, Typography } from "@mui/material";
import ConstructionIcon from "@mui/icons-material/Construction";

export default function Dashboard() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        gap: 1.5,
        opacity: 0.4,
      }}
    >
      <ConstructionIcon sx={{ fontSize: 48 }} />
      <Typography variant="h5">Work in progress</Typography>
      <Typography variant="body2">La dashboard è in costruzione.</Typography>
    </Box>
  );
}
