import escalade from "escalade";
import fileSize from "filesize";
import fs from "fs-extra";
import kebabCase from "lodash/kebabCase.js";
import micromatch from "micromatch";
import path from "path";
import readdirp from "readdirp";

const { partial } = fileSize;

export async function exists(path: string): Promise<boolean> {
    return fs
        .stat(path)
        .then((_) => true)
        .catch((err) => {
            if (err.code === "ENOENT") return false;
            throw err;
        });
}

export async function findUp(
    pattern: string,
    start: string = process.cwd()
): Promise<string | undefined> {
    const match = await escalade(start, (dir, names) => {
        const [match] = micromatch(names, pattern);
        return match;
    });
    return !!match ? match : undefined;
}

const defaultMatchOptions: micromatch.Options = {
    basename: true,
    format: path.normalize,
};

export async function findDown(
    pattern: string,
    start: string = process.cwd(),
    exclude: string[] = [
        "node_modules",
        ".cache",
        ".git",
        ".vscode",
        "obj",
        "packages",
    ],
    options: micromatch.Options = defaultMatchOptions
) {
    const matcher = micromatch.matcher(pattern, options);
    for await (const file of readdirp(start, {
        fileFilter: (f) => matcher(f.fullPath),
        depth: 5,
        directoryFilter: (d) =>
            !micromatch.isMatch(d.fullPath, exclude, options),
        type: "files",
    })) {
        return file.fullPath;
    }
}

export async function findDir(
    pattern: string,
    start: string = process.cwd(),
    exclude: string[] = [
        "node_modules",
        ".cache",
        ".git",
        ".vscode",
        "obj",
        "packages",
    ]
) {
    for await (const dir of readdirp(start, {
        fileFilter: pattern,
        depth: 5,
        directoryFilter: exclude,
        type: "directories",
    })) {
        return dir.fullPath;
    }
}

export function slugify(name: string): string {
    return kebabCase(name);
}

export function validateSlug(dir: string): boolean {
    return !!dir.match(/^[a-z](?:[a-z0-9]+\-?)*[a-z0-9]$/);
}

export async function getFiles(
    baseDir: string = process.cwd(),
    include: string[] = [],
    exclude: string[] = []
): Promise<string[]> {
    const files = new Set<string>();
    const filter = (f: readdirp.EntryInfo) =>
        (!include?.length ||
            micromatch.isMatch(f.fullPath, include, { matchBase: true })) &&
        (!exclude?.length ||
            !micromatch.isMatch(f.fullPath, exclude, { matchBase: true }));

    for await (const file of readdirp(baseDir, {
        root: baseDir,
        fileFilter: filter,
        directoryFilter: filter,
        depth: 99,
    })) {
        files.add(path.relative(baseDir, file.fullPath));
    }

    return [...files];
}

export const filesize = partial({});
