"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  updateSubjectProfile,
  type SubjectProfilePatch,
} from "@/app/app/reviews/[id]/actions";

type Rating = "STAND_OUT" | "ACHIEVER" | "NEEDS_IMPROVEMENT";

const RATING_OPTIONS: { value: Rating; label: string }[] = [
  { value: "NEEDS_IMPROVEMENT", label: "Needs Improvement" },
  { value: "ACHIEVER", label: "Achiever" },
  { value: "STAND_OUT", label: "Stand Out" },
];

interface PersonInitial {
  name: string | null;
  jobFamily: string | null;
  grade: string | null;
  gradeLevel: string | null;
  tenureYears: number | null;
  city: string | null;
  country: string | null;
}

export function EditPersonModal({
  subjectId,
  open,
  onOpenChange,
  initial,
}: {
  subjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: PersonInitial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [jobFamily, setJobFamily] = useState(initial.jobFamily ?? "");
  const [grade, setGrade] = useState(initial.grade ?? "");
  const [gradeLevel, setGradeLevel] = useState(initial.gradeLevel ?? "");
  const [tenureYears, setTenureYears] = useState(
    initial.tenureYears != null ? String(initial.tenureYears) : ""
  );
  const [city, setCity] = useState(initial.city ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const tenure = tenureYears.trim() === "" ? null : Number(tenureYears);
    if (tenure != null && (Number.isNaN(tenure) || tenure < 0)) {
      setError("Tenure must be a non-negative number.");
      return;
    }
    startTransition(async () => {
      try {
        await updateSubjectProfile(subjectId, {
          name: name.trim() || null,
          jobFamily: jobFamily.trim() || null,
          grade: grade.trim() || null,
          gradeLevel: gradeLevel.trim() || null,
          tenureYears: tenure,
          city: city.trim() || null,
          country: country.trim() || null,
        });
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            HR fields. Edits update this person's record, not just this review.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Job family">
            <Input value={jobFamily} onChange={(e) => setJobFamily(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grade">
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 602" />
            </Field>
            <Field label="Grade level">
              <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="e.g. 602.1" />
            </Field>
          </div>
          <Field label="Tenure (years)">
            <Input
              type="number"
              step="0.1"
              min="0"
              value={tenureYears}
              onChange={(e) => setTenureYears(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Country">
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type FieldKind = "rating" | "number" | "percent";

export function EditFieldModal({
  subjectId,
  open,
  onOpenChange,
  field,
  title,
  description,
  kind,
  defaultValue,
}: {
  subjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: keyof SubjectProfilePatch;
  title: string;
  description?: string;
  kind: FieldKind;
  defaultValue: string | number | null;
}) {
  const router = useRouter();
  const [strValue, setStrValue] = useState(
    defaultValue != null ? String(defaultValue) : ""
  );
  const [ratingValue, setRatingValue] = useState<Rating | null>(
    kind === "rating" ? (defaultValue as Rating | null) ?? null : null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    let parsed: SubjectProfilePatch;

    if (kind === "rating") {
      parsed = { [field]: ratingValue ?? null } as SubjectProfilePatch;
    } else {
      if (strValue.trim() === "") {
        parsed = { [field]: null } as SubjectProfilePatch;
      } else {
        const n = Number(strValue);
        if (Number.isNaN(n)) {
          setError("Must be a number.");
          return;
        }
        if (kind === "percent" && (n < 0 || n > 100)) {
          setError("Must be between 0 and 100.");
          return;
        }
        if (kind === "number" && n < 0) {
          setError("Must be 0 or greater.");
          return;
        }
        parsed = { [field]: n } as SubjectProfilePatch;
      }
    }

    startTransition(async () => {
      try {
        await updateSubjectProfile(subjectId, parsed);
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {kind === "rating" ? (
          <div className="flex flex-wrap gap-2">
            {RATING_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRatingValue(r.value)}
                className={cn(
                  "px-3.5 py-1.5 rounded-md border bg-background text-sm transition-colors",
                  "hover:bg-muted/50",
                  ratingValue === r.value &&
                    "bg-foreground text-background border-foreground hover:bg-foreground/90"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        ) : (
          <Field label={kind === "percent" ? "Value (0–100)" : "Value"}>
            <Input
              type="number"
              step={kind === "percent" ? "0.1" : "1"}
              min="0"
              max={kind === "percent" ? "100" : undefined}
              value={strValue}
              onChange={(e) => setStrValue(e.target.value)}
              autoFocus
            />
          </Field>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

interface ContextInitial {
  priorRating2024: string | null;
  priorRating2025: string | null;
  codeContributions: number | null;
  aiUsagePercent: number | null;
}

export function EditContextModal({
  subjectId,
  open,
  onOpenChange,
  initial,
}: {
  subjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ContextInitial;
}) {
  const router = useRouter();
  const [r2024, setR2024] = useState<Rating | null>(
    (initial.priorRating2024 as Rating | null) ?? null
  );
  const [r2025, setR2025] = useState<Rating | null>(
    (initial.priorRating2025 as Rating | null) ?? null
  );
  const [code, setCode] = useState(
    initial.codeContributions != null ? String(initial.codeContributions) : ""
  );
  const [ai, setAi] = useState(
    initial.aiUsagePercent != null ? String(initial.aiUsagePercent) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function parseNumber(
    raw: string,
    opts: { allowEmpty: true; min?: number; max?: number; label: string }
  ): number | null | { error: string } {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    if (Number.isNaN(n)) return { error: `${opts.label} must be a number.` };
    if (opts.min != null && n < opts.min)
      return { error: `${opts.label} must be ≥ ${opts.min}.` };
    if (opts.max != null && n > opts.max)
      return { error: `${opts.label} must be ≤ ${opts.max}.` };
    return n;
  }

  function handleSave() {
    setError(null);

    const codeParsed = parseNumber(code, {
      allowEmpty: true,
      min: 0,
      label: "Code contributions",
    });
    if (codeParsed != null && typeof codeParsed === "object") {
      setError(codeParsed.error);
      return;
    }
    const aiParsed = parseNumber(ai, {
      allowEmpty: true,
      min: 0,
      max: 100,
      label: "AI usage",
    });
    if (aiParsed != null && typeof aiParsed === "object") {
      setError(aiParsed.error);
      return;
    }

    startTransition(async () => {
      try {
        await updateSubjectProfile(subjectId, {
          priorRating2024: r2024,
          priorRating2025: r2025,
          codeContributions: codeParsed as number | null,
          aiUsagePercent: aiParsed as number | null,
        });
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  function RatingPicker({
    value,
    onChange,
  }: {
    value: Rating | null;
    onChange: (r: Rating | null) => void;
  }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {RATING_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange(value === r.value ? null : r.value)}
            className={cn(
              "px-3 py-1.5 rounded-md border bg-background text-sm transition-colors",
              "hover:bg-muted/50",
              value === r.value &&
                "bg-foreground text-background border-foreground hover:bg-foreground/90"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit performance context</DialogTitle>
          <DialogDescription>
            Prior ratings and system metrics. Used as reference when rating.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="2024 rating">
            <RatingPicker value={r2024} onChange={setR2024} />
          </Field>
          <Field label="2025 rating">
            <RatingPicker value={r2025} onChange={setR2025} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code contributions">
              <Input
                type="number"
                min="0"
                step="1"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 220"
              />
            </Field>
            <Field label="AI usage (0–100%)">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={ai}
                onChange={(e) => setAi(e.target.value)}
                placeholder="e.g. 75"
              />
            </Field>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
