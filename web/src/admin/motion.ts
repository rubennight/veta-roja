/** true si no hay que animar (preferencia del sistema) o si el navegador no sabe consultarlo. */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duración de las animaciones de salida del panel (ms): debe coincidir con --a-exit en admin.css. */
export const EXIT_MS = 220;
