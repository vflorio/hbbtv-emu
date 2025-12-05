import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { setAttributes } from "./attribute";

export const createElement =
  <K extends keyof HTMLElementTagNameMap>(tagName: K) =>
  (doc: Document = document): IO.IO<HTMLElementTagNameMap[K]> =>
  () =>
    doc.createElement(tagName);

export const createElementWith =
  <K extends keyof HTMLElementTagNameMap>(tagName: K) =>
  (attributes: Record<string, string>) =>
  (doc: Document = document): IO.IO<HTMLElementTagNameMap[K]> =>
    pipe(
      createElement(tagName)(doc),
      IO.tap((el) => setAttributes(attributes)(el)),
    );

export const createTextNode =
  (text: string) =>
  (doc: Document = document): IO.IO<Text> =>
  () =>
    doc.createTextNode(text);

export const createDocumentFragment =
  (doc: Document = document): IO.IO<DocumentFragment> =>
  () =>
    doc.createDocumentFragment();
