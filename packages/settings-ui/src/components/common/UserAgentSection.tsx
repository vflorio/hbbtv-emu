import { buildDefaultUserAgent } from "@hbb-emu/oipf";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";

interface UserAgentSectionProps {
  currentUserAgent: string | undefined;
  hbbtvVersion: string;
  onSave: (userAgent: string) => Promise<void>;
  onEditingChange: (isEditing: boolean) => void;
}

export function UserAgentSection({ currentUserAgent, hbbtvVersion, onSave, onEditingChange }: UserAgentSectionProps) {
  const defaultUserAgent = buildDefaultUserAgent({ hbbtvVersion });
  const [userAgent, setUserAgent] = useState(currentUserAgent ?? defaultUserAgent);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setUserAgent(currentUserAgent ?? defaultUserAgent);
    setIsEditing(false);
  }, [currentUserAgent, defaultUserAgent]);

  useEffect(() => {
    onEditingChange(isEditing);
  }, [isEditing, onEditingChange]);

  const handleSave = async () => {
    await onSave(userAgent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setUserAgent(currentUserAgent ?? defaultUserAgent);
    setIsEditing(false);
  };

  const handleResetDefault = () => {
    setUserAgent(defaultUserAgent);
    setIsEditing(true);
  };

  return (
    <>
      <Stack gap={1} alignItems="flex-start">
        <TextField
          label="User Agent"
          value={userAgent}
          onChange={(e) => {
            setUserAgent(e.target.value);
            setIsEditing(true);
          }}
          placeholder="Mozilla/5.0 (SmartTV; HbbTV/1.5.1...)"
          fullWidth
          multiline
          minRows={4}
          helperText={`Default for HbbTV ${hbbtvVersion}`}
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
    </>
  );
}
