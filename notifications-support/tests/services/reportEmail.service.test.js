const test = require("node:test");
const assert = require("node:assert/strict");

const createReportEmailService = require("../../services/reportEmail.service");

const build = (previous = null) => {
  const sent = [];
  const records = new Map(previous ? [[previous.sourceEventId, previous]] : []);
  const service = createReportEmailService({
    sendEmail: async (message) => sent.push(message),
    emailDeliveryRepository: {
      findBySourceEventId: async (id) => records.get(id) || null,
      createPending: async (id) => {
        records.set(id, { sourceEventId: id, status: "pending" });
      },
      markSent: async (id) => {
        records.set(id, { sourceEventId: id, status: "sent" });
      },
      markFailed: async (id, lastError) => {
        records.set(id, { sourceEventId: id, status: "failed", lastError });
      },
    },
  });
  return { service, sent, records };
};

test("delivers a submitted report email and records it as sent", async () => {
  const { service, sent, records } = build();
  const event = {
    eventType: "report.submitted.email",
    sourceEventId: "report-email:1",
    reporterEmail: "person@example.com",
    complaintType: "other",
    description: "A report description",
  };
  assert.deepEqual(await service.sendReportEvent(event), {
    sent: true,
    deduplicated: false,
  });
  assert.equal(sent[0].to, "person@example.com");
  assert.match(sent[0].subject, /received/);
  assert.equal(records.get(event.sourceEventId).status, "sent");
});

test("does not redeliver an event already recorded as sent", async () => {
  const { service, sent } = build({
    sourceEventId: "report-email:2",
    status: "sent",
  });
  assert.deepEqual(
    await service.sendReportEvent({
      eventType: "report.resolved.email",
      sourceEventId: "report-email:2",
      reporterEmail: "person@example.com",
    }),
    { sent: true, deduplicated: true },
  );
  assert.equal(sent.length, 0);
});

test("delivers payment invoice emails with a PDF attachment", async () => {
  const { service, sent, records } = build();
  const pdf = Buffer.from("%PDF-invoice");
  const event = {
    eventType: "payment.invoice.email",
    sourceEventId: "payment-invoice:request-1",
    reporterEmail: "mentee@example.com",
    reporterName: "Mentee",
    mentorName: "Mentor",
    invoiceNumber: "INV-123456",
    sessionRate: 100,
    sessionCount: 2,
    totalAmount: 240,
    invoicePdfBase64: pdf.toString("base64"),
  };

  assert.deepEqual(await service.sendReportEvent(event), {
    sent: true,
    deduplicated: false,
  });
  assert.equal(sent[0].to, "mentee@example.com");
  assert.equal(sent[0].attachments[0].filename, "Invoice-INV-123456.pdf");
  assert.deepEqual(sent[0].attachments[0].content, pdf);
  assert.equal(records.get(event.sourceEventId).status, "sent");
});

test("records failures and rejects malformed report email events", async () => {
  const { sent, records } = build();
  const service = createReportEmailService({
    sendEmail: async () => {
      throw new Error("smtp unavailable");
    },
    emailDeliveryRepository: {
      findBySourceEventId: async (id) => records.get(id) || null,
      createPending: async (id) => {
        records.set(id, { sourceEventId: id, status: "pending" });
      },
      markSent: async () => {},
      markFailed: async (id, lastError) => {
        records.set(id, { sourceEventId: id, status: "failed", lastError });
      },
    },
  });
  await assert.rejects(
    service.sendReportEvent({
      eventType: "report.submitted.email",
      sourceEventId: "report-email:3",
      reporterEmail: "person@example.com",
    }),
    /smtp unavailable/,
  );
  assert.equal(records.get("report-email:3").status, "failed");
  assert.equal(sent.length, 0);
  await assert.rejects(service.sendReportEvent({}), {
    code: "INVALID_REPORT_EMAIL_EVENT",
  });
});

test("persists a failed email payload and drains it successfully on retry", async () => {
  const records = new Map();
  let shouldFail = true;
  const service = createReportEmailService({
    sendEmail: async () => {
      if (shouldFail) throw new Error("smtp unavailable");
    },
    emailDeliveryRepository: {
      findBySourceEventId: async (id) => records.get(id) || null,
      createPending: async (id, payload) => {
        records.set(id, { sourceEventId: id, status: "pending", payload });
      },
      findPending: async () =>
        [...records.values()].filter((item) => item.status === "failed"),
      claimForSending: async (id) => {
        const record = records.get(id);
        if (!record || record.status === "sent") return null;
        record.status = "sending";
        return record;
      },
      markSent: async (id) => {
        records.get(id).status = "sent";
      },
      markFailed: async (id, lastError) => {
        Object.assign(records.get(id), { status: "failed", lastError });
      },
    },
  });
  const event = {
    eventType: "support.resolved.email",
    sourceEventId: "support.ticket:ticket-1:resolved:email",
    toEmail: "user@example.com",
    subject: "Help",
  };

  await assert.rejects(service.sendEmailEvent(event), /smtp unavailable/);
  assert.equal(
    records.get(event.sourceEventId).payload.eventType,
    event.eventType,
  );
  shouldFail = false;
  assert.deepEqual(await service.drainPendingEmailEvents(), {
    attempted: 1,
    sent: 1,
  });
  assert.equal(records.get(event.sourceEventId).status, "sent");
});
