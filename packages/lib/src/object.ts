export class ObjectStyleMirror {
  private observer: MutationObserver;
  private source: HTMLElement;
  private target: HTMLElement;

  constructor(source: HTMLElement, target: HTMLElement) {
    this.source = source;
    this.target = target;
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          this.sync();
        }
      }
    });
    this.sync();
    this.observer.observe(this.source, { attributes: true, attributeFilter: ["style"] });
  }

  private sync = () => {
    const styleAttr = this.source.getAttribute("style");
    if (styleAttr) this.target.setAttribute("style", styleAttr);
  };

  disconnect = () => {
    this.observer.disconnect();
  };
}

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

export const getPropertyNames = (source: object): Set<string> => {
  return new Set<string>([...Object.keys(source), ...Object.getOwnPropertyNames(Object.getPrototypeOf(source))]);
};

export const getPropertyDescriptor = (source: object, key: string): PropertyDescriptor | undefined => {
  return (
    Object.getOwnPropertyDescriptor(source, key) || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(source), key)
  );
};

export const proxyMethod = (target: object, source: object, key: string): void => {
  Object.defineProperty(target, key, {
    value: (...args: unknown[]) => (source as any)[key](...args),
    writable: true,
    configurable: true,
  });
};

export const proxyAccessor = (target: object, source: object, key: string): void => {
  Object.defineProperty(target, key, {
    get: () => (source as any)[key],
    set: (value: unknown) => {
      (source as any)[key] = value;
    },
    configurable: true,
  });
};

export const proxyProperty = (target: object, source: object, key: string): void => {
  if (key === "constructor" || key in target) return;

  const descriptor = getPropertyDescriptor(source, key);
  if (!descriptor) return;

  if (typeof descriptor.value === "function") {
    proxyMethod(target, source, key);
  } else {
    proxyAccessor(target, source, key);
  }
};

export const proxyProperties = (target: object, source: object): void => {
  const propertyNames = getPropertyNames(source);
  for (const key of propertyNames) {
    proxyProperty(target, source, key);
  }
};
