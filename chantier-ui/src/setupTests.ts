// Polyfills for jsdom (required by Ant Design)
window.matchMedia = window.matchMedia || function matchMediaMock(query: string) {
    return {
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    };
} as any;

window.ResizeObserver = window.ResizeObserver || class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
} as any;

window.getComputedStyle = window.getComputedStyle || (() => ({})) as any;

// Antd 6 requires these globals in JSDOM
(global as any).getComputedStyle = window.getComputedStyle;
(global as any).Element = window.Element;
(global as any).HTMLElement = window.HTMLElement;

// MessageChannel mock for antd 6 notification system
if (typeof globalThis.MessageChannel === 'undefined') {
    (global as any).MessageChannel = class MessageChannel {
        port1: any;
        port2: any;
        constructor() {
            const port1: any = { onmessage: null, postMessage: (data: any) => { if (this.port2.onmessage) setTimeout(() => this.port2.onmessage({ data }), 0); }, close: () => {} };
            const port2: any = { onmessage: null, postMessage: (data: any) => { if (this.port1.onmessage) setTimeout(() => this.port1.onmessage({ data }), 0); }, close: () => {} };
            this.port1 = port1;
            this.port2 = port2;
        }
    };
}
