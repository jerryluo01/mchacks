import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: ".",
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "src/content/content.js"),
      output: {
        entryFileNames: "content.js",
        format: "iife",
        inlineDynamicImports: true
      }
    }
  }
});
