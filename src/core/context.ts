export const ConfigFileNames = {
    mod: "modinfo.json",
    game: "gameconfig.json",
    system: "systemconfig.json",
} as const;

export const resourceTypes = ["mod", "game", "system"] as const;
export type ResourceTypes = typeof resourceTypes[number];

export const colours = {
    info: "#005FAF",
    success: "#077048",
    warning: "#F79F03",
    danger: "#A10507",
    gray: "#666666",
};

export interface Version {
    major: number;
    minor?: number;
    build?: number;
}

export interface ChangelogEntry {
    date: Date;
    message: string;
    author: AuthorInfo;
    version?: Version;
    hash: string;
}

export interface Paths {
    target: string;
    source: string;
}

export type Suggestion<T> = T | Promise<T>;

export interface Resource {
    name: string;
    url?: string;
}

export interface VersionInfo {
    version: Version;
    changelog?: ChangelogEntry[];
}

export interface AuthorInfo extends Resource {
    email?: string;
    socials?: { [type: string]: string };
}

export interface ModInfo extends Resource, VersionInfo {
    author: AuthorInfo;
    tags: string[];
    git: GitInfo;
    contributions: Contribution[];
    contributors: {
        [type: string]: Contribution[];
    };
    attributions: Attribution[];
    sourceDir: string;
    targetDir: string;

    dependencies?: Dependency[];
}

export interface Contribution {
    author: string;
    description: string;
    suppressed?: boolean;
    hash: string;
}

export interface Attribution {
    description: string;
    author: string;
    license: string;
    url?: string;
}

interface BaseDependency {
    id: string;
    name?: string;
    steamId?: number;
    download?: string;
    version?: string;
    type: "required" | "incompatible" | "loadBefore" | "loadAfter";
}

interface RequiredDependency extends BaseDependency {
    type: "required";
    name: string;
}

interface IncompatibleDependency extends BaseDependency {
    type: "incompatible";
}

interface LoadBeforeDependency extends BaseDependency {
    type: "loadBefore";
}

interface LoadAfterDependency extends BaseDependency {
    type: "loadAfter";
}

export function isRequiredDependency(
    dependency: Dependency
): dependency is RequiredDependency {
    return dependency.type === "required";
}

export function isIncompatibleDependency(
    dependency: Dependency
): dependency is IncompatibleDependency {
    return dependency.type === "incompatible";
}

export function isLoadBeforeDependency(
    dependency: Dependency
): dependency is LoadBeforeDependency {
    return dependency.type === "loadBefore";
}

export function isLoadAfterDependency(
    dependency: Dependency
): dependency is LoadAfterDependency {
    return dependency.type === "loadAfter";
}

export type Dependency =
    | RequiredDependency
    | IncompatibleDependency
    | LoadBeforeDependency
    | LoadAfterDependency;

export interface GitInfo {
    owner: string;
    repo: string;
    url?: string;
}

export interface BuildInfo {
    archivePath?: string;
    baseDir: string;
    sourceDir: string;
    targetDir: string;
    buildTarget?: "DEBUG" | "RELEASE";
}

export interface GameConfig extends Resource {
    targetDir: string;
    archiveDir: string;
    templateDir: string;

    steamId?: number;
    defaultAuthor?: AuthorInfo;

    include?: string[];
    exclude?: string[];
}

export interface SystemConfig {
    msBuildPath: string;
    workshopUploaderPath: string;
    githubToken: string;
    defaultAuthor?: AuthorInfo;
    ignoredContributors?: string[];
}

export interface Context {
    debug?: boolean;
    mod: ModInfo;
    build: BuildInfo;
    game: GameConfig;
    system: SystemConfig;
}
