const AppError = require("../utils/AppError");

const PAID_STATUSES = new Set(["paid", "released"]);

const createInvoiceService = ({
  workspaceClient,
  getCommissionRate,
  generateInvoice,
}) => ({
  generateInvoicePdfBuffer: async ({
    connectRequestId,
    userId,
    correlationId,
  }) => {
    const request = await workspaceClient.getInvoiceContext(
      connectRequestId,
      correlationId,
    );
    if (!request)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    const menteeId = String(
      request.mentee?._id ?? request.mentee?.id ?? request.mentee,
    );
    if (menteeId !== String(userId))
      throw new AppError(
        "Not authorized to download this invoice",
        403,
        "INVOICE_FORBIDDEN",
      );
    if (!PAID_STATUSES.has(request.paymentStatus))
      throw new AppError(
        "No paid invoice found for this session",
        400,
        "INVOICE_NOT_PAID",
      );

    const platformFeePercent = await getCommissionRate();
    if (
      platformFeePercent === null ||
      platformFeePercent === undefined ||
      !Number.isFinite(Number(platformFeePercent))
    )
      throw new AppError(
        "Platform commission rate not configured",
        400,
        "COMMISSION_NOT_CONFIGURED",
      );
    const invoiceNumber = `INV-${String(connectRequestId).slice(-6).toUpperCase()}`;
    const pdfBuffer = await generateInvoice({
      ...request,
      invoiceNumber,
      platformFeePercent,
    });
    return { pdfBuffer, invoiceNumber };
  },
});

module.exports = createInvoiceService;
