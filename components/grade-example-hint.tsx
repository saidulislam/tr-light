"use client";

import { Info } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  effectiveBlastRadius,
  gradeExample,
  type Dimension,
} from "@/lib/grade-examples";

export function GradeExampleHint({
  grade,
  blastRadiusOverride,
  dimension,
}: {
  grade: string | null;
  blastRadiusOverride?: string | null;
  dimension: Dimension;
}) {
  const { meta, example } = gradeExample(grade, dimension);
  const scope = effectiveBlastRadius(grade, blastRadiusOverride ?? null);
  const dimensionLabel = dimension === "WHAT" ? "What" : "How";

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            aria-label={`Example ${dimensionLabel} write-up for this grade`}
            className="inline-flex items-center text-muted-foreground/60 hover:text-foreground transition-colors"
          />
        }
      >
        <Info className="size-4" />
      </HoverCardTrigger>
      <HoverCardContent className="w-96 p-4 space-y-2.5" align="start">
        <div className="space-y-0.5">
          <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Example {dimensionLabel} write-up
          </p>
          {meta ? (
            <p className="text-sm font-medium">
              Grade {meta.grade} · {meta.title}
              {scope.value && (
                <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                  Effective scope: {scope.value}
                  {scope.source === "override" && (
                    <span className="text-muted-foreground/70"> (custom)</span>
                  )}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              No grade set — generic guidance
            </p>
          )}
        </div>
        <p className="text-sm leading-relaxed">{example}</p>
      </HoverCardContent>
    </HoverCard>
  );
}
