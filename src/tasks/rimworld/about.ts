import fs from "fs/promises";
import path from "path";
import { convert } from "xmlbuilder2";

import {
    Context,
    isIncompatibleDependency,
    isLoadAfterDependency,
    isLoadBeforeDependency,
    isRequiredDependency,
} from "../../core/context.js";
import { Task } from "../../core/log.js";
import { getUnityDescription } from "../description.js";
import { getRimWorldVersion } from "./version.js";

export interface Versioned<T> {
    [version: string]: T | undefined;
}

export type List<T> = { li: T[] };

export interface ModDependency {
    packageId: string | number;
    displayName: string;
    downloadUrl?: string;
    steamWorkshopUrl?: string;
}

export interface About {
    _version?: string;

    name: string;
    packageId: string;
    author: string;
    url?: string;
    supportedVersions: List<string>;

    description?: string;
    modDependencies?: List<ModDependency>;
    incompatibleWith?: List<string>;
    loadBefore?: List<string>;
    loadAfter?: List<string>;

    descriptionsByVersion?: Versioned<string>;
    modDependenciesByVersion?: Versioned<List<ModDependency>>;
    incompatibleWithByVersion?: Versioned<List<string>>;
    loadBeforeByVersion?: Versioned<List<string>>;
    loadAfterByVersion?: Versioned<List<string>>;
}

export async function updateAbout(context: Context): Promise<void> {
    const task = await Task.Long("update About.xml");
    try {
        const about = await createAbout(context);
        const aboutPath = path.join(
            context.build.baseDir,
            "About",
            "About.xml"
        );
        await writeAbout(about, aboutPath);
        await task.success(path.relative(context.build.baseDir, aboutPath));
    } catch (err) {
        await task.danger(err);
        throw err;
    }
}

export async function writeAbout(
    about: About,
    aboutPath: string
): Promise<void> {
    const xml = convert(
        {
            version: "1.0",
            encoding: "UTF-8",
            standalone: true,
        },
        { ModMetaData: about },
        {
            prettyPrint: true,
            width: 80,
            indent: "    ",
            format: "xml",
        }
    );
    await fs.writeFile(aboutPath, xml, "utf8");
}

export function createPackageId(author: string, mod: string): string {
    return `${author}.${mod}`.replace(/[^a-z\.]/gim, "");
}

export async function createAbout(context: Context): Promise<About> {
    const { mod } = context;
    const rimworldVersion = await getRimWorldVersion(context);

    const about: About = {
        name: mod.name,
        author: mod.author.name,
        packageId: createPackageId(mod.author.name, mod.name),
        description: await getUnityDescription(context),
        url: mod.url,
        supportedVersions: {
            li: [`${rimworldVersion.major}.${rimworldVersion.minor}`],
        },
    };

    if (mod.dependencies) {
        const required = mod.dependencies.filter(isRequiredDependency);
        const incompatible = mod.dependencies.filter(isIncompatibleDependency);
        const before = mod.dependencies.filter(isLoadBeforeDependency);
        const after = mod.dependencies.filter(
            (dep) => isLoadAfterDependency(dep) || isRequiredDependency(dep)
        );

        if (required.length) {
            const reqs: ModDependency[] = [];
            about.modDependencies = { li: reqs };

            for (const req of required) {
                reqs.push({
                    packageId: req.id,
                    displayName: req.name,
                    steamWorkshopUrl: req.steamId
                        ? `steam://url/CommunityFilePage/${req.steamId}`
                        : undefined,
                    downloadUrl: req.download,
                });
            }
        }

        if (incompatible.length) {
            about.incompatibleWith = {
                li: incompatible.map((req) => req.id),
            };
        }
        if (before.length) {
            about.loadBefore = { li: before.map((req) => req.id) };
        }
        if (after.length) {
            about.loadAfter = { li: after.map((req) => req.id) };
        }
    }

    return about;
}
