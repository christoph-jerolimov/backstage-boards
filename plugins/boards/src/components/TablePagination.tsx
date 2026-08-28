import { Button, Flex, Select, Text } from '@backstage/ui';
import { selectedOption } from './common';

export const PAGE_SIZES = ['10', '25', '50'] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = '25';

/**
 * The footer under a paged table: which rows are on screen, how many
 * there are in total, a step either way, and the page size.
 *
 * `total` counts every row matching the request, not the page, so it is
 * what the range is measured against. The controls disable rather than
 * disappear at the bounds, so the footer does not change height as the
 * user pages.
 */
export function TablePagination(props: {
  /** What the rows are, for the summary: "boards", "items", … */
  noun: string;
  total: number;
  offset: number;
  pageSize: PageSize;
  /** Rows actually on screen, which is fewer than the page on the last one. */
  count: number;
  onOffsetChange: (offset: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}) {
  const { noun, total, offset, pageSize, count } = props;
  const size = Number(pageSize);
  const first = total === 0 ? 0 : offset + 1;
  const last = offset + count;
  return (
    <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
      <Text variant="body-small" color="secondary" style={{ flexGrow: 1 }}>
        {total === 0 ? `No ${noun}` : `${first}–${last} of ${total} ${noun}`}
      </Text>
      <Button
        variant="tertiary"
        size="small"
        isDisabled={offset === 0}
        onPress={() => props.onOffsetChange(Math.max(0, offset - size))}
      >
        Previous
      </Button>
      <Button
        variant="tertiary"
        size="small"
        isDisabled={last >= total}
        onPress={() => props.onOffsetChange(offset + size)}
      >
        Next
      </Button>
      {/* wide enough for the longest option, and fixed so the buttons
          beside it do not shift as the selection changes */}
      <div style={{ width: 140, flexShrink: 0 }}>
        <Select
          aria-label="Page size"
          size="small"
          options={PAGE_SIZES.map(value => ({
            value,
            label: `${value} per page`,
          }))}
          selectedKey={pageSize}
          onSelectionChange={key =>
            props.onPageSizeChange(
              selectedOption(key, PAGE_SIZES) ?? DEFAULT_PAGE_SIZE,
            )
          }
        />
      </div>
    </Flex>
  );
}
