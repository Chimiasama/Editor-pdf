import { DesktopUpdates } from "./components/DesktopUpdates";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  ImagePlus,
  Image as ImageIcon,
  LayoutList,
  LoaderCircle,
  Maximize,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Search,
  ShieldCheck,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  BookOpen,
  Info,
} from "lucide-react";
import { PdfClient } from "./engine/client";
import type {
  PdfEdit,
  PdfInfo,
  PageContent,
  TextRun,
  TextBlock,
  PageImage,
  HistoryState,
} from "./engine/types";
import { ReaderPage, type ReaderTool } from "./components/ReaderPage";
import { Modal } from "./components/Modal";
import {
  TextEditorDialog,
  type TextSelection,
} from "./components/TextEditorDialog";
import { foldText } from "./engine/textLayout";
import * as store from "./utils/documentStore";
import type { PdfDocumentRecord } from "./types/pdf";
import { downloadFile } from "./utils/downloadFile";
const DocumentEditor = lazy(() =>
  import("./components/DocumentEditor").then((m) => ({
    default: m.DocumentEditor,
  })),
);
const emptyHistory: HistoryState = { canUndo: false, canRedo: false };
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);
const formatSize = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
const copyName = (name: string) => name.replace(/\.pdf$/i, "") + "_editado.pdf";

export default function App() {
  const [documents, setDocuments] = useState<PdfDocumentRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<PdfDocumentRecord | null>(null);
  const activeRef = useRef<PdfDocumentRecord | null>(null);
  const clientRef = useRef<PdfClient | null>(null);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [content, setContent] = useState<PageContent | null>(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<ReaderTool>("read");
  const [history, setHistory] = useState(emptyHistory);
  const [busy, setBusy] = useState("");
  const busyRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [navigation, setNavigation] = useState(false);
  const [menu, setMenu] = useState(false);
  const [about, setAbout] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [textEditor, setTextEditor] = useState<TextSelection | null>(null);
  const [selectionMode, setSelectionMode] = useState<"paragraph" | "run">(
    "paragraph",
  );
  const contentKey = useRef("");
  const writes = useRef(Promise.resolve());
  const draftVersion = useRef(0);
  function enqueueWrite(task: () => Promise<void>) {
    const operation = writes.current.then(task);
    writes.current = operation.catch(() => {});
    return operation;
  }
  const [selectedImage, setSelectedImage] = useState<PageImage | null>(null);
  const [imagePoint, setImagePoint] = useState<[number, number] | null>(null);
  const [imageFile, setImageFile] = useState<{
    bytes: Uint8Array;
    url: string;
    ratio: number;
    name: string;
  } | null>(null);
  const [imageWidth, setImageWidth] = useState(35);
  const [imageBackground, setImageBackground] = useState(false);
  const [deleting, setDeleting] = useState<PdfDocumentRecord | null>(null);
  const [restore, setRestore] = useState(false);
  const [passwordJob, setPasswordJob] = useState<{
    bytes: Uint8Array;
    doc?: PdfDocumentRecord;
    name: string;
    working?: boolean;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [legacy, setLegacy] = useState<{
    doc: PdfDocumentRecord;
    bytes: Uint8Array;
  } | null>(null);
  const [documentMode, setDocumentMode] = useState(false);
  const [documentProxy, setDocumentProxy] = useState<any>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const notice = (message: string) => setToast(message);
  const refreshLibrary = () => store.listDocuments().then(setDocuments);
  useEffect(() => {
    store
      .listDocuments()
      .then(setDocuments)
      .catch((e) =>
        setError("Não foi possível abrir a biblioteca: " + errorMessage(e)),
      )
      .finally(() => setReady(true));
    return () => {
      clientRef.current?.destroy();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);
  useEffect(() => {
    if (!active || !clientRef.current) return;
    let cancelled = false;
    const key = active.id + ":" + page;
    if (contentKey.current !== key) {
      setContent(null);
      contentKey.current = key;
    }
    clientRef.current
      .call("content", { page })
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [active?.id, page, revision]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (busyRef.current || saveStatus.startsWith("Não salvo"))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);
  useEffect(
    () => () => {
      if (imageFile) URL.revokeObjectURL(imageFile.url);
    },
    [imageFile],
  );
  async function runTask(label: string, task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(label);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  function updateActive(doc: PdfDocumentRecord) {
    activeRef.current = doc;
    setActive(doc);
    setDocuments((list) => list.map((d) => (d.id === doc.id ? doc : d)));
  }
  async function openBytes(
    bytes: Uint8Array,
    name: string,
    doc?: PdfDocumentRecord,
    pass?: string,
    working = false,
  ): Promise<boolean> {
    const nextClient = new PdfClient();
    try {
      const nextInfo = await nextClient.call("open", { bytes, password: pass });
      const now = Date.now();
      const nextDoc: PdfDocumentRecord = doc
        ? { ...doc, pageCount: nextInfo.pageCount, lastOpenedAt: now }
        : {
            id: crypto.randomUUID(),
            title: name,
            pageCount: nextInfo.pageCount,
            fileSizeFormatted: formatSize(bytes.length),
            isFavorite: false,
            lastOpenedAt: now,
            createdAt: now,
            tableOfContents: nextInfo.outline.map((item, i) => ({
              id: `outline-${i}`,
              title: item.title,
              pageNumber: item.page,
            })),
            pageMetadata: {},
          };
      await writes.current;
      if (working) await store.saveWorkingCopy(nextDoc, bytes);
      else await store.saveDocument(nextDoc, doc ? undefined : bytes);
      clientRef.current?.destroy();
      clientRef.current = nextClient;
      activeRef.current = nextDoc;
      setActive(nextDoc);
      setInfo(nextInfo);
      setContent(null);
      contentKey.current = "";
      setPage(Math.max(1, Math.min(nextInfo.pageCount, nextDoc.lastPage || 1)));
      setZoom(1);
      setTool("read");
      setHistory(emptyHistory);
      setRevision((r) => r + 1);
      setNavigation(false);
      setMenu(false);
      setQuery("");
      setSearchOpen(false);
      setPasswordJob(null);
      setPassword("");
      setSaveStatus("Salvo no aparelho");
      await refreshLibrary();
      return true;
    } catch (e) {
      nextClient.destroy();
      if (
        errorMessage(e) === "PASSWORD_REQUIRED" ||
        (pass !== undefined && /Senha incorreta/.test(errorMessage(e)))
      ) {
        setPasswordJob({ bytes, doc, name, working });
        if (pass) setError(errorMessage(e));
        return false;
      }
      throw e;
    }
  }
  function importFile(file?: File) {
    if (!file) return;
    if (activeRef.current && saveStatus.startsWith("Não salvo")) {
      setError("Salve uma cópia do documento atual antes de abrir outro PDF.");
      return;
    }
    void runTask("Abrindo PDF…", async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await openBytes(bytes, file.name);
    });
  }
  function openDocument(doc: PdfDocumentRecord) {
    void runTask("Abrindo PDF…", async () => {
      const working = await store.readWorkingCopy(doc.id);
      const bytes = working ?? (await store.readDocumentBytes(doc.id));
      if (!bytes)
        throw new Error(
          "O arquivo desta entrada antiga não está salvo. Importe novamente o PDF pelo botão Abrir PDF.",
        );
      if (
        !working &&
        Object.values(doc.pageMetadata || {}).some(
          (p) => p.annotations.length || p.rotation || p.cropBox,
        )
      ) {
        setLegacy({ doc, bytes });
        return;
      }
      await openBytes(bytes, doc.title, doc);
    });
  }
  async function persist() {
    const doc = activeRef.current!;
    setSaveStatus("Salvando…");
    const bytes = await clientRef.current!.call("save", undefined);
    const updated = { ...doc, hasWorkingCopy: true, lastOpenedAt: Date.now() };
    try {
      await enqueueWrite(() => store.saveWorkingCopy(updated, bytes));
      updateActive(updated);
      setSaveStatus("Salvo no aparelho");
    } catch (e) {
      setSaveStatus("Não salvo no aparelho");
      throw new Error(
        "A edição está aberta, mas não foi salva no aparelho. Use Salvar cópia para não perdê-la. " +
          errorMessage(e),
      );
    }
  }
  async function mutate(edit: PdfEdit) {
    await runTask("Aplicando alteração…", async () => {
      const result = await clientRef.current!.call("edit", edit);
      setHistory(result);
      setTextEditor(null);
      setSelectedImage(null);
      setImagePoint(null);
      setImageFile(null);
      setTool(
        edit.type === "insert-image"
          ? "images"
          : edit.type === "insert-text" || edit.type === "insert-block"
            ? "text"
            : tool,
      );
      setRevision((r) => r + 1);
      notice(result.message);
      await persist();
    });
  }
  function travel(direction: "undo" | "redo") {
    void runTask(
      direction === "undo" ? "Desfazendo…" : "Refazendo…",
      async () => {
        setHistory(await clientRef.current!.call(direction, undefined));
        setRevision((r) => r + 1);
        await persist();
      },
    );
  }
  function saveCopy() {
    void runTask("Preparando cópia…", async () => {
      const bytes = await clientRef.current!.call("save", undefined);
      await downloadFile(bytes, copyName(activeRef.current!.title));
      if (saveStatus.startsWith("Não salvo"))
        setSaveStatus("Cópia exportada · armazenamento indisponível");
      notice("Cópia editada pronta para salvar");
    });
  }
  function back() {
    if (busyRef.current) return;
    if (saveStatus.startsWith("Não salvo")) {
      setError("Salve uma cópia antes de fechar este documento.");
      return;
    }
    clientRef.current?.destroy();
    clientRef.current = null;
    activeRef.current = null;
    setActive(null);
    setInfo(null);
    setContent(null);
    setTool("read");
    setError("");
    setMenu(false);
    void refreshLibrary();
  }
  function selectText(run?: TextRun | TextBlock, point?: [number, number]) {
    setError("");
    setTextEditor({ run, point });
  }
  function changePage(n: number) {
    if (!info || busyRef.current) return;
    const next = Math.min(info.pageCount, Math.max(1, Math.round(n) || 1));
    setPage(next);
    setSelectedImage(null);
    const doc = activeRef.current;
    if (doc && doc.lastPage !== next) {
      const updated = { ...doc, lastPage: next };
      updateActive(updated);
      setSaveStatus("Salvando página…");
      void enqueueWrite(() => store.saveDocument(updated))
        .then(() => {
          if (
            activeRef.current?.id === doc.id &&
            activeRef.current.lastPage === next &&
            !busyRef.current
          )
            setSaveStatus("Salvo no aparelho");
        })
        .catch((e) => {
          setError("Não foi possível lembrar a página: " + errorMessage(e));
          setSaveStatus("Não foi possível lembrar a página");
        });
    }
  }
  async function pickImage(file?: File) {
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
      const image = new Image();
      image.src = url;
      try {
        await image.decode();
      } catch {
        URL.revokeObjectURL(url);
        throw new Error("Não foi possível abrir a imagem. Use PNG ou JPEG.");
      }
      setImageFile({
        bytes,
        url,
        ratio: image.naturalWidth / image.naturalHeight,
        name: file.name,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function imageRect(): [number, number, number, number] | null {
    if (!content || !imagePoint || !imageFile) return null;
    const [x0, y0, x1, y1] = content.bounds;
    const width = Math.min(((x1 - x0) * imageWidth) / 100, x1 - imagePoint[0]);
    const fitted = Math.min(width, (y1 - imagePoint[1]) * imageFile.ratio);
    return [
      imagePoint[0],
      imagePoint[1],
      imagePoint[0] + fitted,
      imagePoint[1] + fitted / imageFile.ratio,
    ];
  }
  async function enterDocumentMode() {
    setMenu(false);
    await runTask("Preparando documento…", async () => {
      const { loadPdfJsDocument } = await import("./utils/pdfEngine");
      setDocumentProxy(
        await loadPdfJsDocument(
          await clientRef.current!.call("save", undefined),
        ),
      );
      setDocumentMode(true);
    });
  }
  const filtered = [...documents]
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .filter((d) => d.title.toLowerCase().includes(libraryQuery.toLowerCase()));
  const matchingCount =
    query && content
      ? content.texts.filter((t) => foldText(t.text).includes(foldText(query)))
          .length
      : 0;
  const editing = tool !== "read";
  const help =
    tool === "text"
      ? selectionMode === "paragraph"
        ? "Toque em um parágrafo para editar as linhas juntas."
        : "Toque em um trecho para uma correção pontual."
      : tool === "images"
        ? "Toque em uma imagem para removê-la."
        : tool === "add-text"
          ? "Toque na página onde deseja escrever."
          : tool === "add-image"
            ? "Toque na página onde deseja inserir a imagem."
            : "";
  if (documentMode && active)
    return (
      <Suspense fallback={<div className="app-loading">Abrindo editor…</div>}>
        <DocumentEditor
          document={active}
          pdfDoc={documentProxy}
          saveStatus={saveStatus}
          onBack={() => {
            setDocumentMode(false);
            void documentProxy?.destroy();
            setDocumentProxy(null);
          }}
          onChange={(data) => {
            const doc = { ...activeRef.current!, documentContent: data };
            updateActive(doc);
            setSaveStatus("Salvando…");
            const version = ++draftVersion.current;
            void enqueueWrite(() => store.saveDocument(doc))
              .then(() => {
                if (version === draftVersion.current)
                  setSaveStatus("Salvo no aparelho");
              })
              .catch((e) => {
                setSaveStatus("Não salvo: " + errorMessage(e));
              });
          }}
        />
      </Suspense>
    );
  return (
    <div className={`app ${active ? "workspace" : "library"}`}>
      <input
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Abrir arquivo PDF"
        ref={fileInput}
        hidden
        onChange={(e) => {
          importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        accept="image/png,image/jpeg"
        aria-label="Escolher imagem"
        ref={imageInput}
        hidden
        onChange={(e) => {
          void pickImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <header className="topbar">
        {active ? (
          <>
            <button
              className="icon-button"
              aria-label="Voltar à biblioteca"
              onClick={back}
              disabled={!!busy}
            >
              <ArrowLeft size={21} />
            </button>
            <span className="file-badge compact">
              <FileText size={20} />
            </span>
            <div className="document-heading">
              <h1 title={active.title}>{active.title}</h1>
              <span className="save-status" role="status">
                {saveStatus === "Salvo no aparelho" && <Check size={12} />}{" "}
                {saveStatus}
              </span>
            </div>
            <div className="topbar-actions">
              <button
                className="button primary save-copy"
                onClick={saveCopy}
                disabled={!!busy}
              >
                <Download size={17} />
                <span>Salvar cópia</span>
              </button>
              <button
                className="icon-button"
                aria-label="Mais opções"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
                disabled={!!busy}
              >
                <MoreHorizontal size={21} />
              </button>
            </div>
          </>
        ) : (
          <>
            <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
              <span className="brand-icon">
                <FileText size={21} />
              </span>
              Edit<span>PDF</span>
            </a>
            <span className="brand-caption">Seu espaço para ler e editar.</span>
            <div className="topbar-actions">
              <button
                className="icon-button"
                aria-label="Sobre o aplicativo"
                onClick={() => setAbout(true)}
              >
                <Info size={20} />
              </button>
              <button
                className="button primary"
                onClick={() => fileInput.current?.click()}
                disabled={!!busy || !ready}
              >
                <Plus size={18} />
                Abrir PDF
              </button>
            </div>
          </>
        )}
      </header>
      {menu && active && (
        <>
          <button
            className="menu-dismiss"
            aria-label="Fechar opções"
            onClick={() => setMenu(false)}
          />
          <div className="options-menu">
            <button
              onClick={() => {
                setMenu(false);
                fileInput.current?.click();
              }}
            >
              <FolderOpen size={17} />
              Abrir outro PDF
            </button>
            <button
              onClick={() => {
                setMenu(false);
                void mutate({ type: "rotate", page });
              }}
            >
              <RotateCw size={17} />
              Girar esta página
            </button>
            <button onClick={enterDocumentMode}>
              <FileText size={17} />
              Editor de documento
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setRestore(true);
              }}
            >
              <Undo2 size={17} />
              Restaurar PDF original
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setAbout(true);
              }}
            >
              <Info size={17} />
              Sobre e licenças
            </button>
          </div>
        </>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Fechar mensagem de erro"
            onClick={() => setError("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <DesktopUpdates
        canInstall={
          (!busy &&
            !textEditor &&
            !imagePoint &&
            !passwordJob &&
            !legacy &&
            saveStatus === "Salvo no aparelho") ||
          (!active && !busy)
        }
      />
      {!active ? (
        <main className="library-main">
          <section className="welcome">
            <span className="eyebrow">SIMPLES. DO TEU JEITO.</span>
            <h1>
              Teus PDFs.
              <br />
              <span>Novas possibilidades.</span>
            </h1>
            <p>
              Abra um livro, ajuste as palavras e salve sua versão.
              <br className="desktop-break" /> Tudo no seu aparelho, sem enviar
              seus arquivos.
            </p>
            <button
              className="button primary large"
              onClick={() => fileInput.current?.click()}
              disabled={!!busy || !ready}
            >
              <Upload size={19} />
              Abrir PDF do aparelho
              <ArrowRight size={18} />
            </button>
            <span className="local-note">
              <ShieldCheck size={14} /> Seus arquivos ficam com você
            </span>
            <div className="welcome-paper" aria-hidden="true">
              <div className="paper-label">O SEU PRÓXIMO CAPÍTULO</div>
              <div className="paper-title">
                Um novo
                <br />
                olhar sobre
                <br />
                <em>suas ideias.</em>
              </div>
              <div className="paper-lines" />
              <div className="paper-edit">
                <Pencil size={16} /> Faça a história ser sua.
              </div>
              <span className="paper-page">01</span>
            </div>
          </section>
          <section className="recent">
            <div className="section-heading">
              <div>
                <h2>
                  Meus documentos <span>{documents.length}</span>
                </h2>
                <p>Continue de onde parou.</p>
              </div>
              {documents.length > 0 && (
                <label className="library-search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar na biblioteca"
                    placeholder="Buscar documento"
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                  />
                </label>
              )}
            </div>
            {!ready ? (
              <div className="empty-library">
                <LoaderCircle className="spin" />
                Carregando biblioteca…
              </div>
            ) : !filtered.length ? (
              <div className="empty-library">
                <span className="empty-icon">
                  <FolderOpen size={25} />
                </span>
                <h3>
                  {documents.length
                    ? "Nenhum resultado"
                    : "Sua biblioteca começa aqui"}
                </h3>
                <p>
                  {documents.length
                    ? "Tente buscar por outro nome."
                    : "Importe um PDF do celular ou computador para começar."}
                </p>
                {!documents.length && (
                  <button
                    className="button secondary"
                    onClick={() => fileInput.current?.click()}
                    disabled={!!busy}
                  >
                    Escolher arquivo
                  </button>
                )}
              </div>
            ) : (
              <div className="document-list">
                <div className="list-labels">
                  <span>DOCUMENTO</span>
                  <span>ÚLTIMA ABERTURA</span>
                  <span />
                </div>
                {filtered.map((doc) => (
                  <div className="document-row" key={doc.id}>
                    <button
                      className="document-open"
                      onClick={() => openDocument(doc)}
                      disabled={!!busy}
                    >
                      <span className="file-badge">
                        <FileText size={24} />
                        <small>PDF</small>
                      </span>
                      <span className="document-meta">
                        <strong>{doc.title}</strong>
                        <span>
                          {doc.pageCount}{" "}
                          {doc.pageCount === 1 ? "página" : "páginas"} <i />{" "}
                          {doc.fileSizeFormatted}
                          {doc.hasWorkingCopy && (
                            <>
                              <i />
                              <span className="edited-label">Editado</span>
                            </>
                          )}
                        </span>
                      </span>
                      <time>
                        {new Date(doc.lastOpenedAt).toLocaleDateString("pt-BR")}
                      </time>
                      <ChevronRight className="row-arrow" size={18} />
                    </button>
                    <button
                      className="icon-button delete-document"
                      aria-label={`Excluir ${doc.title} da biblioteca`}
                      onClick={() => setDeleting(doc)}
                      disabled={!!busy}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <footer className="library-footer">
            <span>EditPDF · Feito para suas leituras e ideias.</span>
            <button onClick={() => setAbout(true)}>Sobre e licenças</button>
          </footer>
        </main>
      ) : (
        <>
          <div className="reader-toolbar">
            <div className="reader-tools">
              <button
                className={`button tool-button ${!editing ? "selected" : ""}`}
                onClick={() => setTool("read")}
                disabled={!!busy}
              >
                <BookOpen size={17} />
                Ler
              </button>
              <button
                className={`button tool-button ${editing ? "selected" : ""}`}
                onClick={() => setTool(editing ? "read" : "text")}
                disabled={!!busy || !info?.canEdit}
              >
                <Pencil size={17} />
                Editar
              </button>
              <span className="toolbar-separator" />
              <button
                className="icon-button"
                aria-label="Pesquisar nesta página"
                aria-pressed={searchOpen}
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search size={19} />
              </button>
              <button
                className="icon-button"
                aria-label="Páginas e índice"
                aria-expanded={navigation}
                onClick={() => setNavigation(!navigation)}
              >
                <LayoutList size={19} />
              </button>
            </div>
            <div className="history-tools">
              <button
                className="icon-button"
                aria-label="Desfazer"
                disabled={!!busy || !history.canUndo}
                onClick={() => travel("undo")}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Refazer"
                disabled={!!busy || !history.canRedo}
                onClick={() => travel("redo")}
              >
                <Redo2 size={18} />
              </button>
            </div>
          </div>
          {searchOpen && (
            <div className="page-search">
              <Search size={17} />
              <input
                autoFocus
                aria-label="Pesquisar nesta página"
                placeholder="Pesquisar nesta página…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span>
                {query && content
                  ? `${matchingCount} ${matchingCount === 1 ? "trecho" : "trechos"}`
                  : ""}
              </span>
              <button
                className="icon-button"
                aria-label="Fechar pesquisa"
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {editing && (
            <div className="edit-toolbar" aria-label="Ferramentas de edição">
              <button
                className={tool === "text" ? "active" : ""}
                onClick={() => setTool("text")}
                disabled={!!busy}
              >
                <Pencil size={16} />
                Texto existente
              </button>
              <button
                className={tool === "add-text" ? "active" : ""}
                onClick={() => setTool("add-text")}
                disabled={!!busy}
              >
                <Type size={17} />
                Adicionar texto
              </button>
              <button
                className={tool === "images" ? "active" : ""}
                onClick={() => setTool("images")}
                disabled={!!busy}
              >
                <ImageIcon size={17} />
                Imagens
              </button>
              <button
                className={tool === "add-image" ? "active" : ""}
                onClick={() => setTool("add-image")}
                disabled={!!busy}
              >
                <ImagePlus size={17} />
                Inserir imagem
              </button>
            </div>
          )}
          {tool === "text" && (
            <div
              className="selection-mode"
              role="group"
              aria-label="Tipo de seleção"
            >
              <span>Selecionar</span>
              <button
                className={selectionMode === "paragraph" ? "active" : ""}
                aria-pressed={selectionMode === "paragraph"}
                onClick={() => setSelectionMode("paragraph")}
                disabled={!!busy}
              >
                Parágrafos
              </button>
              <button
                className={selectionMode === "run" ? "active" : ""}
                aria-pressed={selectionMode === "run"}
                onClick={() => setSelectionMode("run")}
                disabled={!!busy}
              >
                Trechos
              </button>
            </div>
          )}
          {help && (
            <div className="tool-hint">
              <span className="hint-dot" />
              {help}
            </div>
          )}
          {!info?.canEdit && (
            <div className="info-banner">
              Este PDF permite leitura, mas restringe alterações.
            </div>
          )}
          {tool === "text" &&
            content &&
            !content.texts.some((t) => t.editable) && (
              <div className="info-banner">
                {content.texts.length
                  ? "A direção do texto desta página ainda não é suportada para edição."
                  : "Não há texto editável nesta página. Se for uma digitalização, será necessário OCR."}
              </div>
            )}
          {tool === "images" && content && !content.images.length && (
            <div className="info-banner">
              Nenhuma imagem separada foi encontrada. Desenhos vetoriais ainda
              não podem ser selecionados.
            </div>
          )}
          <div className="reader-body">
            {navigation && (
              <>
                <button
                  className="sidebar-shade"
                  aria-label="Fechar navegação"
                  onClick={() => setNavigation(false)}
                />
                <aside className="page-sidebar">
                  <div className="sidebar-heading">
                    <h2>Páginas</h2>
                    <button
                      className="icon-button"
                      aria-label="Fechar navegação"
                      onClick={() => setNavigation(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="page-grid">
                    {Array.from({ length: info?.pageCount || 0 }, (_, i) => (
                      <button
                        key={i}
                        className={page === i + 1 ? "current" : ""}
                        onClick={() => {
                          changePage(i + 1);
                          setNavigation(false);
                        }}
                        disabled={!!busy}
                      >
                        <FileText size={25} />
                        <span>{i + 1}</span>
                      </button>
                    ))}
                  </div>
                  {!!info?.outline.length && (
                    <>
                      <h3>Índice do documento</h3>
                      <div className="outline-list">
                        {info.outline.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              changePage(item.page);
                              setNavigation(false);
                            }}
                          >
                            {item.title}
                            <span>{item.page}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </aside>
              </>
            )}
            {content && clientRef.current ? (
              <ReaderPage
                key={active.id}
                client={clientRef.current}
                page={page}
                revision={revision}
                content={content}
                zoom={zoom}
                tool={tool}
                selectionMode={selectionMode}
                disabled={!!busy}
                search={query}
                onText={(run) => selectText(run)}
                onImage={setSelectedImage}
                onPoint={(point) => {
                  if (tool === "add-text") selectText(undefined, point);
                  else {
                    setImagePoint(point);
                    setImageFile(null);
                    setImageWidth(35);
                    setImageBackground(false);
                  }
                }}
                onError={setError}
                onZoom={setZoom}
              />
            ) : (
              <div className="reader-loading">
                <LoaderCircle className="spin" />
                Carregando página…
              </div>
            )}
          </div>
          <footer className="reader-footer">
            <div className="page-controls">
              <button
                className="icon-button"
                aria-label="Página anterior"
                disabled={page <= 1 || !!busy}
                onClick={() => changePage(page - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <label>
                <span className="page-label">Página</span>
                <input
                  aria-label="Número da página"
                  inputMode="numeric"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => {
                    changePage(Number(pageInput));
                    setPageInput(
                      String(
                        Math.min(
                          info?.pageCount || 1,
                          Math.max(1, Number(pageInput) || 1),
                        ),
                      ),
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <span>de {info?.pageCount}</span>
              </label>
              <button
                className="icon-button"
                aria-label="Próxima página"
                disabled={page >= (info?.pageCount || 1) || !!busy}
                onClick={() => changePage(page + 1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="zoom-controls">
              <button
                className="icon-button"
                aria-label="Diminuir zoom"
                disabled={zoom <= 0.5}
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                <ZoomOut size={18} />
              </button>
              <button
                className="zoom-value"
                aria-label="Ajustar à largura"
                onClick={() => setZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                className="icon-button"
                aria-label="Aumentar zoom"
                disabled={zoom >= 3}
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              >
                <ZoomIn size={18} />
              </button>
              <button
                className="icon-button fit-button"
                aria-label="Ajustar página à tela"
                onClick={() => setZoom(1)}
              >
                <Maximize size={17} />
              </button>
            </div>
          </footer>
        </>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          <LoaderCircle className="spin" size={16} />
          {busy}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {textEditor && content && clientRef.current && (
        <TextEditorDialog
          client={clientRef.current}
          page={page}
          bounds={content.bounds}
          selection={textEditor}
          busy={!!busy}
          error={error}
          onClose={() => setTextEditor(null)}
          onApply={(edit) => void mutate(edit)}
        />
      )}
      {selectedImage && (
        <Modal
          error={error}
          title="Imagem selecionada"
          onClose={() => setSelectedImage(null)}
          locked={!!busy}
        >
          <p className="dialog-description">
            Remover esta imagem do conteúdo da página? Os textos e desenhos
            vetoriais serão preservados. Você pode desfazer.
          </p>
          <div className="image-details">
            <ImageIcon size={25} />
            <span>
              Imagem · {selectedImage.width} × {selectedImage.height} pixels
            </span>
          </div>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setSelectedImage(null)}
              disabled={!!busy}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={!!busy}
              onClick={() =>
                void mutate({
                  type: "delete-image",
                  page,
                  id: selectedImage.id,
                })
              }
            >
              <Trash2 size={16} />
              Remover imagem
            </button>
          </div>
        </Modal>
      )}
      {imagePoint && (
        <Modal
          error={error}
          title="Inserir imagem"
          onClose={() => {
            setImagePoint(null);
            setImageFile(null);
          }}
          locked={!!busy}
        >
          <p className="dialog-description">
            Escolha uma imagem PNG ou JPEG do aparelho.
          </p>
          <button
            className="image-picker"
            onClick={() => imageInput.current?.click()}
          >
            {imageFile ? (
              <>
                <img src={imageFile.url} alt="Prévia da imagem" />
                <span>{imageFile.name}</span>
              </>
            ) : (
              <>
                <ImagePlus size={30} />
                <span>Escolher imagem</span>
              </>
            )}
          </button>
          {imageFile && (
            <>
              <label className="field">
                Largura na página: {imageWidth}%
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={imageWidth}
                  onChange={(e) => setImageWidth(Number(e.target.value))}
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={imageBackground}
                  onChange={(e) => setImageBackground(e.target.checked)}
                />
                Colocar atrás do conteúdo (fundo)
              </label>
              {imageBackground && (
                <p className="field-note">
                  Se a página tiver um fundo opaco, ele poderá encobrir a imagem
                  inserida.
                </p>
              )}
            </>
          )}
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => {
                setImagePoint(null);
                setImageFile(null);
              }}
              disabled={!!busy}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={!!busy || !imageFile}
              onClick={() => {
                const rect = imageRect();
                if (rect && imageFile)
                  void mutate({
                    type: "insert-image",
                    page,
                    rect,
                    bytes: imageFile.bytes,
                    background: imageBackground,
                  });
              }}
            >
              Inserir na página
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          error={error}
          title="Excluir da biblioteca?"
          onClose={() => setDeleting(null)}
          locked={!!busy}
        >
          <p className="dialog-description">
            O documento “{deleting.title}” e suas edições serão removidos deste
            aplicativo. O arquivo que você importou do aparelho não será
            alterado.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
              disabled={!!busy}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={!!busy}
              onClick={() =>
                void runTask("Excluindo…", async () => {
                  await enqueueWrite(() =>
                    store.deleteStoredDocument(deleting.id),
                  );
                  setDeleting(null);
                  await refreshLibrary();
                })
              }
            >
              Excluir documento
            </button>
          </div>
        </Modal>
      )}
      {restore && (
        <Modal
          error={error}
          title="Restaurar PDF original?"
          onClose={() => setRestore(false)}
          locked={!!busy}
        >
          <p className="dialog-description">
            A cópia de trabalho voltará ao arquivo importado. Salve uma cópia
            antes se quiser guardar suas alterações atuais. O histórico desta
            sessão será reiniciado.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setRestore(false)}
              disabled={!!busy}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              disabled={!!busy}
              onClick={() =>
                void runTask("Restaurando…", async () => {
                  const doc = activeRef.current!;
                  const bytes = await store.readDocumentBytes(doc.id);
                  if (!bytes) throw new Error("Original não encontrado.");
                  setRestore(false);
                  if (
                    await openBytes(
                      bytes,
                      doc.title,
                      { ...doc, pageMetadata: {}, hasWorkingCopy: false },
                      undefined,
                      true,
                    )
                  )
                    notice("PDF original restaurado");
                })
              }
            >
              Restaurar original
            </button>
          </div>
        </Modal>
      )}
      {passwordJob && (
        <Modal
          error={error}
          title="PDF protegido por senha"
          onClose={() => {
            setPasswordJob(null);
            setPassword("");
          }}
          locked={!!busy}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runTask("Desbloqueando…", async () => {
                await openBytes(
                  passwordJob.bytes,
                  passwordJob.name,
                  passwordJob.doc,
                  password,
                  passwordJob.working,
                );
              });
            }}
          >
            <p className="dialog-description">
              Digite a senha para abrir este arquivo. A cópia de trabalho e o
              PDF exportado ficarão sem senha; o original será preservado.
            </p>
            <label className="field">
              Senha
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <div className="dialog-actions">
              <button
                type="submit"
                className="button primary"
                disabled={!!busy}
              >
                Abrir documento
              </button>
            </div>
          </form>
        </Modal>
      )}
      {legacy && (
        <Modal
          error={error}
          title="Edições da versão anterior"
          onClose={() => setLegacy(null)}
          locked={!!busy}
        >
          <p className="dialog-description">
            Este arquivo tem anotações ou correções visuais feitas na versão
            anterior. Você pode incorporá-las à cópia de trabalho ou começar
            pelo PDF original.
          </p>
          <p className="field-note">
            As coberturas antigas continuam sendo coberturas. Novas alterações
            de texto usarão edição real.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() =>
                void runTask("Abrindo original…", async () => {
                  const doc = {
                    ...legacy.doc,
                    archivedPageMetadata: legacy.doc.pageMetadata,
                    pageMetadata: {},
                  };
                  await openBytes(legacy.bytes, doc.title, doc);
                  setLegacy(null);
                })
              }
            >
              Usar original
            </button>
            <button
              className="button primary"
              disabled={!!busy}
              onClick={() =>
                void runTask("Incorporando edições…", async () => {
                  const { exportEditedPdf } = await import("./utils/pdfExport");
                  const bytes = await exportEditedPdf(
                    legacy.bytes,
                    legacy.doc.pageMetadata,
                    legacy.doc.title,
                  );
                  const doc = {
                    ...legacy.doc,
                    archivedPageMetadata: legacy.doc.pageMetadata,
                    pageMetadata: {},
                    hasWorkingCopy: true,
                  };
                  await openBytes(bytes, doc.title, doc, undefined, true);
                  setLegacy(null);
                })
              }
            >
              Incorporar edições
            </button>
          </div>
        </Modal>
      )}
      {about && (
        <Modal
          error={error}
          title="Sobre o EditPDF"
          onClose={() => setAbout(false)}
        >
          <p className="dialog-description">
            Leitura e edição pessoal de PDFs, com processamento no seu aparelho.
            Nenhuma inteligência artificial ou envio de documentos a servidores.
          </p>
          <div className="about-detail">
            <strong>Motor de edição</strong>
            <span>MuPDF.js 1.28.1 · Artifex Software, Inc.</span>
            <a href="licenses/AGPL-3.0.txt" target="_blank" rel="noreferrer">
              Licença GNU AGPL versão 3
            </a>
            <a
              href="https://github.com/Chimiasama/Editor-pdf"
              target="_blank"
              rel="noreferrer"
            >
              Código-fonte e instruções de compilação
            </a>
          </div>
          <p className="field-note">
            Esta versão edita parágrafos dentro da página e imagens separadas.
            Digitalizações precisam de OCR. O editor de documento, disponível em
            Mais opções, permite escrever com parágrafos e exportar um novo PDF
            com outro layout.
          </p>
          <p className="field-note">
            Faça backup usando Salvar cópia. Limpar os dados do navegador ou do
            aplicativo remove a biblioteca local.
          </p>
          <div className="dialog-actions">
            <button className="button primary" onClick={() => setAbout(false)}>
              Entendi
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
