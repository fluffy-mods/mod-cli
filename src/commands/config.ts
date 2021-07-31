import { spawn } from "child_process";
import inquirer from "inquirer";
import path from "path";
import { CommandModule } from "yargs";

import {
    AuthorInfo,
    ConfigFileNames,
    GameConfig,
    ModInfo,
    ResourceTypes,
    resourceTypes,
    SystemConfig,
} from "../core/context.js";
import { Task } from "../core/log.js";
import { exists, findUp } from "../core/utils.js";
import { readGameConfig, readSystemConfig, writeGameConfig, writeModInfo, writeSystemConfig } from "../tasks/context.js";
import { getGitInfo, getGitUser } from "../tasks/git.js";
import { createVersion, versionString } from "../tasks/version.js";

export const ConfigCommand: CommandModule = {
    command: "config [resource]",
    describe: "create a scaffold for a mod, game or system config file.",
    builder: (yarg) =>
        yarg
            .positional("resource", {
                choices: resourceTypes,
                default: "mod",
                desc: "type of resource to create",
            })
            .command({
                command: "edit <resource>",
                describe: "edit the config file",
                builder: (yarg) =>
                    yarg.positional("resource", {
                        choices: resourceTypes,
                        default: "mod",
                        desc: "type of resource to create",
                    }),
                handler: async (argv) => {
                    let configfile: string | undefined;
                    console.log({ argv });
                    switch (argv.resource) {
                        case "mod":
                            configfile = await findUp(ConfigFileNames.mod);
                            break;
                        case "game":
                            configfile = await findUp(ConfigFileNames.game);
                            break;
                        case "system":
                            configfile = await findUp(ConfigFileNames.system);
                            break;
                    }
                    if (!configfile) {
                        throw new Error(`Could not find config file.`);
                    }
                    try {
                        const editor = spawn(
                            "cmd.exe",
                            ["/C", "code", configfile],
                            {
                                stdio: "inherit",
                            }
                        );
                        editor.on("error", (err) => {
                            console.log({ err });
                            throw err;
                        });
                    } catch (e) {
                        console.error({ e });
                        throw e;
                    }
                },
            })
            .option("dir", {
                desc: "directory in which to create the config file",
                alias: "d",
                default: process.cwd(),
                filter: path.resolve,
            })
            .example(
                "config mod",
                "create a new modinfo file in the current working directory."
            )
            .example(
                "config game -d ..",
                "create a new gameconfig file in the parent directory."
            )
            .help()
            .version("1.1.0"),
    handler: async (args: unknown) => {
        let { resource, dir } = args as {
            resource: ResourceTypes;
            dir: string;
        };

        switch (resource) {
            case "mod":
                return await createModInfo(dir);
            case "game":
                return await createGameConfig(dir);
            case "system":
                return createSystemConfig(dir);
        }
    },
};

async function createModInfo(path: string) {
    const game = await readGameConfig(undefined, path);
    const system = await readSystemConfig(undefined, path);
    const git = {
        repo: await getGitInfo(path, false),
        user: await getGitUser(path, false),
    };

    const author = await inquirer.prompt<AuthorInfo>([
        {
            name: "name",
            type: "input",
            message: "Your name",
            validate: (name) => (!name ? "you do need a name..." : true),
            default:
                game.defaultAuthor?.name ||
                system.defaultAuthor?.name ||
                git.repo?.owner ||
                git.user?.name,
        },
        {
            name: "url",
            type: "input",
            message: "Your personal website",
            default:
                game.defaultAuthor?.url ||
                system.defaultAuthor?.url ||
                git.repo?.url,
        },
        {
            name: "email",
            type: "input",
            message: "Your email",
            default:
                game.defaultAuthor?.email ||
                system.defaultAuthor?.email ||
                git.user?.email,
        },
    ]);
    const mod = await inquirer.prompt<ModInfo>([
        {
            name: "name",
            type: "input",
            message: "Mod name",
            default: git.repo?.repo,
            validate: (name) => (!name ? "the mod does need a name..." : true),
        },
        {
            name: "sourceDir",
            type: "input",
            message:
                "Folder that contains a distributable version of the mod, relative to the base mod folder.",
            default: ".",
        },
        {
            name: "targetDir",
            type: "input",
            message:
                "Folder in which to install the mod, relative to game mods folder.",
            default: ({ name }: ModInfo) => name.replace(/[^a-z]/i, ""),
            validate: (dir: string) =>
                dir.match(/^[a-z][a-z0-9_-]+[a-z0-9]$/i)
                    ? true
                    : "folder name is invalid, slug must start with a letter, contain only letters, numbers, dashes and underscores, and end with a letter or number.",
        },
        {
            name: "url",
            type: "input",
            message: "Mod website",
            default: git.repo?.url,
        },
        {
            name: "version",
            type: "input",
            message: "Mod version",
            default: "0.0.0",
            filter: createVersion,
            transformer: versionString,
        },
    ]);
    mod.author = author;
    const filename = await writeModInfo(mod, path, true);
    Task.Log("create modinfo", "success", filename);
}
async function createGameConfig(path: string) {
    const game = await inquirer.prompt<GameConfig>([
        {
            name: "name",
            type: "input",
            message: "Game name",
            validate: (name) => (!name ? "the game does need a name..." : true),
        },
        {
            name: "steamId",
            type: "number",
            message: "steam game id",
        },
        {
            name: "targetDir",
            type: "input",
            message: "base path for installing mods",
            validate: (path) => {
                if (!path) return "please provide a path";
                try {
                    if (!exists(path)) return "path does not exist";
                } catch (err) {
                    return err.message;
                }
                return true;
            },
        },
        {
            name: "archiveDir",
            type: "input",
            message: "path where release archives should be stored",
            validate: (path) => {
                if (!path) return "please provide a path";
                try {
                    if (!exists(path)) return "path does not exist";
                } catch (err) {
                    return err.message;
                }
                return true;
            },
        },
    ]);
    const filename = await writeGameConfig(path, game);
    Task.Log("create game config", "success", filename);
}

async function createSystemConfig(path: string) {
    const config = await inquirer.prompt<SystemConfig>([
        {
            name: "msBuildPath",
            type: "input",
            message: "path to msbuild.exe",
            validate: (path) => {
                if (!path) return "please provide a path";
                try {
                    if (!exists(path)) return "path does not exist";
                } catch (err) {
                    return err.message;
                }
                return true;
            },
        },
        {
            name: "workshopUploaderPath",
            type: "input",
            message: "path to SteamWorkshopUpdater.exe",
            validate: (path) => {
                if (!path) return true;
                try {
                    if (!exists(path)) return "path does not exist";
                } catch (err) {
                    return err.message;
                }
                return true;
            },
        },
        {
            name: "githubToken",
            type: "input",
            message: "GitHub personal access token",
        },
    ]);
    const filename = await writeSystemConfig(path, config);
    Task.Log("create system config", "success", filename);
}
