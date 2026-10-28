const REMINDER_WINDOWS = [
  { type: "24h", minMinutes: 1430, maxMinutes: 1450 },
  { type: "1h", minMinutes: 50, maxMinutes: 70 },
];

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
  now = () => new Date(),
  logger = console,
}) => {
  let timer = null;
  let running = false;

  const runOnce = async () => {
    if (!workspaceClient.isConfigured())
      return { skipped: true, reason: "workspace-client-not-configured" };
    const currentTime = now();
    const sessions = await workspaceClient.listUpcomingSessions();
    let delivered = 0;
    for (const session of sessions) {
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
