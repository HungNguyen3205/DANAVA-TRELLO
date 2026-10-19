import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "virtual:pwa-register/react": fileURLToPath(new URL("./tests/mocks/pwa-register.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "tests/board.test.ts",
      "tests/performance*.{ts,tsx}",
      "tests/excelImport*.{ts,tsx}",
      "tests/trash*.{ts,tsx}",
      "tests/wip*.{ts,tsx}",
      "tests/department*.{ts,tsx}",
      "tests/telegram*.{ts,tsx}",
    ],
    setupFiles: ["tests/setup.ts"],
  },
});
