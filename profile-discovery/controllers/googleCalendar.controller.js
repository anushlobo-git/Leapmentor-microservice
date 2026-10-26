const createGoogleCalendarController = ({ googleCalendarService }) => {
  const callbackScript = (payload) =>
    `<script>window.opener?.postMessage(${JSON.stringify(payload)}, "*");window.close();</script>`;

  const getAuthUrl = async (req, res, next) => {
    try {
      const url = await googleCalendarService.generateAuthUrl(req.user._id);
      return res.status(200).json({
        success: true,
        data: { url },
        message: "Google Calendar auth URL generated",
      });
    } catch (error) {
      return next(error);
    }
  };

  const handleCallback = async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.status(200).send(callbackScript({ type: "GOOGLE_CALENDAR_ERROR", error }));

    try {
      await googleCalendarService.handleAuthCallback(code, state);
      return res.status(200).send(callbackScript({ type: "GOOGLE_CALENDAR_CONNECTED" }));
    } catch (callbackError) {
      return res.status(200).send(
        callbackScript({
          type: "GOOGLE_CALENDAR_ERROR",
          error: callbackError.message || "Google Calendar connection failed",
        }),
      );
    }
  };

  const disconnect = async (req, res, next) => {
    try {
      await googleCalendarService.disconnectCalendar(req.user._id);
      return res.status(200).json({
        success: true,
        data: null,
        message: "Google Calendar disconnected",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getBusySlots = async (req, res, next) => {
    try {
      const busy = await googleCalendarService.getBusySlots({
        mentorId: req.user._id,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });
      return res.status(200).json({
        success: true,
        data: { busy },
        message: "Busy slots retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getEvents = async (req, res, next) => {
    try {
      const events = await googleCalendarService.getCalendarEvents({
        mentorId: req.user._id,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });
      return res.status(200).json({
        success: true,
        data: { events },
        message: "Calendar events retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getAuthUrl, handleCallback, disconnect, getBusySlots, getEvents };
};

module.exports = createGoogleCalendarController;
