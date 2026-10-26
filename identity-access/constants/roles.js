const ROLES = Object.freeze({
  MENTOR: "mentor",
  MENTEE: "mentee",
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

const isValidRole = (role) => ALL_ROLES.includes(role);

module.exports = {
  ROLES,
  ALL_ROLES,
  isValidRole,
};
