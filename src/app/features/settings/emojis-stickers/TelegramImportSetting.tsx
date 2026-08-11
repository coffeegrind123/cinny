import { FormEventHandler, useEffect, useState } from 'react';
import { Box, Button, Input, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { SequenceCardStyle } from '../styles.css';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';

/**
 * Telegram bot token, used only to import sticker packs.
 *
 * Lives beside the packs it affects rather than in General, where it was
 * stranded next to unrelated embed toggles — the import button that depends on
 * it is one screen away, inside a pack's editor.
 */
export function TelegramImportSetting() {
  const [token, setToken] = useSetting(settingsAtom, 'telegramBotToken');
  const [draft, setDraft] = useState(token);

  useEffect(() => setDraft(token), [token]);

  const hasChanges = draft !== token;

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    setToken(draft.trim());
  };

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Telegram</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Sticker pack import"
          description="Paste a bot token to import packs from t.me/addstickers links, using the Import button inside any pack you can edit. Create a bot with @BotFather on Telegram — Telegram publishes sticker sets nowhere else, so there is no way to import without one. Stored on this device only, never sent to your homeserver, and used solely for requests to api.telegram.org."
        />
        <Box as="form" onSubmit={handleSubmit} gap="200">
          <Box grow="Yes" direction="Column">
            <Input
              name="telegramBotTokenInput"
              value={draft}
              onChange={(evt) => setDraft(evt.currentTarget.value)}
              // A bot token is a credential; treat it like one in the UI even
              // though it only ever reaches api.telegram.org.
              type="password"
              autoComplete="off"
              placeholder="123456:ABC-DEF..."
              variant="Secondary"
              radii="300"
            />
          </Box>
          <Button
            size="400"
            variant={hasChanges ? 'Success' : 'Secondary'}
            fill={hasChanges ? 'Solid' : 'Soft'}
            outlined
            radii="300"
            disabled={!hasChanges}
            type="submit"
          >
            <Text size="B400">Save</Text>
          </Button>
        </Box>
      </SequenceCard>
    </Box>
  );
}
