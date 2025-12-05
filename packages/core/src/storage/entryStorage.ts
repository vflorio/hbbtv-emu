import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import type { StorageError } from "./errors";
import { Storage } from "./storage";

export class EntryStorage<T extends { id: string }> extends Storage<T[]> {
  saveEntry = (entry: T): TE.TaskEither<StorageError, void> =>
    pipe(
      this.load(),
      TE.map((entries) =>
        pipe(
          entries,
          A.findIndex((e) => e.id === entry.id),
          O.match(
            () => [...entries, entry],
            (index) =>
              pipe(
                entries,
                A.updateAt(index, entry),
                O.getOrElse(() => entries),
              ),
          ),
        ),
      ),
      TE.flatMap((updatedEntries) => this.save(updatedEntries)),
    );

  deleteEntry = (id: string): TE.TaskEither<StorageError, void> =>
    pipe(
      this.load(),
      TE.map((entries) =>
        pipe(
          entries,
          A.filter((e) => e.id !== id),
        ),
      ),
      TE.flatMap((filtered) => this.save(filtered)),
    );
}
