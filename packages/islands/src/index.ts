// @est/islands: island component registry extracted from the
// starlight-interactive-islands repo (ComponentRegistry semantics:
// JSX-name validation, duplicate rejection, defaults resolution,
// hydration validation, import/tag generation).

const VALID_JSX_NAME = /^[A-Z][a-zA-Z0-9]*$/;

export type Framework = "react" | "svelte" | "vue" | "solid-js";
export type HydrationStrategy = "load" | "visible" | "idle" | "media" | "only";

const EXTENSION_FRAMEWORK_MAP: Record<string, Framework> = {
  ".tsx": "react",
  ".jsx": "react",
  ".svelte": "svelte",
  ".vue": "vue",
  ".solid.tsx": "solid-js",
  ".solid.jsx": "solid-js",
};

export function isValidComponentName(name: string): boolean {
  return VALID_JSX_NAME.test(name);
}

/** Framework detection from a component path (extension + /solid/ hint). */
export function detectFramework(filePath: string): Framework | null {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  const base = filePath.slice(0, filePath.lastIndexOf("."));
  const compoundExt = base.slice(base.lastIndexOf(".")) + ext;

  if (filePath.includes("/solid/") || filePath.includes("\\solid\\")) {
    return "solid-js";
  }
  return EXTENSION_FRAMEWORK_MAP[compoundExt] ?? EXTENSION_FRAMEWORK_MAP[ext] ?? null;
}

export function hydrationToDirective(strategy: HydrationStrategy): string {
  const directives: Record<HydrationStrategy, string> = {
    load: "client:load",
    visible: "client:visible",
    idle: "client:idle",
    media: "client:media",
    only: "client:only",
  };
  return directives[strategy];
}

export interface IslandComponent {
  name: string;
  component: string;
  framework: Framework;
  hydration: HydrationStrategy;
  mediaQuery?: string;
  clientOnlyFramework?: Framework;
  wrapperTag?: string;
  wrapperClass?: string;
}

export interface ValidationError {
  componentName: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class ComponentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComponentRegistryError";
  }
}

export interface RegistryOptions {
  defaultHydration?: HydrationStrategy;
  defaultFramework?: Framework;
  defaultWrapperTag?: string;
}

/** The island registry: one entry per component, validated on register. */
export class ComponentRegistry {
  #components = new Map<string, IslandComponent>();
  #defaultHydration: HydrationStrategy;
  #defaultFramework: Framework;
  #defaultWrapperTag: string | undefined;

  constructor(options: RegistryOptions = {}) {
    this.#defaultHydration = options.defaultHydration ?? "visible";
    this.#defaultFramework = options.defaultFramework ?? "react";
    this.#defaultWrapperTag = options.defaultWrapperTag;
  }

  /** Register with defaults applied; throws on invalid/duplicate names. */
  registerFromInput(
    name: string,
    input: Partial<IslandComponent> & { component: string },
  ): IslandComponent {
    if (!isValidComponentName(name)) {
      throw new ComponentRegistryError(
        `Invalid component name "${name}". Must start with uppercase and contain only alphanumeric characters.`,
      );
    }
    if (this.#components.has(name)) {
      throw new ComponentRegistryError(`Component "${name}" is already registered.`);
    }
    const framework = input.framework ?? detectFramework(input.component) ?? this.#defaultFramework;
    const hydration = input.hydration ?? this.#defaultHydration;
    if (hydration === "media" && !input.mediaQuery) {
      throw new ComponentRegistryError(
        `Component "${name}" uses "media" hydration strategy but no mediaQuery was provided.`,
      );
    }
    const mergedWrapperTag = input.wrapperTag ?? this.#defaultWrapperTag;
    const component: IslandComponent = {
      name,
      component: input.component,
      framework,
      hydration,
      ...(input.mediaQuery !== undefined ? { mediaQuery: input.mediaQuery } : {}),
      ...(input.clientOnlyFramework !== undefined
        ? { clientOnlyFramework: input.clientOnlyFramework }
        : {}),
      ...(mergedWrapperTag !== undefined ? { wrapperTag: mergedWrapperTag } : {}),
    };
    this.#components.set(name, component);
    return component;
  }

  /** Register a fully-formed component (no defaults applied). */
  register(component: IslandComponent): void {
    if (!isValidComponentName(component.name)) {
      throw new ComponentRegistryError(
        `Invalid component name "${component.name}". Must start with uppercase and contain only alphanumeric characters.`,
      );
    }
    if (this.#components.has(component.name)) {
      throw new ComponentRegistryError(`Component "${component.name}" is already registered.`);
    }
    this.#components.set(component.name, component);
  }

  get(name: string): IslandComponent | undefined {
    return this.#components.get(name);
  }

  has(name: string): boolean {
    return this.#components.has(name);
  }

  getAll(): IslandComponent[] {
    return [...this.#components.values()];
  }

  getNames(): string[] {
    return [...this.#components.keys()];
  }

  /** Cross-component validation: only/media rules and file presence. */
  validate(fileExists: (componentPath: string) => boolean = () => true): ValidationResult {
    const errors: ValidationError[] = [];
    for (const component of this.getAll()) {
      if (!fileExists(component.component)) {
        errors.push({
          componentName: component.name,
          message: `Component file not found: ${component.component}`,
        });
      }
      if (component.hydration === "only" && !component.clientOnlyFramework) {
        errors.push({
          componentName: component.name,
          message: `"only" hydration strategy requires clientOnlyFramework to be specified.`,
        });
      }
      if (component.hydration === "media" && !component.mediaQuery) {
        errors.push({
          componentName: component.name,
          message: `"media" hydration strategy requires mediaQuery to be specified.`,
        });
      }
      if (
        component.hydration !== "only" &&
        component.hydration !== "media" &&
        component.mediaQuery
      ) {
        errors.push({
          componentName: component.name,
          message: `mediaQuery is only applicable with "media" hydration strategy, but got "${component.hydration}".`,
        });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  generateImports(): string[] {
    return this.getAll().map((c) => `import ${c.name} from '${c.component}';`);
  }

  /** Emit the Astro island usage snippet for one component. */
  generateIslandWrapper(component: IslandComponent): string {
    const tag = component.wrapperTag ?? "div";
    const classAttr = component.wrapperClass ? ` class="${component.wrapperClass}"` : "";
    const directive =
      component.hydration === "only"
        ? `client:only="${component.clientOnlyFramework ?? component.framework}"`
        : component.hydration === "media"
          ? `client:media="${component.mediaQuery}"`
          : `client:${component.hydration}`;
    return `<${tag}${classAttr}>\n  <${component.name} ${directive} />\n</${tag}>`;
  }

  getRequiredFrameworks(): Set<Framework> {
    const frameworks = new Set<Framework>();
    for (const component of this.getAll()) {
      frameworks.add(component.framework);
      if (component.clientOnlyFramework) {
        frameworks.add(component.clientOnlyFramework);
      }
    }
    return frameworks;
  }
}
