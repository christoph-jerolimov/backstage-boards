import { useState } from 'react';
import { RiArrowDownSLine, RiEyeLine, RiEyeOffLine } from '@remixicon/react';
import {
  Button,
  ButtonIcon,
  Menu,
  MenuItem,
  MenuTrigger,
  Text,
} from '@backstage/ui';
import { useQuery } from '@tanstack/react-query';
import { AsyncList, RefDisplay } from './common';

/**
 * Combined watch control: the main segment toggles the current user's
 * watch state, the chevron segment opens a dropdown listing all watchers.
 * Used on the board header and in the item drawer.
 */
export function WatchButton(props: {
  watching: boolean;
  onToggle: (watching: boolean) => Promise<void> | void;
  loadWatchers: () => Promise<string[]>;
  /** Cache key for the watcher list, e.g. `queryKeys.boardWatchers(id)`. */
  watchersKey: readonly unknown[];
  targetLabel: string;
}) {
  const { watching, onToggle, loadWatchers, targetLabel } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: watchers, isLoading: loading } = useQuery({
    // the own watch state is part of the key: toggling it changes the list
    queryKey: [...props.watchersKey, watching],
    enabled: menuOpen,
    queryFn: () => loadWatchers(),
  });

  const menuContent = (
    <AsyncList
      isLoading={loading}
      items={watchers}
      loading={
        <MenuItem isDisabled>
          <Text variant="body-small">Loading…</Text>
        </MenuItem>
      }
      empty={
        <MenuItem isDisabled>
          <Text variant="body-small">Nobody is watching yet</Text>
        </MenuItem>
      }
    >
      {found =>
        found.map(watcher => (
          <MenuItem key={watcher} textValue={watcher}>
            <RefDisplay refString={watcher} />
          </MenuItem>
        ))
      }
    </AsyncList>
  );

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Button
        variant={watching ? 'secondary' : 'tertiary'}
        size="small"
        iconStart={
          watching ? <RiEyeLine size={16} /> : <RiEyeOffLine size={16} />
        }
        onPress={() => onToggle(!watching)}
        aria-label={
          watching ? `Stop watching ${targetLabel}` : `Watch ${targetLabel}`
        }
      >
        {watching ? 'Watching' : 'Watch'}
      </Button>
      <MenuTrigger isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <ButtonIcon
          aria-label={`Show watchers of ${targetLabel}`}
          variant="tertiary"
          size="small"
          icon={<RiArrowDownSLine size={16} />}
        />
        <Menu aria-label={`Watchers of ${targetLabel}`}>{menuContent}</Menu>
      </MenuTrigger>
    </span>
  );
}
