// @est/deploy-targets: pure deploy emitters extracted from the
// starlight-multi-site deploy module. The execa invocations stay in the
// source repo; this kit emits the exact command argument vectors and
// workflow YAML, golden-tested so the emitters cannot drift.

export interface SiteLike {
  name: string;
  domain?: string;
  deployOverrides?: { projectName?: string };
}

export interface CloudflareDeployPlan {
  site: string;
  projectName: string;
  args: string[];
  /** Predicted production URL (Pages project convention). */
  url: string;
}

/** Emit the wrangler pages deploy argument vector for a site. */
export function planCloudflareDeploy(
  site: SiteLike,
  outputDir: string,
  options: { branch?: string; commitMessage?: string } = {},
): CloudflareDeployPlan {
  const projectName = site.deployOverrides?.projectName ?? `${site.name}`;
  const args = ["pages", "deploy", outputDir, "--project-name", projectName];
  if (options.branch) args.push("--branch", options.branch);
  if (options.commitMessage) args.push("--commit-message", options.commitMessage);
  return {
    site: site.name,
    projectName,
    args,
    url: site.domain ? `https://${site.domain}` : `https://${projectName}.pages.dev`,
  };
}

export interface GithubActionsDeployPlan {
  /** Path of the emitted workflow file within the repo. */
  path: string;
  yaml: string;
}

/** Emit a GitHub Actions workflow that deploys a site to Pages on push. */
export function planGithubActionsDeploy(
  site: SiteLike,
  outputDir: string,
): GithubActionsDeployPlan {
  const projectName = site.deployOverrides?.projectName ?? site.name;
  const yaml = [
    "name: deploy",
    "on:",
    "  push:",
    `    branches: [main]`,
    "permissions:",
    "  contents: read",
    "  deployments: write",
    "jobs:",
    "  deploy:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: oven-sh/setup-bun@v2",
    "      - run: bun install --frozen-lockfile",
    "      - run: bun run build",
    "      - uses: cloudflare/wrangler-action@v3",
    "        with:",
    "          apiToken: " + "$" + "{{ secrets.CLOUDFLARE_API_TOKEN }}",
    "          accountId: " + "$" + "{{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    `          command: pages deploy ${outputDir} --project-name=${projectName} --branch=main`,
  ].join("\n");
  return { path: `.github/workflows/deploy-${projectName}.yml`, yaml };
}
