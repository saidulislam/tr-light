"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  label: string;
}

const SECTIONS: Section[] = [
  { id: "profile", label: "Profile" },
  { id: "context", label: "Context" },
  { id: "what", label: "What" },
  { id: "how", label: "How" },
  { id: "growth", label: "Growth" },
];

export function RubricToc({
  whatRated,
  howRated,
}: {
  whatRated: boolean;
  howRated: boolean;
}) {
  const [active, setActive] = useState<string>("profile");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (!el) continue;
      const o = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(s.id);
        },
        // Trigger when the section's top is in the upper-middle of the viewport.
        { rootMargin: "-25% 0px -60% 0px", threshold: 0 }
      );
      o.observe(el);
      observers.push(o);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function statusFor(id: string): "done" | "pending" | "optional" | null {
    if (id === "what") return whatRated ? "done" : "pending";
    if (id === "how") return howRated ? "done" : "pending";
    if (id === "growth") return "optional";
    return null;
  }

  return (
    <nav aria-label="Review sections" className="text-[12px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 mb-3">
        On this page
      </p>
      <ul className="space-y-0.5">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          const status = statusFor(s.id);
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md transition-colors duration-150",
                  isActive
                    ? "text-foreground font-medium bg-muted/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <span>{s.label}</span>
                {status && (
                  <span
                    className={cn(
                      "shrink-0",
                      status === "done" && "size-1.5 rounded-full bg-foreground",
                      status === "pending" &&
                        "size-1.5 rounded-full border border-muted-foreground/40",
                      status === "optional" &&
                        "size-1.5 rounded-sm border border-muted-foreground/40"
                    )}
                    aria-hidden
                  />
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
