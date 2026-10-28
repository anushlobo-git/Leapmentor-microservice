const createReportEmailService = ({ sendEmail, emailDeliveryRepository }) => {
  const sendReportEvent = async (event) => {
    if (!event?.sourceEventId || !event.reporterEmail) {
      const error = new Error(
        "Report email event is missing its event ID or recipient",
      );
      error.code = "INVALID_REPORT_EMAIL_EVENT";
      throw error;
    }
    const supportedEventTypes = [
      "report.submitted.email",
      "report.resolved.email",
      "payment.invoice.email",
    ];
    if (!supportedEventTypes.includes(event.eventType)) {
      const error = new Error("Unsupported report email event");
      error.code = "UNSUPPORTED_REPORT_EMAIL_EVENT";
      throw error;
    }

    const previous = await emailDeliveryRepository.findBySourceEventId(
      event.sourceEventId,
    );
    if (previous?.status === "sent") return { sent: true, deduplicated: true };
    if (!previous) {
      try {
        await emailDeliveryRepository.createPending(event.sourceEventId);
      } catch (error) {
        if (error?.code !== 11000) throw error;
        const duplicate = await emailDeliveryRepository.findBySourceEventId(
          event.sourceEventId,
        );
        if (duplicate?.status === "sent")
          return { sent: true, deduplicated: true };
      }
    }

    const isSubmitted = event.eventType === "report.submitted.email";
    const isInvoice = event.eventType === "payment.invoice.email";
    const message = isInvoice
      ? {
          to: event.reporterEmail,
          subject: `Your LeapMentor invoice ${event.invoiceNumber}`,
          text: [
            `Hi ${event.reporterName || "there"},`,
            "",
            `Your payment for the session with ${event.mentorName || "your mentor"} was received.`,
            `Sessions: ${event.sessionCount} x ${event.sessionRate} LP`,
            `Total paid: ${event.totalAmount} LP`,
            "Your invoice PDF is attached.",
            "",
            "LeapMentor",
          ].join("\n"),
          attachments: [
            {
              filename: `Invoice-${event.invoiceNumber}.pdf`,
              content: Buffer.from(event.invoicePdfBase64 || "", "base64"),
              contentType: "application/pdf",
            },
          ],
        }
      : isSubmitted
        ? {
            to: event.reporterEmail,
            subject: "We received your LeapMentor report",
            text: [
              `Hi ${event.reporterName || "there"},`,
              "",
              "We received your report and our team will review it.",
              `Report category: ${event.complaintType}`,
              `Your description: ${event.description}`,
              "",
              "LeapMentor Support",
            ].join("\n"),
          }
        : {
            to: event.reporterEmail,
            subject:
              event.status === "resolved"
                ? "Your LeapMentor report was resolved"
                : "Your LeapMentor report was reviewed",
            text: [
              `Hi ${event.reporterName || "there"},`,
              "",
              `Our team reviewed your ${event.complaintType} report. Status: ${event.status}.`,
              event.adminNote ? `Admin note: ${event.adminNote}` : "",
              "",
              "LeapMentor Support",
            ]
              .filter(Boolean)
              .join("\n"),
          };

    try {
      await sendEmail(message);
      await emailDeliveryRepository.markSent(event.sourceEventId);
      return { sent: true, deduplicated: false };
    } catch (error) {
      await emailDeliveryRepository
        .markFailed(event.sourceEventId, error.message)
        .catch(() => null);
      throw error;
    }
  };

  return { sendReportEvent };
};

module.exports = createReportEmailService;
