import { cn } from "@/lib/utils";

/**
 * The AI brand mark for Talent Review. A four-point sparkle with a soft offset
 * pip — distinct from Lucide's Sparkles, owned by us, scales cleanly at 12–24px.
 * Always rendered in --color-ai unless overridden via className.
 */
export function AiGlyph({
  className,
  ...props
}: React.SVGAttributes<SVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={cn("text-[--color-ai]", className)}
      {...props}
    >
      {/* Main 4-point sparkle */}
      <path d="M12 2.5 c0.4 4.6 1.9 6.1 6.5 6.5 -4.6 0.4 -6.1 1.9 -6.5 6.5 -0.4 -4.6 -1.9 -6.1 -6.5 -6.5 4.6 -0.4 6.1 -1.9 6.5 -6.5z" />
      {/* Offset accent pip — bottom right */}
      <path d="M18 16 c0.15 1.7 0.65 2.2 2.35 2.35 -1.7 0.15 -2.2 0.65 -2.35 2.35 -0.15 -1.7 -0.65 -2.2 -2.35 -2.35 1.7 -0.15 2.2 -0.65 2.35 -2.35z" />
    </svg>
  );
}
