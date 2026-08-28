import { ButtonIcon } from '@backstage/ui';
import { RiStarFill, RiStarLine } from '@remixicon/react';

/**
 * The label for a favorite control. The board is named where the control
 * sits away from the board's title, as in a row of a board table.
 */
export function favoriteLabel(favorite: boolean, boardName?: string): string {
  const verb = favorite ? 'Remove' : 'Add';
  const target = favorite ? 'from favorites' : 'to favorites';
  return boardName ? `${verb} ${boardName} ${target}` : `${verb} ${target}`;
}

/** The star marking a board as favorited, filled while it is. */
export function FavoriteStar(props: { favorite: boolean }) {
  return props.favorite ? <RiStarFill size={16} /> : <RiStarLine size={16} />;
}

/** Toggles a board's favorite state. */
export function FavoriteButton(props: {
  favorite: boolean;
  boardName?: string;
  onToggle: () => void;
}) {
  return (
    <ButtonIcon
      aria-label={favoriteLabel(props.favorite, props.boardName)}
      variant="tertiary"
      size="small"
      icon={<FavoriteStar favorite={props.favorite} />}
      onPress={props.onToggle}
    />
  );
}
