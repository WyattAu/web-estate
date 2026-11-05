import { describe, expect, test } from "bun:test";
import cases from "../../conformance/islands/cases.json";
import {
  ComponentRegistry,
  ComponentRegistryError,
  detectFramework,
  hydrationToDirective,
  type IslandComponent,
  isValidComponentName,
} from "./src/index";

type RegisterCase = {
  name?: string;
  input: { component: string; hydration?: string; framework?: string };
  expected?: { framework: string; hydration: string };
  error?: string;
};
type ValidateCase = {
  component: {
    name: string;
    component: string;
    framework: string;
    hydration: string;
    mediaQuery?: string;
    clientOnlyFramework?: string;
  };
  file_exists?: boolean;
  valid: boolean;
  error_contains?: string;
};
type GenerateCase = {
  component: IslandComponent;
  import: string;
  wrapper: string;
};
type DetectCase = { path: string; expected: string | null };

const suite = cases as unknown as {
  suite: string;
  register_cases: RegisterCase[];
  validate_cases: ValidateCase[];
  generate_cases: GenerateCase[];
  framework_detect_cases: DetectCase[];
};

describe("conformance: islands", () => {
  test("fixture suite is islands", () => {
    expect(suite.suite).toBe("islands");
  });

  test("name validation is JSX-style", () => {
    expect(isValidComponentName("Counter")).toBe(true);
    expect(isValidComponentName("counter")).toBe(false);
    expect(isValidComponentName("My_Component")).toBe(false);
  });

  test("hydration directives map exactly", () => {
    expect(hydrationToDirective("visible")).toBe("client:visible");
    expect(hydrationToDirective("only")).toBe("client:only");
  });

  // Register cases run in sequence against one registry so the duplicate
  // case sees the earlier registration.
  const registry = new ComponentRegistry({
    defaultFramework: "react",
    defaultHydration: "visible",
  });
  for (const c of suite.register_cases) {
    const label = (c.input as { name?: string }).name ?? c.name ?? c.input.component;
    test(`register: ${label}`, () => {
      try {
        const component = registry.registerFromInput(label, {
          ...(c.input as Partial<IslandComponent> & { component: string }),
        });
        if (c.expected) {
          expect(String(component.framework)).toBe(c.expected.framework);
          expect(String(component.hydration)).toBe(c.expected.hydration);
        } else {
          throw new Error("expected an error but registration succeeded");
        }
      } catch (e) {
        if (e instanceof ComponentRegistryError && c.error) {
          expect(e.message).toContain(c.error);
          return;
        }
        throw e;
      }
    });
  }

  for (const c of suite.validate_cases) {
    test(`validate: ${c.component.name} -> valid=${c.valid}`, () => {
      const registry = new ComponentRegistry();
      registry.register(c.component as IslandComponent);
      const result = registry.validate(() => c.file_exists ?? true);
      expect(result.valid).toBe(c.valid);
      if (!c.valid && c.error_contains) {
        const message = c.error_contains;
        expect(result.errors.some((e) => e.message.includes(message))).toBe(true);
      }
    });
  }

  for (const c of suite.generate_cases) {
    test(`generate: ${c.component.name}`, () => {
      const registry = new ComponentRegistry();
      registry.register(c.component);
      expect(registry.generateImports()[0]).toBe(c.import);
      expect(registry.generateIslandWrapper(c.component)).toBe(c.wrapper);
    });
  }

  for (const c of suite.framework_detect_cases) {
    test(`detect framework: ${c.path}`, () => {
      const got = detectFramework(c.path);
      expect(got === null ? null : String(got)).toBe(c.expected);
    });
  }
});
