import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";

export class ObjectStyleMirror {
  observerRef: IORef.IORef<O.Option<MutationObserver>>;
  source: Element;
  target: Element;

  constructor(source: Element, target: Element) {
    this.observerRef = IORef.newIORef(O.none)();
    this.source = source;
    this.target = target;
  }

  start: IO.IO<void> = () => {
    const observer = new MutationObserver((mutations) =>
      pipe(
        mutations,
        A.some((m) => m.type === "attributes" && m.attributeName === "style"),
        (shouldSync) => shouldSync && this.sync(),
      ),
    );

    observer.observe(this.source, {
      attributes: true,
      attributeFilter: ["style"],
    });

    this.sync();
    this.observerRef.write(O.some(observer))();
  };

  stop: IO.IO<void> = () =>
    pipe(
      this.observerRef.read(),
      O.map((observer) => observer.disconnect()),
    );

  processStyle = (style: string): string =>
    pipe(
      style.split(";"),
      A.map((s) => s.trim()),
      A.filter((s) => s.length > 0),
      A.filter((s) => !s.startsWith("background-color")),
      A.map((s) => (s.includes("!important") ? s : `${s} !important`)),
      A.append("background-color: black !important"),
      (styles) => styles.join("; "),
    );

  sync: IO.IO<void> = () => {
    pipe(
      O.fromNullable(this.source.getAttribute("style")),
      O.map(this.processStyle),
      O.map((processed) => this.target.setAttribute("style", processed)),
    );
  };
}

export const copyProperties = (source: object, target: Element) => {
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

const proxyProperty = (target: object, source: object, key: string) => {
  const getPropertyDescriptor = (source: object, key: string): PropertyDescriptor | undefined => {
    return (
      Object.getOwnPropertyDescriptor(source, key) ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(source), key)
    );
  };

  const proxyMethod = (target: object, source: object, key: string) => {
    Object.defineProperty(target, key, {
      value: (...args: unknown[]) => (source as any)[key](...args),
      writable: true,
      configurable: true,
    });
  };

  const proxyAccessor = (target: object, source: object, key: string) => {
    Object.defineProperty(target, key, {
      get: () => (source as any)[key],
      set: (value: unknown) => {
        (source as any)[key] = value;
      },
      configurable: true,
    });
  };

  if (key === "constructor" || key in target) return;

  const descriptor = getPropertyDescriptor(source, key);
  if (!descriptor) return;

  if (typeof descriptor.value === "function") {
    proxyMethod(target, source, key);
  } else {
    proxyAccessor(target, source, key);
  }
};

export const proxyProperties = (target: object, source: object) => {
  const propertyNames = new Set<string>([
    ...Object.keys(source),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(source)),
  ]);

  for (const key of propertyNames) {
    proxyProperty(target, source, key);
  }
};
