const createCookieService = ({ isProduction }) => {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  const setRefreshCookie = (res, token) => {
    res.cookie("refreshToken", token, options);
  };

  const clearRefreshCookie = (res) => {
    res.clearCookie("refreshToken", options);
  };

  return {
    setRefreshCookie,
    clearRefreshCookie,
  };
};

module.exports = createCookieService;
