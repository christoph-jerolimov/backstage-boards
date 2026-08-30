import { useState } from 'react';
import { useApi } from '@backstage/frontend-plugin-api';
import {
  Button,
  Dialog,
  DialogBody,
  DialogHeader,
  Flex,
  Select,
  Text,
} from '@backstage/ui';
import {
  ALL_LEVELS,
  ALL_VISIBILITIES,
  BoardPermissionLevel,
  BoardVisibility,
  BoardWithContext,
} from '@internal/plugin-boards-common';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import {
  PrincipalPicker,
  useAsyncAction,
  ErrorText,
  RefDisplay,
  selectedOption,
} from '@internal/plugin-boards-react';

/** Exhaustive by construction: a new visibility must be labelled here. */
const VISIBILITY_LABELS: Record<BoardVisibility, string> = {
  private: 'Private – only people listed below',
  'logged-in-read': 'Any logged-in user can view',
  'logged-in-write': 'Any logged-in user can edit',
  'public-read': 'Public – anyone can view (read-only)',
  'public-write': 'Public – anyone can edit',
};

const VISIBILITY_OPTIONS = ALL_VISIBILITIES.map(visibility => ({
  value: visibility,
  label: VISIBILITY_LABELS[visibility],
}));

export function ShareDialog(props: {
  board: BoardWithContext;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const { board, isOpen, onOpenChange, onChanged } = props;
  const boardsApi = useApi(boardsApiRef);
  const [principalRef, setPrincipalRef] = useState('');
  const [level, setLevel] = useState<BoardPermissionLevel>('read');
  const { error, run } = useAsyncAction();

  const queryClient = useQueryClient();
  const permissionsKey = queryKeys.permissions(board.id);
  const { data: permissions } = useQuery({
    queryKey: permissionsKey,
    enabled: isOpen && board.access === 'admin',
    queryFn: () => boardsApi.listPermissions(board.id),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: permissionsKey });

  const save = (action: () => Promise<unknown>) =>
    run(async () => {
      await action();
      await refresh();
      await onChanged();
    });

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      style={{ width: '800px', maxWidth: '95%' }}
    >
      <DialogHeader>Share “{board.name}”</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <Select
            label="Board visibility"
            options={VISIBILITY_OPTIONS}
            selectedKey={board.visibility}
            onSelectionChange={key => {
              const visibility = selectedOption(key, ALL_VISIBILITIES);
              if (visibility) {
                save(() => boardsApi.updateBoard(board.id, { visibility }));
              }
            }}
          />
          <Text variant="body-medium" weight="bold">
            People and groups
          </Text>
          {(permissions ?? []).map(entry => (
            <Flex key={entry.id} align="center" gap="2" justify="between">
              <Text variant="body-small">
                <RefDisplay refString={entry.principalRef} />
              </Text>
              <Flex align="center" gap="2">
                <Select
                  aria-label={`Access level for ${entry.principalRef}`}
                  options={ALL_LEVELS.map(l => ({ value: l, label: l }))}
                  selectedKey={entry.level}
                  onSelectionChange={key => {
                    const next = selectedOption(key, ALL_LEVELS);
                    if (next) {
                      save(() =>
                        boardsApi.updatePermission(board.id, entry.id, next),
                      );
                    }
                  }}
                />
                <Button
                  variant="tertiary"
                  size="small"
                  onPress={() =>
                    save(() => boardsApi.removePermission(board.id, entry.id))
                  }
                >
                  Remove
                </Button>
              </Flex>
            </Flex>
          ))}
          <Flex align="end" gap="2">
            <div style={{ flexGrow: 1 }}>
              <PrincipalPicker
                ariaLabel="Add user or group"
                label="Add user or group"
                allowText={false}
                exclude={(permissions ?? []).map(entry => entry.principalRef)}
                onSelect={setPrincipalRef}
              />
            </div>
            {principalRef && (
              <Text variant="body-small">
                <RefDisplay refString={principalRef} />
              </Text>
            )}
            <Select
              aria-label="Level for new entry"
              options={ALL_LEVELS.map(l => ({ value: l, label: l }))}
              selectedKey={level}
              onSelectionChange={key => {
                const next = selectedOption(key, ALL_LEVELS);
                if (next) {
                  setLevel(next);
                }
              }}
            />
            <Button
              variant="primary"
              size="small"
              isDisabled={!principalRef.trim()}
              onPress={() =>
                save(async () => {
                  await boardsApi.addPermission(board.id, {
                    principalRef: principalRef.trim(),
                    level,
                  });
                  setPrincipalRef('');
                })
              }
            >
              Add
            </Button>
          </Flex>
          {error && <ErrorText>{error}</ErrorText>}
        </Flex>
      </DialogBody>
    </Dialog>
  );
}
