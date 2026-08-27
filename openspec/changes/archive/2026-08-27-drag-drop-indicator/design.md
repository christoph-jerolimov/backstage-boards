# Design

React style objects must not mix a shorthand (`border`) with a
conditional longhand (`borderTop`): when the longhand toggles, React
writes empty longhand declarations and the shorthand is lost. The fix
keeps `border: 1px solid var(--bui-border-1)` constant and expresses the
indicator as `boxShadow: '0 -3px 0 0 var(--bui-fg-link)'` while
`isDropTarget` is true — rendered outside the top edge, visible in the
gap between cards, no property conflicts.
