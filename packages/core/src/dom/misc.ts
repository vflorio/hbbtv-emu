import type * as IO from "fp-ts/IO";

// Focus

export const focus =
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.focus();

export const blur =
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.blur();

// Scroll

export const scrollIntoView =
  (options?: ScrollIntoViewOptions) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.scrollIntoView(options);

// Dimensions

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

// Video

/**
 * Recupera la durata reale del video caricando i suoi metadati.
 * Ritorna una Promise che risolve con la durata in secondi.
 */
export const parseVideoDuration = (url: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    // Aggiungi al DOM temporaneamente (nascosto) - alcuni browser lo richiedono
    video.style.position = "fixed";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);

    // Aggiungi timeout di 30 secondi
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout: il video non ha caricato i metadati entro 30 secondi"));
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };

    video.onloadedmetadata = () => {
      if (video.duration === Infinity) {
        cleanup();
        reject(new Error("La durata del video è infinita (stream?)"));
        return;
      }

      if (!video.duration || video.duration <= 0 || Number.isNaN(video.duration)) {
        cleanup();
        reject(new Error(`Durata non valida: ${video.duration}`));
        return;
      }

      const duration = video.duration;
      cleanup();
      resolve(duration);
    };

    video.onerror = () => {
      cleanup();
      const errorMessage = video.error
        ? `Errore ${video.error.code}: ${video.error.message}`
        : "Impossibile caricare il video";
      reject(new Error(`${errorMessage} - URL: ${url}`));
    };

    video.src = url;
    video.load();
  });
};
