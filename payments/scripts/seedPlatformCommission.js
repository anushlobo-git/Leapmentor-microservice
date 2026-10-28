const db = require("../config/db");
const env = require("../config/env");
const PlatformSetting = require("../models/PlatformSetting");

const COMMISSION_KEY = "commissionRate";

const seedPlatformCommission = async ({
  settingModel = PlatformSetting,
  defaultRate = env.commissionRate,
}) => {
  const rate = Number(defaultRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error("COMMISSION_RATE must be a number between 0 and 100");
  }
  const result = await settingModel.updateOne(
    { key: COMMISSION_KEY },
    { $setOnInsert: { key: COMMISSION_KEY, numberValue: rate } },
    { upsert: true, runValidators: true },
  );
  return { inserted: result.upsertedCount === 1, rate };
};

const main = async () => {
  try {
    const connected = await db.connectDatabase();
    if (!connected) throw new Error("MONGO_URI is required to seed the commission rate");
    const result = await seedPlatformCommission();
    process.stdout.write(result.inserted
      ? `Seeded commission rate at ${result.rate}%\n`
      : "Commission rate already exists; left unchanged\n");
  } catch (error) {
    process.stderr.write(`Commission seed failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await db.closeDatabase().catch(() => null);
  }
};

if (require.main === module) main();

module.exports = seedPlatformCommission;