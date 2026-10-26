const cloudinary = require("cloudinary").v2;
const env = require("./env");

const configured = Boolean(
  env.cloudinary.cloudName &&
    env.cloudinary.apiKey &&
    env.cloudinary.apiSecret,
);

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

module.exports = { cloudinary, configured };
