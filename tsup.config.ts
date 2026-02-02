import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
    "react-motion": "src/react-motion/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  target: "es2017",
  external: ["react", "react/jsx-runtime", "motion"],
  splitting: true,
});
