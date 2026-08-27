# Design

The SearchField is wrapped in a fixed-width (240px, no shrink)
container; the status Text gets `flexGrow: 1` so the following Clear
button lands at the row's right edge. Wrapping stays enabled for
narrow viewports.
