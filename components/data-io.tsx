"use client";

import { useRef, useState } from "react";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FilePlus2,
  PencilLine,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpdateRow {
  row: number;
  name: string;
  email: string;
  matchedBy: "Standard ID" | "Email" | "Name";
  changes: string[];
  reviewChanges: string[];
}

interface CreateRow {
  row: number;
  name: string;
  email: string;
  grade: string;
  title: string;
  managerName: string;
}

interface ImportSummary {
  totalRows: number;
  updates: UpdateRow[];
  creates: CreateRow[];
  skipped: number;
  errors: { row: number; message: string }[];
}

export function DataIO({
  canManage = true,
  exportUrl = "/api/data/export",
}: {
  canManage?: boolean;
  /** Override the export URL — used by Calibration to pass ?scope=<userId>. */
  exportUrl?: string;
} = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!canManage) {
    return (
      <p className="text-[11px] text-muted-foreground/70 italic">
        Upload &amp; download are available to managers only.
      </p>
    );
  }

  function pickFile() {
    inputRef.current?.click();
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    setSummary(null);
    setError(null);
    setOpen(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/data/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        setError(body.error ?? `Upload failed with status ${res.status}`);
        return;
      }
      const data = (await res.json()) as ImportSummary;
      setSummary(data);

      const trueUpdates = data.updates.filter(
        (u) => u.changes.length > 0 || u.reviewChanges.length > 0
      ).length;
      const quietDupes = data.updates.length - trueUpdates;
      const parts: string[] = [];
      if (data.creates.length > 0)
        parts.push(`${data.creates.length} new`);
      if (trueUpdates > 0) parts.push(`${trueUpdates} updated`);
      if (quietDupes > 0)
        parts.push(`${quietDupes} duplicate${quietDupes === 1 ? "" : "s"} (no changes)`);
      if (data.errors.length > 0)
        parts.push(`${data.errors.length} error${data.errors.length === 1 ? "" : "s"}`);
      const msg = parts.length > 0 ? parts.join(" · ") : "Nothing changed.";
      if (data.errors.length > 0) toast.warning(msg);
      else toast.success(msg);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setUploading(false);
    }
  }

  const trueUpdates =
    summary?.updates.filter(
      (u) => u.changes.length > 0 || u.reviewChanges.length > 0
    ) ?? [];
  const quietDupes =
    summary?.updates.filter(
      (u) => u.changes.length === 0 && u.reviewChanges.length === 0
    ) ?? [];

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="/api/data/sample"
          download
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Download a small workbook with sample updates + new employees"
        >
          Sample file
        </a>
        <a
          href={exportUrl}
          download
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[13px] font-medium hover:bg-muted/60 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download className="size-3.5" />
          Download
        </a>
        <Button
          type="button"
          variant="outline"
          onClick={pickFile}
          disabled={uploading}
          className="gap-1.5"
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={handleFileChosen}
        />
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && !uploading && setOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import results</DialogTitle>
            <DialogDescription>
              {uploading
                ? "Parsing your file and updating the database…"
                : summary
                  ? `${summary.totalRows} row${summary.totalRows === 1 ? "" : "s"} processed.`
                  : "Here's what happened."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 space-y-4">
            {uploading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && !uploading && (
              <div className="flex items-start gap-3 rounded-md border border-[--color-attention]/30 bg-[--color-attention]/[0.04] p-3">
                <AlertCircle className="size-4 text-[--color-attention] mt-0.5 shrink-0" />
                <p className="text-[13px] text-[--color-attention]">{error}</p>
              </div>
            )}

            {summary && !uploading && (
              <>
                <CountStrip
                  newCount={summary.creates.length}
                  updatedCount={trueUpdates.length}
                  dupCount={quietDupes.length}
                  errorCount={summary.errors.length}
                  skipped={summary.skipped}
                />

                {summary.creates.length > 0 && (
                  <Section
                    icon={FilePlus2}
                    title="New employees added"
                    count={summary.creates.length}
                    iconClass="text-[--color-positive]"
                  >
                    <ul className="space-y-1.5">
                      {summary.creates.map((c) => (
                        <li
                          key={c.row}
                          className="rounded-md border border-border bg-background px-3 py-2 text-[12px]"
                        >
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <p className="font-medium text-[13px]">{c.name}</p>
                            <span className="font-mono tabular-nums text-[10px] text-muted-foreground">
                              Row {c.row}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            {c.email} · Grade {c.grade}
                            {c.title ? ` · ${c.title}` : ""} · reports to {c.managerName}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {trueUpdates.length > 0 && (
                  <Section
                    icon={PencilLine}
                    title="Duplicates updated"
                    count={trueUpdates.length}
                    iconClass="text-foreground"
                  >
                    <ul className="space-y-1.5">
                      {trueUpdates.map((u) => (
                        <li
                          key={u.row}
                          className="rounded-md border border-border bg-background px-3 py-2 text-[12px]"
                        >
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <p className="font-medium text-[13px]">{u.name}</p>
                            <span className="font-mono tabular-nums text-[10px] text-muted-foreground">
                              Row {u.row} · matched by {u.matchedBy}
                            </span>
                          </div>
                          <ul className="space-y-0.5 text-muted-foreground">
                            {u.changes.map((c, i) => (
                              <li key={`c${i}`}>
                                <span className="text-foreground/80">·</span> {c}
                              </li>
                            ))}
                            {u.reviewChanges.map((c, i) => (
                              <li key={`r${i}`}>
                                <span className="text-foreground/80">·</span> {c}{" "}
                                <span className="text-muted-foreground/60">(review)</span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {quietDupes.length > 0 && (
                  <Section
                    icon={CheckCircle2}
                    title="Already up to date"
                    count={quietDupes.length}
                    iconClass="text-muted-foreground"
                  >
                    <p className="text-[12px] text-muted-foreground">
                      {quietDupes.length === 1 ? "This row" : "These rows"}{" "}
                      matched an existing employee but had no new values to apply:{" "}
                      {quietDupes.slice(0, 8).map((d, i) => (
                        <span key={d.row}>
                          {i > 0 ? ", " : ""}
                          <span className="text-foreground/80">{d.name}</span>
                        </span>
                      ))}
                      {quietDupes.length > 8
                        ? `, and ${quietDupes.length - 8} more`
                        : ""}
                      .
                    </p>
                  </Section>
                )}

                {summary.errors.length > 0 && (
                  <Section
                    icon={AlertCircle}
                    title="Errors"
                    count={summary.errors.length}
                    iconClass="text-[--color-attention]"
                  >
                    <ul className="space-y-1 rounded-md border border-[--color-attention]/30 bg-[--color-attention]/[0.04] p-3 max-h-40 overflow-y-auto">
                      {summary.errors.map((err, i) => (
                        <li
                          key={i}
                          className="text-[12px] text-[--color-attention] leading-snug"
                        >
                          <span className="font-mono tabular-nums">
                            Row {err.row}:
                          </span>{" "}
                          {err.message}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {summary.skipped > 0 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    {summary.skipped} blank{" "}
                    {summary.skipped === 1 ? "row was" : "rows were"} skipped.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)} disabled={uploading}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CountStrip({
  newCount,
  updatedCount,
  dupCount,
  errorCount,
  skipped,
}: {
  newCount: number;
  updatedCount: number;
  dupCount: number;
  errorCount: number;
  skipped: number;
}) {
  void skipped;
  return (
    <div className="grid grid-cols-4 gap-2">
      <Stat label="New" value={newCount} tone="positive" />
      <Stat label="Updated" value={updatedCount} tone="foreground" />
      <Stat label="No change" value={dupCount} tone="muted" />
      <Stat label="Errors" value={errorCount} tone="attention" />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "foreground" | "muted" | "attention";
}) {
  const color =
    tone === "positive"
      ? "text-[--color-positive]"
      : tone === "attention"
        ? "text-[--color-attention]"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-center">
      <p className={`text-[18px] font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80 font-medium mt-0.5">
        {label}
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  iconClass,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`size-3.5 ${iconClass}`} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </p>
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}
