"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, History, Loader2 } from "lucide-react";
import { DataIO } from "@/components/data-io";
import { toast } from "sonner";
import { AiGlyph } from "@/components/ui/ai-glyph";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  QUINTILE_LABELS,
  QUINTILE_TARGET_PCT,
  calibrationBindingNote,
  quintileForRank,
  targetCountsForPopulation,
} from "@/lib/calibration";
import {
  acceptPlacements,
  moveSubject,
  suggestMoveRationale,
  suggestPlacementsForGrade,
} from "@/app/app/calibration/actions";

interface SubjectRow {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  grade: string;
  whatRating: string | null;
  howRating: string | null;
  reviewStatus: string;
  rankInGrade: number;
  rationale: string;
  source: string;
}

interface ScopeOption {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  isRoot: boolean;
}

interface ScopeProps {
  currentScopeId: string;
  currentScopeName: string;
  currentScopeIsRoot: boolean;
  options: ScopeOption[];
}

interface MoveLogEntry {
  id: string;
  createdAt: Date;
  subjectName: string;
  subjectGrade: string;
  fromRank: number | null;
  toRank: number;
  fromQuintile: number | null;
  toQuintile: number;
  rationale: string;
  source: string;
  movedByName: string;
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function initials(name: string | null, email: string) {
  const source = name ?? email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function ratingShort(r: string | null): string {
  if (r === "STAND_OUT") return "S";
  if (r === "ACHIEVER") return "A";
  if (r === "NEEDS_IMPROVEMENT") return "N";
  return "—";
}

export function CalibrationBoard({
  currentUser,
  period,
  gradesInOrder,
  rowsByGrade,
  recentMoves,
  scope,
}: {
  currentUser: { id: string; name: string | null; email: string; canManage: boolean };
  period: { id: string; name: string; endsAt: Date };
  gradesInOrder: string[];
  rowsByGrade: Record<string, SubjectRow[]>;
  recentMoves: MoveLogEntry[];
  scope: ScopeProps;
}) {
  const [activeGrade, setActiveGrade] = useState<string>(gradesInOrder[0] ?? "");
  const totalPeople = Object.values(rowsByGrade).flat().length;

  return (
    <div className="px-10 py-10 max-w-6xl mx-auto">
      <header className="space-y-4 mb-8">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight">
              Calibration
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {period.name} ·{" "}
              {scope.currentScopeIsRoot
                ? `Your whole org — ${totalPeople} people across ${gradesInOrder.length} ${gradesInOrder.length === 1 ? "grade" : "grades"}`
                : `${scope.currentScopeName}'s team — ${totalPeople} people across ${gradesInOrder.length} ${gradesInOrder.length === 1 ? "grade" : "grades"}`}
              .
            </p>
          </div>
          <div className="flex items-end gap-3 shrink-0">
            {currentUser.canManage && (
              <DataIO
                canManage
                exportUrl={
                  scope.currentScopeIsRoot
                    ? "/api/data/export"
                    : `/api/data/export?scope=${scope.currentScopeId}`
                }
              />
            )}
            <ScopePicker scope={scope} />
          </div>
        </div>
      </header>

      {gradesInOrder.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          No reports yet in this review period.
        </p>
      ) : (
        <>
          {/* Grade tabs */}
          <div
            role="tablist"
            className="flex items-center gap-1 mb-6 border-b border-border"
          >
            {gradesInOrder.map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={activeGrade === g}
                onClick={() => setActiveGrade(g)}
                className={cn(
                  "px-3 py-2 text-[13px] font-medium transition-colors duration-150 -mb-px border-b-2",
                  activeGrade === g
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Grade {g}
                <span className="ml-1.5 text-[11px] text-muted-foreground/70 tabular-nums">
                  {rowsByGrade[g]?.length ?? 0}
                </span>
              </button>
            ))}
          </div>

          {activeGrade && rowsByGrade[activeGrade] && (
            <GradeBoard
              key={activeGrade}
              periodId={period.id}
              grade={activeGrade}
              rows={rowsByGrade[activeGrade]}
            />
          )}
        </>
      )}

      <ActivityLog moves={recentMoves} />
    </div>
  );
}

function GradeBoard({
  periodId,
  grade,
  rows: initialRows,
}: {
  periodId: string;
  grade: string;
  rows: SubjectRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SubjectRow[]>(initialRows);
  const [pendingMove, setPendingMove] = useState<{
    subject: SubjectRow;
    fromRank: number;
    toRank: number;
    nextRows: SubjectRow[];
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [placementsModalOpen, setPlacementsModalOpen] = useState(false);

  // Reset local state if server data changes (period switch, etc.).
  // Must be useEffect — useMemo runs during render, and setState during render
  // triggers an extra render pass that shifts dnd-kit's internal aria-id
  // counter, producing a hydration mismatch on the sortable <li> elements.
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const n = rows.length;
  const targetCounts = useMemo(() => targetCountsForPopulation(n), [n]);
  const bindingNote = calibrationBindingNote(n);

  // Group rows by their derived quintile for the column display.
  const byQuintile: Record<number, SubjectRow[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const r of rows) {
    const q = quintileForRank(r.rankInGrade, n);
    byQuintile[q].push(r);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const fromIdx = rows.findIndex((r) => r.id === active.id);
    const toIdx = rows.findIndex((r) => r.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const nextRows = arrayMove(rows, fromIdx, toIdx).map((r, i) => ({
      ...r,
      rankInGrade: i + 1,
    }));

    setPendingMove({
      subject: rows[fromIdx],
      fromRank: fromIdx + 1,
      toRank: toIdx + 1,
      nextRows,
    });
  }

  function confirmMove(rationale: string, source: "AI" | "HUMAN") {
    if (!pendingMove) return;
    const { subject, toRank, nextRows } = pendingMove;
    setRows(nextRows); // optimistic
    startTransition(async () => {
      try {
        await moveSubject({
          reviewPeriodId: periodId,
          subjectId: subject.id,
          toRank,
          rationale,
          source,
          grade,
          gradePopulation: nextRows.length,
        });
        setPendingMove(null);
        router.refresh();
      } catch (e) {
        // revert
        setRows(rows);
        alert(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function cancelMove() {
    setPendingMove(null);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        {bindingNote ? (
          <div className="flex-1 rounded-md border border-dashed border-[--color-attention]/30 bg-[--color-attention]/[0.04] px-4 py-3">
            <p className="text-[13px] text-[--color-attention]">{bindingNote}</p>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground/80 self-center">
            Drag a card to a new position. Every move requires a rationale.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPlacementsModalOpen(true)}
          className="shrink-0 gap-1.5 border-[--color-ai]/30 text-[--color-ai] hover:bg-[--color-ai]/[0.04] hover:text-[--color-ai]"
        >
          <AiGlyph className="size-3" />
          Suggest placements
        </Button>
      </div>

      <DndContext
        id={`calibration-dnd-${grade}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((q) => (
              <QuintileColumn
                key={q}
                quintile={q}
                targetCount={targetCounts[q - 1]}
                targetPct={QUINTILE_TARGET_PCT[q - 1]}
                actualCount={byQuintile[q].length}
                rows={byQuintile[q]}
                totalPopulation={n}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {pendingMove && (
        <MoveRationaleModal
          periodId={periodId}
          subjectId={pendingMove.subject.id}
          subjectName={pendingMove.subject.name ?? pendingMove.subject.email}
          grade={grade}
          gradePopulation={pendingMove.nextRows.length}
          fromRank={pendingMove.fromRank}
          toRank={pendingMove.toRank}
          fromQuintile={quintileForRank(pendingMove.fromRank, pendingMove.nextRows.length)}
          toQuintile={quintileForRank(pendingMove.toRank, pendingMove.nextRows.length)}
          pending={pending}
          onCancel={cancelMove}
          onConfirm={confirmMove}
        />
      )}

      {placementsModalOpen && (
        <SuggestPlacementsModal
          periodId={periodId}
          grade={grade}
          currentRows={rows}
          onClose={() => setPlacementsModalOpen(false)}
          onSaved={() => {
            setPlacementsModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function QuintileColumn({
  quintile,
  targetCount,
  targetPct,
  actualCount,
  rows,
  totalPopulation,
}: {
  quintile: number;
  targetCount: number;
  targetPct: number;
  actualCount: number;
  rows: SubjectRow[];
  totalPopulation: number;
}) {
  const delta = actualCount - targetCount;
  const deltaLabel = delta === 0 ? "on target" : delta > 0 ? `+${delta} over` : `${delta} under`;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 min-h-[420px]">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {QUINTILE_LABELS[quintile]}
        </span>
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">
          {Math.round(targetPct * 100)}%
        </span>
      </div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[13px] font-medium tabular-nums">
          {actualCount}
          <span className="text-muted-foreground"> / {targetCount}</span>
        </span>
        {totalPopulation >= 5 && (
          <span
            className={cn(
              "text-[10px] tabular-nums",
              delta === 0 && "text-[--color-positive]",
              delta !== 0 && "text-muted-foreground"
            )}
          >
            {deltaLabel}
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {rows.map((r) => (
          <SubjectCard key={r.id} row={r} totalPopulation={totalPopulation} />
        ))}
        {rows.length === 0 && (
          <li className="text-[11px] text-muted-foreground/60 italic px-1 py-2">
            Empty
          </li>
        )}
      </ul>
    </div>
  );
}

function SubjectCard({
  row,
  totalPopulation,
}: {
  row: SubjectRow;
  totalPopulation: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-md bg-background border border-border cursor-grab active:cursor-grabbing",
        "hover:border-foreground/30 transition-colors duration-150",
        isDragging && "shadow-lg opacity-90"
      )}
    >
      <GripVertical className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground transition" />
      <div className="size-6 rounded-full bg-foreground/[0.07] flex items-center justify-center text-[10px] font-medium shrink-0">
        {initials(row.name, row.email)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate leading-tight">{row.name ?? row.email}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          #{row.rankInGrade} · W:{ratingShort(row.whatRating)} H:{ratingShort(row.howRating)}
        </p>
      </div>
    </li>
  );
}

function MoveRationaleModal({
  periodId,
  subjectId,
  subjectName,
  grade,
  gradePopulation,
  fromRank,
  toRank,
  fromQuintile,
  toQuintile,
  pending,
  onCancel,
  onConfirm,
}: {
  periodId: string;
  subjectId: string;
  subjectName: string;
  grade: string;
  gradePopulation: number;
  fromRank: number;
  toRank: number;
  fromQuintile: number;
  toQuintile: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (rationale: string, source: "AI" | "HUMAN") => void;
}) {
  const [rationale, setRationale] = useState("");
  // Tracks whether the current textarea content originated from AI. Heavy
  // edits won't change this — the rule is "AI proposed, human accepted."
  const [aiProposed, setAiProposed] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const direction = toRank > fromRank ? "down" : "up";

  async function handleSuggest() {
    setSuggesting(true);
    try {
      const result = await suggestMoveRationale({
        reviewPeriodId: periodId,
        subjectId,
        fromRank,
        toRank,
        grade,
        gradePopulation,
      });
      setRationale(result.rationale);
      setAiProposed(true);
      if (result.source === "mock") {
        toast.info("Showing a mock draft — set AI_API_KEY for evidence-grounded suggestions.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI suggestion failed");
    } finally {
      setSuggesting(false);
    }
  }

  function handleConfirm() {
    if (!rationale.trim()) return;
    onConfirm(rationale.trim(), aiProposed ? "AI" : "HUMAN");
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Why this move?</DialogTitle>
          <DialogDescription>
            Moving <span className="font-medium text-foreground">{subjectName}</span>{" "}
            {direction} from <span className="font-mono tabular-nums">#{fromRank} ({QUINTILE_LABELS[fromQuintile]})</span>{" "}
            to <span className="font-mono tabular-nums">#{toRank} ({QUINTILE_LABELS[toQuintile]})</span>. A rationale is required for every calibration move.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="move-rationale"
              className="text-[12px] font-medium text-muted-foreground"
            >
              Rationale
              {aiProposed && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[--color-ai] font-normal">
                  <AiGlyph className="size-2.5" />
                  AI-drafted
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting || pending}
              className="inline-flex items-center gap-1 text-[11px] text-[--color-ai] hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {suggesting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <AiGlyph className="size-3" />
              )}
              {suggesting ? "Drafting…" : "Suggest rationale"}
            </button>
          </div>
          <textarea
            id="move-rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={6}
            placeholder="Cite the specific evidence or pattern that justifies this calibration. Or click ‘Suggest rationale’ to start from an AI draft."
            autoFocus
            disabled={suggesting}
            className="w-full rounded-md border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-y disabled:opacity-60"
          />
          <p className="text-[11px] text-muted-foreground">
            {aiProposed
              ? "Review and edit if needed. You accept the rationale — even AI drafts require your sign-off."
              : "Humans always decide. AI can draft; you accept."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending || suggesting}>
            Cancel move
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending || suggesting || !rationale.trim()}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Accept and save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ProposedPlacement {
  subjectId: string;
  proposedRank: number;
  rationale: string;
}

function SuggestPlacementsModal({
  periodId,
  grade,
  currentRows,
  onClose,
  onSaved,
}: {
  periodId: string;
  grade: string;
  currentRows: SubjectRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<ProposedPlacement[]>([]);
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const subjectsById = useMemo(() => {
    const m = new Map<string, SubjectRow>();
    for (const r of currentRows) m.set(r.id, r);
    return m;
  }, [currentRows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await suggestPlacementsForGrade({
          reviewPeriodId: periodId,
          grade,
        });
        if (cancelled) return;
        const sortedPlacements = [...result.placements].sort(
          (a, b) => a.proposedRank - b.proposedRank
        );
        setProposed(sortedPlacements);
        // Default: include only the placements that would actually change a rank.
        const inc: Record<string, boolean> = {};
        for (const p of sortedPlacements) {
          const current = subjectsById.get(p.subjectId)?.rankInGrade;
          inc[p.subjectId] = current !== p.proposedRank;
        }
        setIncluded(inc);
        if (result.source === "mock") {
          toast.info(
            "Showing heuristic placements — set AI_API_KEY for evidence-grounded ranking."
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "AI suggestion failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeCount = proposed.filter(
    (p) =>
      included[p.subjectId] &&
      subjectsById.get(p.subjectId)?.rankInGrade !== p.proposedRank
  ).length;
  const includedCount = proposed.filter((p) => included[p.subjectId]).length;

  async function handleAccept() {
    setSaving(true);
    try {
      const placements = proposed
        .filter((p) => included[p.subjectId])
        .map((p) => ({
          subjectId: p.subjectId,
          proposedRank: p.proposedRank,
          rationale: (edited[p.subjectId] ?? p.rationale).trim(),
        }));
      const missing = placements.filter((p) => !p.rationale);
      if (missing.length > 0) {
        toast.error("Every accepted placement needs a rationale.");
        setSaving(false);
        return;
      }
      await acceptPlacements({
        reviewPeriodId: periodId,
        grade,
        placements,
      });
      toast.success(
        `Accepted ${placements.length} ${placements.length === 1 ? "placement" : "placements"}.`
      );
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save placements");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AiGlyph className="size-4 text-[--color-ai]" />
            Suggested placements · Grade {grade}
          </DialogTitle>
          <DialogDescription>
            AI proposes a full re-ranking for this grade based on ratings, evidence, and prior trajectory. Review each move, edit any rationale, then accept the ones you agree with. Humans decide; you sign off on every change.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <p className="text-[12px]">Drafting placements…</p>
              <p className="text-[11px] text-muted-foreground/70">
                Reading {currentRows.length} reviews + evidence timelines.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-[--color-attention]/30 bg-[--color-attention]/[0.04] px-4 py-3 text-[13px] text-[--color-attention]">
              {error}
            </div>
          )}

          {!loading && !error && proposed.length > 0 && (
            <ul className="divide-y divide-border/60">
              {proposed.map((p) => {
                const subject = subjectsById.get(p.subjectId);
                if (!subject) return null;
                const currentRank = subject.rankInGrade;
                const changed = currentRank !== p.proposedRank;
                const isIncluded = included[p.subjectId] ?? false;
                const rationaleVal = edited[p.subjectId] ?? p.rationale;
                return (
                  <li key={p.subjectId} className="py-3 first:pt-0">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={(e) =>
                          setIncluded((prev) => ({
                            ...prev,
                            [p.subjectId]: e.target.checked,
                          }))
                        }
                        className="mt-1 size-4 rounded border-border accent-foreground"
                        aria-label={`Include ${subject.name ?? subject.email}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1.5">
                          <p className="text-[13px] font-medium truncate">
                            {subject.name ?? subject.email}
                          </p>
                          <p className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                            {changed ? (
                              <>
                                #{currentRank} → <span className="font-medium text-foreground">#{p.proposedRank}</span>
                              </>
                            ) : (
                              <span>holds at #{currentRank}</span>
                            )}
                          </p>
                        </div>
                        {isIncluded ? (
                          <textarea
                            value={rationaleVal}
                            onChange={(e) =>
                              setEdited((prev) => ({
                                ...prev,
                                [p.subjectId]: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-[12px] leading-snug placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent resize-y"
                          />
                        ) : (
                          <p className="text-[12px] text-muted-foreground/70 line-clamp-2">
                            {rationaleVal}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && !error && proposed.length === 0 && (
            <p className="text-[13px] text-muted-foreground italic py-8 text-center">
              AI didn't return any placements.
            </p>
          )}
        </div>

        <div className="border-t pt-3 -mx-6 px-6 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            {!loading && !error && (
              <>
                <span className="tabular-nums">{includedCount}</span> selected ·{" "}
                <span className="tabular-nums">{changeCount}</span> would change rank
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleAccept}
              disabled={loading || !!error || saving || includedCount === 0}
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Accept {includedCount > 0 ? includedCount : ""}{" "}
              {includedCount === 1 ? "placement" : "placements"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScopePicker({ scope }: { scope: ScopeProps }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = e.target.value;
    startTransition(() => {
      const params = new URLSearchParams();
      // Only carry the param when scoping to a non-root user — keeps the URL
      // clean for the default view.
      const target = scope.options.find((o) => o.id === nextId);
      if (target && !target.isRoot) params.set("scope", nextId);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <label
        htmlFor="calibration-scope"
        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70"
      >
        Scope
      </label>
      <div className="relative">
        <select
          id="calibration-scope"
          value={scope.currentScopeId}
          onChange={handleChange}
          disabled={pending}
          aria-label="Calibration scope"
          className="appearance-none rounded-md border border-border bg-background pl-3 pr-9 py-1.5 text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 bg-[length:12px] bg-[right_10px_center] bg-no-repeat min-w-[220px]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
          }}
        >
          {scope.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.isRoot
                ? "Your whole org"
                : `${o.name ?? o.email}'s team${o.title ? ` (${o.title})` : ""}`}
            </option>
          ))}
        </select>
        {pending && (
          <Loader2 className="size-3.5 animate-spin absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

function ActivityLog({ moves }: { moves: MoveLogEntry[] }) {
  if (moves.length === 0) return null;
  return (
    <section aria-labelledby="log-label" className="mt-16 pt-8 border-t border-border/60">
      <div className="flex items-center gap-2 mb-4">
        <History className="size-4 text-muted-foreground" />
        <p
          id="log-label"
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
        >
          Recent moves
        </p>
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">
          {moves.length}
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {moves.map((m) => (
          <li key={m.id} className="py-3 flex items-start gap-3">
            <div className="text-[11px] text-muted-foreground tabular-nums w-24 shrink-0 pt-0.5">
              {DATE_FMT.format(m.createdAt)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px]">
                <span className="font-medium">{m.movedByName}</span>{" "}
                <span className="text-muted-foreground">
                  {m.fromRank == null
                    ? `placed ${m.subjectName} at #${m.toRank} (${QUINTILE_LABELS[m.toQuintile]})`
                    : `moved ${m.subjectName} from #${m.fromRank} (${m.fromQuintile != null ? QUINTILE_LABELS[m.fromQuintile] : "?"}) to #${m.toRank} (${QUINTILE_LABELS[m.toQuintile]})`}{" "}
                  · Grade {m.subjectGrade}
                </span>
                {m.source === "AI" && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[--color-ai]">
                    <AiGlyph className="size-2.5" />
                    AI rationale
                  </span>
                )}
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-[1.5]">
                {m.rationale}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
