const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

// Load the service environment first. The legacy file is only a migration
// fallback for local use and is never written to or copied into the service.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const legacyEnvPath = process.env.LEGACY_ADMIN_ENV_PATH || path.resolve(
  __dirname,
  "../../../Leapmentor-backend/.env",
);

const readLegacyEnv = () => {
  try {
    return dotenv.parse(fs.readFileSync(legacyEnvPath));
  } catch {
    return {};
  }
};

const legacyEnv = readLegacyEnv();
const getAdminEnv = (key, fallback = "") =>
  process.env[key] || legacyEnv[key] || fallback;

const db = require("../config/db");
const AdminUser = require("../models/AdminUser");

const admin = {
  name: getAdminEnv("ADMIN_NAME", "Super Admin").trim(),
  email: getAdminEnv("ADMIN_EMAIL").trim().toLowerCase(),
  password: getAdminEnv("ADMIN_PASSWORD"),
  isSuperAdmin: true,
};

const validateAdmin = () => {
  if (!admin.email || !admin.password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in the service .env or legacy Leapmentor-backend/.env",
    );
  }
  if (!admin.name) throw new Error("ADMIN_NAME must not be empty");
};

const seedAdmin = async ({ adminModel = AdminUser } = {}) => {
  validateAdmin();

  const existing = await adminModel.findOne({ email: admin.email });
  if (existing) return { inserted: false, email: admin.email };

  await adminModel.create(admin);
  return { inserted: true, email: admin.email };
};

const main = async () => {
  try {
    const connected = await db.connectDatabase();
    if (!connected) throw new Error("MONGO_URI is required to seed the admin");

    const result = await seedAdmin();
    process.stdout.write(
      result.inserted
        ? `Admin created: ${result.email}\n`
        : `Admin already exists; left unchanged: ${result.email}\n`,
    );
  } catch (error) {
    process.stderr.write(`Admin seed failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await db.closeDatabase().catch(() => null);
  }
};

if (require.main === module) main();

module.exports = { seedAdmin, validateAdmin };
