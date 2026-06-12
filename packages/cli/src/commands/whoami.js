const { heading, info, success, warn } = require("../shared");
const { getEmail, isLoggedIn } = require("../internal/auth");
const { CLI_BIN_NAME } = require("../internal/constants");

module.exports = {
  command: "whoami",
  describe: "Display current logged in user",
  handler: async () => {
    heading("Current User");

    if (!isLoggedIn()) {
      warn("You are not logged in.");
      info(`Run '${CLI_BIN_NAME} login' to authenticate.`);
      process.exitCode = 1;
      return;
    }

    const email = getEmail();
    success(`Logged in as: ${email || "(unknown user)"}`);
  },
};
