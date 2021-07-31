import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

import { Context } from "../core/context";
import { Task } from "../core/log";
import { getChangelog, getWorkshopDescription } from "./description";

export async function steamWorkshopUpdate(context: Context): Promise<void> {
    const { build, system: config } = context;
    return new Promise(async (resolve, reject) => {
        const task = await Task.Long("update steam workshop");
        try {
            const changenote = await getChangelog(context);
            const description = await getWorkshopDescription(context);

            // write changenote and description to file.
            await fs.writeFile("changenote.txt", changenote, "utf8");
            await fs.writeFile("description.txt", description, "utf8");

            // spawn process
            let updater = spawn(
                config.workshopUploaderPath,
                [
                    build.targetDir,
                    path.resolve("changenote.txt"),
                    path.resolve("description.txt"),
                ],
                { stdio: "inherit" }
            );

            // wait for process to finish
            updater.on("close", async (exitCode) => {
                await fs.unlink("changenote.txt");
                await fs.unlink("description.txt");
                if (exitCode) {
                    throw new Error(`workshop update error: ${exitCode}`);
                } else {
                    await task.success();
                    return resolve();
                }
            });
        } catch (err) {
            await task.failure(err.message, err.toString());
            reject(err);
        }
    });
}
