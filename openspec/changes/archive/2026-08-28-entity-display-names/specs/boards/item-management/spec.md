# Item Management

## ADDED Requirements

### Requirement: Entity display names for refs
Wherever the boards UI names a creator or assignee ref itself — the assignee avatars, the assignee filter, and the item menu's assignee submenu — it SHALL use the catalog entity's display name: `spec.profile.displayName` for `User` and `Group` entities, `metadata.title` for entities of any other kind, then `metadata.name`. When the entity is unknown, not yet loaded, or carries none of those fields, the ref's own name SHALL be shown as before, and a `text:` ref SHALL show its text. Lists ordered by these names SHALL order by the resolved name, so the same people read and sort the same way on every surface.

Each of those surfaces SHALL make the full entity ref available as a tooltip on the displayed name, so the underlying identity stays reachable. A `text:` ref SHALL NOT carry a tooltip. Surfaces that delegate naming to Backstage's own entity links are not affected by this requirement.

#### Scenario: User display name from the profile
- **WHEN** an item is assigned to `user:default/csmith` whose catalog entity has `spec.profile.displayName` "Christoph Smith"
- **THEN** the assignee reads "Christoph Smith" on the card, in the assignee filter, and in the assignee submenu

#### Scenario: Group display name from the profile
- **WHEN** an item is assigned to `group:default/team-a` whose catalog entity has `spec.profile.displayName` "Team Alpha"
- **THEN** the assignee reads "Team Alpha" rather than "team-a"

#### Scenario: Title for entities without a profile display name
- **WHEN** a ref points at an entity that has no `spec.profile.displayName` but has `metadata.title`
- **THEN** the title is shown

#### Scenario: Fallback for unknown or unresolved entities
- **WHEN** a ref's entity is not in the catalog, has neither a profile display name nor a title, or has not been loaded yet
- **THEN** the name from the ref is shown, exactly as before this change

#### Scenario: Full ref as a tooltip
- **WHEN** a user hovers a resolved assignee name or its avatar
- **THEN** the full entity ref (e.g. `user:default/csmith`) is shown, and for a stacked avatar the display name is shown with it

#### Scenario: Free-text assignees carry no tooltip
- **WHEN** a `text:` assignee is displayed
- **THEN** its text is shown as the label and no ref tooltip is offered

#### Scenario: One order everywhere
- **WHEN** a board's assignees are listed in the assignee submenu and in the assignee filter
- **THEN** both list them in the same order, by resolved display name
