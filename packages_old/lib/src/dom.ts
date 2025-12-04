import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";

// =============================================================================
// Error Types
// =============================================================================

export type ElementNotFoundError = Readonly<{
  type: "ElementNotFoundError";
  selector: string;
  message: string;
}>;

export const elementNotFoundError = (selector: string): ElementNotFoundError => ({
  type: "ElementNotFoundError",
  selector,
  message: `Element not found: ${selector}`,
});

// =============================================================================
// Query Operations
// =============================================================================

export const querySelector =
  (selector: string) =>
  (parent: ParentNode): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(parent.querySelector(selector));

export const querySelectorAs =
  <E extends Element>(selector: string) =>
  (parent: ParentNode): IO.IO<O.Option<E>> =>
  () =>
    O.fromNullable(parent.querySelector<E>(selector));

export const querySelectorAll =
  (selector: string) =>
  (parent: ParentNode): IO.IO<ReadonlyArray<Element>> =>
  () =>
    Array.from(parent.querySelectorAll(selector));

export const querySelectorAllAs =
  <E extends Element>(selector: string) =>
  (parent: ParentNode): IO.IO<ReadonlyArray<E>> =>
  () =>
    Array.from(parent.querySelectorAll<E>(selector));

export const getElementById =
  (id: string) =>
  (doc: Document): IO.IO<O.Option<HTMLElement>> =>
  () =>
    O.fromNullable(doc.getElementById(id));

export const getElementsByClassName =
  (className: string) =>
  (parent: Document | Element): IO.IO<ReadonlyArray<Element>> =>
  () =>
    Array.from(parent.getElementsByClassName(className));

export const getElementsByTagName =
  (tagName: string) =>
  (parent: Document | Element): IO.IO<ReadonlyArray<Element>> =>
  () =>
    Array.from(parent.getElementsByTagName(tagName));

// =============================================================================
// DOM Traversal
// =============================================================================

export const getParentElement =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.parentElement);

export const getParentNode =
  (node: Node): IO.IO<O.Option<ParentNode>> =>
  () =>
    O.fromNullable(node.parentNode);

export const getChildren =
  (element: Element): IO.IO<ReadonlyArray<Element>> =>
  () =>
    Array.from(element.children);

export const getChildNodes =
  (node: Node): IO.IO<ReadonlyArray<ChildNode>> =>
  () =>
    Array.from(node.childNodes);

export const getFirstElementChild =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.firstElementChild);

export const getLastElementChild =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.lastElementChild);

export const getNextElementSibling =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.nextElementSibling);

export const getPreviousElementSibling =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.previousElementSibling);

export const closest =
  (selector: string) =>
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.closest(selector));

// =============================================================================
// DOM Manipulation
// =============================================================================

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

// =============================================================================
// Style Operations
// =============================================================================

export const setStyle =
  (property: string) =>
  (value: string) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.style.setProperty(property, value);

export const setStyles =
  (styles: Record<string, string>) =>
  (element: HTMLElement): IO.IO<void> =>
  () => {
    for (const [key, value] of Object.entries(styles)) {
      element.style.setProperty(key, value);
    }
  };

export const getComputedStyle =
  (property: string) =>
  (element: Element): IO.IO<string> =>
  () =>
    window.getComputedStyle(element).getPropertyValue(property);

export const removeStyle =
  (property: string) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.style.removeProperty(property);

// =============================================================================
// Class Operations
// =============================================================================

export const addClass =
  (className: string) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.classList.add(className);

export const addClasses =
  (classNames: ReadonlyArray<string>) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.classList.add(...classNames);

export const removeClass =
  (className: string) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.classList.remove(className);

export const removeClasses =
  (classNames: ReadonlyArray<string>) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.classList.remove(...classNames);

export const toggleClass =
  (className: string) =>
  (element: Element): IO.IO<boolean> =>
  () =>
    element.classList.toggle(className);

export const hasClass =
  (className: string) =>
  (element: Element): IO.IO<boolean> =>
  () =>
    element.classList.contains(className);

// =============================================================================
// Attribute Operations
// =============================================================================

export const getAttribute =
  (name: string) =>
  (element: Element): IO.IO<O.Option<string>> =>
  () =>
    O.fromNullable(element.getAttribute(name));

export const setAttribute =
  (name: string) =>
  (value: string) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.setAttribute(name, value);

export const setAttributes =
  (attributes: Record<string, string>) =>
  (element: Element): IO.IO<void> =>
  () => {
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
  };

export const removeAttribute =
  (name: string) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.removeAttribute(name);

export const hasAttribute =
  (name: string) =>
  (element: Element): IO.IO<boolean> =>
  () =>
    element.hasAttribute(name);

export const getDataAttribute =
  (name: string) =>
  (element: HTMLElement): IO.IO<O.Option<string>> =>
  () =>
    O.fromNullable(element.dataset[name]);

export const setDataAttribute =
  (name: string) =>
  (value: string) =>
  (element: HTMLElement): IO.IO<void> =>
  () => {
    element.dataset[name] = value;
  };

// =============================================================================
// Content Operations
// =============================================================================

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

// =============================================================================
// Event Operations
// =============================================================================

export const addEventListener =
  <K extends keyof HTMLElementEventMap>(type: K) =>
  (listener: (event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.addEventListener(type, listener, options);

export const addEventListenerIO =
  <K extends keyof HTMLElementEventMap>(type: K) =>
  (listener: (event: HTMLElementEventMap[K]) => IO.IO<void>, options?: boolean | AddEventListenerOptions) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.addEventListener(type, (e) => listener(e)(), options);

export const addEventListenerGeneric =
  (type: string) =>
  (listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) =>
  (target: EventTarget): IO.IO<void> =>
  () =>
    target.addEventListener(type, listener, options);

export const addEventListenerGenericIO =
  (type: string) =>
  (listener: (event: Event) => IO.IO<void>, options?: boolean | AddEventListenerOptions) =>
  (target: EventTarget): IO.IO<void> =>
  () =>
    target.addEventListener(type, (e) => listener(e)(), options);

export const removeEventListener =
  <K extends keyof HTMLElementEventMap>(type: K) =>
  (listener: (event: HTMLElementEventMap[K]) => void, options?: boolean | EventListenerOptions) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.removeEventListener(type, listener, options);

export const dispatchEvent =
  <T>(type: string, detail?: T) =>
  (target: EventTarget): IO.IO<boolean> =>
  () =>
    target.dispatchEvent(new CustomEvent(type, { detail }));

// =============================================================================
// Element Creation
// =============================================================================

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

// =============================================================================
// Focus & Scroll
// =============================================================================

export const focus =
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.focus();

export const blur =
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.blur();

export const scrollIntoView =
  (options?: ScrollIntoViewOptions) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.scrollIntoView(options);

// =============================================================================
// Dimension & Position
// =============================================================================

export const getBoundingClientRect =
  (element: Element): IO.IO<DOMRect> =>
  () =>
    element.getBoundingClientRect();

export const getOffsetDimensions =
  (element: HTMLElement): IO.IO<{ width: number; height: number; top: number; left: number }> =>
  () => ({
    width: element.offsetWidth,
    height: element.offsetHeight,
    top: element.offsetTop,
    left: element.offsetLeft,
  });

// =============================================================================
// Predicates
// =============================================================================

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

// =============================================================================
// Utility Combinators
// =============================================================================

export const withElement =
  <A>(selector: string) =>
  (f: (element: Element) => IO.IO<A>) =>
  (fallback: IO.IO<A>) =>
  (parent: ParentNode): IO.IO<A> =>
    pipe(
      querySelector(selector)(parent),
      IO.flatMap(
        O.match(
          () => fallback,
          (el) => f(el),
        ),
      ),
    );

export const withElements =
  (selector: string) =>
  <A>(f: (element: Element) => IO.IO<A>) =>
  (parent: ParentNode): IO.IO<ReadonlyArray<A>> =>
    pipe(
      querySelectorAll(selector)(parent),
      IO.flatMap((elements) => pipe(elements, RA.traverse(IO.Applicative)(f))),
    );
