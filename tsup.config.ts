import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    helpers: "src/helpers/index.ts",
    react: "src/react/index.ts",
    motion: "src/motion/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  target: "es2020",
  external: ["react", "react/jsx-runtime", "motion"],
  splitting: true,
});
