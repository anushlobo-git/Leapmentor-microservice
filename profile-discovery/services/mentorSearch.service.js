const AppError = require("../utils/AppError");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;
const MENTOR_ROLE = "mentor";
const SEARCHABLE_FILTER = {
  isProfileComplete: true,
  isProfilePublished: { $ne: false },
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePage = (value) => Math.max(DEFAULT_PAGE, Number.parseInt(value, 10) || DEFAULT_PAGE);

const parseLimit = (value) =>
  Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(value, 10) || DEFAULT_LIMIT));

const buildRange = (min, max) => {
  const range = {};
  if (min !== undefined) range.$gte = Number(min);
  if (max !== undefined) range.$lte = Number(max);
  return range;
};

const createMentorSearchService = ({
  mentorSearchRepository,
  identityClient,
  toMentorSearchDTO,
}) => {
  const emptyResult = (page, limit) => ({
    mentors: [],
    pagination: {
      page,
      limit,
      totalCount: 0,
      totalPages: 0,
      currentPage: page,
      hasMore: false,
    },
  });

  const queryMentors = async (queryParams = {}, { correlationId } = {}) => {
    const {
      skill = "",
      name = "",
      industry = "",
      minPrice,
      maxPrice,
      minRating,
      minExperience,
      maxExperience,
    } = queryParams;
    const page = parsePage(queryParams.page);
    const limit = parseLimit(queryParams.limit);

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      Number(minPrice) > Number(maxPrice)
    ) {
      throw new AppError("minPrice cannot exceed maxPrice.", 400, "INVALID_SEARCH_RANGE");
    }
    if (
      minExperience !== undefined &&
      maxExperience !== undefined &&
      Number(minExperience) > Number(maxExperience)
    ) {
      throw new AppError(
        "minExperience cannot exceed maxExperience.",
        400,
        "INVALID_SEARCH_RANGE",
      );
    }

    const andClauses = [SEARCHABLE_FILTER];
    const textMatches = [];

    if (skill.trim()) {
      const expression = { $regex: escapeRegex(skill.trim()), $options: "i" };
      textMatches.push(
        { skills: { $elemMatch: expression } },
        { currentRole: expression },
        { industry: expression },
        { company: expression },
      );
    }

    if (name.trim()) {
      const matchingUsers = await identityClient.searchUsers(
        { name: name.trim(), role: MENTOR_ROLE },
        correlationId,
      );
      const userIds = (matchingUsers || []).map((user) => user._id).filter(Boolean);
      if (userIds.length > 0) textMatches.push({ user: { $in: userIds } });
      else if (!skill.trim()) return emptyResult(page, limit);
    }

    if (textMatches.length > 0) andClauses.push({ $or: textMatches });
    if (industry.trim()) {
      andClauses.push({ industry: { $regex: escapeRegex(industry.trim()), $options: "i" } });
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      andClauses.push({ hourlyRate: buildRange(minPrice, maxPrice) });
    }
    if (minRating !== undefined) andClauses.push({ avgRating: { $gte: Number(minRating) } });
    if (minExperience !== undefined || maxExperience !== undefined) {
      andClauses.push({ yearsOfExperience: buildRange(minExperience, maxExperience) });
    }

    const filter = andClauses.length === 1 ? SEARCHABLE_FILTER : { $and: andClauses };
    const skip = (page - 1) * limit;
    const [totalCount, profiles] = await Promise.all([
      mentorSearchRepository.countSearchable(filter),
      mentorSearchRepository.findSearchable(filter, { skip, limit }),
    ]);

    const userIds = profiles.map((profile) => profile.user).filter(Boolean);
    const users = await identityClient.getUserSummaries(userIds, correlationId);
    const usersById = new Map(
      (users || []).map((user) => [user._id?.toString?.() || user._id, user]),
    );

    const mentors = profiles.map((profile) =>
      toMentorSearchDTO(
        profile,
        usersById.get(profile.user?.toString?.() || profile.user),
      ),
    );

    return {
      mentors,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        hasMore: skip + mentors.length < totalCount,
      },
    };
  };

  return { queryMentors };
};

module.exports = createMentorSearchService;
