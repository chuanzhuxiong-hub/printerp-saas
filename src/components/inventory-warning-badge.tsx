import { StatusBadge } from "@/components/status-badge";

export function InventoryWarningBadge({
  quantity,
  threshold
}: {
  quantity: number;
  threshold?: number | null;
}) {
  if (threshold == null) {
    return <StatusBadge tone="neutral">未设置警戒线</StatusBadge>;
  }

  if (quantity <= threshold) {
    return <StatusBadge tone="warning">库存预警</StatusBadge>;
  }

  return <StatusBadge tone="success">库存正常</StatusBadge>;
}
