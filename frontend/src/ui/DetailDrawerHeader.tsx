import * as React from "react";

import { Box, Divider, IconButton, Stack, Typography } from "@mui/material";
import type { TypographyProps } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  divider?: boolean;
  titleVariant?: TypographyProps["variant"];
  titleSx?: any;
  subtitleSx?: any;
  onClose: () => void;
};

export default function DetailDrawerHeader({
  title,
  subtitle,
  actions,
  divider = true,
  titleVariant = "h6",
  titleSx,
  subtitleSx,
  onClose,
}: Props) {
  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant={titleVariant} sx={{ ...(titleSx || {}) }} noWrap>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" sx={{ opacity: 0.7, ...(subtitleSx || {}) }} noWrap>
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {actions}
          <IconButton onClick={onClose} aria-label="Chiudi">
            <CloseIcon />
          </IconButton>
        </Stack>
      </Stack>
      {divider ? <Divider /> : null}
    </>
  );
}
