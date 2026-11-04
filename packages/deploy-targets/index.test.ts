// @est/deploy-targets fixture parity tests (golden emitters).
import { describe, expect, test } from "bun:test";
import { planCloudflareDeploy, planGithubActionsDeploy } from "./src/index";

describe("deploy-targets", () => {
  test("cloudflare plan builds the wrangler pages arg vector", () => {
    const plan = planCloudflareDeploy({ name: "notes", domain: "notes.example.com" }, "dist", {
      branch: "main",
      commitMessage: "deploy notes",
    });
    expect(plan.projectName).toBe("notes");
    expect(plan.args).toEqual([
      "pages",
      "deploy",
      "dist",
      "--project-name",
      "notes",
      "--branch",
      "main",
      "--commit-message",
      "deploy notes",
    ]);
    expect(plan.url).toBe("https://notes.example.com");
  });

  test("deploy override wins over the site name", () => {
    const plan = planCloudflareDeploy(
      { name: "notes", deployOverrides: { projectName: "wyattsnotes-notes" } },
      "dist",
    );
    expect(plan.projectName).toBe("wyattsnotes-notes");
    expect(plan.url).toBe("https://wyattsnotes-notes.pages.dev");
  });

  test("github actions plan emits a deploy workflow", () => {
    const plan = planGithubActionsDeploy({ name: "notes" }, "dist");
    expect(plan.path).toBe(".github/workflows/deploy-notes.yml");
    expect(plan.yaml).toContain("wrangler-action@v3");
    expect(plan.yaml).toContain("pages deploy dist --project-name=notes --branch=main");
    expect(plan.yaml).toContain("deployments: write");
  });
});
