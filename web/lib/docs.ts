import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { Marked, type Tokens } from "marked";

// Committed copy of the git-tracked docs/ pages, refreshed by scripts/sync-docs.mjs.
const ROOT = join(process.cwd(), "content/docs");

export type DocPage = { slug: string; file: string; title: string; group: string };
export type TocEntry = { id: string; text: string; depth: number };

const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
const slugOf = (file: string) => (file === "README.md" ? "" : posix.basename(file, ".md"));
export const hrefOf = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

/** GitHub's heading anchor rule, so `#slippage-minimums` style links in the source keep working. */
function anchor(text: string, seen: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

const plain = (md: string) => md.replace(/`([^`]*)`/g, "$1").replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
const firstH1 = (md: string) => plain(/^# (.+)$/m.exec(md)?.[1] ?? "");

/** Sidebar order and grouping come from the "## Pages" list in docs/README.md. */
function loadPages(): DocPage[] {
  const pages: DocPage[] = [{ slug: "", file: "README.md", title: firstH1(read("README.md")), group: "Overview" }];
  const section = read("README.md").split(/^## Pages$/m)[1] ?? "";
  let group = "";
  for (const line of section.split("\n")) {
    const item = /^- \[(.+?)\]\(([^)]+\.md)\)/.exec(line);
    if (item) {
      const file = posix.normalize(item[2]);
      pages.push({ slug: slugOf(file), file, title: firstH1(read(file)), group });
    } else if (line.trim() && !line.startsWith("-")) {
      group = line.trim();
    }
  }
  return pages;
}

export const PAGES = loadPages();

export function groups(): { name: string; pages: DocPage[] }[] {
  const out: { name: string; pages: DocPage[] }[] = [];
  for (const p of PAGES) {
    const last = out.at(-1);
    if (last?.name === p.group) last.pages.push(p);
    else out.push({ name: p.group, pages: [p] });
  }
  return out;
}

const pageOfFile = (file: string) => PAGES.find((p) => p.file === file);

/** Relative links between pages become /docs/<slug>; other repo files are not deployed, so they point at the source file name only. */
function rewrite(href: string, from: string): string {
  if (/^[a-z]+:|^#|^\//i.test(href)) return href;
  const [path, hash] = href.split("#");
  const target = posix.normalize(posix.join(posix.dirname(from), path));
  if (target.endsWith(".md")) {
    const page = pageOfFile(target);
    return `${hrefOf(page ? page.slug : posix.basename(target, ".md"))}${hash ? `#${hash}` : ""}`;
  }
  if (target.startsWith("architecture/")) return `/docs/${target}`;
  return href;
}

export function render(page: DocPage): { html: string; titleHtml: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const seen = new Map<string, number>();
  let titleHtml = "";
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        if (depth === 1 && !titleHtml) {
          titleHtml = inner;
          return "";
        }
        const id = anchor(plain(text), seen);
        if (depth <= 3) toc.push({ id, text: plain(text), depth });
        return `<h${depth} id="${id}"><a class="doc-anchor" href="#${id}" aria-label="Link to this section">§</a>${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const to = rewrite(href, page.file);
        const ext = /^https?:/.test(to);
        return `<a href="${to}"${title ? ` title="${title}"` : ""}${ext ? ' target="_blank" rel="noreferrer"' : ""}>${this.parser.parseInline(tokens)}</a>`;
      },
      code({ text, lang }: Tokens.Code) {
        const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<figure class="doc-code">${lang ? `<figcaption>${lang}</figcaption>` : ""}<pre><code>${esc}</code></pre></figure>\n`;
      },
    },
  });
  const html = marked
    .parse(read(page.file), { async: false })
    .replace(/<table>/g, '<div class="doc-table"><table>')
    .replace(/<\/table>/g, "</table></div>");
  return { html, titleHtml, toc };
}
