const createConnectRequestController = ({ connectRequestService }) => {
  const send = async (req, res, next) => {
    try {
      const request = await connectRequestService.sendConnectRequest(req.user._id, req.body);
      return res.status(201).json({ success: true, data: { request }, message: "Connect request sent successfully" });
    } catch (error) { return next(error); }
  };
  const myRequests = async (req, res, next) => {
    try {
      const requests = await connectRequestService.getMyRequests(req.user._id);
      return res.status(200).json({ success: true, data: { requests }, message: "Connect requests retrieved" });
    } catch (error) { return next(error); }
  };
  const incoming = async (req, res, next) => {
    try {
      const requests = await connectRequestService.getIncomingRequests(req.user._id, req.query.status);
      return res.status(200).json({ success: true, data: { requests }, message: "Incoming requests retrieved" });
    } catch (error) { return next(error); }
  };
  const respond = async (req, res, next) => {
    try {
      const request = await connectRequestService.respondToRequest(req.params.id, req.user._id, req.body);
      return res.status(200).json({ success: true, data: { request }, message: `Request ${req.body.status} successfully` });
    } catch (error) { return next(error); }
  };
  const cancel = async (req, res, next) => {
    try {
      await connectRequestService.cancelRequest(req.params.id, req.user._id);
      return res.status(200).json({ success: true, data: null, message: "Request cancelled successfully" });
    } catch (error) { return next(error); }
  };
  const ongoing = async (req, res, next) => {
    try {
      const connects = await connectRequestService.getOngoingConnects(req.user._id);
      return res.status(200).json({ success: true, data: { connects }, message: "Ongoing connects retrieved" });
    } catch (error) { return next(error); }
  };
  const detail = async (req, res, next) => {
    try {
      const connect = await connectRequestService.getConnectDetail(req.params.id, req.user._id);
      return res.status(200).json({ success: true, data: { connect }, message: "Connect details retrieved" });
    } catch (error) { return next(error); }
  };
  return { send, myRequests, incoming, respond, cancel, ongoing, detail };
};

module.exports = createConnectRequestController;
