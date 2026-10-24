import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import { Card, CardHeader, EmptyState } from "../components/ui";

export function Activity() {
  const events = useLiveQuery(() => db.activityLog.orderBy("timestamp").reverse().limit(200).toArray(), [], undefined);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Activity History</h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          Who did what, when, and why — browser-local evidence for this demo, not a tamper-proof production audit log.
        </p>
      </div>

      <Card>
        <CardHeader title="Recent events" />
        {events && events.length > 0 ? (
          <ul className="divide-y divide-[var(--color-border)]">
            {events.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{e.description}</div>
                  <div className="text-xs text-[var(--color-ink-500)]">
                    {e.actor} · {e.entityType} #{e.entityId}
                  </div>
                </div>
                <div className="whitespace-nowrap text-xs text-[var(--color-ink-500)]">{new Date(e.timestamp).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No activity recorded yet" />
        )}
      </Card>
    </div>
  );
}
