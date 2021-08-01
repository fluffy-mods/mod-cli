import inquirer from "inquirer";
import uuid from "uuid";
import { CommandModule } from "yargs";

import { Contribution } from "../core/context.js";
import { getContext, writeModInfo } from "../tasks/context.js";
import { updateContributors } from "../tasks/git.js";

export const ContributeCommand: CommandModule = {
    command: ["contribute", "contrib"],
    describe: "add, suppress and edit contributions",
    builder: (yargs) => {
        return yargs
            .command(
                "suppress <hash>",
                "suppress a contribution",
                (yargs: any) => {
                    yargs.positional("hash", {
                        type: "string",
                        describe: "the contribution hash",
                    });
                },
                async (argv: any) => {
                    const {
                        mod,
                        build: { baseDir },
                    } = await getContext();
                    const contribution = mod.contributions.find((c) =>
                        c.hash.startsWith(argv.hash)
                    );
                    if (!contribution) {
                        throw new Error(
                            `no contribution found with hash ${argv.hash}`
                        );
                    }
                    contribution.suppressed = true;
                    updateContributors(mod);
                    await writeModInfo(mod, baseDir);
                }
            )
            .command({
                command: ["add"],
                describe: "add a contribution",
                handler: async (yargs: any) => {
                    const {
                        mod,
                        build: { baseDir },
                    } = await getContext();
                    if (!mod.contributions) mod.contributions = [];

                    const contribution: Contribution =
                        await inquirer.prompt<Contribution>([
                            {
                                type: "input",
                                name: "name",
                                message: "Contributor name",
                                validate: (value: string) => !!value,
                            },
                            {
                                type: "input",
                                name: "description",
                                message: "Description of the contribution",
                            },
                            {
                                type: "input",
                                name: "hash",
                                message:
                                    "Contribution hash (defaults to random uuid)",
                                default: uuid.v4().substr(0, 8),
                                validate: (value: string) => {
                                    if (!value || value.length < 6) {
                                        return `contributions must have a hash of at least 6 characters`;
                                    }
                                    if (
                                        mod.contributions.some(
                                            (c) => c.hash === value
                                        )
                                    ) {
                                        return `contribution with hash '${value}' already exists`;
                                    }
                                    return true;
                                },
                            },
                        ]);

                    mod.contributions.push(contribution);
                    updateContributors(mod);
                    await writeModInfo(mod, baseDir);
                },
            })
            .command(
                "edit <hash> <message..>",
                "edit a contribution",
                (yargs: any) => {
                    yargs
                        .positional("hash", {
                            type: "string",
                            describe: "the contribution hash",
                        })
                        .positional("message", {
                            type: "string",
                            describe: "the contribution message",
                        })
                        .demandOption(["hash", "message"]);
                },
                async (argv: any) => {
                    const {
                        mod,
                        build: { baseDir },
                    } = await getContext();
                    const contribution = mod.contributions.find((c) =>
                        c.hash.startsWith(argv.hash)
                    );
                    if (!contribution) {
                        throw new Error(
                            `no contribution found for hash ${argv.hash}`
                        );
                    }
                    contribution.description = argv.message.join(" ").trim();
                    updateContributors(mod);
                    await writeModInfo(mod, baseDir);
                }
            )
            .command({
                command: ["list", "ls"],
                describe: "list contributions",
                handler: async (yargs: any) => {
                    const { mod } = await getContext();
                    const contributions = mod.contributions.filter(
                        (c) => !c.suppressed
                    );
                    if (!contributions.length) {
                        console.log("No contributions.");
                        return;
                    }
                    console.log(
                        contributions
                            .map(
                                (c) =>
                                    `${c.hash.substr(0, 6)} :: ${c.author} - ${
                                        c.description
                                    }`
                            )
                            .join("\n")
                    );
                },
            })
            .demandCommand(1)
            .help();
    },
    handler: (args: any) => {},
};
