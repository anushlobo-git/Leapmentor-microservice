const http = require("node:http");
const express = require("express");
const test = require("node:test");
const assert = require("node:assert/strict");

const createReportRouter = require("../../routes/report.routes");
const errorHandler = require("../../middleware/errorHandler");

const startServer = async (roles) => {
  let uploadCalled = false;
  let controllerCalled = false;
  const app = express();
  app.use(
    "/reports",
    createReportRouter({
      authenticate: (req, _res, next) => {
        req.user = { _id: "user-1" };
        req.correlationId = "corr-report";
        next();
      },
      identityClient: {
        getUserSummaries: async () => [{ _id: "user-1", roles }],
      },
      upload: (_req, _res, next) => {
        uploadCalled = true;
        next();
      },
      validations: {
        submitReportValidation: (_req, _res, next) => next(),
        getMyReportValidation: (_req, _res, next) => next(),
      },
      controller: {
        submitReport: (_req, res) => {
          controllerCalled = true;
          res.status(201).json({ success: true });
        },
        getMyReport: (_req, res) => {
          controllerCalled = true;
          res.status(200).json({ success: true });
        },
      },
    }),
  );
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    server,
    uploadWasCalled: () => uploadCalled,
    controllerWasCalled: () => controllerCalled,
  };
};

test("report routes require mentor or mentee role before handling the request", async () => {
  const setup = await startServer(["admin"]);
  try {
    const response = await fetch(
      `http://127.0.0.1:${setup.server.address().port}/reports/`,
      {
        method: "POST",
      },
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "ROLE_REQUIRED");
    assert.equal(setup.uploadWasCalled(), false);
    assert.equal(setup.controllerWasCalled(), false);
  } finally {
    await new Promise((resolve) => setup.server.close(resolve));
  }
});

test("report routes allow mentor and mentee roles", async () => {
  const setup = await startServer(["mentee"]);
  try {
    const response = await fetch(
      `http://127.0.0.1:${setup.server.address().port}/reports/`,
      {
        method: "POST",
      },
    );
    assert.equal(response.status, 201);
    assert.equal(setup.uploadWasCalled(), true);
    assert.equal(setup.controllerWasCalled(), true);
  } finally {
    await new Promise((resolve) => setup.server.close(resolve));
  }
});
