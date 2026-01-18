import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { viteStaticCopy } from "vite-plugin-static-copy";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: ".",
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "src/sidepanel/*",
          dest: "sidepanel"
        }
      ]
    })
  ],
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
