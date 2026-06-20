import { StatusBadge } from "@/components/status-badge";

export function ProfitBadge({ value }: { value: number }) {
  if (value < 0) {
    return <StatusBadge tone="danger">亏损</StatusBadge>;
  }

  if (value === 0) {
    return <StatusBadge tone="neutral">持平</StatusBadge>;
  }

  return <StatusBadge tone="success">盈利</StatusBadge>;
}
