# Insights

The board header's third view toggle opens **Insights**: a modest
analytics view computed from the history the board already records.

## Cycle time per column

For every column, the average and median time items spent in it,
measured over _completed stays_ — an item entered the column and later
left it through a move. The number after the dot is how many stays the
figure is based on. Columns without completed stays are shown muted.

## Cumulative flow

A stacked area of how many items sat in each column at each day's end
over the last 30 days, in the columns' colors. Widening bands show
where work accumulates; parallel bands show a steady flow. Archived
items stop counting from their archival.

## Throughput

How many items reached the board's **last** column per week, over the
last 8 weeks — the board's "done per week" if the rightmost column is a
done column.

## Matrices

The Insights view also links to the
[assignee matrix and priority matrix](items.md) dialogs for the
per-person and per-priority breakdowns.

## Notes

- All aggregates are computed server-side from the recorded status
  moves; the view needs only read access.
- Moves are recorded with column _titles_, so history from before a
  column rename is not attributed to the renamed column.
- A board whose items never moved shows an explanatory empty state.
