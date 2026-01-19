import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  target: "es2017",
  external: ["react", "react/jsx-runtime"],
  splitting: true,
});
