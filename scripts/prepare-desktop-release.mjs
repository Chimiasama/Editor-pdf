import fs from "node:fs";
const number = process.argv[2];
if (!/^\d+$/.test(number || ""))
  throw new Error("Provide the GitHub Actions run number.");
const version = `0.2.${number}`;
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
const signed = !!process.env.TAURI_SIGNING_PRIVATE_KEY && !!publicKey;
const file = "src-tauri/tauri.conf.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
config.version = version;
config.bundle.createUpdaterArtifacts = signed;
if (signed)
  config.plugins = {
    updater: {
      pubkey: publicKey,
      endpoints: [
        "https://github.com/Chimiasama/Editor-pdf/releases/latest/download/latest.json",
      ],
      windows: { installMode: "passive" },
    },
  };
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
fs.writeFileSync(
  "src-tauri/Cargo.toml",
  fs
    .readFileSync("src-tauri/Cargo.toml", "utf8")
    .replace(/^version = "[^"]+"$/m, `version = "${version}"`),
);
fs.appendFileSync(
  process.env.GITHUB_ENV,
  `VITE_DESKTOP_UPDATER_ENABLED=${signed}\n`,
);
fs.appendFileSync(
  process.env.GITHUB_OUTPUT,
  `version=${version}\nsigned=${signed}\n`,
);
console.log(
  `Preparing Windows ${version}. Signed in-app updates: ${signed ? "enabled" : "not configured"}.`,
);
