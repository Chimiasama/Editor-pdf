import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
/**
 * Trigger file download directly in browser
 */
export async function downloadFile(bytes: Uint8Array, fileName: string) {
  if (Capacitor.isNativePlatform()) {
    const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const { uri } = await Filesystem.writeFile({
      path: safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: "Salvar PDF editado", files: [uri] });
    return;
  }
  const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
