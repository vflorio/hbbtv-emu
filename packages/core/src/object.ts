import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";

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

const getPropertyDescriptor = (obj: object, key: string): O.Option<PropertyDescriptor> => {
  // Walk the full prototype chain so mixin-defined accessors/methods are discovered.
  // Stop before Object.prototype to avoid proxying generic object helpers.
  let current: object | null = obj;

  while (current && current !== Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) return O.some(descriptor);
    current = Object.getPrototypeOf(current);
  }

  return O.none;
};

const collectPropertyKeys = (obj: object): ReadonlyArray<string> => {
  const keys: string[] = [];

  // Own enumerable properties
  keys.push(...Object.keys(obj));

  // All prototype properties (including non-enumerable), excluding Object.prototype
  let current: object | null = Object.getPrototypeOf(obj);
  while (current && current !== Object.prototype) {
    keys.push(...Object.getOwnPropertyNames(current));
    current = Object.getPrototypeOf(current);
  }

  return pipe(
    keys,
    RA.uniq({ equals: (a, b) => a === b }),
    RA.filter((key) => key !== "constructor"),
  );
};

const defineProxyMethod =
  (target: object, source: object) =>
  (key: string): IO.IO<void> =>
  () => {
    Object.defineProperty(target, key, {
      value: (...args: unknown[]) => {
        const method = (source as Record<string, unknown>)[key];
        return typeof method === "function" ? method.apply(source, args) : undefined;
      },
      writable: true,
      configurable: true,
    });
  };

const defineProxyAccessor =
  (target: object, source: object) =>
  (key: string): IO.IO<void> =>
  () => {
    Object.defineProperty(target, key, {
      get: () => (source as Record<string, unknown>)[key],
      set: (value: unknown) => {
        (source as Record<string, unknown>)[key] = value;
      },
      configurable: true,
    });
  };

const proxyProperty =
  (target: object, source: object) =>
  (key: string): IO.IO<void> =>
    pipe(
      // Skip if key already exists on target
      O.fromPredicate((k: string) => !(k in target))(key),
      O.flatMap(() => getPropertyDescriptor(source, key)),
      O.match(
        () => IO.of(undefined),
        (descriptor) =>
          typeof descriptor.value === "function"
            ? defineProxyMethod(target, source)(key)
            : defineProxyAccessor(target, source)(key),
      ),
    );

export const proxyProperties = (target: object, source: object): IO.IO<void> =>
  pipe(
    collectPropertyKeys(source),
    RA.traverse(IO.Applicative)(proxyProperty(target, source)),
    IO.map(() => undefined),
  );
