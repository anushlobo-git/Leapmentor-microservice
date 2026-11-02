const createInternalAvailabilityController = ({
  availabilityBlockerRepository,
}) => {
  const getBlockers = async (req, res, next) => {
    try {
      const { mentorId } = req.params;
      const excludeUserId = req.query.excludeUserId || "";
      if (req.query.requestId) {
        const request =
          await availabilityBlockerRepository.findRequestSlotsById(
            req.query.requestId,
            mentorId,
          );
        const selectedSlots =
          request?.selectedSlots ||
          (request?.selectedSlot ? [request.selectedSlot] : []);
        const bookedSlots = [
          ...selectedSlots.filter((slot) => slot.status !== "cancelled"),
          ...(request?.additionalSlots || []).filter(
            (slot) => slot.paymentStatus === "paid",
          ),
        ].map(({ date, startTime, endTime }) => ({ date, startTime, endTime }));
        return res.status(200).json({
          success: true,
          data: { bookedSlots, lockedSlots: [] },
          message: "Availability blockers retrieved",
        });
      }
      const [bookedRequests, activeLocks] = await Promise.all([
        availabilityBlockerRepository.findBookedRequestsByMentor(mentorId),
        availabilityBlockerRepository.findActiveLocksByMentor(
          mentorId,
          excludeUserId,
        ),
      ]);

      const bookedSlots = bookedRequests
        .flatMap(
          (request) =>
            request.selectedSlots ||
            (request.selectedSlot ? [request.selectedSlot] : []),
        )
        .map(({ date, startTime, endTime }) => ({ date, startTime, endTime }));
      const lockedSlots = activeLocks.map(({ date, startTime, endTime }) => ({
        date,
        startTime,
        endTime,
      }));

      return res.status(200).json({
        success: true,
        data: { bookedSlots, lockedSlots },
        message: "Availability blockers retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getBlockers };
};

module.exports = createInternalAvailabilityController;
