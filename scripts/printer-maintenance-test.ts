import { strict as assert } from "node:assert";
import { getMaintenanceState, nextMaintenanceDate } from "../src/lib/printer-maintenance";

const now = new Date("2026-06-10T00:00:00Z");
const hoursDue = getMaintenanceState({
  totalRuntimeHours: 550,
  lastMaintenanceHours: 20,
  maintenanceIntervalHours: 500,
  nextMaintenanceAt: new Date("2026-07-01T00:00:00Z"),
  now
});
assert.equal(hoursDue.due, true);
assert.equal(hoursDue.hoursDue, true);
assert.equal(hoursDue.dateDue, false);
assert.equal(hoursDue.hoursSinceMaintenance, 530);

const dateDue = getMaintenanceState({
  totalRuntimeHours: 100,
  lastMaintenanceHours: 50,
  maintenanceIntervalHours: 500,
  nextMaintenanceAt: new Date("2026-06-01T00:00:00Z"),
  now
});
assert.equal(dateDue.due, true);
assert.equal(dateDue.dateDue, true);
assert.equal(dateDue.hoursDue, false);

assert.equal(nextMaintenanceDate(new Date("2026-06-10T00:00:00Z"), 30)?.toISOString(), "2026-07-10T00:00:00.000Z");
assert.equal(nextMaintenanceDate(now, 0), null);

console.log("Printer maintenance rules passed: 9 checks");
