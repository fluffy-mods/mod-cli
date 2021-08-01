import fs from "fs-extra";
import micromatch from "micromatch";

import { Task } from "../core/log.js";

export async function clearDirectory(dir: string) {
    const task = await Task.Long("clear out directory", dir);
    try {
        await fs.rm(dir, { force: true, recursive: true });
        await task.success();
    } catch (err) {
        await task.failure(err);
    }
}

export async function copyDirectory(
    source: string,
    target: string,
    exclude: string[] = []
) {
    const task = await Task.Long("copy directory", `${source} => ${target}`);
    try {
        await fs.copy(source, target, {
            errorOnExist: true,
            recursive: true,
            filter: (file) =>
                !micromatch.isMatch(file, exclude, { matchBase: true }),
        });
        await task.success();
    } catch (err) {
        await task.failure(err);
    }
}
