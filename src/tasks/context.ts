import fs from "fs-extra";
import path from "path";

import { BuildInfo, ConfigFileNames, Context, GameConfig, ModInfo, SystemConfig } from "../core/context";
import { Task } from "../core/log";
import { findUp } from "../core/utils";
import { getGitInfo } from "./git";

async function getModInfoPath(dir?: string) {
    return findUp(ConfigFileNames.mod, dir);
}
function createModInfoPath(dir?: string) {
    return path.join(dir ?? process.cwd(), ConfigFileNames.mod);
}

export async function readModInfo(
    path?: string,
    dir?: string
): Promise<ModInfo> {
    path ??= await getModInfoPath(dir);
    if (!path) {
        throw new Error(
            `No ${ConfigFileNames.mod} found, please create one first`
        );
    }
    return fs.readFile(path, "utf8").then(JSON.parse);
}

export async function writeModInfo(
    mod: ModInfo,
    baseDir: string,
    create?: boolean
): Promise<string> {
    const modinfoPath = create
        ? createModInfoPath(baseDir)
        : await getModInfoPath(baseDir);
    if (!modinfoPath)
        throw new Error(
            `No ${ConfigFileNames.mod} found, please create one first.`
        );
    await fs.writeFile(modinfoPath, JSON.stringify(mod, null, 4));
    Task.Log(
        "write modinfo",
        "success",
        path.relative(process.cwd(), modinfoPath)
    );
    return modinfoPath;
}

export async function updateModInfo(
    context: Pick<Context, "mod" | "build">
): Promise<void> {
    await writeModInfo(context.mod, context.build.baseDir);
}

export function isContext(obj: unknown): obj is Context {
    let context = obj as Context;
    return (
        !!context &&
        !!context.mod &&
        !!context.game &&
        !!context.system &&
        !!context.build
    );
}

export async function deleteModInfo(path?: string) {
    path ??= await getModInfoPath();
    if (!path) return null;
    return fs.unlink(path);
}

export async function readGameConfig(
    path?: string,
    dir?: string
): Promise<GameConfig> {
    path ??= await findUp(ConfigFileNames.game, dir);
    if (!path) {
        throw new Error(
            `no ${ConfigFileNames.game} found, please create one first.`
        );
    }
    return fs.readFile(path, "utf8").then(JSON.parse);
}

export async function writeGameConfig(dir: string, game: GameConfig) {
    const gameconfigPath = path.join(dir, ConfigFileNames.game);
    await fs.writeFile(gameconfigPath, JSON.stringify(game, null, 4), "utf8");
    Task.Log(
        "write gameconfig",
        "success",
        path.relative(process.cwd(), gameconfigPath)
    );
    return gameconfigPath;
}

export async function readSystemConfig(
    path?: string,
    dir?: string
): Promise<SystemConfig> {
    path ??= await findUp(ConfigFileNames.system, dir);
    if (!path) {
        throw new Error(
            `no ${ConfigFileNames.system} found, please create one first.`
        );
    }
    return fs.readFile(path, "utf8").then(JSON.parse);
}

export async function writeSystemConfig(dir: string, config: SystemConfig) {
    const systemconfigPath = path.join(dir, ConfigFileNames.system);
    await fs.writeFile(
        systemconfigPath,
        JSON.stringify(config, null, 4),
        "utf8"
    );
    Task.Log(
        "write systemconfig",
        "success",
        path.relative(process.cwd(), systemconfigPath)
    );
    return systemconfigPath;
}

export async function getContext(dir?: string): Promise<Context> {
    const mod = await readModInfo(undefined, dir);
    const game = await readGameConfig(undefined, dir);
    const system = await readSystemConfig(undefined, dir);
    const baseDir = await getModDir();
    const build: BuildInfo = {
        baseDir,
        sourceDir: path.join(baseDir, mod.sourceDir),
        targetDir: path.join(game.targetDir, mod.targetDir),
    };

    if (!mod) {
        throw "modinfo.json not found. See `mod config mod -h`";
    }
    if (!game) {
        throw "gameconfig.json not found. See `mod config game -h`";
    }
    if (!system) {
        throw "systemconfig.json not found. See `mod config system -h`";
    }

    // append git info when possible
    if (!mod.git) {
        const gitInfo = await getGitInfo(baseDir, false);
        if (gitInfo) {
            Task.Log(
                "adding gitInfo to modInfo",
                "info",
                `${gitInfo.owner}/${gitInfo.repo}`
            );
            mod.git = gitInfo;
            updateModInfo({ mod, build });
        }
    }

    return { mod, game, system, build };
}

export async function getModDir(cwd: string = process.cwd()): Promise<string> {
    const modinfoPath = await getModInfoPath(cwd);
    if (typeof modinfoPath === "undefined")
        throw "modinfo.json not found, make sure you are running this command from inside a mod directory.";
    return path.dirname(modinfoPath);
}
