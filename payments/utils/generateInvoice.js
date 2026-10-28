const PDFDocument = require("pdfkit");

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

const generateInvoice = (data) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    const rate = Number(data.sessionRate) || 0;
    const count = Number(data.sessionCount) || 1;
    const baseAmount = rate * count;
    const feePercent = Number(data.platformFeePercent) || 0;
    const platformFee = Math.ceil((baseAmount * feePercent) / 100);
    const total = Number(data.totalAmount) || baseAmount + platformFee;
    const slots =
      Array.isArray(data.selectedSlots) && data.selectedSlots.length
        ? data.selectedSlots
        : data.confirmedSlot
          ? [data.confirmedSlot]
          : [];

    document
      .fontSize(22)
      .fillColor("#173f52")
      .text("LeapMentor", { continued: true });
    document
      .fontSize(18)
      .fillColor("#111827")
      .text("  INVOICE", { align: "right" });
    document.moveDown();
    document.fontSize(10).fillColor("#475569");
    document.text(`Invoice number: ${data.invoiceNumber}`);
    document.text(`Paid on: ${formatDate(data.paidAt)}`);
    document.moveDown();
    document.fontSize(12).fillColor("#111827").text("Billed to");
    document
      .fontSize(10)
      .fillColor("#475569")
      .text(`${data.menteeName || "Mentee"} (${data.menteeEmail || ""})`);
    document.moveDown(0.5);
    document.fontSize(12).fillColor("#111827").text("Session with");
    document
      .fontSize(10)
      .fillColor("#475569")
      .text(`${data.mentorName || "Mentor"} (${data.mentorEmail || ""})`);
    document.moveDown();
    document.fillColor("#111827").text(`Session rate: ${rate} LP`);
    document.text(`Sessions: ${count}`);
    document.text(`Session amount: ${baseAmount} LP`);
    document.text(`Platform fee (${feePercent}%): ${platformFee} LP`);
    document.fontSize(13).fillColor("#173f52").text(`Total paid: ${total} LP`);
    if (slots.length) {
      document.moveDown();
      document.fontSize(11).fillColor("#111827").text("Scheduled sessions");
      document.fontSize(9).fillColor("#475569");
      for (const slot of slots) {
        document.text(
          `${slot.date || ""} ${slot.startTime || ""}${slot.endTime ? `-${slot.endTime}` : ""}`.trim(),
        );
      }
    }
    document.moveDown(2);
    document
      .fontSize(8)
      .fillColor("#64748b")
      .text("System-generated receipt for LeapMentor platform tokens.");
    document.end();
  });

module.exports = generateInvoice;
