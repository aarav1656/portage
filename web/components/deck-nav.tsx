"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";

/** Fixed prev/next strip for the /pitch deck. ArrowRight/ArrowLeft move one slide; the counter tracks the slide in view. */
export function DeckNav({ total }: { total: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const onScroll = () => setCurrent(slideInView());
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") go(slideInView() + 1);
      else if (e.key === "ArrowLeft") go(slideInView() - 1);
      else return;
      e.preventDefault();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <nav
      data-deck-nav
      aria-label="Slides"
      className="fixed bottom-4 right-4 z-10 flex items-center gap-2 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--paper)] p-1.5"
    >
      <button type="button" className="btn btn-outline px-2.5 py-1.5" onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous slide">
        <ArrowLeft size={16} aria-hidden="true" />
      </button>
      <span className="mono min-w-[4.5rem] text-center text-xs text-[var(--ink-2)]" aria-live="polite">
        {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
      <button type="button" className="btn btn-outline px-2.5 py-1.5" onClick={() => go(current + 1)} disabled={current === total - 1} aria-label="Next slide">
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}

const slides = () => Array.from(document.querySelectorAll<HTMLElement>("[data-slide]"));

/** Last slide whose top edge has passed the upper third of the viewport. */
function slideInView(): number {
  let index = 0;
  slides().forEach((s, i) => {
    if (s.getBoundingClientRect().top <= window.innerHeight / 3) index = i;
  });
  return index;
}

function go(index: number) {
  const all = slides();
  const target = all[Math.max(0, Math.min(all.length - 1, index))];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
