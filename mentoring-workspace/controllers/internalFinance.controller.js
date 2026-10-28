const createInternalFinanceController = ({
  financeRepository,
  identityClient,
  profileClient,
  notificationClient,
}) => {
  const decorateMentees = async (rows, correlationId) => {
    const userIds = rows
      .map((row) => row.mentee?._id ?? row.mentee)
      .filter(Boolean);
    const users = await identityClient.getUserSummaryMap(
      userIds,
      correlationId,
    );
    return rows.map((row) => ({
      ...row,
      mentee: users.get(String(row.mentee?._id ?? row.mentee)) || row.mentee,
    }));
  };

  const getInvoiceContext = async (req, res, next) => {
    try {
      const request = await financeRepository.findInvoiceContext(
        req.params.requestId,
      );
      if (!request)
        return res
          .status(404)
          .json({ error: "Session not found", code: "SESSION_NOT_FOUND" });
      const users = await identityClient.getUserSummaryMap(
        [request.mentee, request.mentor],
        req.correlationId,
      );
      return res.status(200).json({
        success: true,
        data: {
          ...request,
          mentee: users.get(String(request.mentee)) || request.mentee,
          mentor: users.get(String(request.mentor)) || request.mentor,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  const getMentorSessions = async (req, res, next) => {
    try {
      const status = req.query.status === "ongoing" ? "ongoing" : "completed";
      const since = req.query.since ? new Date(req.query.since) : null;
      if (since && Number.isNaN(since.getTime()))
        return res
          .status(400)
          .json({ error: "Invalid since date", code: "INVALID_DATE" });
      const rows = await financeRepository.findMentorSessions(
        req.params.mentorId,
        status,
        since,
      );
      const decorated = await decorateMentees(rows, req.correlationId);
      return res
        .status(200)
        .json({ success: true, data: { sessions: decorated } });
    } catch (error) {
      return next(error);
    }
  };

  const getPayouts = async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        20,
        Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
      );
      const filter = { mentor: req.params.mentorId, status: "completed" };
      if (req.query.search?.trim()) {
        const users = await identityClient.searchUserSummaries(
          req.query.search.trim(),
          "mentee",
          req.correlationId,
        );
        filter.mentee = { $in: users.map((user) => user._id) };
      }
      const [totalCount, rows] = await Promise.all([
        financeRepository.countPayouts(filter),
        financeRepository.findPayouts(filter, {
          skip: (page - 1) * limit,
          limit,
        }),
      ]);
      const payouts = await decorateMentees(rows, req.correlationId);
      return res.status(200).json({
        success: true,
        data: {
          payouts,
          pagination: {
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: page < Math.ceil(totalCount / limit),
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  const getMentorRating = async (req, res, next) => {
    try {
      const rating = await profileClient.getMentorRating(
        req.params.mentorId,
        req.correlationId,
      );
      return res.status(200).json({ success: true, data: rating });
    } catch (error) {
      return next(error);
    }
  };

  const queueInvoiceEmail = async (req, res, next) => {
    try {
      const event = req.body || {};
      if (
        !event.sourceEventId ||
        !event.reporterEmail ||
        !event.invoicePdfBase64
      ) {
        return res
          .status(400)
          .json({
            error: "Invoice email event is incomplete",
            code: "INVALID_INVOICE_EMAIL_EVENT",
          });
      }
      if (event.invoicePdfBase64.length > 4_000_000) {
        return res
          .status(413)
          .json({
            error: "Invoice attachment is too large",
            code: "INVOICE_ATTACHMENT_TOO_LARGE",
          });
      }
      const result = await notificationClient.publish(
        { ...event, eventType: "payment.invoice.email" },
        req.correlationId,
      );
      return res
        .status(202)
        .json({ success: true, data: result, message: "Invoice email queued" });
    } catch (error) {
      return next(error);
    }
  };

  return {
    getInvoiceContext,
    getMentorSessions,
    getPayouts,
    getMentorRating,
    queueInvoiceEmail,
  };
};

module.exports = createInternalFinanceController;
