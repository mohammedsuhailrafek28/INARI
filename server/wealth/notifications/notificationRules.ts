import type { WealthEvent } from "../events";
import type { Notification, NotificationCategory, NotificationPriority } from "./types";
import { notificationUserKey } from "./inMemoryNotificationStore";

const createNotificationId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const categoryRoute: Record<NotificationCategory, string> = {
  advisor: "/avatar",
  goal: "/goals",
  recommendation: "/recommendations",
  risk: "/dashboard",
  alert: "/dashboard",
  prediction: "/dashboard",
  system: "/dashboard",
};

const categoryAction: Record<NotificationCategory, string> = {
  advisor: "Open advisor",
  goal: "Review goal",
  recommendation: "Review recommendation",
  risk: "Review risk",
  alert: "Review alert",
  prediction: "View forecast",
  system: "View dashboard",
};

const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

function makeNotification(
  event: WealthEvent,
  input: {
    priority: NotificationPriority;
    title?: string;
    message?: string;
    actionLabel?: string;
    actionRoute?: string;
    dedupeKey: string;
    expiresInDays?: number;
  }
): Notification {
  const category = event.category === "profile" ? "system" : event.category;
  return {
    id: createNotificationId(),
    userId: notificationUserKey(event.userId),
    category,
    priority: input.priority,
    status: "unread",
    title: input.title ?? event.title,
    message: input.message ?? event.description,
    actionLabel: input.actionLabel ?? categoryAction[category],
    actionRoute: input.actionRoute ?? categoryRoute[category],
    relatedEventId: event.id,
    relatedMetric:
      typeof event.metadata.relatedMetric === "string"
        ? event.metadata.relatedMetric
        : typeof event.payload.relatedMetric === "string"
          ? event.payload.relatedMetric
          : null,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresInDays ? plusDays(input.expiresInDays) : null,
    metadata: {
      dedupeKey: input.dedupeKey,
      eventType: event.type,
      eventSeverity: event.severity,
    },
  };
}

export function buildNotificationsForEvent(event: WealthEvent): Notification[] {
  switch (event.type) {
    case "alert.generated":
      return [
        makeNotification(event, {
          priority: event.severity === "critical" ? "urgent" : "high",
          title: event.title,
          message: event.description,
          dedupeKey: `alert:${event.payload.type ?? event.title}`,
          expiresInDays: 14,
        }),
      ];

    case "risk.profileChanged":
      if (event.severity === "info") return [];
      return [
        makeNotification(event, {
          priority: event.severity === "critical" ? "high" : "medium",
          dedupeKey: `risk:${event.payload.profile ?? "profile"}`,
          expiresInDays: 30,
        }),
      ];

    case "goal.forecastGenerated":
      if (!["warning", "critical"].includes(event.severity)) return [];
      return [
        makeNotification(event, {
          priority: "medium",
          dedupeKey: `goal:${event.payload.goalId ?? event.title}`,
          expiresInDays: 21,
        }),
      ];

    case "prediction.bundleGenerated":
      if (event.payload.healthDirection !== "declining") return [];
      return [
        makeNotification(event, {
          priority: "medium",
          title: "Financial outlook needs attention",
          message: event.description,
          dedupeKey: "prediction:declining-health",
          expiresInDays: 7,
        }),
      ];

    case "recommendation.generated":
      if (event.severity !== "warning") return [];
      return [
        makeNotification(event, {
          priority: "medium",
          dedupeKey: `recommendation:${event.payload.category ?? event.title}`,
          expiresInDays: 14,
        }),
      ];

    case "advisor.answerGenerated":
      if (event.severity !== "warning") return [];
      return [
        makeNotification(event, {
          priority: "low",
          title: "Advisor answer may need review",
          dedupeKey: "advisor:low-confidence-answer",
          expiresInDays: 3,
        }),
      ];

    case "system.demoModeUsed":
      return [
        makeNotification(event, {
          priority: "low",
          title: "Demo data is active",
          message: "INARI is using local demo data for this session.",
          dedupeKey: "system:demo-mode",
          expiresInDays: 1,
        }),
      ];

    default:
      return [];
  }
}
