import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";

const logger = createLogger("VideoBroadcast/Audio");

const validateVolume = (volume: number): E.Either<string, number> =>
  volume >= 0 && volume <= 100 ? E.right(volume) : E.left(`Volume out of range: ${volume}`);

export interface Audio {
  setVolume(volume: number): boolean;
  getVolume(): number;
}

export const WithAudio = <T extends ClassType>(Base: T) =>
  class extends Base implements Audio {
    volumeRef = IORef.newIORef(100)();

    setVolume = (volume: number): boolean =>
      pipe(
        logger.info(`Validating volume: ${volume}`),
        IO.map(() =>
          pipe(
            validateVolume(volume),
            E.map((validVolume) => {
              const currentVolume = this.volumeRef.read();
              const changed = currentVolume !== validVolume;
              changed && this.volumeRef.write(validVolume);
              return changed;
            }),
            E.getOrElse(() => false),
          ),
        ),
      )();

    getVolume = (): number =>
      pipe(
        logger.info("getVolume"),
        IO.map(() => this.volumeRef.read()),
      )();
  };
