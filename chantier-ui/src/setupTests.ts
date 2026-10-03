// API navigateur absentes de jsdom et utilisées par antd

window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
})) as any;

(global as any).ResizeObserver = (global as any).ResizeObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Version à base de setTimeout : un vrai MessageChannel garde ses ports ouverts et empêche Jest de se terminer
(global as any).MessageChannel = (global as any).MessageChannel || class {
    port1: any = { onmessage: null };
    port2: any = {
        postMessage: (data: any) => setTimeout(() => this.port1.onmessage && this.port1.onmessage({ data }), 0),
    };
};
