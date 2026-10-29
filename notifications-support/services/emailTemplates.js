const slotText = (slot = {}) =>
  `${slot.date || ""} ${slot.startTime || ""}-${slot.endTime || ""}`.trim();

const participantMessage = (subject, lines, to) => ({
  to,
  subject,
  text: lines.filter(Boolean).join("\n"),
});

const escapeCalendarText = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const createCalendarInvite = (event) => {
  const slots = (event.slots || []).filter(
    (slot) => slot.date && slot.startTime && slot.endTime,
  );
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const events = slots.map((slot, index) => {
    const date = String(slot.date).replace(/-/g, "");
    const start = String(slot.startTime).replace(":", "");
    const end = String(slot.endTime).replace(":", "");
    return [
      "BEGIN:VEVENT",
      `UID:${event.requestId || event.sourceEventId}-${index}@leapmentor`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;TZID=${event.timezone || "Asia/Kolkata"}:${date}T${start}00`,
      `DTEND;TZID=${event.timezone || "Asia/Kolkata"}:${date}T${end}00`,
      `SUMMARY:${escapeCalendarText(`LeapMentor session: ${event.mentorName || "Mentor"} and ${event.menteeName || "Mentee"}`)}`,
      `DESCRIPTION:${escapeCalendarText(event.message || "LeapMentor mentoring session")}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LeapMentor//Sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
};

const buildEmailMessages = (event) => {
  const slots = (event.slots || []).map(slotText).filter(Boolean);
  switch (event.eventType) {
    case "report.submitted.email":
      return event.reporterEmail
        ? [
            participantMessage(
              "We received your LeapMentor report",
              [
                `Hi ${event.reporterName || "there"},`,
                "We received your report and our team will review it.",
                `Report category: ${event.complaintType || ""}`,
                `Your description: ${event.description || ""}`,
                "LeapMentor Support",
              ],
              event.reporterEmail,
            ),
          ]
        : [];
    case "report.resolved.email":
      return event.reporterEmail
        ? [
            participantMessage(
              event.status === "resolved"
                ? "Your LeapMentor report was resolved"
                : "Your LeapMentor report was reviewed",
              [
                `Hi ${event.reporterName || "there"},`,
                `Our team reviewed your ${event.complaintType || ""} report. Status: ${event.status || "reviewed"}.`,
                event.adminNote ? `Admin note: ${event.adminNote}` : "",
                "LeapMentor Support",
              ],
              event.reporterEmail,
            ),
          ]
        : [];
    case "payment.invoice.email":
      return event.reporterEmail && event.invoicePdfBase64
        ? [
            {
              ...participantMessage(
                `Your LeapMentor invoice ${event.invoiceNumber || ""}`,
                [
                  `Hi ${event.reporterName || "there"},`,
                  `Your payment for the session with ${event.mentorName || "your mentor"} was received.`,
                  `Sessions: ${event.sessionCount || 0} x ${event.sessionRate || 0} LP`,
                  `Total paid: ${event.totalAmount || 0} LP`,
                  "Your invoice PDF is attached.",
                  "LeapMentor",
                ],
                event.reporterEmail,
              ),
              attachments: [
                {
                  filename: `Invoice-${event.invoiceNumber || "LeapMentor"}.pdf`,
                  content: Buffer.from(event.invoicePdfBase64, "base64"),
                  contentType: "application/pdf",
                },
              ],
            },
          ]
        : [];
    case "connect.request.received.email":
      return event.mentorEmail
        ? [
            participantMessage(
              `New Connect Request from ${event.menteeName || "a mentee"} - LeapMentor`,
              [
                `Hi ${event.mentorName || "Mentor"},`,
                `${event.menteeName || "A mentee"} sent you a connect request.`,
                ...slots.map((slot) => `Proposed slot: ${slot}`),
                event.message ? `Message: ${event.message}` : "",
                "Log in to your LeapMentor dashboard to accept or decline this request.",
              ],
              event.mentorEmail,
            ),
          ]
        : [];
    case "connect.request.accepted.email":
      return event.menteeEmail
        ? [
            participantMessage(
              `${event.mentorName || "Your mentor"} accepted your request - LeapMentor`,
              [
                `Hi ${event.menteeName || "there"},`,
                `${event.mentorName || "Your mentor"} accepted your connect request.`,
                `Confirmed session: ${slotText(event.confirmedSlot || event.slots?.[0])}`,
                "Complete your payment on LeapMentor to lock in your session.",
              ],
              event.menteeEmail,
            ),
          ]
        : [];
    case "session.additional-slot.email":
      return [event.mentorEmail, event.menteeEmail]
        .filter(Boolean)
        .map((to) =>
          participantMessage(
            "Additional Session Added - LeapMentor",
            [
              `Hi ${to === event.mentorEmail ? event.mentorName || "Mentor" : event.menteeName || "Mentee"},`,
              `${event.menteeName || "Your mentee"} added a session slot.`,
              slotText(event.slot),
              "Visit your dashboard to view the updated schedule.",
            ],
            to,
          ),
        );
    case "session.slot-cancelled.email":
      return [event.mentorEmail, event.menteeEmail]
        .filter(Boolean)
        .map((to) =>
          participantMessage(
            "Session Slot Cancelled - LeapMentor",
            [
              `Hi ${to === event.mentorEmail ? event.mentorName || "Mentor" : event.menteeName || "Mentee"},`,
              `${event.cancelledBy === "mentor" ? event.mentorName || "The mentor" : event.menteeName || "The mentee"} cancelled a session slot.`,
              slotText(event.slot),
              event.reason ? `Reason: ${event.reason}` : "",
              "Please check your dashboard for the updated schedule.",
            ],
            to,
          ),
        );
    case "session.slot-rescheduled.email":
      return [event.mentorEmail, event.menteeEmail]
        .filter(Boolean)
        .map((to) =>
          participantMessage(
            "Session Rescheduled - LeapMentor",
            [
              `Hi ${to === event.mentorEmail ? event.mentorName || "Mentor" : event.menteeName || "Mentee"},`,
              `Previous time: ${slotText(event.oldSlot)}`,
              `New time: ${slotText(event.newSlot)}`,
              "Please check your dashboard to confirm the updated time.",
            ],
            to,
          ),
        );
    case "payment.received.email":
      return event.mentorEmail
        ? [
            participantMessage(
              `Payment received from ${event.menteeName || "your mentee"} - LeapMentor`,
              [
                `Hi ${event.mentorName || "Mentor"},`,
                `${event.menteeName || "Your mentee"} paid for ${slots.length} session(s).`,
                ...slots.map((slot) => `Booked session: ${slot}`),
                `Rate: ${event.sessionRate || 0} tokens x ${event.sessionCount || 0} sessions`,
                `Platform fee: ${event.commissionRate || 0}%`,
                `You will receive ${event.mentorPayout || 0} tokens.`,
              ],
              event.mentorEmail,
            ),
          ]
        : [];
    case "payment.calendar-invite.email": {
      const attachment = {
        filename: `LeapMentor-session-${event.requestId || "invite"}.ics`,
        content: Buffer.from(createCalendarInvite(event)),
        contentType: "text/calendar; method=REQUEST; charset=UTF-8",
      };
      return [event.mentorEmail, event.menteeEmail]
        .filter(Boolean)
        .map((to) => ({
          ...participantMessage(
            "LeapMentor session calendar invite",
            [
              `Hi ${to === event.mentorEmail ? event.mentorName || "Mentor" : event.menteeName || "Mentee"},`,
              `Calendar invite for your session with ${to === event.mentorEmail ? event.menteeName || "your mentee" : event.mentorName || "your mentor"}.`,
              ...slots,
            ],
            to,
          ),
          attachments: [attachment],
        }));
    }
    case "support.resolved.email":
      return event.toEmail || event.recipientEmail
        ? [
            participantMessage(
              "Your support request has been resolved - LeapMentor",
              [
                "Our team has looked into your issue and marked it as resolved.",
                `Your request: ${event.subject || "Support request"}`,
                "If you still need help, submit a new message from the Help Center.",
              ],
              event.toEmail || event.recipientEmail,
            ),
          ]
        : [];
    case "profile.documents-submitted.email":
      return event.mentorEmail
        ? [
            participantMessage(
              "We received your verification documents - LeapMentor",
              [
                `Hi ${event.mentorName || "Mentor"},`,
                "Our team will review your profile and documents. This process usually takes 24-48 hours.",
                "You will receive an email once your account has been verified.",
              ],
              event.mentorEmail,
            ),
          ]
        : [];
    case "profile.mentor-verified.email":
      return event.mentorEmail
        ? [
            participantMessage(
              "Your LeapMentor mentor account is verified",
              [
                `Congratulations, ${event.mentorName || "Mentor"}!`,
                "Your profile has been reviewed and verified. You can now complete your profile and receive mentee requests.",
              ],
              event.mentorEmail,
            ),
          ]
        : [];
    default:
      return [];
  }
};

module.exports = { buildEmailMessages };
