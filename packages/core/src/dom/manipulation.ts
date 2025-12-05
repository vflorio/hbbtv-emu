import type * as IO from "fp-ts/IO";

export const appendChild =
  <T extends Node>(child: T) =>
  (parent: Node): IO.IO<T> =>
  () =>
    parent.appendChild(child);

export const prependChild =
  (child: Node) =>
  (parent: Element): IO.IO<void> =>
  () =>
    parent.prepend(child);

export const insertBefore =
  (newNode: Node) =>
  (referenceNode: Node) =>
  (parent: Node): IO.IO<Node> =>
  () =>
    parent.insertBefore(newNode, referenceNode);

export const insertAfter =
  (newNode: Node) =>
  (referenceNode: ChildNode): IO.IO<void> =>
  () =>
    referenceNode.after(newNode);

export const remove =
  (element: Element): IO.IO<void> =>
  () =>
    element.remove();

export const removeChild =
  <T extends Node>(child: T) =>
  (parent: Node): IO.IO<T> =>
  () =>
    parent.removeChild(child);

export const replaceChild =
  (newChild: Node) =>
  (oldChild: Node) =>
  (parent: Node): IO.IO<Node> =>
  () =>
    parent.replaceChild(newChild, oldChild);

export const replaceWith =
  (newElement: Node) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.replaceWith(newElement);

export const cloneNode =
  (deep = true) =>
  <T extends Node>(node: T): IO.IO<T> =>
  () =>
    node.cloneNode(deep) as T;
