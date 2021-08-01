import archiver from "archiver";
import fs from "fs";
import path from "path";

import { Context } from "../core/context.js";
import { Task } from "../core/log.js";
import { filesize } from "../core/utils.js";
import { versionString } from "./version.js";

export async function createArchive({
    mod,
    game,
    build,
}: Context): Promise<void> {
    const task = await Task.Long(`create release archive`);
    return new Promise((resolve, reject) => {
        const archiveName = `${mod.name} v${versionString(mod.version)}.zip`;
        build.archivePath = path.join(game.archiveDir, archiveName);

        // open archive
        var archive = archiver("zip", { store: true });
        archive.on("warning", async (warning) => {
            await task.warn(warning.message);
        });
        archive.on("error", async (err) => {
            await task.failure(err);
            process.exit(-1);
        });

        // open a stream
        var out = fs.createWriteStream(build.archivePath);
        out.on("close", async (err: any) => {
            if (err) {
                await task.failure(err);
                process.exit(-1);
            }
            await task.success(
                `${path.relative(
                    build.baseDir,
                    build.archivePath!
                )} (${filesize(archive.pointer())})`
            );
            return resolve();
        });

        // add our files
        archive.pipe(out);
        archive.directory(build.targetDir, path.basename(build.targetDir));
        archive.finalize();
    });
}
