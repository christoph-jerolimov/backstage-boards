import { wipState } from './types';

describe('wipState', () => {
  it('stays ok without limits', () => {
    expect(wipState({}, 99)).toBe('ok');
  });

  it('turns soft at the soft limit and hard at the hard limit', () => {
    const column = { wipSoftLimit: 2, wipHardLimit: 4 };
    expect(wipState(column, 1)).toBe('ok');
    expect(wipState(column, 2)).toBe('soft');
    expect(wipState(column, 3)).toBe('soft');
    expect(wipState(column, 4)).toBe('hard');
    expect(wipState(column, 5)).toBe('hard');
  });

  it('works with a single limit', () => {
    expect(wipState({ wipSoftLimit: 1 }, 1)).toBe('soft');
    expect(wipState({ wipHardLimit: 1 }, 1)).toBe('hard');
  });
});
