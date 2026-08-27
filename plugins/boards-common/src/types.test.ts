import { COLUMN_COLORS, ColumnColor } from './types';

describe('COLUMN_COLORS', () => {
  it('maps every palette name to a hex color', () => {
    const names: ColumnColor[] = [
      'gray',
      'blue',
      'green',
      'yellow',
      'orange',
      'red',
      'purple',
      'teal',
    ];
    expect(Object.keys(COLUMN_COLORS).sort()).toEqual([...names].sort());
    for (const name of names) {
      expect(COLUMN_COLORS[name]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
