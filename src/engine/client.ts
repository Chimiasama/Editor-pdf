import type { RpcMethods } from "./types";
export class PdfClient {
  private worker = new Worker(new URL("./pdf.worker.ts", import.meta.url), {
    type: "module",
  });
  private nextId = 0;
  private pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();
  constructor() {
    this.worker.onmessage = ({ data }) => {
      const task = this.pending.get(data.id);
      if (!task) return;
      this.pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error));
      else task.resolve(data.result);
    };
    this.worker.onerror = () => {
      for (const task of this.pending.values())
        task.reject(
          new Error(
            "Não foi possível executar o editor. Reabra o aplicativo e tente novamente.",
          ),
        );
      this.pending.clear();
    };
  }
  call<K extends keyof RpcMethods>(
    method: K,
    args: RpcMethods[K]["args"],
  ): Promise<RpcMethods[K]["result"]> {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, args });
    });
  }
  destroy() {
    this.worker.terminate();
    for (const task of this.pending.values())
      task.reject(new Error("Documento fechado."));
    this.pending.clear();
  }
}
