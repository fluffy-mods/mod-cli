import fs, { mkdir } from "fs/promises";
import isEqual from "lodash/isEqual";
import uniqWith from "lodash/uniqWith";
import path from "path";
import semver from "semver";
import Git from "simple-git";
import { convert } from "xmlbuilder2";

import { Context } from "../../core/context";
import { Task } from "../../core/log";
import { getFiles } from "../../core/utils";
import { About, List, ModDependency, Versioned, writeAbout } from "./about";

/**
 * Multiple releases merge strategy using Git branches.
 *
 * Creates a multi-version targeted mod at the target location. It does this by
 * checking for each consecutive version which files have been changed, added
 * and/or removed.
 *
 * If files are added or changed, add them to a new versioned folder. If they
 * are removed, add the original version to a versioned folder.
 *
 * @param targetDir path to target directory.
 * @param versions object of branch names, with versions as keys.
 */
export async function mergeVersions({
    build: { baseDir, targetDir },
    game: { include, exclude },
    debug,
}: Context): Promise<void> {
    const git = Git(baseDir);
    const versions = await getVersionBranches(baseDir);
    const abouts: About[] = [];
    const task = await Task.Long("merge versions");

    for (let i = 0; i < versions.length; i++) {
        let version = versions[i];
        await git.checkout(version);

        let files = await getFiles(baseDir, include, exclude);
        let about = await getAbout(baseDir);
        abouts.push({ _version: version, ...about });
        const unversionedFiles = new Set<string>();

        await task.inform(`${version}: merging ${files.length} files`);

        for (let file of files) {
            if (!isVersioned(file, version)) {
                if (semver.satisfies(semver.coerce(version)!, ">= 1.1")) {
                    unversionedFiles.add(file);
                }
                await copy(
                    path.join(baseDir, file),
                    path.join(targetDir, file)
                );
            }
            await copy(
                path.join(baseDir, file),
                path.join(targetDir, version, file)
            );
        }

        if (debug && unversionedFiles.size) {
            await task.warn(
                `${version}: ${[...unversionedFiles].join(", ")} not versioned.`
            );
        }
    }

    let loadFolders: Versioned<List<string>> = {};
    for (let version of versions) {
        // 1.0 is always defaulted to `/` or `/1.0`
        if (semver.satisfies(semver.coerce(version)!, ">= 1.1")) {
            loadFolders[`v${version}`] = { li: [version] };
        }
    }

    let about: About = {
        name: abouts[0].name,
        author: abouts[0].author,
        packageId: abouts[abouts.length - 1].packageId,
        url: abouts[0].url,
        supportedVersions: { li: versions },
    };

    // assign descriptions, dependencies etc. overall or if necessary per version.
    let descriptions = abouts.map((a) => a.description);
    if (hasMultipleVersions(descriptions)) {
        about.descriptionsByVersion = abouts.reduce((x, y) => {
            x[`v${y._version}`] = y.description;
            return x;
        }, {} as Versioned<string>);
    } else {
        about.description = descriptions[0];
    }
    // set 1.0 description as default description, if it exists.
    if (!about.description && versions.some((v) => v === "1.0")) {
        about.description =
            descriptions[versions.findIndex((v) => v === "1.0")];
    }

    let modDependencies = abouts.map((a) => a.modDependencies);
    if (hasMultipleVersions(modDependencies)) {
        about.modDependenciesByVersion = abouts.reduce((all, dep) => {
            all[`v${dep._version}`] = dep.modDependencies;
            return all;
        }, {} as Versioned<List<ModDependency>>);
    } else {
        about.modDependencies = modDependencies[0];
    }

    let incompatibleWith = abouts.map((a) => a.incompatibleWith);
    if (hasMultipleVersions(incompatibleWith)) {
        about.incompatibleWithByVersion = abouts.reduce((all, dep) => {
            all[`v${dep._version}`] = dep.incompatibleWith;
            return all;
        }, {} as Versioned<List<string>>);
    } else {
        about.incompatibleWith = incompatibleWith[0];
    }

    let loadBefore = abouts.map((a) => a.loadBefore);
    if (hasMultipleVersions(loadBefore)) {
        about.loadBeforeByVersion = abouts.reduce((all, dep) => {
            all[`v${dep._version}`] = dep.loadBefore;
            return all;
        }, {} as Versioned<List<string>>);
    } else {
        about.loadBefore = loadBefore[0];
    }
    let loadAfter = abouts.map((a) => a.loadAfter);
    if (hasMultipleVersions(loadAfter)) {
        about.loadAfterByVersion = abouts.reduce((all, dep) => {
            all[`v${dep._version}`] = dep.loadAfter;
            return all;
        }, {} as Versioned<List<string>>);
    } else {
        about.loadAfter = loadAfter[0];
    }

    await fs.writeFile(
        path.join(targetDir, "LoadFolders.xml"),
        convert(
            { version: "1.0", encoding: "UTF-8", standalone: true },
            { loadFolders }
        ),
        "utf8"
    );
    await writeAbout(about, path.join(targetDir, "About", "About.xml"));

    await task.success(versions.join(", "));
}

function hasMultipleVersions(array: any[], comparator = isEqual) {
    return uniqWith(array, comparator).length > 1;
}

async function getAbout(baseDir: string): Promise<About> {
    const raw = await fs.readFile(
        path.join(baseDir, "About", "About.xml"),
        "utf8"
    );
    const about = convert(raw, { format: "object" }) as any;
    return about.ModMetaData;
}

export async function getVersionBranches(baseDir: string) {
    let git = Git(baseDir);
    let branches = await git.branch();
    return branches.all
        .filter((b) => b.match(/^\d+\.\d+$/))
        .sort((a, b) => semver.coerce(a)?.compare(semver.coerce(b)!)!);
}

async function copy(source: string, target: string) {
    let dir = path.dirname(target);
    try {
        await fs.stat(dir);
    } catch (err) {
        await mkdir(dir, { recursive: true });
    }
    try {
        await fs.copyFile(source, target);
    } catch (err) {
        Task.Log(
            "merge versions",
            "danger",
            `Failed to copy ${source} to ${target}: ${err}`
        );
        process.exit(-1);
    }
    return true;
}

const versioned = [
    {
        version: "1.0",
        folders: ["Assemblies", "Defs", "Patches"],
    },
    {
        version: ">= 1.1",
        folders: [
            "Assemblies",
            "Defs",
            "Patches",
            "Sounds",
            "Textures",
            "Languages",
        ],
    },
];

function isVersioned(file: string, version: string) {
    let { folders } = versioned.find((v) =>
        semver.satisfies(semver.coerce(version)!, v.version, true)
    ) || { folders: [] };
    return folders.some((f) => file.split(/\\|\//)[0] == f);
}
