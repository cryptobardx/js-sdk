const path = require("path");
const {
  heading,
  info,
  success,
  warn,
  error,
  input,
  getErrorMessage,
} = require("../shared");
const { requireAuth, authenticatedFetch } = require("../internal/auth");
const { MARKETPLACE_API_PLUGINS_URL } = require("../internal/constants");
const { resolvePluginManifest } = require("../internal/manifest");
const {
  VALID_TAGS,
  partitionTags,
  validateUpdatePayload,
} = require("../internal/marketplaceSchema");

/**
 * Include only user-editable fields supported by PATCH /plugins/{id}.
 * Undefined/null/empty values are skipped to avoid accidental field clearing.
 * @param {object} manifest
 * @returns {object}
 */
function buildUpdatePayload(manifest) {
  const payload = {};

  const directFields = [
    "name",
    "description",
    "coverImages",
    "storybookUrl",
    "storybookTooltip",
    "usagePrompt",
  ];

  directFields.forEach((field) => {
    const value = manifest[field];
    if (value !== undefined && value !== null && value !== "") {
      payload[field] = value;
    }
  });

  const tags = Array.isArray(manifest.tags) ? manifest.tags : [];
  if (tags.length > 0) {
    const { validTags, invalidTags } = partitionTags(tags);

    if (invalidTags.length > 0) {
      warn(`Ignored invalid tags from manifest: ${invalidTags.join(", ")}`);
      info(`Valid tags: ${VALID_TAGS.join(", ")}`);
    }

    if (validTags.length > 0) {
      payload.tags = validTags;
    }
  }

  return payload;
}

module.exports = {
  command: "update",
  describe: "Update plugin metadata in Orderly Marketplace",
  builder: (yargs) => {
    return yargs
      .option("path", {
        alias: "p",
        type: "string",
        describe:
          "string; path to the plugin directory (must contain .orderly-manifest.json with a pluginId, or package.json-derived metadata). If omitted, you will be prompted",
        demandOption: false,
      })
      .option("dry-run", {
        alias: "d",
        type: "boolean",
        describe:
          "boolean; validate and print the PATCH payload without calling the marketplace API",
        default: false,
      })
      .example(
        "orderly-devkit update --path ./my-plugin --dry-run",
        "Validate the update payload from a local plugin folder",
      );
  },
  handler: async (argv) => {
    heading("Update plugin on Orderly Marketplace");

    if (!requireAuth()) {
      return;
    }

    const targetPath = argv.path || (await input("Path to plugin:", "./"));
    const resolvedPath = path.resolve(targetPath);
    info(`Reading plugin metadata from ${resolvedPath}...`);

    const manifest = resolvePluginManifest(resolvedPath);
    if (!manifest) {
      error("No plugin metadata found.");
      info(
        "Please ensure .orderly-manifest.json exists in your plugin project and contains pluginId.",
      );
      process.exitCode = 1;
      return;
    }

    const pluginId = String(manifest.pluginId || "").trim();
    if (!pluginId) {
      error("pluginId is required in .orderly-manifest.json for update.");
      process.exitCode = 1;
      return;
    }

    const payload = buildUpdatePayload(manifest);
    const validation = validateUpdatePayload(payload);

    if (!validation.valid) {
      error("Validation failed. Please fix the following issues:");
      validation.errors.forEach((validationError) =>
        info(`  - ${validationError}`),
      );
      process.exitCode = 1;
      return;
    }

    if (Object.keys(payload).length === 0) {
      warn("No updatable fields found in manifest.");
      info(
        "Supported fields: name, description, tags, coverImages, storybookUrl, storybookTooltip, usagePrompt.",
      );
      process.exitCode = 1;
      return;
    }

    const apiUrl = `${MARKETPLACE_API_PLUGINS_URL}/${encodeURIComponent(pluginId)}`;

    if (argv["dry-run"]) {
      success("Dry-run completed. Update payload is valid.");
      info("PATCH target:");
      console.log(apiUrl);
      info("\nPayload:");
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    info("Submitting update request...");

    try {
      const response = await authenticatedFetch(apiUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const serverMessage = getErrorMessage(responseData, response.status);
        error(`Update failed: ${serverMessage}`);
        process.exitCode = 1;
        return;
      }

      success("Plugin updated successfully!");
      info(`Plugin ID: ${responseData?.id || pluginId}`);
      info(`Status: ${responseData?.status || "N/A"}`);
    } catch (requestError) {
      const cause = requestError?.message || String(requestError);
      error(`Request failed while calling ${apiUrl}: ${cause}`);
      info("Please verify network connectivity and API availability.");
      process.exitCode = 1;
    }
  },
};
