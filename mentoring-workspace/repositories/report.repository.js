const createReportRepository = (Report) => ({
  countAllReports: () => Report.countDocuments(),
  countReportsByFilter: (filter) => Report.countDocuments(filter),
  findReports: (filter, { skip, limit }) =>
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  findById: (id) => Report.findById(id).lean(),
  updateById: (id, update) =>
    Report.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean(),
});

module.exports = createReportRepository;
