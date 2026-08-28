import {
  RiArchiveLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiGridLine,
  RiHistoryLine,
  RiKanbanView,
  RiLockUnlockLine,
  RiSettings3Line,
  RiMore2Fill,
} from '@remixicon/react';
import {
  Alert,
  Button,
  ButtonIcon,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  Select,
  Text,
  ToggleButton,
  ToggleButtonGroup,
} from '@backstage/ui';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { BoardWithContext } from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { useApi } from '@backstage/frontend-plugin-api';
import { GroupByMode } from './grouping';
import { InlineEdit } from './common';
import { WatchButton } from './WatchButton';
import { BoardDialogKind } from './BoardDialogs';

export type BoardViewMode = 'board' | 'table';

function StarIcon(props: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill={props.filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EntitySection(props: { entityRefs: string[] }) {
  if (props.entityRefs.length === 0) {
    return (
      <Text variant="body-small" color="secondary">
        none
      </Text>
    );
  }
  return (
    <Text variant="body-small">
      {props.entityRefs.map((ref, index) => (
        <span key={ref}>
          {index > 0 && ', '}
          <EntityRefLink entityRef={ref} />
        </span>
      ))}
    </Text>
  );
}

/**
 * The board's title row: name, favorite, watch, grouping and view
 * controls, the actions menu, and the entity/access line below them.
 */
export function BoardHeader(props: {
  board: BoardWithContext;
  canWrite: boolean;
  isAdmin: boolean;
  view: BoardViewMode;
  onViewChange: (view: BoardViewMode) => void;
  groupBy: GroupByMode;
  onGroupByChange: (mode: GroupByMode) => void;
  guarded: (action: () => Promise<unknown>) => Promise<void>;
  onOpenDialog: (dialog: BoardDialogKind) => void;
}) {
  const { board, canWrite, isAdmin, view, groupBy, guarded } = props;
  const { onViewChange, onGroupByChange, onOpenDialog } = props;
  const boardsApi = useApi(boardsApiRef);

  return (
    <>
      <Flex
        align="center"
        gap="2"
        justify="between"
        style={{ flexWrap: 'wrap' }}
      >
        <Flex align="center" gap="2">
          <InlineEdit
            value={board.name}
            canEdit={isAdmin}
            ariaLabel="board name"
            onCommit={name =>
              guarded(() => boardsApi.updateBoard(board.id, { name }))
            }
            display={
              <Text variant="title-medium" as="h1">
                {board.name}
              </Text>
            }
          />
          <ButtonIcon
            aria-label={
              board.favorite ? 'Remove from favorites' : 'Add to favorites'
            }
            variant="tertiary"
            size="small"
            icon={<StarIcon filled={board.favorite} />}
            onPress={() =>
              guarded(() => boardsApi.setFavorite(board.id, !board.favorite))
            }
          />
        </Flex>
        <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
          <WatchButton
            watching={board.watching}
            targetLabel="this board"
            onToggle={watching =>
              guarded(() => boardsApi.setWatchBoard(board.id, watching))
            }
            loadWatchers={() => boardsApi.listBoardWatchers(board.id)}
          />
          <Select
            aria-label="Group by"
            size="small"
            options={[
              { value: 'none', label: 'Not grouped' },
              { value: 'assignee', label: 'By assignee' },
              { value: 'dueDate', label: 'By due date' },
              { value: 'tags', label: 'By tags' },
            ]}
            selectedKey={groupBy}
            onSelectionChange={key =>
              onGroupByChange((key as GroupByMode) ?? 'none')
            }
          />
          <ToggleButtonGroup
            aria-label="View"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[view]}
            onSelectionChange={keys => {
              const [key] = [...keys];
              if (key) onViewChange(key as BoardViewMode);
            }}
          >
            <ToggleButton id="board" aria-label="Board view">
              <RiKanbanView size={16} />
            </ToggleButton>
            <ToggleButton id="table" aria-label="Table view">
              <RiGridLine size={16} />
            </ToggleButton>
          </ToggleButtonGroup>
          <MenuTrigger>
            <ButtonIcon
              aria-label="More board actions"
              variant="tertiary"
              size="small"
              icon={<RiMore2Fill size={16} />}
            />
            <Menu aria-label="Board actions">
              <MenuItem
                iconStart={<RiHistoryLine size={16} />}
                onAction={() => onOpenDialog('changes')}
              >
                Recent changes…
              </MenuItem>
              {canWrite && (
                <MenuItem
                  iconStart={<RiArchiveLine size={16} />}
                  onAction={() => onOpenDialog('archived')}
                >
                  Archived items…
                </MenuItem>
              )}
              <MenuItem
                iconStart={<RiFileCopyLine size={16} />}
                onAction={() => onOpenDialog('duplicate')}
              >
                Duplicate board…
              </MenuItem>
              {isAdmin && (
                <MenuItem
                  iconStart={<RiSettings3Line size={16} />}
                  onAction={() => onOpenDialog('settings')}
                >
                  Board settings…
                </MenuItem>
              )}
              {isAdmin && (
                <MenuItem
                  iconStart={<RiLockUnlockLine size={16} />}
                  onAction={() => onOpenDialog('share')}
                >
                  Share…
                </MenuItem>
              )}
              {isAdmin && (
                <MenuItem
                  iconStart={<RiDeleteBinLine size={16} />}
                  color="danger"
                  onAction={() => onOpenDialog('delete')}
                >
                  Archive board…
                </MenuItem>
              )}
            </Menu>
          </MenuTrigger>
        </Flex>
      </Flex>

      <Flex align="center" gap="2">
        <Text variant="body-small" color="secondary">
          Entities:
        </Text>
        <EntitySection entityRefs={board.entityRefs} />
        <Text variant="body-small" color="secondary">
          · your access: {board.access}
        </Text>
      </Flex>
    </>
  );
}

/** The archived-board banner, with the admin's unarchive/delete actions. */
export function ArchivedBoardAlert(props: {
  board: BoardWithContext;
  isAdmin: boolean;
  guarded: (action: () => Promise<unknown>) => Promise<void>;
  onRequestDelete: () => void;
}) {
  const { board, isAdmin, guarded, onRequestDelete } = props;
  const boardsApi = useApi(boardsApiRef);
  const purgeDate = board.archivedAt
    ? new Date(
        new Date(board.archivedAt).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toLocaleDateString()
    : undefined;
  return (
    <Alert
      status="warning"
      title="This board is archived and read-only"
      description={`It is no longer listed and will be permanently deleted on ${purgeDate}. Until then only admins can view it via this link.`}
      customActions={
        isAdmin ? (
          <Flex gap="2">
            <Button
              variant="secondary"
              size="small"
              onPress={() => guarded(() => boardsApi.unarchiveBoard(board.id))}
            >
              Unarchive
            </Button>
            <Button
              variant="secondary"
              size="small"
              destructive
              onPress={onRequestDelete}
            >
              Delete now
            </Button>
          </Flex>
        ) : undefined
      }
    />
  );
}
