"use client";

import type { Separator } from "fumadocs-core/page-tree";

export function SidebarSeparator({ item }: { item: Separator }) {
  return (
    <p className="inline-flex items-center gap-2 mb-1.5 px-2 mt-6 empty:mb-0 first:mt-0 [&_svg]:size-4 [&_svg]:shrink-0">
      {item.name}
    </p>
  );
}
