import { useEffect, useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { desktopUpdaterEnabled, isDesktop } from "../utils/desktop";

export function DesktopUpdates({ canInstall }: { canInstall: boolean }) {
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [version, setVersion] = useState("");
  const [available, setAvailable] = useState("");
  const candidate = useRef<Update | null>(null);
  const lock = useRef(false);
  const enabled = desktopUpdaterEnabled();
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (installing) modal.current?.showModal();
    else modal.current?.close();
  }, [installing]);
  async function checkUpdates(manual = false) {
    if (lock.current || !enabled) return;
    lock.current = true;
    setChecking(true);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check({ timeout: 15000 });
      await candidate.current?.close();
      candidate.current = update;
      setAvailable(update?.version || "");
      setMessage(
        update
          ? `Versão ${update.version} disponível.`
          : manual
            ? "Você está usando a versão mais recente."
            : "",
      );
    } catch {
      if (manual)
        setMessage(
          "Não foi possível verificar atualizações. Confira a conexão e tente novamente.",
        );
    } finally {
      lock.current = false;
      setChecking(false);
    }
  }
  useEffect(() => {
    if (!isDesktop()) return;
    let closed = false;
    import("@tauri-apps/api/app")
      .then((m) => m.getVersion())
      .then((v) => {
        if (!closed) setVersion(v);
      })
      .catch(() => {});
    const timer = setTimeout(() => {
      if (!closed) void checkUpdates();
    }, 3000);
    return () => {
      closed = true;
      clearTimeout(timer);
      void candidate.current?.close();
      candidate.current = null;
    };
  }, []);
  async function install() {
    if (!canInstall || lock.current || !candidate.current) return;
    lock.current = true;
    setInstalling(true);
    let received = 0,
      total = 0;
    try {
      // Download first. Installation begins only after the caller has persisted the current document.
      await candidate.current.download((event) => {
        if (event.event === "Started") total = event.data.contentLength || 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          setMessage(
            total
              ? `Baixando atualização: ${Math.min(100, Math.round((received / total) * 100))}%`
              : "Baixando atualização…",
          );
        }
      });
      setMessage("Instalando atualização… O aplicativo será reiniciado.");
      await candidate.current.install();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch {
      setMessage(
        "A atualização não foi instalada. Seus documentos foram mantidos; tente novamente.",
      );
      setInstalling(false);
    } finally {
      lock.current = false;
    }
  }
  if (!isDesktop()) return null;
  return (
    <div className="desktop-updates">
      <span role="status">
        EditPDF {version && `v${version}`}{" "}
        {installing || message
          ? `· ${message}`
          : !enabled
            ? "· Atualizações pelo app aguardam ativação."
            : ""}
      </span>
      {enabled && (
        <button
          className="button secondary"
          disabled={checking || installing}
          onClick={() => void checkUpdates(true)}
        >
          {checking ? "Verificando…" : "Verificar atualizações"}
        </button>
      )}
      {available && (
        <button
          className="button primary"
          disabled={!canInstall || installing || checking}
          onClick={() => void install()}
        >
          {installing ? "Atualizando…" : "Atualizar e reiniciar"}
        </button>
      )}
      {available && !canInstall && (
        <span>Conclua a edição e salve o documento antes de atualizar.</span>
      )}
      <dialog
        ref={modal}
        className="dialog"
        aria-label="Atualizando EditPDF"
        onCancel={(e) => e.preventDefault()}
      >
        <h2>Atualizando EditPDF</h2>
        <p className="dialog-description">{message}</p>
        <p className="field-note">
          Aguarde a conclusão. O aplicativo será reiniciado; a biblioteca local
          será preservada.
        </p>
      </dialog>
    </div>
  );
}
