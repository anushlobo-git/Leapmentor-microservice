const env = require("../config/env");
const {
  BLUE_GRADIENT,
  RED_GRADIENT,
  GREEN_GRADIENT,
  escapeHtml,
  formatTime,
  formatDate,
  wrapEmail,
  buildHeader,
  FOOTER,
  buildInfoCard,
  buildBanner,
  buildCTA,
  buildParticipantBlock,
  buildSlotRows,
  buildColoredSlotRow,
  buildSlotSection,
} = require("./emailTemplateHelpers");

const slotText = (slot = {}) =>
  `${slot.date || ""} ${slot.startTime || ""}-${slot.endTime || ""}`.trim();

const participantMessage = (subject, lines, to, html) => ({
  to,
  subject,
  text: lines.filter(Boolean).join("\n"),
  html,
});

const dashboardUrl = (path) => `${env.appBaseUrl}${path}`;
const slotListHeading = (heading, slots) => buildSlotSection(heading, buildSlotRows(slots));
const body = (content) =>
  `<div class="email-body" style="padding:24px 32px;">${content}</div>${FOOTER}`;
const formattedComplaintType = (value = "") =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const buildCalendarInvite = (event) => {
  const slots = (event.slots || []).filter((slot) => slot.date && slot.startTime && slot.endTime);
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
      `SUMMARY:${String(
        `LeapMentor session: ${event.mentorName || "Mentor"} and ${event.menteeName || "Mentee"}`,
      )
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")}`,
      `DESCRIPTION:${String(event.message || "LeapMentor mentoring session")
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")}`,
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

const createSessionHtml = (event, kind, recipientName) => {
  const mentorName = event.mentorName || "Mentor";
  const menteeName = event.menteeName || "Mentee";
  const dashboardLink = dashboardUrl(
    `/shared-dashboard/${encodeURIComponent(event.requestId || event.connectRequestId || "")}`,
  );
  const participants = buildParticipantBlock(mentorName, menteeName);
  if (kind === "additional") {
    return wrapEmail(`
      ${buildHeader(BLUE_GRADIENT, "Additional Session Added", `${menteeName} has added a new session slot`)}
      ${body(`
        ${participants}
        ${buildSlotSection("New Session Slot", buildColoredSlotRow(event.slot || {}, "#16a34a", "#f0fdf4", "#bbf7d0", "NEW"))}
        ${buildBanner("#eff6ff", "#2563eb", "#1e40af", `Hi ${escapeHtml(recipientName)}, a new session slot has been added to your ongoing engagement. Visit your dashboard to view the updated schedule.`, true)}
        ${buildCTA(dashboardLink, "View Dashboard")}
      `)}
    `);
  }
  if (kind === "cancelled") {
    const cancelledByName = event.cancelledBy === "mentor" ? mentorName : menteeName;
    return wrapEmail(`
      ${buildHeader(RED_GRADIENT, "Session Slot Cancelled", `${cancelledByName} has cancelled a session slot`)}
      ${body(`
        ${participants}
        ${buildSlotSection("Cancelled Slot", buildColoredSlotRow(event.slot || {}, "#dc2626", "#fef2f2", "#fecaca", "CANCELLED"))}
        ${event.reason ? `<div style="background:#fff7ed;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:3px solid #f97316;"><div style="font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Reason</div><div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">&quot;${escapeHtml(event.reason)}&quot;</div></div>` : ""}
        ${buildBanner("#fffbeb", "#fde68a", "#92400e", `Hi ${escapeHtml(recipientName)}, this slot has been cancelled by ${escapeHtml(cancelledByName)}. Please visit your dashboard to view your updated session schedule.`)}
        ${buildCTA(dashboardLink, "View Dashboard")}
      `)}
    `);
  }

  const oldSlot = event.oldSlot || {};
  const newSlot = event.newSlot || {};
  return wrapEmail(`
    ${buildHeader(BLUE_GRADIENT, "Session Rescheduled", `${menteeName} has rescheduled a session slot`)}
    ${body(`
      ${participants}
      <div style="margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Schedule Change</div>
        <div class="slot-row" style="padding:10px 14px;border-radius:10px;margin-bottom:8px;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;">
          <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;margin-bottom:3px;">Old Time</div>
          <div style="font-size:13px;font-weight:700;color:#1e293b;">${formatDate(oldSlot.date)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">${formatTime(oldSlot.startTime)} &ndash; ${formatTime(oldSlot.endTime)}</div>
        </div>
        <div style="text-align:center;padding:4px 0;font-size:16px;color:#94a3b8;">&#8595;</div>
        <div class="slot-row" style="padding:10px 14px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;">
          <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;margin-bottom:3px;">New Time</div>
          <div style="font-size:13px;font-weight:700;color:#1e293b;">${formatDate(newSlot.date)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">${formatTime(newSlot.startTime)} &ndash; ${formatTime(newSlot.endTime)}</div>
        </div>
      </div>
      ${buildBanner("#eff6ff", "#2563eb", "#1e40af", `Hi ${escapeHtml(recipientName)}, your session has been rescheduled by ${escapeHtml(menteeName)}. Please check your dashboard to confirm the updated time.`, true)}
      ${buildCTA(dashboardLink, "View Dashboard")}
    `)}
  `);
};

const buildEmailMessages = (event) => {
  const slots = (event.slots || []).filter((slot) => slot.date && slot.startTime && slot.endTime);
  switch (event.eventType) {
    case "report.submitted.email": {
      if (!event.reporterEmail) return [];
      const complaintType = formattedComplaintType(event.complaintType);
      const html = wrapEmail(`
        ${buildHeader(BLUE_GRADIENT, "Report Submitted", "We've received your report and will review it shortly")}
        ${body(`
          ${buildInfoCard("Submitted By", event.reporterName || "there")}
          <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Report Details</div>
            <div style="margin-bottom:10px;"><div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Complaint Type</div><div style="font-size:14px;font-weight:700;color:#1e293b;">${escapeHtml(complaintType)}</div></div>
            <div style="border-top:1px solid #e2e8f0;padding-top:10px;"><div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Description</div><div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">&quot;${escapeHtml(event.description || "")}&quot;</div></div>
          </div>
          ${buildBanner("#eff6ff", "#2563eb", "#1e40af", "Our admin team will review your report and take appropriate action. This usually takes <strong>24–48 hours</strong>. You'll receive an email once it's resolved.", true)}
          ${buildCTA(dashboardUrl(`/dashboard/${event.reporterRole === "mentor" ? "mentor" : "mentee"}`), "View Dashboard")}
        `)}
      `);
      return [
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
          html,
        ),
      ];
    }
    case "report.resolved.email": {
      if (!event.reporterEmail) return [];
      const complaintType = formattedComplaintType(event.complaintType);
      const resolved = event.status === "resolved";
      const status = resolved ? "Resolved" : "Dismissed";
      const html = wrapEmail(`
        ${buildHeader(resolved ? GREEN_GRADIENT : RED_GRADIENT, `Report ${status}`, "An update on your report has been made by our team")}
        ${body(`
          <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Report Summary</div>
            <div style="margin-bottom:10px;"><div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Complaint Type</div><div style="font-size:14px;font-weight:700;color:#1e293b;">${escapeHtml(complaintType)}</div></div>
            <div style="border-top:1px solid #e2e8f0;padding-top:10px;"><div style="font-size:11px;color:#94a3b8;">Status</div><span style="font-size:11px;font-weight:700;color:${resolved ? "#16a34a" : "#dc2626"};background:${resolved ? "#dcfce7" : "#fee2e2"};padding:3px 8px;border-radius:6px;">${status.toUpperCase()}</span></div>
          </div>
          ${event.adminNote ? `<div style="background:#fffbeb;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:3px solid #f59e0b;"><div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Note from Admin</div><div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">&quot;${escapeHtml(event.adminNote)}&quot;</div></div>` : ""}
          ${buildBanner(resolved ? "#f0fdf4" : "#fef2f2", resolved ? "#bbf7d0" : "#fecaca", resolved ? "#15803d" : "#991b1b", resolved ? "Your report has been reviewed and resolved by our admin team. Thank you for helping keep LeapMentor safe." : "After reviewing your report, our admin team has determined that it does not meet the threshold for action. If you believe this is an error, please contact support.")}
          ${buildCTA(dashboardUrl(`/dashboard/${event.reporterRole === "mentor" ? "mentor" : "mentee"}`), "View Dashboard")}
        `)}
      `);
      return [
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
          html,
        ),
      ];
    }
    case "payment.invoice.email": {
      if (!event.reporterEmail || !event.invoicePdfBase64) return [];
      const invoiceNumber = event.invoiceNumber || "LeapMentor";
      const html = wrapEmail(`
        ${buildHeader(BLUE_GRADIENT, `Invoice #${invoiceNumber}`, "Your payment receipt from LeapMentor")}
        ${body(`
          <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Billing Summary</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr><td style="font-size:13px;color:#64748b;padding:5px 0;">Mentor</td><td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;padding:5px 0;">${escapeHtml(event.mentorName || "your mentor")}</td></tr>
              <tr><td style="font-size:13px;color:#64748b;padding:5px 0;">Sessions</td><td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;padding:5px 0;">${escapeHtml(event.sessionCount || 0)} &times; ${escapeHtml(event.sessionRate || 0)} tokens</td></tr>
              <tr><td colspan="2"><div style="border-top:1px solid #e2e8f0;margin:8px 0;"></div></td></tr>
              <tr><td style="font-size:14px;font-weight:700;color:#0f172a;padding:5px 0;">Total Paid</td><td style="font-size:14px;font-weight:700;color:#2563eb;text-align:right;padding:5px 0;">${escapeHtml(event.totalAmount || 0)} tokens</td></tr>
            </table>
          </div>
          ${buildBanner("#f0fdf4", "#bbf7d0", "#15803d", "Your invoice PDF is attached to this email for your records.")}
        `)}
      `);
      return [
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
            html,
          ),
          attachments: [
            {
              filename: `Invoice-${event.invoiceNumber || "LeapMentor"}.pdf`,
              content: Buffer.from(event.invoicePdfBase64, "base64"),
              contentType: "application/pdf",
            },
          ],
        },
      ];
    }
    case "connect.request.received.email": {
      if (!event.mentorEmail) return [];
      const mentorName = event.mentorName || "Mentor";
      const menteeName = event.menteeName || "a mentee";
      const html = wrapEmail(`
        ${buildHeader(BLUE_GRADIENT, "New Connect Request", `${menteeName} wants to book a session with you`)}
        ${body(`
          ${buildInfoCard("Mentee", menteeName)}
          ${slotListHeading(`Proposed Slots (${slots.length})`, slots)}
          ${event.message ? `<div style="background:#eff6ff;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:3px solid #2563eb;"><div style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Message from ${escapeHtml(menteeName)}</div><div style="font-size:13px;color:#334155;line-height:1.6;font-style:italic;">&quot;${escapeHtml(event.message)}&quot;</div></div>` : ""}
          ${buildBanner("#f0fdf4", "#bbf7d0", "#15803d", "Log in to your LeapMentor dashboard to accept or decline this request.")}
          ${buildCTA(dashboardUrl("/dashboard/mentor?tab=requests"), "View Request", "Opens your <strong>Requests</strong> tab directly")}
        `)}
      `);
      return [
        participantMessage(
          `New Connect Request from ${menteeName} - LeapMentor`,
          [
            `Hi ${mentorName},`,
            `${menteeName} sent you a connect request.`,
            ...slots.map((slot) => `Proposed slot: ${slotText(slot)}`),
            event.message ? `Message: ${event.message}` : "",
            "Log in to your LeapMentor dashboard to accept or decline this request.",
          ],
          event.mentorEmail,
          html,
        ),
      ];
    }
    case "connect.request.accepted.email": {
      if (!event.menteeEmail) return [];
      const mentorName = event.mentorName || "Your mentor";
      const confirmedSlot = event.confirmedSlot || event.slots?.[0];
      const confirmedSlots = confirmedSlot ? [confirmedSlot] : [];
      const html = wrapEmail(`
        ${buildHeader(BLUE_GRADIENT, "Your request was accepted!", `${mentorName} has accepted your connect request`)}
        ${body(`
          ${buildInfoCard("Your Mentor", mentorName)}
          ${slotListHeading("Confirmed Session", confirmedSlots)}
          ${buildBanner("#fffbeb", "#fde68a", "#92400e", "Complete your payment on LeapMentor to lock in your session. Tokens are held securely in escrow until the session is complete.")}
          ${buildCTA(dashboardUrl("/dashboard/mentee?tab=history"), "Complete Payment", "Opens your <strong>Session History</strong> tab directly")}
        `)}
      `);
      return [
        participantMessage(
          `${mentorName} accepted your request - LeapMentor`,
          [
            `Hi ${event.menteeName || "there"},`,
            `${mentorName} accepted your connect request.`,
            `Confirmed session: ${slotText(confirmedSlot)}`,
            "Complete your payment on LeapMentor to lock in your session.",
          ],
          event.menteeEmail,
          html,
        ),
      ];
    }
    case "session.additional-slot.email":
    case "session.slot-cancelled.email":
    case "session.slot-rescheduled.email": {
      const kind =
        event.eventType === "session.additional-slot.email"
          ? "additional"
          : event.eventType === "session.slot-cancelled.email"
            ? "cancelled"
            : "rescheduled";
      return [event.mentorEmail, event.menteeEmail].filter(Boolean).map((to) => {
        const isMentor = to === event.mentorEmail;
        const recipientName = isMentor
          ? event.mentorName || "Mentor"
          : event.menteeName || "Mentee";
        const html = createSessionHtml(event, kind, recipientName);
        if (kind === "additional") {
          return participantMessage(
            "Additional Session Added - LeapMentor",
            [
              `Hi ${recipientName},`,
              `${event.menteeName || "Your mentee"} added a session slot.`,
              slotText(event.slot),
              "Visit your dashboard to view the updated schedule.",
            ],
            to,
            html,
          );
        }
        if (kind === "cancelled") {
          const cancelledBy =
            event.cancelledBy === "mentor"
              ? event.mentorName || "The mentor"
              : event.menteeName || "The mentee";
          return participantMessage(
            "Session Slot Cancelled - LeapMentor",
            [
              `Hi ${recipientName},`,
              `${cancelledBy} cancelled a session slot.`,
              slotText(event.slot),
              event.reason ? `Reason: ${event.reason}` : "",
              "Please check your dashboard for the updated schedule.",
            ],
            to,
            html,
          );
        }
        return participantMessage(
          "Session Rescheduled - LeapMentor",
          [
            `Hi ${recipientName},`,
            `Previous time: ${slotText(event.oldSlot)}`,
            `New time: ${slotText(event.newSlot)}`,
            "Please check your dashboard to confirm the updated time.",
          ],
          to,
          html,
        );
      });
    }
    case "payment.received.email": {
      if (!event.mentorEmail) return [];
      const mentorName = event.mentorName || "Mentor";
      const menteeName = event.menteeName || "your mentee";
      const html = wrapEmail(`
        ${buildHeader(BLUE_GRADIENT, "Payment Received", `${menteeName} has paid for ${slots.length} session${slots.length > 1 ? "s" : ""} with you`)}
        ${body(`
          ${slotListHeading(`Booked Sessions (${slots.length})`, slots)}
          <div style="background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Payment Summary</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr><td style="font-size:13px;color:#64748b;padding:5px 0;">Rate per session</td><td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;padding:5px 0;">${escapeHtml(event.sessionRate || 0)} tokens</td></tr>
              <tr><td style="font-size:13px;color:#64748b;padding:5px 0;">Sessions</td><td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;padding:5px 0;">&times; ${escapeHtml(event.sessionCount || slots.length)}</td></tr>
              <tr><td style="font-size:13px;color:#64748b;padding:5px 0;">Platform fee (${escapeHtml(event.commissionRate || 0)}%)</td><td style="font-size:13px;font-weight:600;color:#f59e0b;text-align:right;padding:5px 0;">deducted by platform</td></tr>
              <tr><td colspan="2"><div style="border-top:1px solid #e2e8f0;margin:8px 0;"></div></td></tr>
              <tr><td style="font-size:14px;font-weight:700;color:#0f172a;padding:5px 0;">You will receive</td><td style="font-size:14px;font-weight:700;color:#16a34a;text-align:right;padding:5px 0;">${escapeHtml(event.mentorPayout || 0)} tokens</td></tr>
            </table>
          </div>
        `)}
      `);
      return [
        participantMessage(
          `Payment received from ${menteeName} - LeapMentor`,
          [
            `Hi ${mentorName},`,
            `${event.menteeName || "Your mentee"} paid for ${slots.length} session(s).`,
            ...slots.map((slot) => `Booked session: ${slotText(slot)}`),
            `Rate: ${event.sessionRate || 0} tokens x ${event.sessionCount || 0} sessions`,
            `Platform fee: ${event.commissionRate || 0}%`,
            `You will receive ${event.mentorPayout || 0} tokens.`,
          ],
          event.mentorEmail,
          html,
        ),
      ];
    }
    case "payment.calendar-invite.email": {
      const attachment = {
        filename: `LeapMentor-session-${event.requestId || "invite"}.ics`,
        content: Buffer.from(buildCalendarInvite(event)),
        contentType: "text/calendar; method=REQUEST; charset=UTF-8",
      };
      return [event.mentorEmail, event.menteeEmail].filter(Boolean).map((to) => {
        const isMentor = to === event.mentorEmail;
        const recipientName = isMentor
          ? event.mentorName || "Mentor"
          : event.menteeName || "Mentee";
        const otherName = isMentor
          ? event.menteeName || "your mentee"
          : event.mentorName || "your mentor";
        const slotCount = slots.length;
        const html = wrapEmail(`
            ${buildHeader(BLUE_GRADIENT, isMentor ? `${slotCount} new session${slotCount > 1 ? "s" : ""} scheduled` : `Your ${slotCount} session${slotCount > 1 ? "s are" : " is"} confirmed!`, isMentor ? `${event.menteeName || "Your mentee"} has completed payment · Sessions confirmed` : `Payment received · Sessions locked in with ${event.mentorName || "your mentor"}`)}
            ${body(`
              ${buildInfoCard(isMentor ? "Mentee" : "Mentor", otherName)}
              ${slotListHeading(`${isMentor ? "Scheduled" : "Booked"} Sessions (${slotCount})`, slots)}
              ${buildBanner("#f0fdf4", "#bbf7d0", "#15803d", `📎 ${slotCount} calendar invite${slotCount > 1 ? "s are" : " is"} attached. Add ${slotCount > 1 ? "them" : "it"} to Google Calendar, Outlook, or Apple Calendar.`)}
            `)}
          `);
        return {
          ...participantMessage(
            "LeapMentor session calendar invite",
            [
              `Hi ${recipientName},`,
              `Calendar invite for your session with ${otherName}.`,
              ...slots.map(slotText),
            ],
            to,
            html,
          ),
          attachments: [attachment],
        };
      });
    }
    case "support.resolved.email": {
      const to = event.toEmail || event.recipientEmail;
      if (!to) return [];
      const subject = event.subject || "Support request";
      const html = wrapEmail(`
        ${buildHeader(BLUE_GRADIENT, "Your support request is resolved", "Our team has looked into your issue and marked it as resolved.")}
        ${body(`
          ${buildInfoCard("Your Request", subject)}
          ${buildBanner("#f0fdf4", "#bbf7d0", "#15803d", "If your issue is fully resolved, no further action is needed. If you still need help, feel free to submit a new request from the Help Center in your dashboard.")}
          ${buildBanner("#eff6ff", "#2563eb", "#1e40af", "Still having trouble? Open your dashboard &rarr; Help Center &rarr; Send us a message.", true)}
        `)}
      `);
      return [
        participantMessage(
          "Your support request has been resolved - LeapMentor",
          [
            "Our team has looked into your issue and marked it as resolved.",
            `Your request: ${subject}`,
            "If you still need help, submit a new message from the Help Center.",
          ],
          to,
          html,
        ),
      ];
    }
    case "profile.documents-submitted.email": {
      if (!event.mentorEmail) return [];
      const mentorName = event.mentorName || "Mentor";
      const html = wrapEmail(`
        ${buildHeader(BLUE_GRADIENT, "Application Received", "We've received your verification documents")}
        ${body(`
          ${buildInfoCard("Applicant", mentorName)}
          <div style="background:#eff6ff;border-radius:12px;padding:16px 18px;margin-bottom:18px;border-left:3px solid #2563eb;">
            <p style="font-size:13px;color:#1e40af;margin:0 0 8px;font-weight:600;">Thank you for submitting your documents!</p>
            <p style="font-size:13px;color:#334155;margin:0;line-height:1.6;">Our team will review your documents, usually within <strong>24–48 hours</strong>. We'll notify you by email once your account has been verified.</p>
          </div>
          <div style="background:#f8fafc;border-radius:12px;padding:16px 18px;margin-bottom:18px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">What happens next?</div>
            <ol style="font-size:13px;color:#334155;line-height:1.8;padding-left:22px;margin:0;"><li>Admin reviews your resume and work documents</li><li>Your profile is verified and activated</li><li>You're ready to start mentoring on LeapMentor</li></ol>
          </div>
          ${buildCTA(dashboardUrl("/dashboard/mentor"), "View Dashboard", "Check your application status anytime")}
        `)}
      `);
      return [
        participantMessage(
          "We received your verification documents - LeapMentor",
          [
            `Hi ${mentorName},`,
            "Our team will review your profile and documents. This process usually takes 24-48 hours.",
            "You will receive an email once your account has been verified.",
          ],
          event.mentorEmail,
          html,
        ),
      ];
    }
    case "profile.mentor-verified.email": {
      if (!event.mentorEmail) return [];
      const mentorName = event.mentorName || "Mentor";
      const verifiedCard = `<span style="display:inline-flex;align-items:center;gap:10px;"><span style="font-size:15px;font-weight:700;color:#1e293b;">${escapeHtml(mentorName)}</span><span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;padding:3px 8px;border-radius:6px;">VERIFIED</span></span>`;
      const html = wrapEmail(`
        ${buildHeader(GREEN_GRADIENT, "Account Verified!", "Congratulations — you're now a verified mentor")}
        ${body(`
          ${buildInfoCard("Verified Mentor", "", verifiedCard)}
          <div style="background:#f0fdf4;border-radius:12px;padding:16px 18px;margin-bottom:18px;border:1px solid #bbf7d0;">
            <p style="font-size:13px;color:#15803d;margin:0 0 8px;font-weight:600;">Welcome to the LeapMentor mentor community!</p>
            <p style="font-size:13px;color:#334155;margin:0;line-height:1.6;">Your profile has been reviewed and verified by our admin team. You can now complete your profile and start receiving mentee connect requests.</p>
          </div>
          <div style="background:#f8fafc;border-radius:12px;padding:16px 18px;margin-bottom:18px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Get started</div>
            <ol style="font-size:13px;color:#334155;line-height:1.8;padding-left:22px;margin:0;"><li>Complete your mentor profile with bio, skills and expertise</li><li>Set your availability so mentees can book sessions</li><li>Start accepting connect requests from mentees</li></ol>
          </div>
          ${buildCTA(dashboardUrl("/dashboard/mentor"), "Complete Your Profile", "You're one step away from your first session")}
        `)}
      `);
      return [
        participantMessage(
          "Your LeapMentor mentor account is verified",
          [
            `Congratulations, ${mentorName}!`,
            "Your profile has been reviewed and verified. You can now complete your profile and receive mentee requests.",
          ],
          event.mentorEmail,
          html,
        ),
      ];
    }
    default:
      return [];
  }
};

module.exports = { buildEmailMessages };
