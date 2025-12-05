import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

export const getTextContent =
  (node: Node): IO.IO<O.Option<string>> =>
  () =>
    O.fromNullable(node.textContent);

export const setTextContent =
  (text: string) =>
  (node: Node): IO.IO<void> =>
  () => {
    node.textContent = text;
  };

export const getInnerHTML =
  (element: Element): IO.IO<string> =>
  () =>
    element.innerHTML;

export const setInnerHTML =
  (html: string) =>
  (element: Element): IO.IO<void> =>
  () => {
    element.innerHTML = html;
  };

export const getOuterHTML =
  (element: Element): IO.IO<string> =>
  () =>
    element.outerHTML;
