const createInternalMentorLookupController = ({
  mentorProfileRepository,
  identityClient,
  availabilityService,
  toMentorSearchDTO,
}) => {
  const getSimilarMentors = async (req, res, next) => {
    try {
      const profile = await mentorProfileRepository.findMentorProfileByUserId(req.params.mentorId);
      if (!profile) return res.status(200).json({ success: true, data: { mentors: [], mySkills: [] }, message: "Similar mentors retrieved" });
      const skills = profile.skills || [];
      if (!skills.length) return res.status(200).json({ success: true, data: { mentors: [], mySkills: [] }, message: "Similar mentors retrieved" });
      const candidates = await mentorProfileRepository.findSimilarPublishedMentors(req.params.mentorId, skills, 20);
      const users = await identityClient.getUserSummaries(candidates.map((item) => item.user), req.correlationId);
      const usersById = new Map((users || []).map((user) => [String(user._id), user]));
      const skillSet = new Set(skills.map((skill) => String(skill).toLowerCase()));
      const mentors = candidates
        .map((candidate) => ({
          ...toMentorSearchDTO(candidate, usersById.get(String(candidate.user))),
          matchCount: (candidate.skills || []).filter((skill) => skillSet.has(String(skill).toLowerCase())).length,
        }))
        .sort((left, right) => right.matchCount - left.matchCount);
      return res.status(200).json({ success: true, data: { mentors, mySkills: skills }, message: "Similar mentors retrieved" });
    } catch (error) { return next(error); }
  };

  const getAvailability = async (req, res, next) => {
    try {
      const duration = Number.parseInt(req.query.duration, 10) || 60;
      const data = await availabilityService.getAvailableSlots(
        req.params.mentorId,
        duration,
        req.query.excludeUserId || "",
        { correlationId: req.correlationId },
      );
      return res.status(200).json({ success: true, data, message: "Mentor availability retrieved" });
    } catch (error) { return next(error); }
  };

  return { getSimilarMentors, getAvailability };
};

module.exports = createInternalMentorLookupController;
