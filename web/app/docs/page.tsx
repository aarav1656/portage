import type { Metadata } from "next";
import { DocView } from "@/components/doc-view";
import { PAGES } from "@/lib/docs";

export const metadata: Metadata = { title: "Docs: Portage" };

export default function DocsIndex() {
  return <DocView page={PAGES[0]} />;
}
