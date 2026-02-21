import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Inject app version (from package.json) into the build so the footer can show it.
const here = dirname(fileURLToPath(import.meta.url));
let appVersion = "dev";
try {
  const pkg = JSON.parse(readFileSync(resolve(here, "package.json"), "utf-8"));
  appVersion = pkg?.version ?? appVersion;
} catch {
  // keep "dev"
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Allows usage like: import.meta.env.VITE_APP_VERSION
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
});
