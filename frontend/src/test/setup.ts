import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
Object.assign(navigator, { clipboard: { writeText: async () => {} } })

// jsdom non implementa scrollTo sugli elementi (usato dai pannelli flottanti).
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = function scrollTo() {}
