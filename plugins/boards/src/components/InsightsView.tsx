import { Button, Flex, Text } from '@backstage/ui';
import { useApi } from '@backstage/frontend-plugin-api';
import { useQuery } from '@tanstack/react-query';
import { RiBarChartLine } from '@remixicon/react';
import {
  BoardInsights,
  BoardWithContext,
  ColumnColor,
} from '@internal/plugin-boards-common';
import { boardsApiRef } from '../api';
import { queryKeys } from '../queries';
import type { BoardDialogKind } from './BoardDialogs';
import { EmptyState } from './EmptyState';
import { colorHex } from './StatusBadge';

/** A readable duration for chart labels: minutes, hours, or days. */
export function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  if (hours < 48) {
    return `${Math.round(hours * 10) / 10}h`;
  }
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

function ChartCard(props: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--bui-border)',
        borderRadius: 8,
        padding: 16,
        background: 'var(--bui-bg-neutral-1)',
        minWidth: 320,
        flexGrow: 1,
        flexBasis: 360,
      }}
    >
      <Text variant="body-medium" weight="bold" as="h3">
        {props.title}
      </Text>
      <Text variant="body-small" color="secondary">
        {props.subtitle}
      </Text>
      <div style={{ marginTop: 12 }}>{props.children}</div>
    </div>
  );
}

/** Horizontal bars: average time per column, labelled with avg/median. */
function CycleTimeChart(props: { insights: BoardInsights }) {
  const rows = props.insights.cycleTimes;
  const max = Math.max(...rows.map(row => row.averageHours), 1);
  return (
    <div data-testid="cycle-time-chart">
      {rows.map(row => (
        <Flex key={row.columnId} align="center" gap="2" mb="1">
          <div style={{ width: 110, flexShrink: 0, textAlign: 'right' }}>
            <Text variant="body-small">{row.title}</Text>
          </div>
          <div style={{ flexGrow: 1 }}>
            <div
              style={{
                width: `${Math.max((row.averageHours / max) * 100, 1)}%`,
                height: 16,
                borderRadius: 4,
                background: colorHex(row.color),
                opacity: row.stays === 0 ? 0.25 : 1,
              }}
            />
          </div>
          <div style={{ width: 150, flexShrink: 0 }}>
            <Text variant="body-x-small" color="secondary">
              {row.stays === 0
                ? 'no completed stays'
                : `avg ${formatHours(row.averageHours)} · median ${formatHours(
                    row.medianHours,
                  )} · ${row.stays}`}
            </Text>
          </div>
        </Flex>
      ))}
    </div>
  );
}

/** Stacked area of per-column item counts over the last 30 days. */
function CumulativeFlowChart(props: { insights: BoardInsights }) {
  const { columns, cumulativeFlow } = props.insights;
  const width = 600;
  const height = 180;
  const days = cumulativeFlow.length;
  const totalOf = (index: number) =>
    columns.reduce(
      (sum, column) =>
        sum + (cumulativeFlow[index].counts[column.columnId] ?? 0),
      0,
    );
  const maxTotal = Math.max(...cumulativeFlow.map((_, i) => totalOf(i)), 1);
  const x = (index: number) => (index / Math.max(days - 1, 1)) * width;
  const y = (count: number) => height - (count / maxTotal) * height;

  // stack bottom-up in column order: each band's top line is the sum of
  // itself and everything below it
  const bands = columns.map((column, columnIndex) => {
    const top = cumulativeFlow.map((day, index) => {
      const sum = columns
        .slice(0, columnIndex + 1)
        .reduce((acc, entry) => acc + (day.counts[entry.columnId] ?? 0), 0);
      return `${x(index)},${y(sum)}`;
    });
    const bottom = cumulativeFlow
      .map((day, index) => {
        const sum = columns
          .slice(0, columnIndex)
          .reduce((acc, entry) => acc + (day.counts[entry.columnId] ?? 0), 0);
        return `${x(index)},${y(sum)}`;
      })
      .reverse();
    return { column, points: [...top, ...bottom].join(' ') };
  });

  return (
    <div data-testid="cumulative-flow-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Cumulative flow diagram"
      >
        {bands.map(band => (
          <polygon
            key={band.column.columnId}
            points={band.points}
            fill={colorHex(band.column.color)}
            fillOpacity={0.7}
          />
        ))}
      </svg>
      <Flex gap="3" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {columns.map(column => (
          <LegendEntry
            key={column.columnId}
            color={column.color}
            label={column.title}
          />
        ))}
      </Flex>
      <Flex justify="between">
        <Text variant="body-x-small" color="secondary">
          {cumulativeFlow[0]?.date}
        </Text>
        <Text variant="body-x-small" color="secondary">
          {cumulativeFlow[cumulativeFlow.length - 1]?.date}
        </Text>
      </Flex>
    </div>
  );
}

function LegendEntry(props: { color?: ColumnColor; label: string }) {
  return (
    <Flex align="center" gap="1">
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: colorHex(props.color),
          display: 'inline-block',
        }}
      />
      <Text variant="body-x-small" color="secondary">
        {props.label}
      </Text>
    </Flex>
  );
}

/** Weekly bars of arrivals in the board's last column. */
function ThroughputChart(props: { insights: BoardInsights }) {
  const weeks = props.insights.throughput;
  const max = Math.max(...weeks.map(week => week.count), 1);
  return (
    <div data-testid="throughput-chart">
      <Flex align="end" gap="2" style={{ height: 140 }}>
        {weeks.map(week => (
          <Flex
            key={week.weekStart}
            direction="column"
            align="center"
            gap="1"
            style={{ flexGrow: 1, height: '100%', justifyContent: 'flex-end' }}
          >
            <Text variant="body-x-small" color="secondary">
              {week.count}
            </Text>
            <div
              style={{
                width: '70%',
                height: `${Math.max((week.count / max) * 100, 2)}%`,
                borderRadius: '4px 4px 0 0',
                background: 'var(--bui-bg-solid)',
              }}
            />
          </Flex>
        ))}
      </Flex>
      <Flex justify="between">
        {weeks.map((week, index) => (
          <Text
            key={week.weekStart}
            variant="body-x-small"
            color="secondary"
            style={{ flexGrow: 1, textAlign: 'center' }}
          >
            {index === 0 || index === weeks.length - 1
              ? week.weekStart.slice(5)
              : ''}
          </Text>
        ))}
      </Flex>
    </div>
  );
}

/**
 * The board's Insights view: cycle time per column, cumulative flow,
 * and weekly throughput — server-computed from the recorded item
 * history — plus entry points to the matrix dialogs.
 */
export function InsightsView(props: {
  board: BoardWithContext;
  onOpenDialog: (kind: BoardDialogKind) => void;
}) {
  const { board, onOpenDialog } = props;
  const boardsApi = useApi(boardsApiRef);
  const { data: insights, isLoading } = useQuery({
    queryKey: queryKeys.boardInsights(board.id),
    queryFn: () => boardsApi.getBoardInsights(board.id),
  });
  if (isLoading || !insights) {
    return <Text color="secondary">Loading insights…</Text>;
  }
  if (insights.moveCount === 0) {
    return (
      <EmptyState
        icon={<RiBarChartLine size={28} />}
        title="No flow history yet"
        description="Once items move between columns, cycle times, cumulative flow, and throughput show up here."
      />
    );
  }
  return (
    <Flex direction="column" gap="3">
      <Flex gap="2">
        <Button
          variant="tertiary"
          size="small"
          onPress={() => onOpenDialog('assigneeMatrix')}
        >
          Assignee matrix
        </Button>
        <Button
          variant="tertiary"
          size="small"
          onPress={() => onOpenDialog('priorityMatrix')}
        >
          Priority matrix
        </Button>
      </Flex>
      <Flex gap="3" style={{ flexWrap: 'wrap', alignItems: 'stretch' }}>
        <ChartCard
          title="Cycle time per column"
          subtitle="How long items spend in each column (completed stays only)"
        >
          <CycleTimeChart insights={insights} />
        </ChartCard>
        <ChartCard
          title="Throughput"
          subtitle={`Items reaching “${
            insights.columns[insights.columns.length - 1]?.title ?? '—'
          }” per week, last 8 weeks`}
        >
          <ThroughputChart insights={insights} />
        </ChartCard>
      </Flex>
      <ChartCard
        title="Cumulative flow"
        subtitle="Items per column at each day's end, last 30 days"
      >
        <CumulativeFlowChart insights={insights} />
      </ChartCard>
    </Flex>
  );
}
