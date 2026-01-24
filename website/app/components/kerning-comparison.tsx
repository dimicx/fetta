import { headers } from "next/headers";
import { KerningComparisonClient } from "./kerning-comparison-client";

export async function KerningComparison() {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

  return <KerningComparisonClient isSafari={isSafari} />;
}
