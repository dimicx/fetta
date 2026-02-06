export async function waitForFontsReady(waitForFonts: boolean): Promise<void> {
  if (!waitForFonts) return;

  const fonts = (document as Document & {
    fonts?: { ready?: Promise<unknown> };
  }).fonts;

  const ready = fonts?.ready;
  if (!ready || typeof (ready as Promise<unknown>).then !== "function") return;

  try {
    await ready;
  } catch {
    // Font loading failures should not block splitting.
  }
}
