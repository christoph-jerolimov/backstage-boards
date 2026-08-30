import '@testing-library/jest-dom';

// jsdom implements neither range measurement nor ResizeObserver; the
// Lexical editor needs both for selection handling and menu positioning.
const zeroRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
} as DOMRect;

if (typeof Range !== 'undefined' && !Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => zeroRect;
  Range.prototype.getClientRects = () =>
    ({
      length: 1,
      item: () => zeroRect,
      [Symbol.iterator]: [zeroRect][Symbol.iterator].bind([zeroRect]),
      0: zeroRect,
    } as unknown as DOMRectList);
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
