import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  return {
    server: {
      port: 4200,
    },
    build: {
      outDir: "build",
    },
    plugins: [react()],
  };
});
