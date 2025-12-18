import styled from "@emotion/styled";
import { Stack } from "@mui/material";

export const Acrylic = styled(Stack)({
  background: "rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(10px) saturate(180%)",
  WebkitBackdropFilter: "blur(10px) saturate(180%)",
  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
}) as typeof Stack;
