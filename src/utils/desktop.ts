export const isDesktop = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const desktopUpdaterEnabled = () =>
  isDesktop() && import.meta.env.VITE_DESKTOP_UPDATER_ENABLED === "true";
