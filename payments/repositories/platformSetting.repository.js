const COMMISSION_KEY = "commissionRate";

const createPlatformSettingRepository = (PlatformSetting) => ({
  findCommission: async () =>
    PlatformSetting.findOne({ key: COMMISSION_KEY }).lean(),
  saveCommission: (numberValue) =>
    PlatformSetting.findOneAndUpdate(
      { key: COMMISSION_KEY },
      { $set: { numberValue } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean(),
});

module.exports = createPlatformSettingRepository;
