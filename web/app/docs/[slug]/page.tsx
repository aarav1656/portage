import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocView } from "@/components/doc-view";
import { PAGES } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return PAGES.filter((p) => p.slug).map((p) => ({ slug: p.slug }));
}

const find = (slug: string) => PAGES.find((p) => p.slug && p.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = find((await params).slug);
  return { title: page ? `${page.title}: Portage docs` : "Portage docs" };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = find((await params).slug);
  if (!page) notFound();
  return <DocView page={page} />;
}
