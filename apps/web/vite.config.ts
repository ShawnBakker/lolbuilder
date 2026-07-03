import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative base: the app lives under /lolbuilder/ on Pages and anywhere else.
  base: "./",
});
