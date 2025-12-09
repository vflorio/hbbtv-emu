/**
 * FP Patterns Example: State, Lifecycle, and Object API
 *
 * This file demonstrates how to handle common OOP patterns in pure fp-ts:
 * 1. Persistent state across calls (like class fields)
 * 2. External API that requires methods on an object
 * 3. Lifecycle management (init, cleanup)
 *
 * Pattern: "Functional Core, Imperative Shell"
 * - Core logic is pure functions
 * - State is managed via IORef
 * - Effects are described, not executed
 * - Execution happens at the boundary
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";

// ═══════════════════════════════════════════════════════════════════════════
// PART 1: State Management (replaces class fields)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Instead of: class Counter { private count = 0; }
 * We use: IORef<CounterState>
 *
 * IORef is a mutable reference wrapped in IO - the mutation is an effect.
 */

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

type AppState = Readonly<{
  connectionState: ConnectionState;
  messageCount: number;
  lastError: O.Option<AppError>;
  subscribers: ReadonlyArray<(state: AppState) => void>;
}>;

const initialState: AppState = {
  connectionState: "disconnected",
  messageCount: 0,
  lastError: O.none,
  subscribers: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure State Transformations (no effects, easily testable)
// ─────────────────────────────────────────────────────────────────────────────

const setConnectionState =
  (state: ConnectionState) =>
  (appState: AppState): AppState => ({
    ...appState,
    connectionState: state,
    lastError: state === "error" ? appState.lastError : O.none,
  });

const incrementMessageCount = (appState: AppState): AppState => ({
  ...appState,
  messageCount: appState.messageCount + 1,
});

const setError =
  (error: AppError) =>
  (appState: AppState): AppState => ({
    ...appState,
    connectionState: "error",
    lastError: O.some(error),
  });

const addSubscriber =
  (subscriber: (state: AppState) => void) =>
  (appState: AppState): AppState => ({
    ...appState,
    subscribers: [...appState.subscribers, subscriber],
  });

const removeSubscriber =
  (subscriber: (state: AppState) => void) =>
  (appState: AppState): AppState => ({
    ...appState,
    subscribers: appState.subscribers.filter((s) => s !== subscriber),
  });

// ─────────────────────────────────────────────────────────────────────────────
// State Effects (wrap pure transforms in IO via IORef)
// ─────────────────────────────────────────────────────────────────────────────

type StateRef = IORef.IORef<AppState>;

// Modify state and notify subscribers
const modifyAndNotify =
  (stateRef: StateRef) =>
  (f: (s: AppState) => AppState): IO.IO<void> =>
    pipe(
      stateRef.read,
      IO.map(f),
      IO.flatMap((newState) =>
        pipe(
          stateRef.write(newState),
          IO.flatMap(() => notifySubscribers(newState)),
        ),
      ),
    );

const notifySubscribers = (state: AppState): IO.IO<void> =>
  pipe(
    state.subscribers,
    RA.traverse(IO.Applicative)((subscriber) => IO.of(subscriber(state))),
    IO.map(() => undefined),
  );

// ═══════════════════════════════════════════════════════════════════════════
// PART 2: Environment & Dependencies (replaces constructor injection)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Instead of: constructor(private http: HttpClient, private logger: Logger)
 * We use: ReaderTaskEither<Env, Error, A>
 *
 * The Env contains all dependencies, accessed via RTE.ask()
 */

// ─────────────────────────────────────────────────────────────────────────────
// Ports (interfaces for dependencies)
// ─────────────────────────────────────────────────────────────────────────────

type Logger = Readonly<{
  info: (msg: string) => IO.IO<void>;
  error: (msg: string, err?: unknown) => IO.IO<void>;
}>;

type HttpClient = Readonly<{
  get: (url: string) => TE.TaskEither<HttpError, unknown>;
  post: (url: string, body: unknown) => TE.TaskEither<HttpError, unknown>;
}>;

type WebSocketClient = Readonly<{
  connect: (url: string) => TE.TaskEither<ConnectionError, WebSocketHandle>;
  disconnect: (handle: WebSocketHandle) => TE.TaskEither<ConnectionError, void>;
}>;

type WebSocketHandle = Readonly<{
  send: (msg: string) => TE.TaskEither<ConnectionError, void>;
  onMessage: (handler: (msg: string) => void) => IO.IO<() => void>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Environment (all dependencies combined)
// ─────────────────────────────────────────────────────────────────────────────

type AppEnv = Readonly<{
  logger: Logger;
  http: HttpClient;
  ws: WebSocketClient;
  stateRef: StateRef;
  config: AppConfig;
}>;

type AppConfig = Readonly<{
  apiUrl: string;
  wsUrl: string;
  maxRetries: number;
}>;

// ═══════════════════════════════════════════════════════════════════════════
// PART 3: Error Types (replaces exceptions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Instead of: throw new Error("...")
 * We use: E.left({ _tag: "ErrorType", ... })
 *
 * Errors are values, not control flow. They compose with Either/TaskEither.
 */

type HttpError = Readonly<{ _tag: "HttpError"; status: number; message: string }>;
type ConnectionError = Readonly<{ _tag: "ConnectionError"; reason: string }>;
type ValidationError = Readonly<{ _tag: "ValidationError"; field: string; message: string }>;

type AppError = HttpError | ConnectionError | ValidationError;

const httpError = (status: number, message: string): HttpError => ({
  _tag: "HttpError",
  status,
  message,
});

const connectionError = (reason: string): ConnectionError => ({
  _tag: "ConnectionError",
  reason,
});

const validationError = (field: string, message: string): ValidationError => ({
  _tag: "ValidationError",
  field,
  message,
});

// ═══════════════════════════════════════════════════════════════════════════
// PART 4: Business Logic as ReaderTaskEither
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Instead of: class AppService { async connect() { ... } }
 * We use: const connect: RTE.ReaderTaskEither<AppEnv, AppError, void>
 *
 * Each operation is a value describing what to do, not doing it.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helper: lift IO to RTE
// ─────────────────────────────────────────────────────────────────────────────

const liftIO = <A>(io: IO.IO<A>): RTE.ReaderTaskEither<AppEnv, AppError, A> => RTE.fromIO(io);

const modifyState = (f: (s: AppState) => AppState): RTE.ReaderTaskEither<AppEnv, AppError, void> =>
  pipe(
    RTE.ask<AppEnv>(),
    RTE.flatMapIO(({ stateRef }) => modifyAndNotify(stateRef)(f)),
  );

const getState: RTE.ReaderTaskEither<AppEnv, AppError, AppState> = pipe(
  RTE.ask<AppEnv>(),
  RTE.flatMapIO(({ stateRef }) => stateRef.read),
);

const logInfo = (msg: string): RTE.ReaderTaskEither<AppEnv, AppError, void> =>
  pipe(
    RTE.ask<AppEnv>(),
    RTE.flatMapIO(({ logger }) => logger.info(msg)),
  );

const logError = (msg: string, err?: unknown): RTE.ReaderTaskEither<AppEnv, AppError, void> =>
  pipe(
    RTE.ask<AppEnv>(),
    RTE.flatMapIO(({ logger }) => logger.error(msg, err)),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Business Operations
// ─────────────────────────────────────────────────────────────────────────────

const connect: RTE.ReaderTaskEither<AppEnv, AppError, WebSocketHandle> = pipe(
  logInfo("Connecting..."),
  RTE.flatMap(() => modifyState(setConnectionState("connecting"))),
  RTE.flatMap(() => RTE.ask<AppEnv>()),
  RTE.flatMap(({ ws, config }) => RTE.fromTaskEither(ws.connect(config.wsUrl))),
  RTE.tap(() => modifyState(setConnectionState("connected"))),
  RTE.tap(() => logInfo("Connected successfully")),
  RTE.tapError((err) =>
    pipe(
      modifyState(setError(err)),
      RTE.flatMap(() => logError("Connection failed", err)),
    ),
  ),
);

const disconnect = (handle: WebSocketHandle): RTE.ReaderTaskEither<AppEnv, AppError, void> =>
  pipe(
    logInfo("Disconnecting..."),
    RTE.flatMap(() => RTE.ask<AppEnv>()),
    RTE.flatMap(({ ws }) => RTE.fromTaskEither(ws.disconnect(handle))),
    RTE.flatMap(() => modifyState(setConnectionState("disconnected"))),
    RTE.tap(() => logInfo("Disconnected")),
  );

const sendMessage =
  (handle: WebSocketHandle) =>
  (message: string): RTE.ReaderTaskEither<AppEnv, AppError, void> =>
    pipe(
      validateMessage(message),
      RTE.fromEither,
      RTE.flatMap(() => RTE.fromTaskEither(handle.send(message))),
      RTE.flatMap(() => modifyState(incrementMessageCount)),
      RTE.tap(() => logInfo(`Message sent: ${message}`)),
    );

const validateMessage = (message: string): E.Either<ValidationError, string> =>
  message.trim().length === 0 ? E.left(validationError("message", "Message cannot be empty")) : E.right(message);

const fetchInitialData: RTE.ReaderTaskEither<AppEnv, AppError, unknown> = pipe(
  RTE.ask<AppEnv>(),
  RTE.flatMap(({ http, config }) => RTE.fromTaskEither(http.get(`${config.apiUrl}/init`))),
  RTE.tap(() => logInfo("Initial data fetched")),
);

// ═══════════════════════════════════════════════════════════════════════════
// PART 5: Lifecycle Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Instead of: constructor() { ... } and destroy() { ... }
 * We use: bracket pattern - acquire, use, release
 *
 * This guarantees cleanup even if use fails.
 */

type AppHandle = Readonly<{
  wsHandle: WebSocketHandle;
  unsubscribes: ReadonlyArray<() => void>;
}>;

// Bracket pattern: acquire → use → release (guaranteed cleanup)
const withConnection = <A>(
  use: (handle: AppHandle) => RTE.ReaderTaskEither<AppEnv, AppError, A>,
): RTE.ReaderTaskEither<AppEnv, AppError, A> =>
  pipe(
    // Acquire
    acquire,
    RTE.flatMap((handle) =>
      pipe(
        // Use
        use(handle),
        // Release (always, even on error)
        RTE.tapBoth({
          onLeft: () => release(handle),
          onRight: () => release(handle),
        }),
      ),
    ),
  );

const acquire: RTE.ReaderTaskEither<AppEnv, AppError, AppHandle> = pipe(
  logInfo("Acquiring resources..."),
  RTE.flatMap(() => fetchInitialData),
  RTE.flatMap(() => connect),
  RTE.flatMap((wsHandle) =>
    pipe(
      setupMessageHandler(wsHandle),
      RTE.map((unsubscribe) => ({
        wsHandle,
        unsubscribes: [unsubscribe],
      })),
    ),
  ),
  RTE.tap(() => logInfo("Resources acquired")),
);

const release = (handle: AppHandle): RTE.ReaderTaskEither<AppEnv, AppError, void> =>
  pipe(
    logInfo("Releasing resources..."),
    RTE.flatMap(() => liftIO(() => handle.unsubscribes.forEach((unsub) => unsub()))),
    RTE.flatMap(() => disconnect(handle.wsHandle)),
    RTE.tap(() => logInfo("Resources released")),
    // Ignore errors during cleanup
    RTE.orElse(() => RTE.of(undefined)),
  );

const setupMessageHandler = (handle: WebSocketHandle): RTE.ReaderTaskEither<AppEnv, AppError, () => void> =>
  pipe(
    RTE.ask<AppEnv>(),
    RTE.flatMapIO(({ stateRef, logger }) =>
      handle.onMessage((msg) => {
        pipe(
          modifyAndNotify(stateRef)(incrementMessageCount),
          IO.flatMap(() => logger.info(`Received: ${msg}`)),
        )();
      }),
    ),
  );

// ═══════════════════════════════════════════════════════════════════════════
// PART 6: External API (object interface for consumers)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sometimes external APIs require an object with methods.
 * We create this at the boundary by "interpreting" our RTE functions.
 *
 * Instead of: class App { connect() { ... } }
 * We create: { connect: () => Promise<...>, ... }
 */

type AppApi = Readonly<{
  connect: () => Promise<E.Either<AppError, void>>;
  disconnect: () => Promise<E.Either<AppError, void>>;
  send: (message: string) => Promise<E.Either<AppError, void>>;
  getState: () => AppState;
  subscribe: (handler: (state: AppState) => void) => () => void;
}>;

// Creates the API object by capturing the environment
const createAppApi = (env: AppEnv): IO.IO<AppApi> => {
  // Mutable reference to hold the connection handle
  const handleRef = IORef.newIORef<O.Option<AppHandle>>(O.none)();

  return IO.of({
    connect: async () => {
      const result = await acquire(env)();
      if (E.isRight(result)) {
        handleRef.write(O.some(result.right))();
      }
      return pipe(
        result,
        E.map(() => undefined),
      );
    },

    disconnect: async () => {
      const maybeHandle = handleRef.read();
      return pipe(
        maybeHandle,
        O.match(
          () => Promise.resolve(E.right(undefined as void)),
          async (handle) => {
            const result = await release(handle)(env)();
            handleRef.write(O.none)();
            return result;
          },
        ),
      );
    },

    send: async (message: string) => {
      const maybeHandle = handleRef.read();
      return pipe(
        maybeHandle,
        O.match(
          () => Promise.resolve(E.left(connectionError("Not connected"))),
          (handle) => sendMessage(handle.wsHandle)(message)(env)(),
        ),
      );
    },

    getState: () => env.stateRef.read(),

    subscribe: (handler) => {
      modifyAndNotify(env.stateRef)(addSubscriber(handler))();
      return () => {
        modifyAndNotify(env.stateRef)(removeSubscriber(handler))();
      };
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// PART 7: Adapters (implementations of ports)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Real implementations of the ports for production use.
 * In tests, you'd provide mock implementations.
 */

const consoleLogger: Logger = {
  info: (msg) => () => console.log(`[INFO] ${msg}`),
  error: (msg, err) => () => console.error(`[ERROR] ${msg}`, err),
};

const fetchHttpClient: HttpClient = {
  get: (url) =>
    TE.tryCatch(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
      (e) => httpError(500, String(e)),
    ),
  post: (url, body) =>
    TE.tryCatch(
      async () => {
        const res = await fetch(url, {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
      (e) => httpError(500, String(e)),
    ),
};

// Mock WebSocket client for demonstration
const mockWsClient: WebSocketClient = {
  connect: (url) =>
    TE.of({
      send: (msg) => TE.of(undefined),
      onMessage: (handler) => () => () => {},
    }),
  disconnect: (_handle) => TE.of(undefined),
};

// ═══════════════════════════════════════════════════════════════════════════
// PART 8: Application Bootstrap (the only impure boundary)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * This is where we wire everything together and "run" the application.
 * All effects are executed here at the boundary.
 */

const bootstrap: IO.IO<AppApi> = pipe(
  IORef.newIORef(initialState),
  IO.flatMap((stateRef) => {
    const env: AppEnv = {
      logger: consoleLogger,
      http: fetchHttpClient,
      ws: mockWsClient,
      stateRef,
      config: {
        apiUrl: "https://api.example.com",
        wsUrl: "wss://ws.example.com",
        maxRetries: 3,
      },
    };
    return createAppApi(env);
  }),
);

// ═══════════════════════════════════════════════════════════════════════════
// PART 9: Usage Example
// ═══════════════════════════════════════════════════════════════════════════

const main: IO.IO<void> = pipe(
  bootstrap,
  IO.flatMap((api) =>
    IO.of(async () => {
      // Subscribe to state changes
      const unsubscribe = api.subscribe((state) => {
        console.log("State changed:", state.connectionState, state.messageCount);
      });

      // Connect
      const connectResult = await api.connect();
      if (E.isLeft(connectResult)) {
        console.error("Failed to connect:", connectResult.left);
        return;
      }

      // Send messages
      await api.send("Hello!");
      await api.send("World!");

      // Check state
      console.log("Current state:", api.getState());

      // Disconnect
      await api.disconnect();

      // Cleanup
      unsubscribe();
    }),
  ),
  IO.flatMap((run) => IO.of(run())),
);

// Execute at the boundary
// main();

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY: Pattern Comparison
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ OOP Pattern                    │ FP Equivalent                          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ class fields (private state)   │ IORef<State>                           │
 * │ constructor injection          │ Reader/ReaderTaskEither<Env>           │
 * │ methods                        │ functions returning RTE<Env, E, A>     │
 * │ this.state = x                 │ stateRef.modify(f)                     │
 * │ throw new Error()              │ E.left({ _tag: "...", ... })           │
 * │ try/catch                      │ TE.tryCatch / RTE.tapError             │
 * │ async/await                    │ TaskEither / ReaderTaskEither          │
 * │ constructor + destroy          │ bracket(acquire, use, release)         │
 * │ event handlers                 │ IO<() => void> (returns unsubscribe)   │
 * │ public interface               │ create API object at boundary          │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Key benefits:
 * 1. Pure core logic is easily testable (no mocks needed for pure functions)
 * 2. Dependencies are explicit in the type signature
 * 3. Errors are values, not exceptions - they compose
 * 4. Side effects are described, not executed - you can inspect/transform them
 * 5. Lifecycle is explicit with bracket pattern
 * 6. State changes are traceable (every transform is a pure function)
 */

export {
  // Types
  type AppState,
  type AppEnv,
  type AppError,
  type AppApi,
  type AppHandle,
  // State transforms (pure, testable)
  setConnectionState,
  incrementMessageCount,
  setError,
  // Operations (RTE, composable)
  connect,
  disconnect,
  sendMessage,
  // Lifecycle
  withConnection,
  acquire,
  release,
  // API creation
  createAppApi,
  // Bootstrap
  bootstrap,
};
