import { source } from "@/app/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody, DocsPage } from "fumadocs-ui/page";
import { notFound } from "next/navigation";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} tableOfContent={{ style: "clerk" }}>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

// Custom page titles for sharing (clearer than frontmatter titles)
const pageTitles: Record<string, string> = {
  installation: "Installation",
  "examples/vanilla": "Vanilla examples",
  "examples/react": "React examples",
  "api/core": "splitText() API reference",
  "api/react": "SplitText (React) API reference",
};

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  // Index page uses the default title from layout, others use the template
  const isIndex = !params.slug || params.slug.length === 0;
  const slugKey = params.slug?.join("/") || "";
  const pageTitle = pageTitles[slugKey] || page.data.title;

  return {
    // { absolute: "Fetta" } bypasses the template for the index page
    title: isIndex ? { absolute: "Fetta" } : pageTitle,
    description: page.data.description,
  };
}
