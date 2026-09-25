import Image, { type StaticImageData } from "next/image";

const CAPTURED = "2026-09-25";

const display = (href: string) => href.replace(/^https?:\/\/(www\.)?/, "");

/** A captured third-party page, tagged like a numbered exhibit with its source and capture date. */
export function Exhibit({
  no,
  src,
  alt,
  href,
  note,
  className = "",
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: {
  no: string;
  src: StaticImageData;
  alt: string;
  href: string;
  note: React.ReactNode;
  className?: string;
  sizes?: string;
}) {
  return (
    <figure className={`min-w-0 border border-[var(--line-strong)] bg-[var(--paper-2)] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line-strong)] px-3 py-1.5">
        <span className="mono text-[0.6875rem] uppercase tracking-widest text-[var(--ink)]">Exhibit {no}</span>
        <span className="mono text-[0.6875rem] text-[var(--ink-3)]">captured {CAPTURED}</span>
      </div>
      <Image src={src} alt={alt} sizes={sizes} className="block h-auto w-full" />
      <figcaption className="space-y-1 px-3 py-2.5">
        <p className="text-sm text-[var(--ink)]">{note}</p>
        <a href={href} target="_blank" rel="noreferrer" className="mono block break-all text-xs text-[var(--ink-2)] underline decoration-[var(--line-strong)]">
          {display(href)}
        </a>
      </figcaption>
    </figure>
  );
}

export type Tweet = {
  url: string;
  name: string;
  handle: string;
  date: string;
  avatar: StaticImageData;
  text: string;
  excerpt?: boolean;
  media?: { src: StaticImageData; alt: string };
  quote?: { title: string; text: string };
};

/** A post as fetched from api.fxtwitter.com: real author, handle, date and text, avatar stored locally. */
export function TweetCard({ t, className = "" }: { t: Tweet; className?: string }) {
  return (
    <article className={`min-w-0 border border-[var(--line-strong)] bg-[var(--paper)] p-4 ${className}`}>
      <header className="flex items-center gap-3">
        <Image src={t.avatar} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{t.name}</p>
          <p className="mono truncate text-xs text-[var(--ink-3)]">@{t.handle}</p>
        </div>
        <span className="mono ml-auto shrink-0 text-xs text-[var(--ink-3)]">{t.date}</span>
      </header>
      {t.excerpt && <p className="mono mt-3 text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">Excerpt</p>}
      <p className="mt-3 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-[var(--ink)]">{t.text}</p>
      {t.media && (
        <Image src={t.media.src} alt={t.media.alt} sizes="(min-width: 1024px) 33vw, 100vw" className="mt-3 block h-auto w-full rounded-[var(--radius)] border border-[var(--line)]" />
      )}
      {t.quote && (
        <blockquote className="mt-3 border-l-2 border-[var(--rejected)] pl-3">
          <p className="mono text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">Linked X article: {t.quote.title}</p>
          <p className="mt-1.5 text-[0.9375rem] text-[var(--ink)]">&ldquo;{t.quote.text}&rdquo;</p>
        </blockquote>
      )}
      <a href={t.url} target="_blank" rel="noreferrer" className="mono mt-3 block break-all text-xs text-[var(--ink-2)] underline decoration-[var(--line-strong)]">
        {display(t.url)}
      </a>
    </article>
  );
}

export type Article = { title: string; outlet: string; date: string; href: string; quote: string };

/** A cited page with a verbatim quote, laid out as a ledger line rather than a card. */
export function ArticleLine({ a }: { a: Article }) {
  return (
    <li className="grid gap-x-6 gap-y-1 border-b border-dashed border-[var(--line)] py-4 md:grid-cols-[14rem_1fr]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--ink)]">{a.outlet}</p>
        <p className="mono text-xs text-[var(--ink-3)]">{a.date}</p>
      </div>
      <div className="min-w-0">
        <a href={a.href} target="_blank" rel="noreferrer" className="font-[family-name:var(--font-display)] text-lg underline decoration-[var(--line-strong)]">
          {a.title}
        </a>
        <p className="mt-1 text-pretty text-[0.9375rem] text-[var(--ink-2)]">&ldquo;{a.quote}&rdquo;</p>
      </div>
    </li>
  );
}
