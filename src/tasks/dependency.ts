import inquirer from "inquirer";
import isEqualWith from "lodash/isEqualWith.js";
import { fs } from "mz";
import path from "path";

import { Context, Dependency } from "../core/context.js";
import { Task } from "../core/log.js";
import { findDown } from "../core/utils.js";
import { writeModInfo } from "./context.js";

// list dependencies specified in modinfo
export async function listDependencies({ mod: { dependencies } }: Context) {
    const task = await Task.Long("list dependencies");

    if (!dependencies || !dependencies.length) {
        return await task.info("no dependencies listed");
    }
    for (const dep of dependencies) {
        await Task.Log(dep.id, "info", dep.version ?? "*", dep.type);
    }
    return;
}

export async function addDependency(
    { mod, build: { baseDir } }: Context,
    dep: Dependency
) {
    const task = await Task.Long("add dependency");

    try {
        await task.info(
            `adding ${dep.type} dependency on: ${dep.id} ${dep.version ?? "*"}`
        );

        if (!mod.dependencies) {
            mod.dependencies = [];
        }
        if (
            mod.dependencies.find(
                (_dep) => dep.id === dep.id && dep.version === _dep.version
            )
        ) {
            throw new Error(
                `mod already contains a ${dep.type} dependency on ${dep.id} ${
                    dep.version ?? "*"
                }`
            );
        }

        mod.dependencies.push(dep);
        await writeModInfo(mod, baseDir);
        await task.success(
            `added ${dep.type} dependency on: ${dep.id} ${dep.version ?? "*"}`
        );
    } catch (err) {
        task.danger(err);
        process.exit(-1);
    }
}

export async function removeDependency(
    { mod, build: { baseDir } }: Context,
    id: string
) {
    const task = await Task.Long("remove dependency");
    try {
        if (!mod.dependencies) {
            throw new Error(`mod does not have any dependencies`);
        }
        const deps = mod.dependencies.filter((_dep) => _dep.id === id);
        if (deps.length === 0) {
            throw new Error(`mod does not have a dependency on ${id}`);
        }
        if (deps.length > 1) {
            throw new Error(
                `mod has multiple dependencies on ${id}, cannot automatically remove dependency`
            );
        }
        const [dep] = deps;
        mod.dependencies = mod.dependencies.filter((_dep) => _dep.id !== id);
        await writeModInfo(mod, baseDir);
        await task.success(
            `removed ${dep.type} dependency on: ${dep.id} ${dep.version ?? "*"}`
        );
    } catch (err) {
        task.danger(err);
        process.exit(0);
    }
}

export async function migrateDependencies(
    { mod, build: { baseDir } }: Context,
    clean: boolean
) {
    const task = await Task.Long("migrate dependencies");
    try {
        const dependenciesJson = await findDown("dependencies.json", baseDir);
        if (dependenciesJson) {
            await task.success(
                `found dependencies.json file at ${path.relative(
                    baseDir,
                    dependenciesJson
                )}`
            );
        } else {
            await task.info(
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
                    task.info(
                        `requirement on ${dep.id} already exists, skipping`
                    );
                } else {
                    task.success(`adding requirement on ${old.id}`);
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
                            cur.id === old.id && cur.type === "incompatible"
                    )
                ) {
                    task.info(
                        `incompatibility with ${old.id} already exists, skipping`
                    );
                } else {
                    task.success(`adding incompatibility with ${old.id}`);
                    mod.dependencies.push(dep);
                }
            }
        }
        if (dependencies.before) {
            for (const old of dependencies.before) {
                if (
                    mod.dependencies.find(
                        (cur) => cur.id === old && cur.type === "loadBefore"
                    )
                ) {
                    task.info(
                        `dependency loadBefore ${old.id} already exists, skipping`
                    );
                } else {
                    task.success(`adding dependency loadBefore ${old}`);
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
                        (cur) => cur.id === old && cur.type === "required"
                    )
                ) {
                    task.info(
                        `dependency loadAfter ${old} is implied, skipping`
                    );
                } else if (
                    mod.dependencies.find(
                        (cur) => cur.id === old && cur.type === "loadAfter"
                    )
                ) {
                    task.info(
                        `dependency loadAfter ${old} already exists, skipping`
                    );
                } else {
                    task.success(`adding dependency loadAfter ${old}`);
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
        task.success("dependency migration completed");
    } catch (err) {
        task.danger(err);
        process.exit(-1);
    }
}
