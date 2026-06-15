const path = require("path");
const {
  input,
  heading,
  info,
  success,
  warn,
  error,
  getApiErrorInfo,
} = require("../shared");
const {
  requireAuth,
  getEmail,
  authenticatedFetch,
} = require("../internal/auth");
const {
  CLI_BIN_NAME,
  MARKETPLACE_API_PLUGINS_URL,
} = require("../internal/constants");
const { resolvePluginManifest, getRepoUrl } = require("../internal/manifest");
const {
  VALID_TAGS,
  partitionTags,
  validateSubmission,
} = require("../internal/marketplaceSchema");
const {
  maybePrintOrderlyDevEnvironmentHints,
} = require("../internal/orderlySdkDocsMcpDetect");

const SUBMIT_PROGRESS_TOTAL_STEPS = 7;

/**
 * Print a consistent progress message so users can track submit lifecycle.
 * @param {number} step
 * @param {string} message
 */
function printProgress(step, message) {
  info(`[${step}/${SUBMIT_PROGRESS_TOTAL_STEPS}] ${message}`);
}

/**
 * Render actionable submit failure hints while preserving server message.
 * @param {number} status
 * @param {string | null} errorCode
 * @param {string} serverMessage
 */
function printSubmitFailure(status, errorCode, serverMessage) {
  const normalizedCode = (errorCode || "").toUpperCase();
  const normalizedMessage = serverMessage || `HTTP ${status}`;

  if (status === 409 || normalizedCode === "CONFLICT") {
    error(`Plugin registration conflict: ${normalizedMessage}`);
    info(
      `Try a different pluginId in your manifest, then rerun '${CLI_BIN_NAME} submit'.`,
    );
    return;
  }

  if (status === 404 || normalizedCode === "NOT_FOUND") {
    error(`Resource not found: ${normalizedMessage}`);
    info(
      "Please verify npmName/repoUrl/pluginId in your manifest and try again.",
    );
    return;
  }

  if (status === 400 || normalizedCode === "BAD_REQUEST") {
    error(`Invalid submission data: ${normalizedMessage}`);
    info("Please correct your manifest fields and run submit again.");
    return;
  }

  if (status === 401) {
    error(`Unauthorized. Please run '${CLI_BIN_NAME} login' again.`);
    return;
  }

  if (status >= 500) {
    error(`Marketplace server error (HTTP ${status}): ${normalizedMessage}`);
    return;
  }

  error(`Submission failed (HTTP ${status}): ${normalizedMessage}`);
}

module.exports = {
  command: "submit",
  describe: "Submit a plugin to Orderly Marketplace",
  builder: (yargs) => {
    return yargs
      .option("path", {
        alias: "p",
        type: "string",
        describe:
          "string; path to the plugin directory. If omitted, you'll be prompted (default: ./)",
        demandOption: false,
      })
      .option("tags", {
        alias: "t",
        type: "string",
        describe:
          "string; comma-separated tag list (e.g., 'UI,Trading'). Values are trimmed; invalid tags are ignored with a warning",
        demandOption: false,
      })
      .option("storybook-url", {
        type: "string",
        describe:
          "string; optional Storybook base URL (for the plugin). Overrides manifest.storybookUrl when provided",
        demandOption: false,
      })
      .option("dry-run", {
        alias: "d",
        type: "boolean",
        describe:
          "boolean; validate the submission payload and print it without calling the marketplace API",
        default: false,
      })
      .example(
        "orderly-devkit submit --path ./my-plugin --dry-run",
        "Validate the plugin payload from a local folder",
      )
      .example(
        "orderly-devkit submit --path ./my-plugin --tags UI,Trading --storybook-url https://example.com/storybook",
        "Submit with tags and a Storybook URL",
      );
  },
  handler: async (argv) => {
    heading("Submit to Orderly Marketplace");
    info("This command will submit your plugin to the marketplace.\n");
    printProgress(1, "Checking authentication status...");

    if (!requireAuth()) {
      return;
    }

    const displayName = getEmail();
    info(`Authenticated as: ${displayName || "(unknown user)"}\n`);

    printProgress(2, "Resolving plugin path...");
    const targetPath = argv.path || (await input("Path to plugin:", "./"));
    const resolvedPath = path.resolve(targetPath);

    printProgress(3, `Reading plugin metadata from ${resolvedPath}...`);

    const manifest = resolvePluginManifest(resolvedPath);
    if (!manifest) {
      error("No plugin metadata found.");
      info(
        `Add a package.json with a valid "name" field, or create .orderly-manifest.json (e.g. via '${CLI_BIN_NAME} create plugin').`,
      );
      process.exitCode = 1;
      return;
    }

    if (!manifest.repoUrl) {
      const repoUrl = getRepoUrl();
      if (repoUrl) {
        info("Found repo URL from git remote, adding to manifest...");
        manifest.repoUrl = repoUrl;
      }
    }

    printProgress(4, "Preparing submission fields...");
    if (!manifest.pluginId) {
      manifest.pluginId = await input("Plugin ID (required):");
    }

    info(`Package: ${manifest.npmName}`);
    if (manifest.pluginId) {
      info(`Plugin ID: ${manifest.pluginId}`);
    }
    if (manifest.repoUrl) {
      info(`Repository: ${manifest.repoUrl}`);
    }

    let tags = manifest.tags || [];
    if (argv.tags) {
      tags = argv.tags.split(",").map((t) => t.trim());
    }

    const { validTags, invalidTags } = partitionTags(tags);
    if (invalidTags.length > 0) {
      warn(`Invalid tags: ${invalidTags.join(", ")}`);
      info(`Valid tags: ${VALID_TAGS.join(", ")}`);
    }
    tags = validTags;

    const storybookUrl = argv.storybookUrl || manifest.storybookUrl || null;
    const storybookTooltip = manifest.storybookTooltip || null;
    const usagePrompt = manifest.usagePrompt || null;
    const coverImages = manifest.coverImages || [];

    printProgress(5, "Validating submission payload...");
    const submission = validateSubmission({
      npmName: manifest.npmName,
      repoUrl: manifest.repoUrl,
      pluginId: manifest.pluginId,
      tags,
      coverImages,
      usagePrompt,
    });

    if (!submission.valid) {
      error("\nValidation failed. Please fix the following issues:");
      submission.errors.forEach((e) => info(`  - ${e}`));
      process.exitCode = 1;
      return;
    }

    if (argv["dry-run"]) {
      success("\nDry-run completed! Plugin is valid for submission.");
      info(`\nSubmission payload:`);
      console.log(
        JSON.stringify(
          {
            npmName: manifest.npmName,
            repoUrl: manifest.repoUrl,
            pluginId: manifest.pluginId,
            tags,
            coverImages,
            storybookUrl,
            storybookTooltip,
            usagePrompt,
          },
          null,
          2,
        ),
      );
      return;
    }

    printProgress(
      6,
      `Submitting request to Orderly Marketplace (${MARKETPLACE_API_PLUGINS_URL})...`,
    );

    const payload = {
      npmName: manifest.npmName,
      repoUrl: manifest.repoUrl,
      pluginId: manifest.pluginId,
      tags,
      coverImages,
    };

    if (storybookUrl) {
      payload.storybookUrl = storybookUrl;
    }
    if (storybookTooltip) {
      payload.storybookTooltip = storybookTooltip;
    }
    if (usagePrompt) {
      payload.usagePrompt = usagePrompt;
    }

    try {
      const response = await authenticatedFetch(
        MARKETPLACE_API_PLUGINS_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
        {
          onAuthEvent: (event, details = {}) => {
            if (event === "request_unauthorized") {
              info(
                "[6/7] Access token expired (HTTP 401), attempting token refresh...",
              );
              return;
            }

            if (event === "refresh_started") {
              info(
                `[6/7] Refreshing CLI token via ${details.url || "refresh endpoint"}...`,
              );
              return;
            }

            if (event === "refresh_succeeded") {
              info("[6/7] Token refresh succeeded, retrying submit request...");
              return;
            }

            if (event === "refresh_missing") {
              warn(
                `[6/7] No refresh token found. Please run '${CLI_BIN_NAME} login' again if submit fails.`,
              );
              return;
            }

            if (event === "refresh_failed") {
              warn(
                `[6/7] Token refresh failed (HTTP ${details.status || "unknown"}).`,
              );
              return;
            }

            if (event === "refresh_error") {
              warn(
                `[6/7] Token refresh request error: ${details.message || "unknown error"}`,
              );
              return;
            }

            if (event === "request_retry_started") {
              info(
                "[6/7] Sending retried submit request with refreshed token...",
              );
            }
          },
        },
      );

      printProgress(
        7,
        `Received server response (HTTP ${response.status}), processing...`,
      );
      const responseData = await response.json().catch(() => ({}));

      if (response.status === 201) {
        success("\nSubmission successful!");
        info(`Plugin ID: ${responseData.id || "N/A"}`);
        info(`NPM Name: ${responseData.npmName || manifest.npmName}`);
        info(`Status: ${responseData.status || "under_review"}`);
        maybePrintOrderlyDevEnvironmentHints(resolvedPath);
      } else {
        const { code: errorCode, message: errorMessage } = getApiErrorInfo(
          responseData,
          response.status,
        );
        printSubmitFailure(response.status, errorCode, errorMessage);

        if (responseData.details) {
          info("Details:");
          console.log(JSON.stringify(responseData.details, null, 2));
        }

        if (errorCode) {
          info(`Error code: ${errorCode}`);
        }

        process.exitCode = 1;
      }
    } catch (e) {
      const cause = e?.message || String(e);
      error(
        `Submission failed while calling ${MARKETPLACE_API_PLUGINS_URL}: ${cause}`,
      );
      info("Please verify network connectivity and API availability.");
      process.exitCode = 1;
    }
  },
};
