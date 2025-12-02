import type { MessageAdapter } from "@hbb-emu/lib";
import {
  type ClassType,
  type CronScheduler,
  createCronScheduler,
  createEnvelope,
  createLogger,
  type ExtensionConfig,
  type MessageBus,
  type StreamEventPayload,
} from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { State } from "./state";

const logger = createLogger("StreamEventScheduler");

export interface StreamEventScheduler {
  cronScheduler: CronScheduler;
  scheduleStreamEvents: (state: ExtensionConfig.State) => IO.IO<void>;
  dispatchStreamEventToTabs: (event: StreamEventPayload) => T.Task<void>;
}

export const WithStreamEventScheduler = <T extends ClassType<MessageBus & MessageAdapter & State>>(Base: T) =>
  class extends Base implements StreamEventScheduler {
    cronScheduler: CronScheduler = createCronScheduler();

    constructor(...args: unknown[]) {
      super(...args);

      this.bus.on("UPDATE_CONFIG", (envelope) =>
        pipe(
          logger.info("StreamEventScheduler received config update"),
          IO.flatMap(() => this.stateRef.write(envelope.message.payload)),
          IO.flatMap(() => this.scheduleStreamEvents(envelope.message.payload)),
        ),
      );
    }

    scheduleStreamEvents =
      (state: ExtensionConfig.State): IO.IO<void> =>
      () => {
        this.cronScheduler.unscheduleAll();

        const currentChannel = state.currentChannel;
        if (!currentChannel) {
          logger.info("No current channel, skipping stream event scheduling")();
          return;
        }

        if (!currentChannel.enableStreamEvents) {
          logger.info("Stream events disabled for current channel")();
          return;
        }

        const streamEvents = currentChannel.streamEvents || [];
        const enabledEvents = streamEvents.filter((e) => e.enabled !== false);

        logger.info(`Scheduling ${enabledEvents.length} stream events for channel ${currentChannel.name}`)();

        pipe(
          enabledEvents,
          A.filter((event) => !!event.cronSchedule),
          A.map((event) => {
            const result = this.cronScheduler.schedule(event.id, event.cronSchedule!, () => {
              logger.info(`Triggering stream event: ${event.name} (${event.eventName})`)();

              const payload: StreamEventPayload = {
                targetURL: event.targetURL || "dvb://current.ait",
                eventName: event.eventName,
                data: event.data,
                text: event.text || "",
              };

              this.dispatchStreamEventToTabs(payload)();
            });

            pipe(
              result,
              E.match(
                (error) => logger.error(`Failed to schedule event ${event.name}: ${error.message}`)(),
                () => logger.info(`Scheduled event ${event.name} with cron: ${event.cronSchedule}`)(),
              ),
            );
          }),
        );
      };

    dispatchStreamEventToTabs = (event: StreamEventPayload): T.Task<void> =>
      pipe(
        T.fromIO(this.messageOrigin.read),
        T.flatMap((messageOrigin) =>
          pipe(
            Array.from(this.tabs),
            A.traverse(T.ApplicativeSeq)((tabId) => {
              const envelope = createEnvelope(
                messageOrigin,
                "CONTENT_SCRIPT",
                { type: "DISPATCH_STREAM_EVENT", payload: event },
                { tabId },
              );

              return pipe(
                this.sendMessage(envelope),
                TE.match(
                  () => logger.info(`Failed to send stream event to tab ${tabId}`)(),
                  () => logger.info(`Stream event sent to tab ${tabId}`)(),
                ),
              );
            }),
          ),
        ),
        T.map(() => undefined),
      );
  };
