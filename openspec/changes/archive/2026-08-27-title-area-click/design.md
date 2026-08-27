# Design

The title wrapper keeps `stopPropagation` (so a click on the InlineEdit
span doesn't bubble into the card's open handler), but when the click
target is the wrapper itself — i.e. beside the inline text, not on it —
it calls `openItem` directly.
