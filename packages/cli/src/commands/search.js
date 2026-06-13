const {
  heading,
  info,
  error,
  success,
  dim,
  getErrorMessage,
} = require("../shared");
const { fetchWithTimeout, getHttpTimeoutMs } = require("../internal/auth");
const {
  MARKETPLACE_API_PLUGINS_URL,
  MARKETPLACE_WEB_BASE_URL,
} = require("../internal/constants");
const {
  normalizePlugins,
  truncate,
  renderTable,
  terminalLink,
  getNpmPackageUrl,
  parseGithubRepoUrl,
} = require("../internal/formatting");

const SORT_OPTIONS = ["downloads", "stars", "name", "updated"];
const ORDER_OPTIONS = ["asc", "desc"];

const SEARCH_COLUMNS = {
  headers: [
    "ID",
    "Package",
    "Tags",
    "Downloads",
    "Stars",
    "Description",
    "GitHub",
  ],
  keys: [
    "id",
    "package",
    "tags",
    "downloads",
    "stars",
    "description",
    "github",
  ],
};

function formatGithubCell(repoUrl) {
  const repo = parseGithubRepoUrl(repoUrl);
  return repo ? repo.url : "-";
}

function formatPackageCell(plugin) {
  const packageName = plugin?.npmName || plugin?.name || "-";
  const npmUrl = getNpmPackageUrl(packageName);
  return npmUrl ? terminalLink(packageName, npmUrl) : packageName;
}

function mapRow(plugin) {
  const tags = Array.isArray(plugin?.tags) ? plugin.tags.join(",") : "-";

  return {
    id: plugin?.id || plugin?.pluginId || "-",
    package: formatPackageCell(plugin),
    tags: truncate(tags || "-", 32),
    downloads: plugin?.downloads ?? "-",
    stars: plugin?.stars ?? "-",
    github: formatGithubCell(plugin?.repoUrl),
    description: truncate(plugin?.description || "-", 72),
  };
}

/**
 * Append query params only when values are meaningful.
 */
function buildSearchUrl(argv) {
  const url = new URL(MARKETPLACE_API_PLUGINS_URL);
  const query = String(argv.query || "").trim();
  const tag = String(argv.tag || "").trim();

  if (query) {
    url.searchParams.set("search", query);
  }
  if (tag) {
    url.searchParams.set("tag", tag);
  }

  url.searchParams.set("sort", argv.sort);
  url.searchParams.set("order", argv.order);
  url.searchParams.set("page", String(argv.page));
  url.searchParams.set("limit", String(argv.limit));

  return url.toString();
}

function validatePositiveInteger(value, name, max) {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}.`);
  }
  return true;
}

/**
 * Parse API pagination fields that may arrive as strings.
 * @param {unknown} value
 * @param {number} fallback
 * @param {{ allowZero?: boolean }} options
 * @returns {number}
 */
function parsePaginationNumber(value, fallback, options = {}) {
  const { allowZero = false } = options;

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const integer = Math.trunc(parsed);
  if (allowZero ? integer >= 0 : integer > 0) {
    return integer;
  }

  return fallback;
}

module.exports = {
  command: "search [query]",
  describe: "Search available plugins from Marketplace",
  builder: (yargs) => {
    return yargs
      .positional("query", {
        type: "string",
        describe:
          "string; optional search text matched against plugin name, description, and npm package name",
      })
      .option("tag", {
        type: "string",
        describe: "string; optional Marketplace tag slug to filter by",
      })
      .option("sort", {
        type: "string",
        choices: SORT_OPTIONS,
        describe: "string; sort field",
        default: "downloads",
      })
      .option("order", {
        type: "string",
        choices: ORDER_OPTIONS,
        describe: "string; sort order",
        default: "desc",
      })
      .option("page", {
        type: "number",
        describe: "number; result page to fetch",
        default: 1,
      })
      .option("limit", {
        type: "number",
        describe: "number; results per page, between 1 and 100",
        default: 20,
      })
      .option("json", {
        type: "boolean",
        describe:
          "boolean; when true, output the raw marketplace response as JSON (useful for agents)",
        default: false,
      })
      .check((argv) => {
        validatePositiveInteger(argv.page, "page", Number.MAX_SAFE_INTEGER);
        validatePositiveInteger(argv.limit, "limit", 100);
        return true;
      })
      .example("orderly-devkit search", "List available plugins")
      .example(
        "orderly-devkit search orderbook",
        "Search available plugins by keyword",
      )
      .example(
        "orderly-devkit search orderbook --tag trading --limit 5",
        "Search by keyword and tag",
      )
      .example(
        "orderly-devkit search funding --sort updated --order desc --json",
        "Output raw JSON for agent integration",
      );
  },
  handler: async (argv) => {
    if (!argv.json) {
      heading("Available Marketplace Plugins");
    }

    const url = buildSearchUrl(argv);

    try {
      // Public marketplace search does not require user authentication.
      const headers = new Headers({ Accept: "application/json" });
      const response = await fetchWithTimeout(
        url,
        { method: "GET", headers },
        getHttpTimeoutMs(),
      );

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const serverMessage = getErrorMessage(responseData, response.status);
        error(`Failed to search plugins: ${serverMessage}`);
        process.exitCode = 1;
        return;
      }

      const plugins = normalizePlugins(responseData);

      if (argv.json) {
        // Print real server payload so agents can consume full plugin metadata.
        console.log(JSON.stringify(responseData ?? {}, null, 2));
        return;
      }

      if (plugins.length === 0) {
        const query = String(argv.query || "").trim();
        const tag = String(argv.tag || "").trim();
        const filters = [];
        if (query) {
          filters.push(`query "${query}"`);
        }
        if (tag) {
          filters.push(`tag "${tag}"`);
        }

        const filterText = filters.length
          ? ` for ${filters.join(" and ")}`
          : "";
        info(`No available plugins found${filterText}.`);
        info(
          "Try a different keyword/tag, or run `orderly-devkit search --json` to inspect the raw API response.",
        );
        return;
      }

      const rows = plugins.map(mapRow);
      console.log(renderTable(rows, SEARCH_COLUMNS));

      const pagination = responseData?.pagination || {};
      const total = parsePaginationNumber(pagination.total, plugins.length, {
        allowZero: true,
      });
      const page = parsePaginationNumber(pagination.page, argv.page);
      const limit = parsePaginationNumber(pagination.limit, argv.limit);
      const totalPages = parsePaginationNumber(
        pagination.totalPages,
        Math.max(1, Math.ceil(total / limit)),
      );
      success(
        `\nShowing ${plugins.length} of ${total} plugin(s) ` +
          `(page ${page}/${totalPages || 1})`,
      );
      dim(`Browse plugins on the web: ${MARKETPLACE_WEB_BASE_URL}`);
    } catch (e) {
      // Surface target endpoint to make network/runtime failures actionable.
      const cause = e?.message || String(e);
      error(`Request failed while calling ${url}: ${cause}`);
      info("Please verify network connectivity and API availability.");
      process.exitCode = 1;
    }
  },
};
