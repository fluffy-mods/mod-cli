import inquirer from "inquirer";
import { CommandModule } from "yargs";

import { Attribution } from "../core/context.js";
import { Task } from "../core/log.js";
import { addAttribution, findAttributions, listAttributions, removeAttribution } from "../tasks/attribution.js";
import { getContext } from "../tasks/context.js";

export const AttributeCommand: CommandModule = {
    command: "attribute",
    describe: "add an attribution",
    builder: (yarg) =>
        yarg
            .command({
                command: "add",
                describe: "add an attribution",
                handler: async () => {
                    const attribution: Attribution =
                        await inquirer.prompt<Attribution>([
                            {
                                type: "input",
                                name: "description",
                                message: "Enter the attribution description",
                                validate: (value: string) => {
                                    if (value.length < 1) {
                                        return "Description is required";
                                    }
                                    return true;
                                },
                            },
                            {
                                type: "input",
                                name: "author",
                                message: "Enter the attribution author",
                                validate: (value: string) => {
                                    if (value.length < 1) {
                                        return "Author is required";
                                    }
                                    return true;
                                },
                            },
                            {
                                type: "input",
                                name: "license",
                                message: "Enter the attribution license",
                                validate: (value: string) => {
                                    if (value.length < 1) {
                                        return "License is required";
                                    }
                                    return true;
                                },
                            },
                            {
                                type: "input",
                                name: "url",
                                message: "Enter the attribution url",
                            },
                        ]);
                    const context = await getContext();
                    await addAttribution(context, attribution);
                },
            })
            .command({
                command: ["$0", "list", "ls"],
                describe: "list all attributions",
                handler: async () => {
                    const context = await getContext();
                    await listAttributions(context);
                },
            })
            .command<{ query: string | undefined }>({
                command: "remove [query]",
                describe: "remove one or more attributions",
                builder: (yarg) =>
                    yarg.positional("query", {
                        describe:
                            "query to remove. Matched to author names, or if there are no results against attribution descriptions.",
                        type: "string",
                    }),
                handler: async ({ query }) => {
                    const context = await getContext();
                    const attributions = await findAttributions(
                        context,
                        query ?? ""
                    );

                    if (attributions.length === 0) {
                        Task.Log(
                            "remove attribution",
                            "info",
                            `no attributions found for query '${query}'`
                        );
                        process.exit(1);
                    }
                    const { remove } = await inquirer.prompt<{
                        remove: Attribution[];
                    }>([
                        {
                            type: "checkbox",
                            name: "remove",
                            message: "Select the attributions to remove",
                            choices: attributions.map((attribution) => ({
                                value: attribution,
                                name: `${attribution.author} :: ${attribution.description}`,
                            })),
                        },
                    ]);

                    for (const attribution of remove) {
                        await removeAttribution(context, attribution);
                    }
                },
            })
            .command<{ query: string | undefined }>({
                command: "edit [query]",
                describe: "edit an attribution",
                builder: (yarg) =>
                    yarg.positional("query", {
                        describe:
                            "query to edit. Matched to author names, or if there are no results against attribution descriptions.",
                        type: "string",
                    }),
                handler: async ({ query }) => {
                    const context = await getContext();
                    const attributions = await findAttributions(
                        context,
                        query ?? ""
                    );
                    if (attributions.length === 0) {
                        Task.Log(
                            "edit attribution",
                            "info",
                            "no attributions found"
                        );
                        process.exit(1);
                    }
                    const { edit } = await inquirer.prompt<{
                        edit: Attribution;
                    }>([
                        {
                            type: "list",
                            name: "edit",
                            message: "Select the attributions to edit",
                            choices: attributions.map((attribution) => ({
                                value: attribution,
                                name: `${attribution.author} :: ${attribution.description}`,
                            })),
                        },
                    ]);

                    const attribution = await inquirer.prompt<Attribution>([
                        {
                            type: "input",
                            name: "description",
                            message: "Enter the attribution description",
                            default: edit.description,
                            validate: (value: string) => {
                                if (value.length < 1) {
                                    return "Description is required";
                                }
                                return true;
                            },
                        },
                        {
                            type: "input",
                            name: "author",
                            message: "Enter the attribution author",
                            default: edit.author,
                            validate: (value: string) => {
                                if (value.length < 1) {
                                    return "Author is required";
                                }
                                return true;
                            },
                        },
                        {
                            type: "input",
                            name: "license",
                            default: edit.license,
                            message: "Enter the attribution license",
                            validate: (value: string) => {
                                if (value.length < 1) {
                                    return "License is required";
                                }
                                return true;
                            },
                        },
                        {
                            type: "input",
                            name: "url",
                            default: edit.url,
                            message: "Enter the attribution url",
                        },
                    ]);

                    await removeAttribution(context, edit);
                    await addAttribution(context, attribution);
                },
            })
            .help()
            .version("1.0.0"),
    handler: () => {},
};
