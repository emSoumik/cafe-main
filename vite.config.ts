import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Base path for the project site. When publishing to
  // https://<user>.github.io/cafe/ set base to '/cafe/'.
  // Commented out for local development
  // base: '/cafe/',
  server: {
    host: "::",
    // Avoid port conflicts with the Firestore emulator (default 8080).
    // Use Vite's common default port 5173 for development.
    port: 5173,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
