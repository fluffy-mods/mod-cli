import fs from "fs/promises";
import path from "path";

import { Context, Version } from "../../core/context.js";
import { createVersion } from "../version.js";

export async function getRimWorldVersion({ game }: Context): Promise<Version> {
    const versionPath = path.join(game.targetDir, "..", "Version.txt");
    const versionString = await fs.readFile(versionPath, "utf8");
    const versionMatch = versionString.match(/\d+\.\d+\.\d+/);
    if (!versionMatch) {
        throw new Error(
            `Could not find RimWorld version:\n${{
                versionPath,
                versionString,
            }}`
        );
    }

    return createVersion(versionMatch[0]);
}
