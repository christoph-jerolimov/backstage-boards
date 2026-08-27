import { useState } from 'react';
import { Button, Flex, Text, TextAreaField } from '@backstage/ui';
import { CommentVersion } from '@internal/plugin-boards-common';
import {
  formatDate,
  MarkdownContent,
  RefDisplay,
  useAsyncData,
} from './common';

/**
 * Shared markdown display/edit block with retained version history.
 * Used for comments and for the item description.
 */
export function EditableMarkdown(props: {
  text: string;
  canEdit: boolean;
  /** Number of stored versions; history is offered when > 1. */
  versionCount: number;
  loadVersions: () => Promise<CommentVersion[]>;
  onSave: (text: string) => Promise<void>;
  /** Allow saving an empty text (clears the content). */
  allowEmpty?: boolean;
  emptyText?: string;
  editAriaLabel: string;
}) {
  const {
    text,
    canEdit,
    versionCount,
    loadVersions,
    onSave,
    allowEmpty,
    emptyText,
    editAriaLabel,
  } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [showVersions, setShowVersions] = useState(false);
  const { data: versions } = useAsyncData(
    () => (showVersions ? loadVersions() : Promise.resolve(undefined)),
    [showVersions, versionCount, loadVersions],
  );

  const save = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next === text.trim()) {
      return;
    }
    if (next || allowEmpty) {
      await onSave(next);
    }
  };

  return (
    <div>
      <Flex gap="1" justify="end">
        {versionCount > 1 && (
          <Button
            variant="tertiary"
            size="small"
            onPress={() => setShowVersions(!showVersions)}
          >
            {showVersions ? 'Hide history' : 'History'}
          </Button>
        )}
        {canEdit && !editing && (
          <Button
            variant="tertiary"
            size="small"
            onPress={() => {
              setDraft(text);
              setEditing(true);
            }}
          >
            {text ? 'Edit' : 'Add'}
          </Button>
        )}
      </Flex>
      {editing ? (
        <Flex direction="column" gap="2">
          <TextAreaField
            aria-label={editAriaLabel}
            value={draft}
            onChange={setDraft}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into a field the user just revealed
            autoFocus
          />
          <Flex gap="2">
            <Button
              variant="secondary"
              size="small"
              onPress={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="small" onPress={save}>
              Save
            </Button>
          </Flex>
        </Flex>
      ) : (
        <>
          {text ? (
            <MarkdownContent text={text} />
          ) : (
            <Text variant="body-small" color="secondary">
              {emptyText ?? 'Nothing here yet.'}
            </Text>
          )}
        </>
      )}
      {showVersions && versions && (
        <div
          style={{
            marginTop: 8,
            paddingLeft: 8,
            borderLeft: '2px solid var(--bui-border-1)',
          }}
        >
          {versions.map(version => (
            <div key={version.id}>
              <Text variant="body-x-small" color="secondary">
                {formatDate(version.editedAt)} by{' '}
                <RefDisplay refString={version.editedBy} />
              </Text>
              <MarkdownContent text={version.text} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
