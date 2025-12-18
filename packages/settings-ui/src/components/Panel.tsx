import { Divider, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { BASE_SIZE } from "../App";
import { Acrylic } from "./materials";

export default function Panel({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Stack width={"100%"} height={"100%"} overflow={"hidden"}>
      <Divider />
      <Acrylic height={BASE_SIZE - 1} flexGrow={1} px={2} alignItems={"center"} direction={"row"}>
        {title && <Typography variant="h5">{title}</Typography>}
        <div style={{ flexGrow: 1 }} />
        {actions && (
          <Stack direction={"row"} justifyContent={"flex-end"} alignItems={"center"} height={"100%"}>
            {actions}
          </Stack>
        )}
      </Acrylic>
      <Divider />
      {children && (
        <Stack height={`calc(100% - ${BASE_SIZE}px)`} p={2} gap={2} overflow={"auto"}>
          {children}
        </Stack>
      )}
    </Stack>
  );
}
