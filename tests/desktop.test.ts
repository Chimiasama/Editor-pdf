import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("desktop releases only activate signed updates with both signing inputs and keep the app identity stable", () => {
  const root = path.resolve("work");
  fs.mkdirSync(root, { recursive: true });
  const temp = fs.mkdtempSync(path.join(root, "desktop-test-"));
  const config = JSON.parse(
    fs.readFileSync("src-tauri/tauri.conf.json", "utf8"),
  );
  fs.mkdirSync(path.join(temp, "src-tauri"));
  const envFile = path.join(temp, "env"),
    output = path.join(temp, "outputs");
  const run = (signed: boolean) => {
    fs.writeFileSync(
      path.join(temp, "src-tauri/tauri.conf.json"),
      JSON.stringify(config),
    );
    fs.copyFileSync(
      "src-tauri/Cargo.toml",
      path.join(temp, "src-tauri/Cargo.toml"),
    );
    execFileSync(
      process.execPath,
      [path.resolve("scripts/prepare-desktop-release.mjs"), "12"],
      {
        cwd: temp,
        env: {
          ...process.env,
          GITHUB_ENV: envFile,
          GITHUB_OUTPUT: output,
          TAURI_SIGNING_PRIVATE_KEY: signed ? "test-only-placeholder" : "",
          TAURI_UPDATER_PUBLIC_KEY: signed ? "test-public-key" : "",
        },
        stdio: "pipe",
      },
    );
    return JSON.parse(
      fs.readFileSync(path.join(temp, "src-tauri/tauri.conf.json"), "utf8"),
    );
  };
  try {
    const unsigned = run(false);
    assert.equal(unsigned.bundle.createUpdaterArtifacts, false);
    assert.equal(unsigned.plugins, undefined);
    const signed = run(true);
    assert.equal(signed.bundle.createUpdaterArtifacts, true);
    assert.equal(signed.version, "0.2.12");
    assert.equal(signed.identifier, config.identifier);
    assert.equal(signed.plugins.updater.pubkey, "test-public-key");
    assert.match(
      signed.plugins.updater.endpoints[0],
      /^https:\/\/github.com\/Chimiasama\/Editor-pdf\//,
    );
    assert.match(
      fs.readFileSync(envFile, "utf8"),
      /VITE_DESKTOP_UPDATER_ENABLED=true/,
    );
    assert.doesNotMatch(
      fs.readFileSync(envFile, "utf8") + fs.readFileSync(output, "utf8"),
      /test-only-placeholder/,
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
