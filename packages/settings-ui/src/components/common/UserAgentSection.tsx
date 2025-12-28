import { buildDefaultUserAgent, DEFAULT_HBBTV_VERSION } from "@hbb-emu/oipf";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { useEffect, useState } from "react";
import { useAppState } from "../../context/AppState";
import { useUserAgent } from "../../hooks";

export function UserAgentSection() {
  const { config } = useAppState();
  const { userAgent: currentUserAgent, update: saveUserAgent } = useUserAgent();
  const hbbtvVersion = config.hbbtv?.oipfCapabilities?.hbbtvVersion ?? DEFAULT_HBBTV_VERSION;

  const defaultUserAgent = buildDefaultUserAgent({ hbbtvVersion });
  const [userAgent, setUserAgent] = useState(currentUserAgent ?? defaultUserAgent);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setUserAgent(currentUserAgent ?? defaultUserAgent);
    setIsEditing(false);
  }, [currentUserAgent, defaultUserAgent]);

  const handleSave = pipe(
    TE.of(userAgent),
    TE.tap((ua) => saveUserAgent(ua)),
    TE.tapIO(() => () => {
      setIsEditing(false);
    }),
  );

  const handleCancel = () => {
    setUserAgent(currentUserAgent ?? defaultUserAgent);
    setIsEditing(false);
  };

  const handleResetDefault = () => {
    setUserAgent(defaultUserAgent);
    setIsEditing(true);
  };

  return (
    <Stack gap={2}>
      <Typography variant="h6">User Agent</Typography>
      <Stack gap={1} alignItems="flex-start">
        <TextField
          label="User Agent"
          value={userAgent}
          fullWidth
          multiline
          minRows={4}
          onChange={(e) => {
            setUserAgent(e.target.value);
            setIsEditing(true);
          }}
        />
        <Button onClick={handleResetDefault} sx={{ mt: 1 }}>
          Reset to default
        </Button>
      </Stack>
      <Alert severity="warning" sx={{ mt: -2 }}>
        Changing the User-Agent may require a page reload to take effect.
      </Alert>
      {isEditing && (
        <Stack direction="row" gap={2} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
          <Button variant="outlined" onClick={handleCancel}>
            Cancel
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
