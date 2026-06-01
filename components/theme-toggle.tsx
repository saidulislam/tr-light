"use client";

import { useEffect, useState, useTransition } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { setTheme } from "@/app/_actions/set-theme";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Three-way segmented control: Light / Dark / System. Writes a cookie and
 *  applies the class instantly so the user sees the change without waiting
 *  for the server round-trip. */
export function ThemeToggle() {
  const [current, setCurrent] = useState<Theme>("system");
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Read the existing cookie value to seed local state.
    const match = document.cookie
      .split("; ")
      .find((r) => r.startsWith("tr-theme="));
    const value = match?.split("=")[1];
    if (value === "light" || value === "dark" || value === "system") {
      setCurrent(value);
    }
  }, []);

  function applyClass(next: Theme) {
    const isDark =
      next === "dark" ||
      (next === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  }

  function handleSelect(next: Theme) {
    setCurrent(next);
    applyClass(next);
    startTransition(async () => {
      await setTheme(next);
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = mounted && current === opt.value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => handleSelect(opt.value)}
            disabled={pending}
            className={cn(
              "inline-flex items-center justify-center size-7 rounded-[5px] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
