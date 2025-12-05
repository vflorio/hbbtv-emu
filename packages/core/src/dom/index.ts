export * from "./attribute";
export * from "./class";
export * from "./content";
export * from "./element";
export * from "./event";
export * from "./misc";
export * from "./predicates";
export * from "./query";
export * from "./style";
export * from "./traversal";

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
