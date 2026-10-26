const test = require("node:test");
const assert = require("node:assert/strict");

const createGoogleCalendarService = require("../../services/googleCalendar.service");
const createCalendarStateService = require("../../utils/calendarState.service");

const createFakeGoogle = ({ tokenResponse = { access_token: "access" }, calendarApi } = {}) => {
  const clients = [];
  class OAuth2 {
    constructor(clientId, clientSecret, redirectUri) {
      this.config = { clientId, clientSecret, redirectUri };
      this.listeners = {};
      clients.push(this);
    }

    generateAuthUrl(options) {
      this.authOptions = options;
      return `https://accounts.google.test/auth?state=${options.state}`;
    }

    async getToken(code) {
      this.code = code;
      return { tokens: tokenResponse };
    }

    setCredentials(tokens) {
      this.credentials = tokens;
    }

    on(event, callback) {
      this.listeners[event] = callback;
    }
  }
  return {
    google: { auth: { OAuth2 }, calendar: () => calendarApi },
    clients,
  };
};

const createService = (overrides = {}) => {
  const stateService = createCalendarStateService({ secret: "calendar-secret" });
  const repository = {
    findWithCalendarToken: async () => ({
      googleCalendarToken: JSON.stringify({ refresh_token: "refresh" }),
    }),
    updateGoogleCalendarConfig: async (...args) => args,
    ...overrides.repository,
  };
  const calendarApi = {
    freebusy: {
      query: async () => ({
        data: { calendars: { primary: { busy: [{ start: "10:00", end: "11:00" }] } } },
      }),
    },
    calendarList: {
      list: async () => ({ data: { items: [{ id: "primary" }, { id: "work" }] } }),
    },
    events: {
      list: async ({ calendarId }) => ({
        data: {
          items:
            calendarId === "primary"
              ? [{ id: "event-1", summary: "Focus", start: { dateTime: "2026-01-01T10:00:00Z" }, end: { dateTime: "2026-01-01T11:00:00Z" } }]
              : [{ id: "event-1", summary: "Duplicate" }, { id: "event-2", summary: "Work", start: { date: "2026-01-02" }, end: { date: "2026-01-03" } }],
        },
      }),
    },
  };
  const fakeGoogle = createFakeGoogle({ calendarApi });
  const service = createGoogleCalendarService({
    google: fakeGoogle.google,
    googleConfig: {
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost/callback",
    },
    calendarStateService: stateService,
    availabilityRepository: repository,
    logger: { warn: () => undefined, error: () => undefined },
  });
  return { service, repository, stateService, fakeGoogle };
};

test("generates an offline Google Calendar authorization URL", async () => {
  const { service, fakeGoogle } = createService();

  const url = await service.generateAuthUrl("user-1");

  assert.match(url, /^https:\/\/accounts\.google\.test\/auth\?state=/);
  assert.equal(fakeGoogle.clients[0].authOptions.access_type, "offline");
  assert.equal(fakeGoogle.clients[0].authOptions.prompt, "consent");
});

test("verifies callback state, exchanges the code, and stores calendar credentials", async () => {
  const calls = [];
  const { service, stateService, repository } = createService({
    repository: {
      updateGoogleCalendarConfig: async (...args) => {
        calls.push(args);
      },
    },
  });
  const state = stateService.create("user-1");

  await service.handleAuthCallback("code-1", state);

  assert.deepEqual(calls, [[
    "user-1",
    {
      googleCalendarConnected: true,
      googleCalendarToken: JSON.stringify({ access_token: "access" }),
    },
  ]]);
  assert.ok(repository);
});

test("returns busy slots and normalized deduplicated events", async () => {
  const { service, fakeGoogle } = createService();

  const busy = await service.getBusySlots({
    mentorId: "user-1",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
  });
  const events = await service.getCalendarEvents({
    mentorId: "user-1",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
  });

  assert.deepEqual(busy, [{ start: "10:00", end: "11:00" }]);
  assert.deepEqual(events, [
    {
      id: "event-1",
      summary: "Focus",
      start: "2026-01-01T10:00:00Z",
      end: "2026-01-01T11:00:00Z",
      allDay: false,
    },
    {
      id: "event-2",
      summary: "Work",
      start: "2026-01-02",
      end: "2026-01-03",
      allDay: true,
    },
  ]);
  assert.deepEqual(fakeGoogle.clients[0].credentials, { refresh_token: "refresh" });
});

test("returns empty calendar data when the mentor has not connected Google Calendar", async () => {
  const { service } = createService({
    repository: { findWithCalendarToken: async () => ({ googleCalendarToken: "" }) },
  });

  assert.deepEqual(
    await service.getBusySlots({ mentorId: "user-1", startDate: "2026-01-01", endDate: "2026-01-02" }),
    [],
  );
});

test("returns a provider configuration error before attempting OAuth", async () => {
  const stateService = createCalendarStateService({ secret: "calendar-secret" });
  const service = createGoogleCalendarService({
    google: {},
    googleConfig: { clientId: "", clientSecret: "", redirectUri: "" },
    calendarStateService: stateService,
    availabilityRepository: {},
  });

  await assert.rejects(service.generateAuthUrl("user-1"), {
    statusCode: 503,
    code: "CALENDAR_PROVIDER_NOT_CONFIGURED",
  });
});
