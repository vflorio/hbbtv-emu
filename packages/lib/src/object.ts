export const copyProperties = (source: object, target: HTMLObjectElement) => {
    Object.keys(source).forEach((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(source, key);
        if (descriptor) Object.defineProperty(target, key, descriptor);
    });

    const proto = Object.getPrototypeOf(source);
    if (!proto) return;

    Object.getOwnPropertyNames(proto).forEach((key) => {
        if (key !== "constructor" && !(key in target)) {
            const descriptor = Object.getOwnPropertyDescriptor(proto, key);
            if (descriptor) Object.defineProperty(target, key, descriptor);
        }
    });
};