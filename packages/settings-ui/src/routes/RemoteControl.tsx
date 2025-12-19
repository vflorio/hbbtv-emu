import { Stack } from "@mui/material";
import Panel from "../components/Panel";
import { TvRemote } from "../components/TvRemote";
import { useSideEffects } from "../context/state";

export default function RemoteControl() {
  const sideEffects = useSideEffects();

  const handleKeyPress = (keyCode: number) => sideEffects.dispatchKey(keyCode);

  return (
    <Panel title="Remote Control">
      <Stack maxWidth={375} margin={"0 auto"}>
        <TvRemote handleKeyPress={handleKeyPress} />
      </Stack>
    </Panel>
  );
}
