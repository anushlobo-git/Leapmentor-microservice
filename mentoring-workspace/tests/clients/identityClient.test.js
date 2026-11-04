const test = require("node:test");
const assert = require("node:assert/strict");

const createIdentityClient = require("../../clients/identityClient");

const fakeHttpClient = (response) => {
  const requests = [];
  return {
    requests,
    request: async (options) => {
      requests.push(options);
      if (response instanceof Error) throw response;
      return response;
    },
  };
};

test("getUserSummaries calls the Identity ids lookup and returns the users", async () => {
  const httpClient = fakeHttpClient({
    data: { users: [{ _id: "u1", name: "Jane" }] },
  });
  const client = createIdentityClient({ httpClient });

  const users = await client.getUserSummaries(["u1", "u2"], "corr-1");

  assert.deepEqual(users, [{ _id: "u1", name: "Jane" }]);
  assert.deepEqual(httpClient.requests, [
    {
      method: "GET",
      path: "/internal/v1/users?ids=u1%2Cu2",
      correlationId: "corr-1",
    },
  ]);
});

test("de-duplicates and drops empty IDs before calling Identity", async () => {
  const httpClient = fakeHttpClient({ data: { users: [] } });
  const client = createIdentityClient({ httpClient });

  await client.getUserSummaries(["u1", "u1", "", null, undefined, "u2"]);

  assert.equal(httpClient.requests[0].path, "/internal/v1/users?ids=u1%2Cu2");
});

test("does not call Identity when there is nothing to look up", async () => {
  const httpClient = fakeHttpClient({ data: { users: [] } });
  const client = createIdentityClient({ httpClient });

  assert.deepEqual(await client.getUserSummaries([]), []);
  assert.deepEqual(await client.getUserSummaries(undefined), []);
  assert.deepEqual(await client.getUserSummaries([null, ""]), []);
  assert.equal(httpClient.requests.length, 0);
});

test("returns an empty list when the response has no users", async () => {
  const client = createIdentityClient({
    httpClient: fakeHttpClient({ data: {} }),
  });
  assert.deepEqual(await client.getUserSummaries(["u1"]), []);

  const empty = createIdentityClient({ httpClient: fakeHttpClient(null) });
  assert.deepEqual(await empty.getUserSummaries(["u1"]), []);
});

test("getUserSummaryMap keys summaries by user ID", async () => {
  const client = createIdentityClient({
    httpClient: fakeHttpClient({
      data: {
        users: [
          { _id: "u1", name: "Jane" },
          { _id: "u2", name: "Raj" },
        ],
      },
    }),
  });

  const map = await client.getUserSummaryMap(["u1", "u2"]);

  assert.equal(map.get("u1").name, "Jane");
  assert.equal(map.get("u2").name, "Raj");
  assert.equal(map.has("u3"), false);
});

test("propagates Identity failures so the caller decides how to degrade", async () => {
  const failure = Object.assign(new Error("unavailable"), { statusCode: 503 });
  const client = createIdentityClient({ httpClient: fakeHttpClient(failure) });

  await assert.rejects(client.getUserSummaries(["u1"]), (error) => {
    assert.equal(error.statusCode, 503);
    return true;
  });
});
