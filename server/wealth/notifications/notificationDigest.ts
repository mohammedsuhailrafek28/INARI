import type { WealthEvent } from "../events";
import type { Notification, NotificationDigest } from "./types";

export function buildNotificationDigest(
  notifications: Notification[],
  events: WealthEvent[] = []
): NotificationDigest {
  const active = notifications.filter((notification) => notification.status !== "dismissed");
  const unread = active.filter((notification) => notification.status === "unread");
  const highPriority = active.filter((notification) =>
    notification.priority === "high" || notification.priority === "urgent"
  );
  const topRisks = active
    .filter((notification) => notification.category === "risk" || notification.category === "alert")
    .slice(0, 3)
    .map((notification) => notification.title);
  const topOpportunities = active
    .filter((notification) => notification.category === "recommendation" || notification.category === "prediction")
    .slice(0, 3)
    .map((notification) => notification.title);
  const latestFocus =
    highPriority[0]?.message ||
    active[0]?.message ||
    events.find((event) => event.category === "prediction")?.description ||
    "Keep reviewing your INARI dashboard weekly.";

  return {
    title: "Weekly INARI Digest",
    summary:
      active.length === 0
        ? "No active notifications yet. Keep using INARI to build your activity trail."
        : `${active.length} active notification${active.length === 1 ? "" : "s"}, including ${highPriority.length} high-priority item${highPriority.length === 1 ? "" : "s"}.`,
    highPriorityCount: highPriority.length,
    unreadCount: unread.length,
    topRisks,
    topOpportunities,
    recommendedFocus: latestFocus,
    generatedAt: new Date().toISOString(),
  };
}
