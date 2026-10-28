const test = require("node:test");
const assert = require("node:assert/strict");

const createInvoiceService = require("../../services/invoice.service");
const generateInvoice = require("../../utils/generateInvoice");

const build = (
  request = { mentee: { _id: "mentee-1" }, paymentStatus: "paid" },
) => {
  const generated = [];
  const service = createInvoiceService({
    workspaceClient: { getInvoiceContext: async () => request },
    getCommissionRate: async () => 20,
    generateInvoice: async (data) => {
      generated.push(data);
      return Buffer.from("%PDF");
    },
  });
  return { service, generated };
};

test("generates an invoice only for the paying mentee and includes the configured fee", async () => {
  const { service, generated } = build({
    _id: "request-123456",
    mentee: { _id: "mentee-1", name: "Mentee" },
    paymentStatus: "released",
  });
  const result = await service.generateInvoicePdfBuffer({
    connectRequestId: "request-123456",
    userId: "mentee-1",
  });
  assert.equal(result.invoiceNumber, "INV-123456");
  assert.equal(result.pdfBuffer.toString(), "%PDF");
  assert.equal(generated[0].platformFeePercent, 20);
});

test("rejects unauthorized users and unpaid sessions", async () => {
  await assert.rejects(
    build().service.generateInvoicePdfBuffer({
      connectRequestId: "request-1",
      userId: "other",
    }),
    {
      statusCode: 403,
      code: "INVOICE_FORBIDDEN",
    },
  );
  await assert.rejects(
    build({
      mentee: { _id: "mentee-1" },
      paymentStatus: "pending",
    }).service.generateInvoicePdfBuffer({
      connectRequestId: "request-1",
      userId: "mentee-1",
    }),
    {
      statusCode: 400,
      code: "INVOICE_NOT_PAID",
    },
  );
});

test("accepts a configured zero-percent platform commission", async () => {
  const generated = [];
  const service = createInvoiceService({
    workspaceClient: { getInvoiceContext: async () => ({ mentee: "mentee-1", paymentStatus: "paid" }) },
    getCommissionRate: async () => 0,
    generateInvoice: async (data) => { generated.push(data); return Buffer.from("%PDF"); },
  });
  await service.generateInvoicePdfBuffer({ connectRequestId: "request-1", userId: "mentee-1" });
  assert.equal(generated[0].platformFeePercent, 0);
});

test("generates a valid PDF buffer with the Payments invoice renderer", async () => {
  const buffer = await generateInvoice({
    invoiceNumber: "INV-123456",
    menteeName: "Mentee",
    mentorName: "Mentor",
    sessionRate: 100,
    sessionCount: 2,
    platformFeePercent: 20,
    totalAmount: 240,
    paidAt: "2026-10-28T00:00:00.000Z",
    confirmedSlot: { date: "2026-11-01", startTime: "10:00", endTime: "11:00" },
  });
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});
