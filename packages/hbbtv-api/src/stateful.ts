/**
 * Stateful Object Pattern
 *
 * Provides a declarative way to:
 * 1. Instantiate OIPF classes with pre-loaded state
 * 2. Define how state maps to class properties
 * 3. Apply state updates to existing instances
 * 4. Notify external listeners when state changes (bidirectional)
 *
 * Supports deriving schemas from io-ts codecs to avoid duplication.
 */

import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as t from "io-ts";

/**
 * Descriptor for a single property mapping from state to instance.
 * Uses a simpler callback-based approach for flexibility.
 */
export type PropertyDescriptor<S extends object, T extends object> = Readonly<{
  /** Key in the state object */
  stateKey: keyof S;

  /** Key in the instance object */
  instanceKey: keyof T;

  /** Apply value from state to instance */
  apply: (instance: T, value: unknown) => void;

  /** Read value from instance to state */
  read: (instance: T) => unknown;
}>;

/**
 * Schema defining how state maps to an instance's properties.
 * Array of property descriptors for each state field.
 *
 * @template S - State type (must be object)
 * @template T - Instance type (must be object)
 */
export type StateSchema<S extends object, T extends object> = ReadonlyArray<PropertyDescriptor<S, T>>;

/**
 * Callback type for state change notifications.
 */
export type OnStateChangeCallback<S> = (state: Partial<S>) => IO.IO<void>;

/**
 * Interface for stateful objects that can receive state updates.
 *
 * @template S - State type
 */
export interface Stateful<S> {
  /** Apply a partial state update to this instance */
  applyState: (state: Partial<S>) => IO.IO<void>;

  /** Get current state from instance properties */
  getState: () => IO.IO<Partial<S>>;

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe: (callback: OnStateChangeCallback<S>) => IO.IO<() => void>;

  /** Notify subscribers of a state change (internal use) */
  notifyStateChange: (changedKeys: ReadonlyArray<keyof S>) => IO.IO<void>;
}

/**
 * Mapping overrides for schema derivation.
 * Maps state keys to instance keys when they differ.
 */
export type PropertyMappings<S extends object, T extends object> = Partial<Record<keyof S, keyof T>>;

/**
 * Custom transform function for a property.
 */
export type PropertyTransforms<S extends object> = Partial<Record<keyof S, (value: unknown) => unknown>>;

/**
 * Custom reverse transform function (instance → state).
 */
export type PropertyReverseTransforms<S extends object> = Partial<Record<keyof S, (value: unknown) => unknown>>;

// ─────────────────────────────────────────────────────────────────────────────
// Descriptor Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a property descriptor for direct assignment.
 * When state has a value, assign it directly to the instance property.
 *
 * @example
 * ```ts
 * prop<MyState, MyClass>("hbbtvVersion", "hbbtvVersion")
 * // state.hbbtvVersion → instance.hbbtvVersion
 * ```
 */
export const prop = <S extends object, T extends object>(
  stateKey: keyof S,
  instanceKey: keyof T,
): PropertyDescriptor<S, T> => ({
  stateKey,
  instanceKey,
  apply: (instance, value) => {
    if (value !== undefined) {
      (instance as Record<keyof T, unknown>)[instanceKey] = value;
    }
  },
  read: (instance) => (instance as Record<keyof T, unknown>)[instanceKey],
});

/**
 * Create a property descriptor that spreads array values.
 * Useful for arrays that should be copied (not referenced).
 *
 * @example
 * ```ts
 * propArray<MyState, MyClass>("uiProfiles", "uiProfiles")
 * // state.uiProfiles → instance.uiProfiles = [...value]
 * ```
 */
export const propArray = <S extends object, T extends object>(
  stateKey: keyof S,
  instanceKey: keyof T,
): PropertyDescriptor<S, T> => ({
  stateKey,
  instanceKey,
  apply: (instance, value) => {
    if (value !== undefined) {
      (instance as Record<keyof T, unknown>)[instanceKey] = Array.isArray(value) ? [...value] : value;
    }
  },
  read: (instance) => {
    const value = (instance as Record<keyof T, unknown>)[instanceKey];
    return Array.isArray(value) ? [...value] : value;
  },
});

/**
 * Create a property descriptor with custom transformation.
 *
 * @example
 * ```ts
 * propTransform<MyState, MyClass>("width", "width", (v) => String(v), (v) => Number(v))
 * // state.width (number) → instance.width (string) and back
 * ```
 */
export const propTransform = <S extends object, T extends object, V>(
  stateKey: keyof S,
  instanceKey: keyof T,
  transform: (value: unknown) => V,
  reverseTransform: (value: unknown) => unknown = (v) => v,
): PropertyDescriptor<S, T> => ({
  stateKey,
  instanceKey,
  apply: (instance, value) => {
    if (value !== undefined) {
      (instance as Record<keyof T, unknown>)[instanceKey] = transform(value);
    }
  },
  read: (instance) => reverseTransform((instance as Record<keyof T, unknown>)[instanceKey]),
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema Derivation from io-ts Codec
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if an io-ts codec represents an array type.
 * Works with ArrayType, ReadonlyArrayType, and refinements.
 */
const isArrayCodec = (codec: t.Mixed): boolean => {
  const tag = (codec as any)._tag;
  return tag === "ArrayType" || tag === "ReadonlyArrayType";
};

/**
 * Derive a StateSchema from an io-ts codec.
 *
 * Automatically detects array types and creates appropriate descriptors.
 * Use mappings to override instance property names when they differ from state keys.
 * Use transforms for custom value transformations.
 *
 * @param codec - io-ts codec (t.partial or t.type)
 * @param options - Optional mappings and transforms
 * @returns StateSchema derived from the codec
 *
 * @example
 * ```ts
 * // Same keys in state and instance
 * const schema = deriveSchema<OipfCapabilitiesState, OipfCapabilities>(
 *   OipfCapabilitiesStateCodec
 * );
 *
 * // With key mappings
 * const schema = deriveSchema<MyState, MyClass>(MyCodec, {
 *   mappings: { stateKey: "instanceKey" }
 * });
 *
 * // With transforms
 * const schema = deriveSchema<MyState, MyClass>(MyCodec, {
 *   transforms: { width: (v) => String(v) }
 * });
 * ```
 */
export const deriveSchema = <S extends object, T extends object>(
  codec: t.PartialC<t.Props> | t.TypeC<t.Props>,
  options: {
    mappings?: PropertyMappings<S, T>;
    transforms?: PropertyTransforms<S>;
  } = {},
): StateSchema<S, T> => {
  const { mappings = {} as PropertyMappings<S, T>, transforms = {} as PropertyTransforms<S> } = options;
  const props = codec.props;

  return Object.keys(props).map((key) => {
    const stateKey = key as keyof S;
    const instanceKey = ((mappings as Record<keyof S, keyof T>)[stateKey] ?? key) as keyof T;
    const propCodec = props[key];
    const transform = (transforms as Record<keyof S, (value: unknown) => unknown>)[stateKey];

    // If custom transform provided, use it
    if (transform) {
      return propTransform<S, T, unknown>(stateKey, instanceKey, transform);
    }

    // Auto-detect arrays and use propArray
    if (isArrayCodec(propCodec)) {
      return propArray<S, T>(stateKey, instanceKey);
    }

    // Default to direct assignment
    return prop<S, T>(stateKey, instanceKey);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// State Application
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply state to an instance using a schema.
 *
 * @param schema - The state schema defining property mappings
 * @param instance - The instance to update
 * @param state - The state to apply (partial)
 * @returns IO action that applies the state
 */
export const applyState =
  <S extends object, T extends object>(schema: StateSchema<S, T>) =>
  (instance: T) =>
  (state: Partial<S>): IO.IO<void> =>
  () => {
    for (const descriptor of schema) {
      const value = state[descriptor.stateKey];
      if (value !== undefined) {
        descriptor.apply(instance, value);
      }
    }
  };

/**
 * Read current state from an instance using a schema.
 *
 * @param schema - The state schema defining property mappings
 * @param instance - The instance to read from
 * @param keys - Optional: only read specific keys. If omitted, reads all.
 * @returns IO action that returns the current state
 */
export const readState =
  <S extends object, T extends object>(schema: StateSchema<S, T>) =>
  (instance: T) =>
  (keys?: ReadonlyArray<keyof S>): IO.IO<Partial<S>> =>
  () => {
    const result: Partial<S> = {};
    for (const descriptor of schema) {
      // If keys specified, only read those
      if (keys && !keys.includes(descriptor.stateKey)) {
        continue;
      }
      const value = descriptor.read(instance);
      if (value !== undefined) {
        (result as Record<keyof S, unknown>)[descriptor.stateKey] = value;
      }
    }
    return result;
  };

/**
 * Create a stateful instance with initial state applied.
 *
 * @param schema - The state schema
 * @param create - Factory function to create instance
 * @param initialState - Initial state to apply
 * @returns IO action that creates and initializes the instance
 */
export const createStateful =
  <S extends object, T extends object>(schema: StateSchema<S, T>) =>
  (create: () => T) =>
  (initialState: Partial<S>): IO.IO<T> =>
    pipe(
      IO.of(create()),
      IO.tap((instance) => applyState(schema)(instance)(initialState)),
    );

// ─────────────────────────────────────────────────────────────────────────────
// Bidirectional State Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subscriber storage for an instance.
 * Uses WeakMap to avoid memory leaks.
 */
const subscribersMap = new WeakMap<object, Set<OnStateChangeCallback<object>>>();

/**
 * Get or create subscribers set for an instance.
 */
const getSubscribers = <S extends object>(instance: object): Set<OnStateChangeCallback<S>> => {
  let subs = subscribersMap.get(instance);
  if (!subs) {
    subs = new Set();
    subscribersMap.set(instance, subs);
  }
  return subs as Set<OnStateChangeCallback<S>>;
};

/**
 * Subscribe to state changes on an instance.
 *
 * @param instance - The stateful instance
 * @param callback - Called when state changes
 * @returns IO action that returns an unsubscribe function
 */
export const subscribe =
  <S extends object>(instance: object) =>
  (callback: OnStateChangeCallback<S>): IO.IO<() => void> =>
  () => {
    const subs = getSubscribers<S>(instance);
    subs.add(callback);
    return () => {
      subs.delete(callback);
    };
  };

/**
 * Notify all subscribers of state changes.
 *
 * @param schema - The state schema
 * @param instance - The stateful instance
 * @param changedKeys - Keys that changed
 * @returns IO action that notifies all subscribers
 */
export const notifyStateChange =
  <S extends object, T extends object>(schema: StateSchema<S, T>) =>
  (instance: T) =>
  (changedKeys: ReadonlyArray<keyof S>): IO.IO<void> =>
    pipe(
      readState(schema)(instance)(changedKeys),
      IO.flatMap((changedState) => () => {
        const subs = getSubscribers<S>(instance);
        for (const callback of subs) {
          callback(changedState)();
        }
      }),
    );

/**
 * Create methods for bidirectional state management.
 * Returns an object with all Stateful methods bound to the schema and instance.
 *
 * @param schema - The state schema
 * @param instance - The instance to bind to
 * @returns Object with applyState, getState, subscribe, notifyStateChange
 *
 * @example
 * ```ts
 * class OipfCapabilities implements Stateful<OipfCapabilitiesState> {
 *   private _stateful = createBidirectionalMethods(schema, this);
 *
 *   applyState = this._stateful.applyState;
 *   getState = this._stateful.getState;
 *   subscribe = this._stateful.subscribe;
 *   notifyStateChange = this._stateful.notifyStateChange;
 * }
 * ```
 */
export const createBidirectionalMethods = <S extends object, T extends object>(
  schema: StateSchema<S, T>,
  instance: T,
): {
  applyState: (state: Partial<S>) => IO.IO<void>;
  getState: () => IO.IO<Partial<S>>;
  subscribe: (callback: OnStateChangeCallback<S>) => IO.IO<() => void>;
  notifyStateChange: (changedKeys: ReadonlyArray<keyof S>) => IO.IO<void>;
} => ({
  applyState: (state: Partial<S>) => applyState(schema)(instance)(state),
  getState: () => readState(schema)(instance)(),
  subscribe: (callback) => subscribe<S>(instance)(callback),
  notifyStateChange: (changedKeys) => notifyStateChange(schema)(instance)(changedKeys),
});
