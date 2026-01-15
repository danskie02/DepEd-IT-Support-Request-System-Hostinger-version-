import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: "pending" | "approved" | "denied" }) {
  const statusLower = status.toLowerCase() as "pending" | "approved" | "denied";

  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    denied: "bg-red-100 text-red-800 border-red-200",
  };

  const labels = {
    pending: "Pending",
    approved: "Approved",
    denied: "Denied",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
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
