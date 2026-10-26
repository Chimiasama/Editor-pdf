import type { RpcMethods } from "./types";
// Install the message handler before loading the WASM module. Top-level await in
// a static import can otherwise consume the first message before a handler exists.
const ready = import("./mupdfEngine").then(
  ({ MuPdfEngine }) => new MuPdfEngine(),
);
let queue = Promise.resolve();
self.onmessage = (
  event: MessageEvent<{ id: number; method: keyof RpcMethods; args: any }>,
) => {
  const { id, method, args } = event.data;
  queue = queue.then(async () => {
    try {
      const engine = await ready;
      let result: unknown;
      switch (method) {
        case "open":
          result = engine.open(args.bytes, args.password);
          break;
        case "content":
          result = engine.content(args.page);
          break;
        case "render":
          result = engine.render(args.page, args.scale);
          break;
        case "edit":
          result = engine.edit(args);
          break;
        case "undo":
          result = engine.undo();
          break;
        case "redo":
          result = engine.redo();
          break;
        case "save":
          result = engine.save();
          break;
        case "close":
          engine.close();
          break;
      }
      const transfer: Transferable[] = [];
      if (result instanceof Uint8Array)
        transfer.push(result.buffer as ArrayBuffer);
      else if (method === "render")
        transfer.push(
          (result as { pixels: Uint8ClampedArray }).pixels
            .buffer as ArrayBuffer,
        );
      self.postMessage({ id, result }, { transfer });
    } catch (error) {
      self.postMessage({
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
