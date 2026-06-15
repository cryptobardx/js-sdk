const {
  heading,
  info,
  warn,
  error,
  success,
  select,
  confirm,
  getApiErrorInfo,
} = require("../shared");
const { requireAuth, authenticatedFetch } = require("../internal/auth");
const {
  CLI_BIN_NAME,
  MARKETPLACE_API_MY_PLUGINS_URL,
  getMarketplaceApiPluginUrl,
} = require("../internal/constants");
const { normalizePlugins } = require("../internal/formatting");

/**
 * Render a compact plugin label for the selection prompt.
 * @param {Record<string, unknown>} plugin
 * @returns {string}
 */
function toPluginChoiceLabel(plugin) {
  const name = plugin?.name || plugin?.npmName || "Unknown";
  const id = plugin?.id || plugin?.pluginId || "unknown-id";
  const status = plugin?.status || "unknown";
  return `${name} (${id}) [${status}]`;
}

module.exports = {
  command: "delete",
  describe: "Delete one of your submitted plugins from Marketplace",
  builder: (yargs) => {
    return yargs
      .option("pluginId", {
        type: "string",
        describe:
          "string; plugin ID to delete directly. If omitted, an interactive selector is shown",
        demandOption: false,
      })
      .example(
        "orderly-devkit delete",
        "Select one of your plugins and delete it",
      )
      .example(
        "orderly-devkit delete --pluginId my-plugin-id",
        "Delete a specific plugin directly without selection",
      );
  },
  handler: async (argv) => {
    heading("Delete My Plugin");
    info(
      "This command will permanently delete one of your submitted plugins.\n",
    );

    if (!requireAuth()) {
      return;
    }

    try {
      let selectedPluginId =
        typeof argv.pluginId === "string" ? argv.pluginId.trim() : "";
      if (!selectedPluginId) {
        info("Fetching your submitted plugins...");
        const listResponse = await authenticatedFetch(
          MARKETPLACE_API_MY_PLUGINS_URL,
          {
            method: "GET",
            headers: { Accept: "application/json" },
          },
        );

        const listData = await listResponse.json().catch(() => null);
        if (!listResponse.ok) {
          const { message } = getApiErrorInfo(listData, listResponse.status);
          error(`Failed to fetch plugins: ${message}`);
          process.exitCode = 1;
          return;
        }

        const plugins = normalizePlugins(listData);
        if (plugins.length === 0) {
          info("You have not submitted any plugins yet.");
          info(
            `If Marketplace Web shows records, run \`${CLI_BIN_NAME} whoami\` to confirm account consistency and \`${CLI_BIN_NAME} list --json\` to inspect the raw API response.`,
          );
          return;
        }

        const choices = plugins
          .map((plugin) => ({
            name: String(plugin?.id || plugin?.pluginId || ""),
            message: toPluginChoiceLabel(plugin),
            value: String(plugin?.id || plugin?.pluginId || ""),
          }))
          .filter((choice) => Boolean(choice.value));

        if (choices.length === 0) {
          error("No valid plugin IDs found in marketplace response.");
          process.exitCode = 1;
          return;
        }

        selectedPluginId = await select(
          "Select a plugin to delete permanently:",
          choices,
          0,
        );
      } else {
        info(`Using pluginId from command argument: ${selectedPluginId}`);
      }

      if (!selectedPluginId) {
        warn("No plugin selected.");
        process.exitCode = 1;
        return;
      }

      const confirmed = await confirm(
        `Are you sure you want to delete plugin "${selectedPluginId}"? This action cannot be undone.`,
      );
      if (!confirmed) {
        warn("Deletion cancelled.");
        return;
      }

      const endpoint = getMarketplaceApiPluginUrl(selectedPluginId);
      info(`Submitting delete request to ${endpoint} ...`);
      const deleteResponse = await authenticatedFetch(endpoint, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      if (deleteResponse.status === 204) {
        success("\nPlugin deleted successfully.");
        info(`Plugin ID: ${selectedPluginId}`);
        return;
      }

      const deleteData = await deleteResponse.json().catch(() => null);
      const { code, message } = getApiErrorInfo(
        deleteData,
        deleteResponse.status,
      );
      error(`Failed to delete plugin: ${message}`);
      if (code) {
        info(`Error code: ${code}`);
      }
      info("Please verify plugin ownership and API availability.");
      process.exitCode = 1;
    } catch (e) {
      const cause = e?.message || String(e);
      error(`Request failed while calling marketplace APIs: ${cause}`);
      info("Please verify network connectivity and API availability.");
      process.exitCode = 1;
    }
  },
};
