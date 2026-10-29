const test = require("node:test");
const assert = require("node:assert/strict");

const { buildEmailMessages } = require("../../services/emailTemplates");

test("builds one recipient message for each single-recipient monolith email", () => {
  const events = [
    {
      eventType: "connect.request.received.email",
      mentorEmail: "mentor@example.com",
    },
    {
      eventType: "connect.request.accepted.email",
      menteeEmail: "mentee@example.com",
    },
    { eventType: "payment.received.email", mentorEmail: "mentor@example.com" },
    { eventType: "support.resolved.email", toEmail: "user@example.com" },
    {
      eventType: "profile.documents-submitted.email",
      mentorEmail: "mentor@example.com",
    },
    {
      eventType: "profile.mentor-verified.email",
      mentorEmail: "mentor@example.com",
    },
  ];

  for (const event of events) {
    assert.equal(buildEmailMessages(event).length, 1, event.eventType);
  }
});

test("sends slot changes and calendar invites to both participants", () => {
  for (const eventType of [
    "session.additional-slot.email",
    "session.slot-cancelled.email",
    "session.slot-rescheduled.email",
    "payment.calendar-invite.email",
  ]) {
    const messages = buildEmailMessages({
      eventType,
      sourceEventId: "event-1",
      requestId: "request-1",
      mentorEmail: "mentor@example.com",
      menteeEmail: "mentee@example.com",
      slots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00" }],
    });
    assert.deepEqual(
      messages.map((message) => message.to),
      ["mentor@example.com", "mentee@example.com"],
    );
    if (eventType === "payment.calendar-invite.email") {
      assert.equal(
        messages[0].attachments[0].filename,
        "LeapMentor-session-request-1.ics",
      );
      assert.match(
        messages[0].attachments[0].content.toString(),
        /BEGIN:VCALENDAR/,
      );
      assert.match(
        messages[0].attachments[0].content.toString(),
        /BEGIN:VEVENT/,
      );
    }
  }
});

test("keeps existing report and invoice email messages supported", () => {
  assert.equal(
    buildEmailMessages({
      eventType: "report.submitted.email",
      reporterEmail: "reporter@example.com",
    })[0].to,
    "reporter@example.com",
  );
  assert.equal(
    buildEmailMessages({
      eventType: "payment.invoice.email",
      reporterEmail: "payer@example.com",
      invoicePdfBase64: Buffer.from("pdf").toString("base64"),
    })[0].attachments[0].content.toString(),
    "pdf",
  );
});
