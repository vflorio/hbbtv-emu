import { Stack } from "@mui/material";
import Panel from "../components/Panel";
import { TvRemote } from "../components/TvRemote";
import { useRemoteControl } from "../hooks";

export default function RemoteControl() {
  const { dispatchKey } = useRemoteControl();
  return (
    <Panel title="Remote Control">
      <Stack maxWidth={375} margin={"0 auto"}>
        <TvRemote handleKeyPress={dispatchKey} />
      </Stack>
    </Panel>
  );
}
