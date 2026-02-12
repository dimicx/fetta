declare module "react-dom" {
  export function flushSync<T>(fn: () => T): T;
}
