import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  locked = false,
  error,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  locked?: boolean;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Fechar"
          onClick={onClose}
          disabled={locked}
        >
          <X size={20} />
        </button>
      </div>
      {error && (
        <div className="dialog-error" role="alert">
          {error}
        </div>
      )}
      {children}
    </dialog>
  );
}
