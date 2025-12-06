import type * as IO from "fp-ts/IO";
import React from "react";
import ReactDOM from "react-dom/client";

export const renderApp: IO.IO<void> = () => {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;
  return ReactDOM.createRoot(rootElement).render(<React.StrictMode></React.StrictMode>);
};
