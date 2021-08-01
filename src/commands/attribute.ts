import inquirer from "inquirer";
import { CommandModule } from "yargs";

import { Attribution } from "../core/context.js";
import { Task } from "../core/log.js";
import { getContext, writeModInfo } from "../tasks/context.js";

export const AttributeCommand: CommandModule = {
    command: "attribute",
    describe: "add an attribution",
    builder: (yarg) => yarg.help().version("1.0.0"),
    handler: async () => {
        const attribution: Attribution = await inquirer.prompt<Attribution>([
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

        const {
            mod,
            build: { baseDir },
        } = await getContext();
        if (!mod.attributions) {
            mod.attributions = [];
        }
        mod.attributions.push(attribution);
        Task.Log(
            "Attribution added",
            "success",
            `${attribution.author}: ${attribution.description} (${
                attribution.license
            }) [${attribution.url ?? "no link"}]`
        );
        writeModInfo(mod, baseDir);
    },
};
