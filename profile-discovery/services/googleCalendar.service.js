const AppError = require("../utils/AppError");

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const MAX_EVENT_RESULTS = 250;

const createGoogleCalendarService = ({
  google,
  googleConfig,
  calendarStateService,
  availabilityRepository,
  logger = console,
}) => {
  const isConfigured = Boolean(
    googleConfig.clientId &&
      googleConfig.clientSecret &&
      googleConfig.redirectUri,
  );

  const ensureConfigured = () => {
    if (!isConfigured) {
      throw new AppError(
        "Google Calendar is not configured",
        503,
        "CALENDAR_PROVIDER_NOT_CONFIGURED",
      );
    }
  };

  const createClient = () =>
    new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret,
      googleConfig.redirectUri,
    );

  const bindTokenRefreshListener = (client, currentTokens, mentorId) => {
    if (typeof client.on !== "function") return;
    client.on("tokens", (newTokens) => {
      availabilityRepository
        .updateGoogleCalendarConfig(mentorId, {
          googleCalendarToken: JSON.stringify({ ...currentTokens, ...newTokens }),
        })
        .catch((error) =>
          logger.error?.("Google Calendar token refresh storage failed", {
            message: error.message,
          }),
        );
    });
  };

  const parseTokens = (availability) => {
    if (!availability?.googleCalendarToken) return null;
    try {
      return JSON.parse(availability.googleCalendarToken);
    } catch {
      throw new AppError(
        "Stored Google Calendar credentials are invalid",
        502,
        "INVALID_CALENDAR_CREDENTIALS",
      );
    }
  };

  const createCalendarClient = async (mentorId) => {
    ensureConfigured();
    const availability = await availabilityRepository.findWithCalendarToken(mentorId);
    const tokens = parseTokens(availability);
    if (!tokens) return null;

    const client = createClient();
    client.setCredentials(tokens);
    bindTokenRefreshListener(client, tokens, mentorId);
    return google.calendar({ version: "v3", auth: client });
  };

  const dateRange = (startDate, endDate) => ({
    timeMin: new Date(`${startDate}T00:00:00Z`).toISOString(),
    timeMax: new Date(`${endDate}T23:59:59Z`).toISOString(),
  });

  const generateAuthUrl = async (userId) => {
    ensureConfigured();
    const client = createClient();
    return client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state: calendarStateService.create(userId),
    });
  };

  const handleAuthCallback = async (code, state) => {
    ensureConfigured();
    if (!code || !state) {
      throw new AppError("Authorization code and state are required", 400, "INVALID_CALENDAR_CALLBACK");
    }

    let stateData;
    try {
      stateData = calendarStateService.verify(state);
    } catch (error) {
      throw new AppError(error.message, 400, "INVALID_CALENDAR_STATE");
    }

    const client = createClient();
    const { tokens } = await client.getToken(code);
    await availabilityRepository.updateGoogleCalendarConfig(stateData.userId, {
      googleCalendarConnected: true,
      googleCalendarToken: JSON.stringify(tokens),
    });
    return stateData.userId;
  };

  const disconnectCalendar = async (mentorId) => {
    await availabilityRepository.updateGoogleCalendarConfig(mentorId, {
      googleCalendarConnected: false,
      googleCalendarToken: "",
    });
  };

  const getBusySlots = async ({ mentorId, startDate, endDate }) => {
    const calendar = await createCalendarClient(mentorId);
    if (!calendar) return [];
    const response = await calendar.freebusy.query({
      requestBody: {
        ...dateRange(startDate, endDate),
        items: [{ id: "primary" }],
      },
    });
    return response.data?.calendars?.primary?.busy || [];
  };

  const getCalendarEvents = async ({ mentorId, startDate, endDate }) => {
    const calendar = await createCalendarClient(mentorId);
    if (!calendar) return [];
    const range = dateRange(startDate, endDate);
    const calendarList = await calendar.calendarList.list();
    const calendarIds = (calendarList.data?.items || [])
      .filter((item) => item.selected !== false)
      .map((item) => item.id)
      .filter(Boolean);
    const events = [];

    for (const calendarId of calendarIds) {
      try {
        const response = await calendar.events.list({
          calendarId,
          ...range,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: MAX_EVENT_RESULTS,
        });
        for (const event of response.data?.items || []) {
          events.push({
            id: event.id,
            summary: event.summary || "Busy",
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            allDay: !event.start?.dateTime,
          });
        }
      } catch (error) {
        logger.warn?.("Failed to fetch Google Calendar events", {
          calendarId,
          message: error.message,
        });
      }
    }

    const seen = new Set();
    return events.filter((event) => {
      if (!event.id || seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
  };

  return {
    generateAuthUrl,
    handleAuthCallback,
    disconnectCalendar,
    getBusySlots,
    getCalendarEvents,
  };
};

module.exports = createGoogleCalendarService;
