import { Context, Version } from "../core/context";
import { Task } from "../core/log";

export function checkVersion(version: Partial<Version>): Required<Version> {
    version ??= {};
    version.build ??= 0;
    version.minor ??= 0;
    version.major ??= 0;
    return version as Required<Version>;
}

export function versionString(version: Version) {
    if (typeof version === "string") return version;
    version = checkVersion(version);
    return `${version.major}.${version.minor}.${version.build}`;
}

export function createVersion(versionString: string): Version {
    const parts = versionString
        .split(".")
        .map((part) => part.trim().replace(/[^0-9]/, ""));
    return {
        major: parts[0] ? parseInt(parts[0]) : 0,
        minor: parts[1] ? parseInt(parts[1]) : 0,
        build: parts[2] ? parseInt(parts[2]) : 0,
    };
}
async function bump(
    version: Version,
    build: boolean = true,
    minor?: boolean,
    major?: boolean
) {
    const _version = checkVersion(version);
    if (build) _version.build++;
    if (minor) _version.minor++;
    if (major) {
        _version.major++;
        _version.minor = 0;
    }
    await Task.Short("success", "bump version", versionString(_version));
}

export async function setVersion(
    context: Context,
    major: number,
    minor: number,
    build: number
) {
    const version = checkVersion(context.mod.version);
    if (typeof build !== "undefined") version.build = build;
    if (typeof minor !== "undefined") version.minor = minor;
    if (typeof major !== "undefined") version.major = major;
    await Task.Short("set version", versionString(version));
}

export async function bumpBuild({ mod: { version } }: Context) {
    await bump(version, true, false, false);
}

export async function bumpMinor({ mod: { version } }: Context) {
    await bump(version, false, true, true);
}

export async function bumpMajor({ mod: { version } }: Context) {
    await bump(version, false, false, true);
}

export async function bumpVersion<T extends keyof Version>(
    { mod: { version } }: Context,
    part: T
) {
    await bump(version, part === "build", part === "minor", part === "major");
}
