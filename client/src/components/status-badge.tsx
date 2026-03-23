import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: "pending" | "on_going" | "finished" }) {
  const statusLower = status.toLowerCase() as "pending" | "on_going" | "finished";

  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    on_going: "bg-blue-100 text-blue-800 border-blue-200",
    finished: "bg-green-100 text-green-800 border-green-200",
  };

  const labels = {
    pending: "Pending",
    on_going: "On-Going",
    finished: "Finished",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border whitespace-nowrap inline-flex items-center",
      styles[statusLower]
    )}>
      {labels[statusLower]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toLowerCase();
  const isUrgent = p === "urgent";
  const isHigh = p === "high";
  const isMedium = p === "medium";
  const isLow = p === "low";

  const getPriorityStyles = () => {
    if (isUrgent) return { text: "text-red-700", bg: "bg-red-600", border: "border-red-300" };
    if (isHigh) return { text: "text-red-600", bg: "bg-red-500", border: "border-red-200" };
    if (isMedium) return { text: "text-orange-600", bg: "bg-orange-500", border: "border-orange-200" };
    return { text: "text-blue-600", bg: "bg-blue-500", border: "border-blue-200" };
  };

  const styles = getPriorityStyles();

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-medium text-sm font-bold uppercase",
      styles.text
    )}>
      <span className={cn(
        "w-2 h-2 rounded-full",
        styles.bg,
        (isUrgent || isHigh) && "animate-pulse"
      )} />
      {priority}
    </span>
  );
}
