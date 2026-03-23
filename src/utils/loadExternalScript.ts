const loaded = new Map<string, Promise<void>>();

/** Injects a script tag once per URL; resolves when the script has loaded. */
export function loadExternalScript(src: string): Promise<void> {
    const existing = loaded.get(src);
    if (existing) return existing;
    const p = new Promise<void>((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.onload = () => resolve();
        el.onerror = () => {
            loaded.delete(src);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(el);
    });
    loaded.set(src, p);
    return p;
}
