import type { Priority } from "@/lib/database.types";

const labels: Record<Priority, string> = {
  normal: "Обычное",
  important: "Важное",
  critical: "Критично"
};

const styles: Record<Priority, string> = {
  normal: "border-line bg-white text-steel",
  important: "border-amber/40 bg-amber/10 text-amber",
  critical: "border-coral/40 bg-coral/10 text-coral"
};

export function StatusPill({ priority }: { priority: Priority }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${styles[priority]}`}>{labels[priority]}</span>;
}
