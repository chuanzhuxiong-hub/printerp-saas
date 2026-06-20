export type MaintenanceState = {
  due: boolean;
  dateDue: boolean;
  hoursDue: boolean;
  hoursSinceMaintenance: number;
  remainingHours: number | null;
  daysRemaining: number | null;
};

export function getMaintenanceState(input: {
  totalRuntimeHours: number;
  lastMaintenanceHours: number;
  maintenanceIntervalHours: number;
  nextMaintenanceAt: Date | null;
  now?: Date;
}): MaintenanceState {
  const now = input.now ?? new Date();
  const hoursSinceMaintenance = Math.max(0, input.totalRuntimeHours - input.lastMaintenanceHours);
  const hoursDue = input.maintenanceIntervalHours > 0 && hoursSinceMaintenance >= input.maintenanceIntervalHours;
  const remainingHours = input.maintenanceIntervalHours > 0 ? Math.max(0, input.maintenanceIntervalHours - hoursSinceMaintenance) : null;
  const dateDue = Boolean(input.nextMaintenanceAt && input.nextMaintenanceAt.getTime() <= now.getTime());
  const daysRemaining = input.nextMaintenanceAt
    ? Math.ceil((input.nextMaintenanceAt.getTime() - now.getTime()) / 86400000)
    : null;
  return { due: hoursDue || dateDue, dateDue, hoursDue, hoursSinceMaintenance, remainingHours, daysRemaining };
}

export function nextMaintenanceDate(performedAt: Date, intervalDays: number) {
  if (intervalDays <= 0) return null;
  const next = new Date(performedAt);
  next.setDate(next.getDate() + intervalDays);
  return next;
}
