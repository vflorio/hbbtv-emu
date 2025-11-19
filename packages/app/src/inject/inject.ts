import { attachObjectElement } from "./objectHandler";

const attachObjects = (context: Document | HTMLElement) =>
  Array.from(context.querySelectorAll<HTMLObjectElement>("object")).forEach(attachObjectElement);

const onDOMContentLoaded = () => {
  attachObjects(document);

  // TODO: Capire l'impatto sulle performance della pagina
  // const observer = new MutationObserver((mutations) => {
  //   mutations
  //     .flatMap((mutation) => Array.from(mutation.addedNodes))
  //     .forEach((node) => {
  //       if (node instanceof HTMLObjectElement) {
  //         attachObjectElement(node);
  //       } else if (node instanceof HTMLElement) {
  //         attachObjects(node);
  //       }
  //     });
  // });

  // observer.observe(document.body, { childList: true, subtree: true });
};

const initialize = () => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
  } else {
    onDOMContentLoaded();
  }
};

initialize();
