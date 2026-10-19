import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "virtual:pwa-register/react": path.resolve(__dirname, "tests/mocks/pwa-register.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/*.ui.test.tsx"],
    setupFiles: ["tests/setup.ts"],
  },
});

