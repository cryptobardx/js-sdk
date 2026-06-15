/** Valid Marketplace plugin tags (must match backend). */
const VALID_TAGS = [
  "UI",
  "Indicator",
  "Order Entry",
  "Trading",
  "Chart",
  "Portfolio",
  "Analytics",
  "Tool",
  "Widget",
];

const MAX_TAGS = 5;
const MAX_COVER_IMAGES = 10;
const MAX_USAGE_PROMPT_LENGTH = 8192;

/** Regex patterns matching backend createPluginSchema. */
const NPM_NAME_REGEX =
  /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[\w-]+\/[\w-]+$/;
const PLUGIN_ID_REGEX = /^[a-zA-Z][a-zA-Z0-9-]*$/;
const UPLOADS_PATH_REGEX = /^\/uploads\/.+$/;

/**
 * Split tags into valid and invalid buckets against the Marketplace whitelist.
 * @param {string[]} tags
 * @returns {{ validTags: string[], invalidTags: string[] }}
 */
function partitionTags(tags) {
  const validTags = tags.filter((tag) => VALID_TAGS.includes(tag));
  const invalidTags = tags.filter((tag) => !VALID_TAGS.includes(tag));
  return { validTags, invalidTags };
}

/**
 * Validate submission payload against backend schema rules.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSubmission({
  npmName,
  repoUrl,
  pluginId,
  tags,
  coverImages,
  usagePrompt,
}) {
  const errors = [];

  if (!npmName) {
    errors.push("npmName is required (set in package.json)");
  } else if (!NPM_NAME_REGEX.test(npmName)) {
    errors.push(`npmName "${npmName}" is not a valid npm package name`);
  }

  if (!repoUrl) {
    errors.push(
      "repoUrl is required (configure git remote or set in manifest)",
    );
  } else if (!GITHUB_URL_REGEX.test(repoUrl)) {
    errors.push(
      `repoUrl must be a valid GitHub URL (https://github.com/<owner>/<repo>), got: ${repoUrl}`,
    );
  }

  if (!pluginId) {
    errors.push("pluginId is required (set in manifest or pass interactively)");
  } else if (!PLUGIN_ID_REGEX.test(pluginId)) {
    errors.push(
      `pluginId must start with a letter and contain only letters, digits, or hyphens, got: ${pluginId}`,
    );
  }

  if (tags.length > MAX_TAGS) {
    errors.push(`Too many tags (${tags.length}), maximum is ${MAX_TAGS}`);
  }

  if (coverImages && coverImages.length > MAX_COVER_IMAGES) {
    errors.push(
      `Too many cover images (${coverImages.length}), maximum is ${MAX_COVER_IMAGES}`,
    );
  }

  if (coverImages && coverImages.length > 0) {
    const invalidCoverImage = coverImages.find((image) => {
      if (typeof image !== "string" || image.length === 0) {
        return true;
      }

      return !URL.canParse(image) && !UPLOADS_PATH_REGEX.test(image);
    });

    if (invalidCoverImage) {
      errors.push(
        `coverImages contains an invalid value: ${invalidCoverImage}. Each value must be an absolute URL or a path that starts with /uploads/`,
      );
    }
  }

  if (usagePrompt && usagePrompt.length > MAX_USAGE_PROMPT_LENGTH) {
    errors.push(
      `usagePrompt is too long (${usagePrompt.length} chars), maximum is ${MAX_USAGE_PROMPT_LENGTH}`,
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update payload against marketplace schema constraints.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateUpdatePayload(payload) {
  const errors = [];

  if (payload.tags && payload.tags.length > MAX_TAGS) {
    errors.push(
      `Too many tags (${payload.tags.length}), maximum is ${MAX_TAGS}`,
    );
  }

  if (payload.coverImages && payload.coverImages.length > MAX_COVER_IMAGES) {
    errors.push(
      `Too many cover images (${payload.coverImages.length}), maximum is ${MAX_COVER_IMAGES}`,
    );
  }

  if (
    payload.usagePrompt &&
    payload.usagePrompt.length > MAX_USAGE_PROMPT_LENGTH
  ) {
    errors.push(
      `usagePrompt is too long (${payload.usagePrompt.length} chars), maximum is ${MAX_USAGE_PROMPT_LENGTH}`,
    );
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  VALID_TAGS,
  MAX_TAGS,
  MAX_COVER_IMAGES,
  MAX_USAGE_PROMPT_LENGTH,
  NPM_NAME_REGEX,
  GITHUB_URL_REGEX,
  PLUGIN_ID_REGEX,
  UPLOADS_PATH_REGEX,
  partitionTags,
  validateSubmission,
  validateUpdatePayload,
};
