const AppError = require("../utils/AppError");

const createPlatformSettingsService = ({
  platformSettingRepository,
  defaultCommissionRate,
}) => {
  const getCommissionRate = async () => {
    const setting = await platformSettingRepository.findCommission();
    return setting?.numberValue ?? defaultCommissionRate;
  };

  const updateCommissionRate = async (value) => {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new AppError(
        "Commission rate must be between 0 and 100",
        400,
        "INVALID_COMMISSION_RATE",
      );
    }
    await platformSettingRepository.saveCommission(rate);
    return rate;
  };

  return { getCommissionRate, updateCommissionRate };
};

module.exports = createPlatformSettingsService;
