import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
// Run locally by the owner with GitHub CLI authenticated. Never logs private material.
const folder = path.resolve(".desktop-signing");
fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
const key = path.join(folder, "editpdf.key");
const cli = path.resolve("node_modules/@tauri-apps/cli/tauri.js");
if (!fs.existsSync(key))
  execFileSync(
    process.execPath,
    [cli, "signer", "generate", "--ci", "-w", key],
    { stdio: "pipe" },
  );
fs.chmodSync(key, 0o600);
execFileSync(
  "gh",
  [
    "secret",
    "set",
    "TAURI_SIGNING_PRIVATE_KEY",
    "--repo",
    "Chimiasama/Editor-pdf",
  ],
  { input: fs.readFileSync(key), stdio: ["pipe", "inherit", "inherit"] },
);
execFileSync(
  "gh",
  [
    "variable",
    "set",
    "TAURI_UPDATER_PUBLIC_KEY",
    "--repo",
    "Chimiasama/Editor-pdf",
  ],
  {
    input: fs.readFileSync(key + ".pub"),
    stdio: ["pipe", "inherit", "inherit"],
  },
);
console.log(
  "Assinatura configurada. Guarde a pasta .desktop-signing como backup privado. Não publique a chave.",
);
console.log(
  "Execute novamente o workflow Windows para gerar o primeiro instalador com atualizações ativadas.",
);
