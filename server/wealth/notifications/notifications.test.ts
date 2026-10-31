import { describe, expect, it } from "vitest";
import { createAlertGeneratedEvent, createSystemDemoModeUsedEvent, publishEventSafely } from "../events";
import { buildNotificationDigest } from "./notificationDigest";
import { processEventForNotifications } from "./notificationEngine";
import { buildNotificationsForEvent } from "./notificationRules";
import { InMemoryNotificationStore } from "./inMemoryNotificationStore";
import type { Notification } from "./types";

const userId = "notification-test-user";

function createNotification(index: number, status: Notification["status"] = "unread"): Notification {
  return {
    id: `notification-${index}`,
    userId,
    category: "alert",
    priority: index % 2 === 0 ? "high" : "medium",
    status,
    title: `Notification ${index}`,
    message: `Message ${index}`,
    actionLabel: "Review",
    actionRoute: "/dashboard",
    relatedEventId: `event-${index}`,
    relatedMetric: "testMetric",
    createdAt: new Date(Date.now() + index).toISOString(),
    expiresAt: null,
    metadata: { dedupeKey: `notification:${index}` },
  };
}

function highAlertEvent() {
  return createAlertGeneratedEvent(userId, {
    id: "alert-1",
    type: "emergencyFund",
    severity: "high",
    title: "Emergency fund low",
    message: "Emergency fund needs attention.",
    suggestedAction: "Rebuild emergency fund.",
    relatedMetric: "emergencyFundBalance",
  });
}

describe("in-memory notification store", () => {
  it("adds notifications and counts unread items", async () => {
    const store = new InMemoryNotificationStore();
    await store.addNotification(createNotification(1));

    expect(await store.getUnreadCount(userId)).toBe(1);
    expect(await store.getNotifications(userId)).toHaveLength(1);
  });

  it("marks one and all notifications read", async () => {
    const store = new InMemoryNotificationStore();
    await store.addNotifications([createNotification(1), createNotification(2)]);

    await store.markRead(userId, "notification-1");
    expect(await store.getUnreadCount(userId)).toBe(1);

    await store.markAllRead(userId);
    expect(await store.getUnreadCount(userId)).toBe(0);
  });

  it("dismisses and clears notifications", async () => {
    const store = new InMemoryNotificationStore();
    await store.addNotifications([createNotification(1), createNotification(2)]);

    await store.dismiss(userId, "notification-1");
    const dismissed = await store.getNotifications(userId, { status: "dismissed" });
    expect(dismissed).toHaveLength(1);

    await store.clearNotifications(userId);
    await expect(store.getNotifications(userId)).resolves.toEqual([]);
  });

  it("keeps newest-first rolling limit of 100", async () => {
    const store = new InMemoryNotificationStore();
    for (let i = 0; i < 105; i++) {
      await store.addNotification(createNotification(i));
    }

    const notifications = await store.getNotifications(userId, { limit: 150 });
    expect(notifications).toHaveLength(100);
    expect(notifications[0]?.id).toBe("notification-104");
    expect(notifications.at(-1)?.id).toBe("notification-5");
  });

  it("deduplicates similar notifications by dedupe key", async () => {
    const store = new InMemoryNotificationStore();
    await store.addNotification(createNotification(1));
    await store.addNotification({ ...createNotification(2), metadata: { dedupeKey: "notification:1" } });

    const notifications = await store.getNotifications(userId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.id).toBe("notification-2");
  });
});

describe("notification rules and digest", () => {
  it("converts high alert events into high-priority notifications", () => {
    const notifications = buildNotificationsForEvent(highAlertEvent());

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      priority: "urgent",
      category: "alert",
      title: "Emergency fund low",
      actionRoute: "/dashboard",
    });
  });

  it("avoids low-value advisor and risk spam", () => {
    const demoNotifications = buildNotificationsForEvent(createSystemDemoModeUsedEvent(userId));
    const questionNotifications = buildNotificationsForEvent({
      id: "question",
      type: "advisor.questionAsked",
      category: "advisor",
      timestamp: new Date().toISOString(),
      userId,
      source: "avatar",
      severity: "info",
      title: "Advisor question asked",
      description: "Question",
      payload: {},
      metadata: {},
    });

    expect(demoNotifications).toHaveLength(1);
    expect(questionNotifications).toHaveLength(0);
  });

  it("generates digest summaries", () => {
    const digest = buildNotificationDigest([
      createNotification(1),
      createNotification(2),
      { ...createNotification(3), category: "recommendation", title: "Savings opportunity" },
    ]);

    expect(digest.title).toBe("Weekly INARI Digest");
    expect(digest.highPriorityCount).toBeGreaterThan(0);
    expect(digest.unreadCount).toBe(3);
    expect(digest.recommendedFocus.length).toBeGreaterThan(0);
  });
});

describe("event notification integration", () => {
  it("processes event publishing into notifications safely", async () => {
    const store = new InMemoryNotificationStore();
    await processEventForNotifications(highAlertEvent(), store);

    const notifications = await store.getNotifications(userId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.relatedMetric).toBe("emergencyFundBalance");
  });

  it("global event publishing creates notifications without breaking", async () => {
    const event = highAlertEvent();
    await publishEventSafely(event);

    expect(event.type).toBe("alert.generated");
  });
});
