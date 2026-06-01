"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
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
import { createReviewPeriod } from "@/app/app/review-periods/actions";

const CADENCES = [
  { value: "AD_HOC", label: "Ad hoc" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMIANNUAL", label: "Every six months" },
  { value: "ANNUAL", label: "Once a year" },
];

const STATUSES = [
  { value: "DRAFT", label: "Draft (not yet open)" },
  { value: "OPEN", label: "Open (active)" },
  { value: "CLOSED", label: "Closed (read-only)" },
];

interface Props {
  label?: string;
  variant?: "default" | "outline";
}

export function NewPeriodDialog({ label = "New review period", variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createReviewPeriod(formData);
        toast.success("Review period created.");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create period.");
      }
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && !pending && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New review period</DialogTitle>
            <DialogDescription>
              Define when the next review window opens. Cadence is informational —
              the system doesn't auto-create future periods yet.
            </DialogDescription>
          </DialogHeader>

          <form action={handleSubmit} className="space-y-4">
            <Field label="Name" hint="What people will see in their inbox.">
              <input
                name="name"
                required
                placeholder="e.g. H2 2026 Performance Review"
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </Field>

            <Field label="Cadence">
              <NativeSelect name="cadence" defaultValue="QUARTERLY">
                {CADENCES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <input
                  type="date"
                  name="startsAt"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  name="endsAt"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </Field>
            </div>

            <Field label="Status">
              <NativeSelect name="status" defaultValue="DRAFT">
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NativeSelect({
  name,
  defaultValue,
  children,
}: {
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="w-full appearance-none rounded-md border border-border bg-background px-3 py-2 pr-9 text-[14px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-[length:12px] bg-[right_10px_center] bg-no-repeat"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
      }}
    >
      {children}
    </select>
  );
}
