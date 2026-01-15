import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: "pending" | "approved" | "denied" }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    denied: "bg-red-100 text-red-800 border-red-200",
  };

  const labels = {
    pending: "Pending Review",
    approved: "Approved",
    denied: "Denied",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
      styles[status]
    )}>
      {labels[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toLowerCase();
  const isHigh = p === "high" || p === "urgent";
  const isMedium = p === "medium";
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-medium text-sm",
      isHigh ? "text-red-600" : isMedium ? "text-orange-500" : "text-blue-600"
    )}>
      <span className={cn(
        "w-2 h-2 rounded-full",
        isHigh ? "bg-red-600 animate-pulse" : isMedium ? "bg-orange-500" : "bg-blue-600"
      )} />
      {priority}
    </span>
  );
}
