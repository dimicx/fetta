import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/app/source";
import { FettaLogo } from "../components/icons/fetta-logo";
import { SidebarSeparator } from "../components/sidebar-separator";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <span className="h-6 block">
            <FettaLogo />
          </span>
        ),
        url: "/",
      }}
      githubUrl="https://github.com/dimicx/fetta"
      sidebar={{
        components: {
          Separator: SidebarSeparator,
        },
      }}
    >
      {children}
    </DocsLayout>
  );
}
