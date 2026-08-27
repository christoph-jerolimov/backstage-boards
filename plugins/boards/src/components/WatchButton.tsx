import { useState } from 'react';
import { RiArrowDownSLine, RiEyeLine, RiEyeOffLine } from '@remixicon/react';
import { Button, ButtonIcon, Menu, MenuItem, MenuTrigger, Text } from '@backstage/ui';
import { RefDisplay, useAsyncData } from './common';

/**
 * Combined watch control: the main segment toggles the current user's
 * watch state, the chevron segment opens a dropdown listing all watchers.
 * Used on the board header and in the item drawer.
 */
export function WatchButton(props: {
  watching: boolean;
  onToggle: (watching: boolean) => Promise<void> | void;
  loadWatchers: () => Promise<string[]>;
  targetLabel: string;
}) {
  const { watching, onToggle, loadWatchers, targetLabel } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: watchers, loading } = useAsyncData(
    () => (menuOpen ? loadWatchers() : Promise.resolve(undefined)),
    // reload when the menu opens or the user's own state changed
    [menuOpen, watching, loadWatchers],
  );

  let menuContent;
  if (loading || watchers === undefined) {
    menuContent = (
      <MenuItem isDisabled>
        <Text variant="body-small">Loading…</Text>
      </MenuItem>
    );
  } else if (watchers.length === 0) {
    menuContent = (
      <MenuItem isDisabled>
        <Text variant="body-small">Nobody is watching yet</Text>
      </MenuItem>
    );
  } else {
    menuContent = watchers.map(watcher => (
      <MenuItem key={watcher} textValue={watcher}>
        <RefDisplay refString={watcher} />
      </MenuItem>
    ));
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Button
        variant={watching ? 'secondary' : 'tertiary'}
        size="small"
        iconStart={watching ? <RiEyeLine size={16} /> : <RiEyeOffLine size={16} />}
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
