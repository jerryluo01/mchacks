import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

export default defineConfig({
  root: "src", // <-- important: tells Vite to treat src/ as root
  plugins: [crx({ manifest })],
  build: {
    outDir: "../dist", // output folder relative to project root
    emptyOutDir: true,
  },
});
