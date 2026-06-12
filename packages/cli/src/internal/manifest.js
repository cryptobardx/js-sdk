const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { CLI_BIN_NAME } = require("./constants");

const MANIFEST_FILENAME = ".orderly-manifest.json";

/**
 * Read repoUrl from git remote origin.
 */
function getRepoUrl() {
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    }).trim();

    if (remoteUrl.startsWith("git@")) {
      return remoteUrl
        .replace("git@", "")
        .replace(":", "/")
        .replace(".git", "");
    }

    return remoteUrl.replace(/\.git$/, "");
  } catch (e) {
    return null;
  }
}

/**
 * Read npm package name from package.json.
 */
function getNpmName(packageJsonPath) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return packageJson.name || null;
  } catch (e) {
    return null;
  }
}

/**
 * Generate `.orderly-manifest.json` in the plugin directory.
 * @param {string} pluginDir - Plugin root directory
 * @param {Object} pluginInfo - pluginId, tags, storybookUrl, etc.
 */
function generateManifest(pluginDir, pluginInfo = {}) {
  const packageJsonPath = path.join(pluginDir, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("package.json not found in plugin directory");
  }

  const manifest = {
    npmName: getNpmName(packageJsonPath),
    pluginId: pluginInfo.pluginId || null,
    repoUrl: pluginInfo.repoUrl || getRepoUrl() || null,
    tags: pluginInfo.tags || [],
    storybookUrl: pluginInfo.storybookUrl || null,
    storybookTooltip: pluginInfo.storybookTooltip || null,
    usagePrompt: pluginInfo.usagePrompt || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(pluginDir, MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return manifest;
}

/**
 * Read `.orderly-manifest.json` from the plugin directory.
 * @param {string} pluginDir - Plugin root directory
 * @returns {Object|null} Manifest object, or null when missing
 */
function readManifest(pluginDir) {
  const manifestPath = path.join(pluginDir, MANIFEST_FILENAME);

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (e) {
    console.warn(
      `Warning: Failed to parse ${MANIFEST_FILENAME}: ${e.message}. Ignoring corrupted manifest.`,
    );
    return null;
  }
}

/**
 * Resolve plugin metadata for submit: use `.orderly-manifest.json` when present,
 * otherwise derive from `package.json` and git (manual plugins may skip the manifest).
 * @param {string} pluginDir - Plugin root directory
 * @returns {Object|null} Manifest-shaped object, or null if no manifest and no package.json
 */
function resolvePluginManifest(pluginDir) {
  const fromFile = readManifest(pluginDir);
  if (fromFile) {
    return fromFile;
  }

  const packageJsonPath = path.join(pluginDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  return {
    npmName: getNpmName(packageJsonPath),
    pluginId: null,
    repoUrl: getRepoUrl(),
    tags: [],
    storybookUrl: null,
    storybookTooltip: null,
    usagePrompt: null,
    coverImages: [],
  };
}

/**
 * Update fields in an existing manifest file.
 * @param {string} pluginDir - Plugin root directory
 * @param {Object} updates - Fields to merge into the manifest
 */
function updateManifest(pluginDir, updates) {
  const manifest = readManifest(pluginDir);

  if (!manifest) {
    throw new Error(
      `Manifest file not found. Run '${CLI_BIN_NAME} create plugin' first.`,
    );
  }

  const updatedManifest = {
    ...manifest,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(pluginDir, MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, JSON.stringify(updatedManifest, null, 2));

  return updatedManifest;
}

/**
 * Check whether the manifest contains required submit fields.
 * @param {string} pluginDir - Plugin root directory
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateManifest(pluginDir) {
  const manifest = readManifest(pluginDir);
  const missing = [];

  if (!manifest) {
    return { valid: false, missing: ["manifest file not found"] };
  }

  if (!manifest.npmName) {
    missing.push("npmName (from package.json)");
  }

  if (!manifest.repoUrl) {
    missing.push("repoUrl (configure git remote or run in git repository)");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

module.exports = {
  MANIFEST_FILENAME,
  getRepoUrl,
  getNpmName,
  generateManifest,
  readManifest,
  resolvePluginManifest,
  updateManifest,
  validateManifest,
};
