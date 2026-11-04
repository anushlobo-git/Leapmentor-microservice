const mongoose = require("mongoose");

const env = require("./env");

let connectionPromise = null;

const connectDatabase = async () => {
  if (!env.mongoUri) return false;
  if (mongoose.connection.readyState === 1) return true;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
    });
  }

  await connectionPromise;
  return mongoose.connection.readyState === 1;
};

const closeDatabase = async () => {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

const isConnected = () => mongoose.connection.readyState === 1;

module.exports = {
  connectDatabase,
  closeDatabase,
  isConnected,
};
