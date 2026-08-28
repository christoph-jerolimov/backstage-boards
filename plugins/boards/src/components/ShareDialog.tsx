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
  BoardPermissionLevel,
  BoardVisibility,
  BoardWithContext,
} from '@internal/plugin-boards-common';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import { PrincipalPicker } from './PrincipalPicker';
import { RefDisplay } from './common';

const VISIBILITY_OPTIONS: Array<{ value: BoardVisibility; label: string }> = [
  { value: 'private', label: 'Private – only people listed below' },
  { value: 'logged-in-read', label: 'Any logged-in user can view' },
  { value: 'logged-in-write', label: 'Any logged-in user can edit' },
  { value: 'public-read', label: 'Public – anyone can view (read-only)' },
  { value: 'public-write', label: 'Public – anyone can edit' },
];

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
  const [error, setError] = useState<string | undefined>();

  const queryClient = useQueryClient();
  const permissionsKey = queryKeys.permissions(board.id);
  const { data: permissions } = useQuery({
    queryKey: permissionsKey,
    enabled: isOpen && board.access === 'admin',
    queryFn: () => boardsApi.listPermissions(board.id),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: permissionsKey });

  const run = async (action: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await action();
      await refresh();
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>Share “{board.name}”</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="3">
          <Select
            label="Board visibility"
            options={VISIBILITY_OPTIONS}
            selectedKey={board.visibility}
            onSelectionChange={key =>
              run(() =>
                boardsApi.updateBoard(board.id, {
                  visibility: key as BoardVisibility,
                }),
              )
            }
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
                  onSelectionChange={key =>
                    run(() =>
                      boardsApi.updatePermission(
                        board.id,
                        entry.id,
                        key as BoardPermissionLevel,
                      ),
                    )
                  }
                />
                <Button
                  variant="tertiary"
                  size="small"
                  onPress={() =>
                    run(() => boardsApi.removePermission(board.id, entry.id))
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
              onSelectionChange={key => setLevel(key as BoardPermissionLevel)}
            />
            <Button
              variant="primary"
              size="small"
              isDisabled={!principalRef.trim()}
              onPress={() =>
                run(async () => {
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
          {error && (
            <Text variant="body-small" style={{ color: '#cc3344' }}>
              {error}
            </Text>
          )}
        </Flex>
      </DialogBody>
    </Dialog>
  );
}
