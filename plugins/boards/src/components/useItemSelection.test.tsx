import { act, renderHook } from '@testing-library/react';
import { useItemSelection } from './useItemSelection';

describe('useItemSelection', () => {
  it('toggles single items', () => {
    const { result } = renderHook(() => useItemSelection());
    expect(result.current.selected.size).toBe(0);

    act(() => result.current.toggleItem('a'));
    expect([...result.current.selected]).toEqual(['a']);

    act(() => result.current.toggleItem('b'));
    expect([...result.current.selected].sort()).toEqual(['a', 'b']);

    act(() => result.current.toggleItem('a'));
    expect([...result.current.selected]).toEqual(['b']);
  });

  it('sets and clears many ids at once', () => {
    const { result } = renderHook(() => useItemSelection());

    act(() => result.current.setMany(['a', 'b', 'c'], true));
    expect(result.current.selected.size).toBe(3);

    act(() => result.current.setMany(['b', 'c'], false));
    expect([...result.current.selected]).toEqual(['a']);
  });

  it('clears everything', () => {
    const { result } = renderHook(() => useItemSelection());
    act(() => result.current.setMany(['a', 'b'], true));
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
  });

  it('keeps an id a single selection however often it is set', () => {
    const { result } = renderHook(() => useItemSelection());
    act(() => result.current.setMany(['a', 'a', 'a'], true));
    expect(result.current.selected.size).toBe(1);
  });
});
