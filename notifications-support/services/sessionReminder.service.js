const crypto = require("node:crypto");

const REMINDER_WINDOWS = [
  { type: "24h", minMinutes: 1430, maxMinutes: 1450 },
  { type: "1h", minMinutes: 50, maxMinutes: 70 },
];
const REMINDER_LOCK_KEY = "notifications-support:session-reminders:leader";
const REMINDER_LOCK_TTL_MS = 60_000;
const REMINDER_LOCK_RENEW_MS = 20_000;
const RENEW_LOCK_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end";
const RELEASE_LOCK_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";

const idOf = (value) =>
  value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.();

const toISTDate = (date, time) => {
  const [year, month, day] = String(date).split("-").map(Number);
  const [hours, minutes] = String(time).split(":").map(Number);
  if (![year, month, day, hours, minutes].every(Number.isFinite)) return null;
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes) - 330 * 60 * 1000,
  );
};

const createSessionReminderService = ({
  workspaceClient,
  notificationService,
  lockClient = null,
  distributedLockEnabled = false,
  now = () => new Date(),
  logger = console,
}) => {
  let timer = null;
  let running = false;
  let localScanRunning = false;

  const scanSessions = async (isLockHeld = () => true) => {
    if (!workspaceClient.isConfigured())
      return { skipped: true, reason: "workspace-client-not-configured" };
    const currentTime = now();
    const sessions = await workspaceClient.listUpcomingSessions();
    let delivered = 0;
    for (const session of sessions) {
      if (!isLockHeld()) {
        return {
          scanned: sessions.length,
          delivered,
          skipped: true,
          reason: "reminder-lock-lost",
        };
      }
      const slot = session.confirmedSlot;
      const sessionTime =
        slot?.date && slot?.startTime
          ? toISTDate(slot.date, slot.startTime)
          : null;
      const menteeId = idOf(session.mentee);
      const mentorId = idOf(session.mentor);
      if (!sessionTime || !menteeId || !mentorId) continue;
      const minutesUntil =
        (sessionTime.getTime() - currentTime.getTime()) / 60000;
      const window = REMINDER_WINDOWS.find(
        ({ minMinutes, maxMinutes }) =>
          minutesUntil >= minMinutes && minutesUntil <= maxMinutes,
      );
      if (!window) continue;

      const isDayAhead = window.type === "24h";
      const recipients = [
        {
          id: menteeId,
          otherName: session.mentor?.name || "your mentor",
          message: isDayAhead
            ? `Reminder: Your session with ${session.mentor?.name || "your mentor"} is tomorrow at ${slot.startTime} on ${slot.date}.`
            : `Your session with ${session.mentor?.name || "your mentor"} starts in about 1 hour at ${slot.startTime}.`,
        },
        {
          id: mentorId,
          otherName: session.mentee?.name || "your mentee",
          message: isDayAhead
            ? `Reminder: You have a session with ${session.mentee?.name || "your mentee"} tomorrow at ${slot.startTime} on ${slot.date}.`
            : `Your session with ${session.mentee?.name || "your mentee"} starts in about 1 hour at ${slot.startTime}.`,
        },
      ];
      for (const recipient of recipients) {
        if (!isLockHeld()) {
          return {
            scanned: sessions.length,
            delivered,
            skipped: true,
            reason: "reminder-lock-lost",
          };
        }
        await notificationService.createFromEvent({
          sourceEventId: `session-reminder:${session.requestId}:${window.type}:${recipient.id}`,
          recipient: recipient.id,
          type: "upcoming_session",
          title: isDayAhead ? "Session Tomorrow" : "Session in 1 Hour",
          message: recipient.message,
          metadata: { requestId: session.requestId, reminderType: window.type },
        });
        delivered += 1;
      }
    }
    return { scanned: sessions.length, delivered };
  };

  const runOnce = async () => {
    if (localScanRunning) {
      return { skipped: true, reason: "local-scan-in-progress" };
    }
    localScanRunning = true;
    try {
      if (!distributedLockEnabled) return await scanSessions();
      if (
        typeof lockClient?.set !== "function" ||
        typeof lockClient?.eval !== "function"
      ) {
        return { skipped: true, reason: "distributed-lock-not-configured" };
      }

      const lockToken = crypto.randomUUID();
      const acquired = await lockClient.set(REMINDER_LOCK_KEY, lockToken, {
        NX: true,
        PX: REMINDER_LOCK_TTL_MS,
      });
      if (acquired !== "OK")
        return { skipped: true, reason: "another-worker-active" };

      let lockHeld = true;
      let renewing = false;
      const renewTimer = setInterval(async () => {
        if (renewing || !lockHeld) return;
        renewing = true;
        try {
          const renewed = await lockClient.eval(RENEW_LOCK_SCRIPT, {
            keys: [REMINDER_LOCK_KEY],
            arguments: [lockToken, String(REMINDER_LOCK_TTL_MS)],
          });
          if (renewed !== 1) lockHeld = false;
        } catch {
          lockHeld = false;
        } finally {
          renewing = false;
        }
      }, REMINDER_LOCK_RENEW_MS);
      renewTimer.unref?.();
      try {
        return await scanSessions(() => lockHeld);
      } finally {
        clearInterval(renewTimer);
        await lockClient
          .eval(RELEASE_LOCK_SCRIPT, {
            keys: [REMINDER_LOCK_KEY],
            arguments: [lockToken],
          })
          .catch((error) =>
            logger.warn?.("Reminder lock release failed", {
              error: error.message,
            }),
          );
      }
    } finally {
      localScanRunning = false;
    }
  };

  const start = () => {
    if (timer) return false;
    running = true;
    const runSafely = () => {
      if (!running) return;
      runOnce().catch((error) =>
        logger.error?.("Session reminder run failed", { error: error.message }),
      );
    };
    runSafely();
    timer = setInterval(runSafely, 10 * 60 * 1000);
    timer.unref?.();
    return true;
  };

  const stop = () => {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
  };

  return { runOnce, start, stop };
};

module.exports = createSessionReminderService;
