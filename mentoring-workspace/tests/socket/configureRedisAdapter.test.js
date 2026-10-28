const test = require("node:test");
const assert = require("node:assert/strict");

const configureRedisAdapter = require("../../socket/configureRedisAdapter");

const createRedisPair = () => {
  const clients = [];
  const createClient = ({ url }) => {
    const client = {
      url,
      isOpen: false,
      on() {},
      duplicate: () => createClient({ url }),
      connect: async () => {
        client.isOpen = true;
      },
      quit: async () => {
        client.isOpen = false;
      },
    };
    clients.push(client);
    return client;
  };
  return { createClient, clients };
};

test("enables the Socket.IO adapter with connected publisher and subscriber clients", async () => {
  const { createClient, clients } = createRedisPair();
  const adapters = [];
  const io = { adapter: (adapter) => adapters.push(adapter) };
  const result = await configureRedisAdapter({
    io,
    enabled: true,
    url: "redis://local",
    createClient,
    createAdapter: (publisher, subscriber) => ({ publisher, subscriber }),
  });
  assert.equal(result.enabled, true);
  assert.equal(clients.length, 2);
  assert.equal(adapters[0].publisher, clients[0]);
  await result.close();
  assert.equal(
    clients.every((client) => !client.isOpen),
    true,
  );
});

test("does not create Redis clients when disabled and rejects a missing URL when enabled", async () => {
  let created = false;
  const disabled = await configureRedisAdapter({
    io: {},
    enabled: false,
    createClient: () => {
      created = true;
    },
  });
  assert.equal(disabled.enabled, false);
  assert.equal(created, false);
  await assert.rejects(
    configureRedisAdapter({
      io: {},
      enabled: true,
      url: "",
      createClient() {},
      createAdapter() {},
    }),
    /REDIS_URL/,
  );
});
