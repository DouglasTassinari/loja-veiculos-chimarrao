// Sobe a loja para os testes de navegador: banco SQLite novo e descartável, dados de demonstração,
// build de produção (a mesma que vai ao ar) e `next start`.  E2E_SKIP_BUILD=1 reaproveita o build.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const port = process.env.E2E_PORT ?? "3210";
const dir = path.join(process.cwd(), ".e2e");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: "",
  SQLITE_PATH: path.join(dir, "loja.db"),
  ERP_PASSWORD: process.env.E2E_PASSWORD ?? "senha-de-teste-123",
  ERP_SECRET: "segredo-de-teste-com-mais-de-16-caracteres",
  SEED_DEMO: "1",
  NEXT_PUBLIC_PREVIEW: "1",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  NEXT_TELEMETRY_DISABLED: "1",
};

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
if (process.env.E2E_SKIP_BUILD !== "1") {
  const b = spawnSync(process.execPath, [next, "build"], { env, stdio: "inherit" });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const srv = spawn(process.execPath, [next, "start", "-p", port], { env, stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { srv.kill(); process.exit(0); });
srv.on("exit", (code) => process.exit(code ?? 0));
