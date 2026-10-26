const createSessionRepository = (ConnectRequest) => ({
  findById: (id) => ConnectRequest.findById(id),
  save: (request) => request.save(),
});

module.exports = createSessionRepository;
