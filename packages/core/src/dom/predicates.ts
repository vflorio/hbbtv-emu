import type * as IO from "fp-ts/IO";

export const matches =
  (selector: string) =>
  (element: Element): IO.IO<boolean> =>
  () =>
    element.matches(selector);

export const contains =
  (other: Node) =>
  (node: Node): IO.IO<boolean> =>
  () =>
    node.contains(other);

export const isConnected =
  (node: Node): IO.IO<boolean> =>
  () =>
    node.isConnected;
