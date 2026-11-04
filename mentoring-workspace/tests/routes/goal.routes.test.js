const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createGoalRouter = require("../../routes/goal.routes");
const createGoalController = require("../../controllers/goal.controller");
const createAuthenticate = require("../../middleware/authenticate");
const validations = require("../../middleware/goalValidation");

const REQUEST_ID = "507f1f77bcf86cd799439011";
const GOAL_ID = "507f1f77bcf86cd799439012";
const MILESTONE_ID = "507f1f77bcf86cd799439013";

const startServer = async (goalService) => {
  const controller = createGoalController({ goalService });
  const goalRouter = createGoalRouter({
    controller,
    authenticate: createAuthenticate({ accessSecret: "test-secret" }),
    validations,
  });
  const server = http.createServer(
    createApp({ health: { isReady: () => true }, goalRouter }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/api/v1/goals`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

const withServer = async (goalService, run) => {
  const details = await startServer(goalService);
  try {
    await run(details);
  } finally {
    await new Promise((resolve) => details.server.close(resolve));
  }
};

test("goal routes require a bearer token", async () => {
  await withServer({}, async ({ url }) => {
    const response = await fetch(`${url}/${REQUEST_ID}`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "INVALID_ACCESS_TOKEN");
  });
});

test("POST /goals creates a goal for the authenticated user", async () => {
  let received;
  await withServer(
    {
      createGoal: async (input) => {
        received = input;
        return { _id: GOAL_ID, title: input.title };
      },
    },
    async ({ url, headers }) => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          connectRequestId: REQUEST_ID,
          title: "Ship it",
          startDate: "2099-01-01",
          userId: "spoofed",
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.data.goal.title, "Ship it");
      assert.equal(received.userId, "mentee-1");
      assert.equal(received.connectRequestId, REQUEST_ID);
    },
  );
});

test("POST /goals rejects invalid bodies with 400", async () => {
  await withServer(
    {
      createGoal: async () => {
        throw new Error("must not be called");
      },
    },
    async ({ url, headers }) => {
      const send = (payload) =>
        fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
      assert.equal((await send({ title: "x" })).status, 400);
      assert.equal(
        (await send({ connectRequestId: "bad", title: "x" })).status,
        400,
      );
      assert.equal(
        (await send({ connectRequestId: REQUEST_ID, title: "  " })).status,
        400,
      );
      assert.equal(
        (await send({ connectRequestId: REQUEST_ID, title: 42 })).status,
        400,
      );
      assert.equal(
        (
          await send({
            connectRequestId: REQUEST_ID,
            title: "x",
            startDate: "01/02/2099",
          })
        ).status,
        400,
      );
      const noBody = await fetch(url, {
        method: "POST",
        headers: { Authorization: headers.Authorization },
      });
      assert.equal(noBody.status, 400);
      assert.equal((await noBody.json()).code, "INVALID_GOAL_REQUEST");
    },
  );
});

test("GET /goals/:connectRequestId returns the goal payload and validates the id", async () => {
  await withServer(
    {
      getGoalByConnection: async (id, userId) => ({
        goal: { connectRequest: id },
        milestones: [],
        userId,
      }),
    },
    async ({ url, headers }) => {
      const ok = await fetch(`${url}/${REQUEST_ID}`, { headers });
      const body = await ok.json();
      assert.equal(ok.status, 200);
      assert.equal(body.data.goal.connectRequest, REQUEST_ID);
      assert.equal(body.data.userId, "mentee-1");

      const bad = await fetch(`${url}/not-an-id`, { headers });
      assert.equal(bad.status, 400);
    },
  );
});

test("PATCH /goals/:goalId updates a goal, validates status, and tolerates a missing body", async () => {
  await withServer(
    {
      updateGoal: async (input) => ({
        _id: input.goalId,
        status: input.status,
      }),
    },
    async ({ url, headers }) => {
      const ok = await fetch(`${url}/${GOAL_ID}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "completed" }),
      });
      assert.equal(ok.status, 200);
      assert.equal((await ok.json()).data.goal.status, "completed");

      const badStatus = await fetch(`${url}/${GOAL_ID}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "paused" }),
      });
      assert.equal(badStatus.status, 400);

      const empty = await fetch(`${url}/${GOAL_ID}`, {
        method: "PATCH",
        headers: { Authorization: headers.Authorization },
      });
      assert.equal(empty.status, 200);

      const badId = await fetch(`${url}/nope`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({}),
      });
      assert.equal(badId.status, 400);
    },
  );
});

test("milestone routes create, update and delete through the service", async () => {
  const calls = [];
  await withServer(
    {
      createMilestone: async (input) => {
        calls.push(["create", input.goalId]);
        return { _id: MILESTONE_ID, title: input.title };
      },
      updateMilestone: async (input) => {
        calls.push(["update", input.milestoneId]);
        return { _id: input.milestoneId, isCompleted: input.isCompleted };
      },
      deleteMilestone: async (id) => {
        calls.push(["delete", id]);
        return id;
      },
    },
    async ({ url, headers }) => {
      const created = await fetch(`${url}/${GOAL_ID}/milestones`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "Step 1", dueDate: "2099-03-03" }),
      });
      assert.equal(created.status, 201);
      assert.equal((await created.json()).data.milestone.title, "Step 1");

      const updated = await fetch(`${url}/milestones/${MILESTONE_ID}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isCompleted: true }),
      });
      assert.equal(updated.status, 200);
      assert.equal((await updated.json()).data.milestone.isCompleted, true);

      const deleted = await fetch(`${url}/milestones/${MILESTONE_ID}`, {
        method: "DELETE",
        headers,
      });
      assert.equal(deleted.status, 200);
      assert.equal((await deleted.json()).data.milestoneId, MILESTONE_ID);

      assert.deepEqual(calls, [
        ["create", GOAL_ID],
        ["update", MILESTONE_ID],
        ["delete", MILESTONE_ID],
      ]);
    },
  );
});

test("milestone routes reject malformed ids and bodies", async () => {
  await withServer({}, async ({ url, headers }) => {
    const send = (path, method, payload) =>
      fetch(`${url}${path}`, {
        method,
        headers,
        body: payload && JSON.stringify(payload),
      });
    assert.equal(
      (await send("/bad/milestones", "POST", { title: "x" })).status,
      400,
    );
    assert.equal(
      (await send(`/${GOAL_ID}/milestones`, "POST", { title: " " })).status,
      400,
    );
    assert.equal(
      (
        await send(`/${GOAL_ID}/milestones`, "POST", {
          title: "x",
          dueDate: "tomorrow",
        })
      ).status,
      400,
    );
    assert.equal((await send("/milestones/bad", "PATCH", {})).status, 400);
    assert.equal(
      (
        await send(`/milestones/${MILESTONE_ID}`, "PATCH", {
          isCompleted: "yes",
        })
      ).status,
      400,
    );
    assert.equal((await send("/milestones/bad", "DELETE")).status, 400);
  });
});

test("service errors keep their status code and error code in the response", async () => {
  const error = Object.assign(new Error("Not authorized"), {
    statusCode: 403,
    code: "NOT_PARTICIPANT",
  });
  await withServer(
    {
      getGoalByConnection: async () => {
        throw error;
      },
    },
    async ({ url, headers }) => {
      const response = await fetch(`${url}/${REQUEST_ID}`, { headers });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "NOT_PARTICIPANT");
    },
  );
});
