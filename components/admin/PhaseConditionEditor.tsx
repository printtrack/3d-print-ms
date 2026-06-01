"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type OrderCondition,
  type PartCondition,
  type PartPhaseFlag,
} from "@/lib/phase-conditions";

// ──────────────────────────────────────────────────────────────
// ORDER CONDITION EDITOR
// ──────────────────────────────────────────────────────────────

const ORDER_TOGGLES: Array<{ type: OrderCondition["type"]; labelKey: string; flag?: PartPhaseFlag }> = [
  { type: "all_parts_in_phase_with_flag", labelKey: "phase_condition_all_parts_print_ready", flag: "isPrintReady" },
  { type: "all_parts_in_phase_with_flag", labelKey: "phase_condition_all_parts_printed", flag: "isPrinted" },
  { type: "all_parts_in_phase_with_flag", labelKey: "phase_condition_all_parts_misprint", flag: "isMisprint" },
  { type: "all_jobs_done", labelKey: "phase_condition_all_jobs_done" },
  { type: "quote_approved", labelKey: "phase_condition_quote_approved" },
  { type: "invoice_paid", labelKey: "phase_condition_invoice_paid" },
  { type: "verification_complete", labelKey: "phase_condition_verification_complete" },
  { type: "survey_submitted", labelKey: "phase_condition_survey_submitted" },
];

function matchesOrderCondition(c: OrderCondition, type: OrderCondition["type"], flag?: PartPhaseFlag) {
  if (c.type !== type) return false;
  if (c.type === "all_parts_in_phase_with_flag") return c.flag === flag;
  return true;
}

interface OrderEditorProps {
  value: OrderCondition[];
  onChange: (next: OrderCondition[]) => void;
  testidPrefix?: string;
}

export function OrderConditionEditor({ value, onChange, testidPrefix = "ocond" }: OrderEditorProps) {
  const t = useTranslations("admin");

  const toggle = (type: OrderCondition["type"], flag?: PartPhaseFlag) => {
    const exists = value.some((c) => matchesOrderCondition(c, type, flag));
    if (exists) {
      onChange(value.filter((c) => !matchesOrderCondition(c, type, flag)));
    } else {
      if (type === "all_parts_in_phase_with_flag" && flag) {
        onChange([...value, { type, flag }]);
      } else if (type !== "all_parts_in_phase_with_flag" && type !== "days_in_phase") {
        onChange([...value, { type } as OrderCondition]);
      }
    }
  };

  const daysCondition = value.find((c) => c.type === "days_in_phase") as
    | Extract<OrderCondition, { type: "days_in_phase" }>
    | undefined;

  const setDays = (days: number | null) => {
    const without = value.filter((c) => c.type !== "days_in_phase");
    if (days && days > 0) onChange([...without, { type: "days_in_phase", days }]);
    else onChange(without);
  };

  return (
    <div className="space-y-2">
      {ORDER_TOGGLES.map((tog, i) => {
        const checked = value.some((c) => matchesOrderCondition(c, tog.type, tog.flag));
        const id = `${testidPrefix}-${i}`;
        return (
          <label
            key={id}
            htmlFor={id}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-muted/40"
          >
            <input
              id={id}
              type="checkbox"
              checked={checked}
              onChange={() => toggle(tog.type, tog.flag)}
              className="h-4 w-4 accent-primary"
              data-testid={id}
            />
            <span>{t(tog.labelKey)}</span>
          </label>
        );
      })}
      <div className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm">
        <input
          id={`${testidPrefix}-days-toggle`}
          type="checkbox"
          checked={Boolean(daysCondition)}
          onChange={(e) => setDays(e.target.checked ? daysCondition?.days ?? 7 : null)}
          className="h-4 w-4 accent-primary"
        />
        <Label htmlFor={`${testidPrefix}-days-toggle`} className="flex-1 cursor-pointer">
          {t("phase_condition_days_in_phase", { days: daysCondition?.days ?? 7 })}
        </Label>
        {daysCondition && (
          <Input
            type="number"
            min={1}
            max={365}
            value={daysCondition.days}
            onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)}
            className="h-8 w-20 text-sm"
            data-testid={`${testidPrefix}-days-input`}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// PART CONDITION EDITOR
// ──────────────────────────────────────────────────────────────

const PART_TOGGLES: Array<{ type: PartCondition["type"]; labelKey: string }> = [
  { type: "part_all_jobs_done", labelKey: "phase_condition_part_all_jobs_done" },
  { type: "part_assigned_to_job", labelKey: "phase_condition_part_assigned_to_job" },
];

interface PartEditorProps {
  value: PartCondition[];
  onChange: (next: PartCondition[]) => void;
  testidPrefix?: string;
}

export function PartConditionEditor({ value, onChange, testidPrefix = "pcond" }: PartEditorProps) {
  const t = useTranslations("admin");

  const toggle = (type: PartCondition["type"]) => {
    const exists = value.some((c) => c.type === type);
    if (exists) onChange(value.filter((c) => c.type !== type));
    else if (type !== "part_days_in_phase") onChange([...value, { type } as PartCondition]);
  };

  const daysCondition = value.find((c) => c.type === "part_days_in_phase") as
    | Extract<PartCondition, { type: "part_days_in_phase" }>
    | undefined;

  const setDays = (days: number | null) => {
    const without = value.filter((c) => c.type !== "part_days_in_phase");
    if (days && days > 0) onChange([...without, { type: "part_days_in_phase", days }]);
    else onChange(without);
  };

  return (
    <div className="space-y-2">
      {PART_TOGGLES.map((tog, i) => {
        const id = `${testidPrefix}-${i}`;
        return (
          <label
            key={id}
            htmlFor={id}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-muted/40"
          >
            <input
              id={id}
              type="checkbox"
              checked={value.some((c) => c.type === tog.type)}
              onChange={() => toggle(tog.type)}
              className="h-4 w-4 accent-primary"
              data-testid={id}
            />
            <span>{t(tog.labelKey)}</span>
          </label>
        );
      })}
      <div className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm">
        <input
          id={`${testidPrefix}-days-toggle`}
          type="checkbox"
          checked={Boolean(daysCondition)}
          onChange={(e) => setDays(e.target.checked ? daysCondition?.days ?? 7 : null)}
          className="h-4 w-4 accent-primary"
        />
        <Label htmlFor={`${testidPrefix}-days-toggle`} className="flex-1 cursor-pointer">
          {t("phase_condition_part_days_in_phase", { days: daysCondition?.days ?? 7 })}
        </Label>
        {daysCondition && (
          <Input
            type="number"
            min={1}
            max={365}
            value={daysCondition.days}
            onChange={(e) => setDays(parseInt(e.target.value, 10) || 1)}
            className="h-8 w-20 text-sm"
            data-testid={`${testidPrefix}-days-input`}
          />
        )}
      </div>
    </div>
  );
}
