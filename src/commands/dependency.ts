import inquirer from "inquirer";
import isEqualWith from "lodash/isEqualWith.js";
import { fs } from "mz";
import path from "path";
import { CommandModule } from "yargs";

import { Task } from "../core/log.js";
import { findDown } from "../core/utils.js";
import { getContext, writeModInfo } from "../tasks/context.js";

export const DependencyCommand: CommandModule = {
    command: ["dependency", "dep"],
    describe: "add, remove and update mod dependencies",
    builder: (yargs) => {
        return (
            yargs
                // .command("add [harmony]", "add a dependency", {
                //     builder: (yargs: Argv<{}>) => {
                //         return yargs.positional("harmony", {
                //             describe: "add harmony dependency",
                //             type: "boolean",
                //             default: false,
                //         });
                //     },
                //     handler: async (args) => {
                //         const {
                //             mod,
                //             build: { baseDir },
                //         } = await getContext();
                //         const dep = await inquirer.prompt<Dependency>([
                //             {
                //                 name: "type",
                //                 type: "list",
                //                 choices: [
                //                     "required",
                //                     "incompatible",
                //                     "loadBefore",
                //                     "loadAfter",
                //                 ],
                //                 message: "Dependency type",
                //                 default: "required",
                //             },
                //             {
                //                 name: "id",
                //                 message: "Dependency id",
                //                 validate: (id: string) =>
                //                     id.match(/^(?:[a-z0-9]+\.)+(?:[a-z0-9])+$/i),
                //             },
                //             {
                //                 name: "name",
                //                 message: "Dependency name",
                //                 default: "",
                //                 validate: (name: string, args: Dependency) =>
                //                     args.type !== "required" || name,
                //             },
                //             {
                //                 name: "version",
                //                 message: "Dependency version",
                //                 default: "",
                //                 validate: (version: string) =>
                //                     !!version || valid(version),
                //             },
                //             {
                //                 name: "steamId",
                //                 message: "Dependency name",
                //                 default: "",
                //                 when: (args: Dependency) =>
                //                     args.type === "required",
                //             },
                //             {
                //                 name: "download",
                //                 message: "Dependency download url",
                //                 default: "",
                //                 when: (args: Dependency) =>
                //                     args.type === "required",
                //             },
                //         ]);

                //         if (!mod.dependencies) {
                //             mod.dependencies = [];
                //         }
                //         if (
                //             mod.dependencies.find(
                //                 (_dep) =>
                //                     dep.id === dep.id &&
                //                     dep.version === _dep.version
                //             )
                //         ) {
                //             throw new Error(
                //                 `mod already contains a dependency on '${dep.id}', version '${dep.version}'`
                //             );
                //         }
                //         let dependency: Dependency;
                //         switch (dep.type) {
                //             case "required":
                //                 dependency = {
                //                     type: "required",
                //                     id: dep.id,
                //                     name: dep.name,
                //                     version: dep.version,
                //                     steamId: dep.steamId,
                //                     download: dep.download,
                //                 };
                //                 break;
                //             case "incompatible":
                //                 dependency = {
                //                     type: "incompatible",
                //                     id: dep.id,
                //                     name: dep.name,
                //                     version: dep.version,
                //                 };
                //                 break;
                //             case "loadBefore":
                //                 dependency = {
                //                     type: "loadBefore",
                //                     id: dep.id,
                //                     name: dep.name,
                //                     version: dep.version,
                //                 };
                //                 break;
                //             case "loadAfter":
                //                 dependency = {
                //                     type: "loadAfter",
                //                     id: dep.id,
                //                     name: dep.name,
                //                     version: dep.version,
                //                 };
                //                 break;
                //         }
                //         mod.dependencies.push(dependency);
                //         await writeModInfo(mod, baseDir);
                //     },
                // })
                // .command(
                //     "remove <id>",
                //     "remove a dependency",
                //     (yargs: Argv<{}>) =>
                //         yargs
                //             .positional("id", {
                //                 describe: "dependency id",
                //                 type: "string",
                //             })
                //             .demandOption("id"),
                //     async (args: any) => {
                //         const {
                //             mod,
                //             build: { baseDir },
                //         } = await getContext();
                //         const dep = mod.dependencies?.find(
                //             (_dep) => _dep.id === args.id
                //         );
                //         if (!dep) {
                //             throw new Error(
                //                 `dependency '${args.id}' not found`
                //             );
                //         }
                //         mod.dependencies = mod.dependencies!.filter(
                //             (_dep) => _dep.id !== args.id
                //         );
                //         await writeModInfo(mod, baseDir);
                //     }
                // )
                .command({
                    command: "migrate",
                    describe: "migrate from dependencies.json file",
                    handler: async (args) => {
                        const task = await Task.Long("migrate dependencies");
                        const {
                            mod,
                            build: { baseDir },
                        } = await getContext();

                        const dependenciesJson = await findDown(
                            "dependencies.json",
                            baseDir
                        );
                        if (dependenciesJson) {
                            await task.success(
                                `found dependencies.json file at ${path.relative(
                                    baseDir,
                                    dependenciesJson
                                )}`
                            );
                        } else {
                            await task.inform(
                                `no dependencies.json file found in ${baseDir}, skipping`
                            );
                            return;
                        }

                        const dependencies = await fs
                            .readFile(dependenciesJson, "utf8")
                            .then(JSON.parse);

                        if (!mod.dependencies) {
                            mod.dependencies = [];
                        }

                        if (dependencies.depends) {
                            for (const old of dependencies.depends) {
                                const dep = {
                                    type: "required" as const,
                                    id: old.id,
                                    name: old.name,
                                    version: old.version,
                                    steamId: old.steam,
                                    download: old.url,
                                };
                                if (
                                    mod.dependencies.find((cur) =>
                                        isEqualWith(
                                            cur,
                                            dep,
                                            (a, b) =>
                                                a.id === b.id &&
                                                a.version === b.version &&
                                                a.type === b.type
                                        )
                                    )
                                ) {
                                    task.inform(
                                        `requirement on ${dep.id} already exists, skipping`
                                    );
                                } else {
                                    task.success(
                                        `adding requirement on ${old.id}`
                                    );
                                    mod.dependencies.push(dep);
                                }
                            }
                        }

                        if (dependencies.incompatible) {
                            for (const old of dependencies.incompatible) {
                                const dep = {
                                    type: "incompatible" as const,
                                    id: old.id,
                                    name: old.name,
                                    version: old.version,
                                };
                                if (
                                    mod.dependencies.find(
                                        (cur) =>
                                            cur.id === old.id &&
                                            cur.type === "incompatible"
                                    )
                                ) {
                                    task.inform(
                                        `incompatibility with ${old.id} already exists, skipping`
                                    );
                                } else {
                                    task.success(
                                        `adding incompatibility with ${old.id}`
                                    );
                                    mod.dependencies.push(dep);
                                }
                            }
                        }
                        if (dependencies.before) {
                            for (const old of dependencies.before) {
                                if (
                                    mod.dependencies.find(
                                        (cur) =>
                                            cur.id === old &&
                                            cur.type === "loadBefore"
                                    )
                                ) {
                                    task.inform(
                                        `dependency loadBefore ${old.id} already exists, skipping`
                                    );
                                } else {
                                    task.success(
                                        `adding dependency loadBefore ${old}`
                                    );
                                    mod.dependencies.push({
                                        type: "loadBefore",
                                        id: old,
                                    });
                                }
                            }
                        }
                        if (dependencies.after) {
                            for (const old of dependencies.after) {
                                if (
                                    mod.dependencies.find(
                                        (cur) =>
                                            cur.id === old &&
                                            cur.type === "required"
                                    )
                                ) {
                                    task.inform(
                                        `ignoring dependency loadBefore ${old} because it is implied`
                                    );
                                } else if (
                                    mod.dependencies.find(
                                        (cur) =>
                                            cur.id === old &&
                                            cur.type === "loadAfter"
                                    )
                                ) {
                                    task.inform(
                                        `dependency loadAfter ${old} already exists, skipping`
                                    );
                                } else {
                                    task.success(
                                        `adding dependency loadAfter ${old}`
                                    );
                                    mod.dependencies.push({
                                        type: "loadAfter",
                                        id: old,
                                    });
                                }
                            }
                        }
                        await writeModInfo(mod, baseDir);

                        const { remove } = await inquirer.prompt<{
                            remove: boolean;
                        }>([
                            {
                                type: "confirm",
                                name: "remove",
                                message: "delete dependencies.json file?",
                                default: true,
                            },
                        ]);
                        if (remove) {
                            await fs.unlink(dependenciesJson);
                        }
                        task.success("dependencies.json migration completed");
                    },
                })
                .demandCommand(1)
                .help()
        );
    },
    handler: () => {},
};
