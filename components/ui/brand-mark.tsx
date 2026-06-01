import { cn } from "@/lib/utils";

/**
 * Talent Review brand mark — two stacked, slightly offset rounded squares
 * suggesting a record of records. Single color, scales 16–32px.
 */
export function BrandMark({
  className,
  ...props
}: React.SVGAttributes<SVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("text-foreground", className)}
      {...props}
    >
      {/* Back card */}
      <rect
        x="3"
        y="6"
        width="14"
        height="14"
        rx="3"
        className="fill-current opacity-30"
      />
      {/* Front card */}
      <rect
        x="7"
        y="4"
        width="14"
        height="14"
        rx="3"
        className="fill-current"
      />
      {/* Subtle highlight line on front card */}
      <line
        x1="10"
        y1="9"
        x2="18"
        y2="9"
        className="stroke-background"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="12"
        x2="15"
        y2="12"
        className="stroke-background"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
