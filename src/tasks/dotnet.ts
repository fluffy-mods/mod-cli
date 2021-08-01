import { exec } from "child_process";
import { basename, relative } from "path";

import { Context } from "../core/context.js";
import { Task } from "../core/log.js";
import { findDown } from "../core/utils.js";
import { versionString } from "./version.js";

export async function buildModSolution({
    build: { baseDir, buildTarget },
    mod: { version, author },
}: Context) {
    const task = await Task.Long(`build mod assemblies`);
    const sln = await findDown("*.sln", baseDir);

    if (!sln) {
        await task.warn(`no solution found, skipping build`);
        return;
    }

    return new Promise((resolve, reject) => {
        const args = [
            `-p:PostBuildEvent=""`,
            `-p:Version="${versionString(version)}"`,
            `-p:Company="${author.name}"`,
            `-p:FileVersion="${versionString(version)}"`,
            `-p:AssemblyVersion="${version.major}.0.0"`,
        ];
        if (buildTarget === "RELEASE") {
            args.push(`-p:Configuration=Release`);
        } else if (buildTarget === "DEBUG") {
            args.push(`-p:Configuration=Debug`);
        }
        const command = `dotnet build ${args.join(" ")} "${sln}"`;
        exec(command, async (err, stdout, stderr) => {
            if (err) {
                await task.failure(stderr || stdout);
                return reject(err);
            }
            await task.success(`${relative(baseDir, sln)} [${buildTarget}]`);
            return resolve(true);
        });
    });
}

export async function updateProjectReferences({ build: { baseDir } }: Context) {
    const task = await Task.Long(`update project references`);
    const solution = await findDown("*.sln", baseDir);
    if (!solution) {
        await task.warn("no solution found, skipping update");
        return;
    }
    return new Promise<void>((resolve, reject) => {
        const command = `dotnet outdated -u "${solution}"`;
        exec(command, async (err, stdout, stderr) => {
            if (err) {
                await task.failure(stderr || stdout);
                return reject(err);
            }
            await task.success(basename(solution));
            return resolve();
        });
    }).catch(console.error);
}

export async function formatProject({ build: { baseDir } }: Context) {
    const task = await Task.Long(`apply code formatting`);
    const solution = await findDown("*.sln", baseDir);
    if (!solution) {
        await task.warn("no solution found, skipping format");
        return;
    }

    return new Promise<void>((resolve, reject) => {
        const command = `dotnet format -w -s:info -a:warn "${solution}"`;
        exec(command, async (err, stdout, stderr) => {
            if (err) {
                await task.failure(stderr || stdout);
                return reject(err);
            }
            await task.success(basename(solution));
            return resolve();
        });
    }).catch(console.error);
}
