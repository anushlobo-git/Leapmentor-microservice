const createInvoiceController = ({ invoiceService }) => ({
  downloadInvoice: async (req, res, next) => {
    try {
      const { pdfBuffer, invoiceNumber } =
        await invoiceService.generateInvoicePdfBuffer({
          connectRequestId: req.params.connectRequestId,
          userId: req.user._id,
          correlationId: req.correlationId,
        });
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${invoiceNumber}.pdf"`,
        "Content-Length": pdfBuffer.length,
      });
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createInvoiceController;
