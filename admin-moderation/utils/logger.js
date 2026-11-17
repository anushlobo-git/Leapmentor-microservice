const { AsyncLocalStorage } = require("node:async_hooks");
const crypto = require("node:crypto");
const env = require("../config/env");

const requestContext = new AsyncLocalStorage();

const normalize = (value, seen = new WeakSet()) => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalize(item, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item, seen)]),
    );
  }
  return value;
};

const write = (level, message, ...details) => {
  const fields = {};
  for (const detail of details) {
    if (detail instanceof Error) fields.error = detail;
    else if (detail && typeof detail === "object") Object.assign(fields, detail);
    else if (detail !== undefined) fields.detail = detail;
  }

  const traceId = fields.traceId ?? requestContext.getStore()?.traceId ?? null;
  delete fields.traceId;
  const entry = normalize({
    ...fields,
    timestamp: new Date().toISOString(),
    level,
    message: message instanceof Error ? message.message : String(message),
    service: env.serviceName,
    traceId,
  });
  process.stdout.write(`${JSON.stringify(entry)}\n`);
};

const logger = {
  info: (message, ...details) => write("info", message, ...details),
  warn: (message, ...details) => write("warn", message, ...details),
  error: (message, ...details) => write("error", message, ...details),
  debug: (message, ...details) => write("debug", message, ...details),
};

const requestMiddleware = (req, res, next) => {
  const incomingTraceId = req.get("X-Correlation-ID");
  const traceId =
    incomingTraceId && incomingTraceId.length <= 128 ? incomingTraceId : crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  req.correlationId = traceId;
  req.traceId = traceId;
  res.setHeader("X-Correlation-ID", traceId);
  res.on("finish", () => {
    logger.info("HTTP request completed", {
      method: req.method,
      path: req.originalUrl.split("?")[0],
      statusCode: res.statusCode,
      durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
      traceId,
    });
  });

  requestContext.run({ traceId }, next);
};

module.exports = { ...logger, requestMiddleware };
