import inquirer from "inquirer";
import { valid } from "semver";
import { CommandModule } from "yargs";

import { Dependency } from "../core/context.js";
import { getContext } from "../tasks/context.js";
import { addDependency, listDependencies, migrateDependencies, removeDependency } from "../tasks/dependency.js";

export const DependencyCommand: CommandModule = {
    command: ["dependency", "dep"],
    describe: "add, remove and update mod dependencies",
    builder: (yargs) => {
        return yargs
            .command({
                command: ["$0", "list", "ls"],
                describe: "list all dependencies",
                builder: (yargs) => yargs.help(),
                handler: async () => {
                    const context = await getContext();
                    await listDependencies(context);
                },
            })
            .command<{ harmony: boolean }>({
                command: "add [harmony]",
                describe: "add a dependency",
                builder: (yargs) => {
                    return yargs
                        .positional("harmony", {
                            describe: "add harmony dependency",
                            type: "boolean",
                            default: false,
                        })
                        .help();
                },
                handler: async (args) => {
                    const context = await getContext();
                    let dep: Dependency;
                    if (args.harmony) {
                        dep = {
                            name: "Harmony",
                            id: "brrainz.harmony",
                            steamId: 2009463077,
                            download:
                                "https://github.com/pardeike/HarmonyRimWorld/releases/latest",
                            type: "required",
                        };
                    } else {
                        dep = await inquirer.prompt<Dependency>([
                            {
                                name: "type",
                                type: "list",
                                choices: [
                                    "required",
                                    "incompatible",
                                    "loadBefore",
                                    "loadAfter",
                                ],
                                message: "Dependency type",
                                default: "required",
                            },
                            {
                                name: "id",
                                message: "Dependency id",
                                validate: (id: string) =>
                                    id.match(
                                        /^(?:[a-z0-9]+\.)+(?:[a-z0-9])+$/i
                                    ),
                            },
                            {
                                name: "name",
                                message: "Dependency name",
                                default: "",
                                validate: (name: string, args: Dependency) =>
                                    args.type !== "required" || name,
                            },
                            {
                                name: "version",
                                message: "Dependency version",
                                default: "",
                                validate: (version: string) =>
                                    !!version || valid(version),
                            },
                            {
                                name: "steamId",
                                message: "Dependency name",
                                default: "",
                                when: (args: Dependency) =>
                                    args.type === "required",
                            },
                            {
                                name: "download",
                                message: "Dependency download url",
                                default: "",
                                when: (args: Dependency) =>
                                    args.type === "required",
                            },
                        ]);
                    }
                    await addDependency(context, dep);
                },
            })
            .command<{ id: string }>({
                command: "remove <id>",
                describe: "remove a dependency",
                builder: (yargs) =>
                    yargs
                        .positional("id", {
                            describe: "dependency id",
                            type: "string",
                        })
                        .demandOption("id")
                        .help(),
                handler: async (args) => {
                    const context = await getContext();
                    await removeDependency(context, args.id);
                },
            })
            .command<{ cleanup: boolean }>({
                command: "migrate",
                describe: "migrate from dependencies.json file",
                builder: (yargs) =>
                    yargs
                        .option("cleanup", {
                            type: "boolean",
                            default: false,
                            describe: "cleanup old dependency files",
                        })
                        .help(),
                handler: async (args) => {
                    const context = await getContext();
                    await migrateDependencies(context, args.cleanup);
                },
            })
            .help();
    },
    handler: () => {},
};
