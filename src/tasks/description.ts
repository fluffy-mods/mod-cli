import { convert as markdownToSteamBBCode } from "@fluffy-mods/remark-bbcode-steam";
import { convert as markdownToUnityHTML } from "@fluffy-mods/remark-html-unity";
import fs from "fs-extra";
import handlebars from "handlebars";
import path from "path";

import { Context } from "../core/context";
import { Task } from "../core/log";
import { findDown } from "../core/utils";
import { getChangelog as getRawChangeLog } from "./git";

export type DistributionEnvironment = "workshop" | "github" | "unity";

export async function getWorkshopDescription(
    context: Context
): Promise<string> {
    return await Promise.all([getDescription(context), getFooter(context)])
        .then((parts) => parts.join("\n"))
        .then(applyImageHeaders)
        .then(markdownToSteamBBCode);
}

export async function getGithubDescription(context: Context): Promise<string> {
    return await Promise.all([
        // getBadges(context),
        getDescription(context),
        getFooter(context),
    ])
        .then((parts) => parts.join("\n"))
        .then(applyImageHeaders);
}

export async function getUnityDescription(context: Context): Promise<string> {
    return await Promise.all([getDescription(context)])
        .then((parts) => parts.join("\n"))
        .then(markdownToUnityHTML);
}

export async function getDescription(context: Context): Promise<string> {
    const description = await findDown("description.md", context.build.baseDir);
    if (!description) throw new Error("description.md not found");

    return await renderTemplate(description, context);
}

export async function getFooter(context: Context): Promise<string> {
    const footer = await findDown("footer.md", context.game.templateDir);
    if (!footer) throw new Error("footer.md not found");

    return await renderTemplate(footer, context);
}

// export async function getBadges(context: Context): Promise<string> {
//     const badges = await findDown("badges.md", context.game.templateDir);
//     if (!badges) throw new Error("badges.md not found");
//     return await renderTemplate(badges, context);
// }

export function applyImageHeaders(content: string): string {
    return content.replace(/##? (.*?)(?:\n|$)/gm, (_, title) => {
        const trimmed = title.trim();
        const encoded = encodeURIComponent(title);
        return `![${trimmed}](https://banners.karel-kroeze.nl/title/${encoded}.png)  `;
    });
}

async function renderTemplate(
    templatePath: string,
    { mod, game }: Context
): Promise<string> {
    const template = await fs.readFile(templatePath, "utf8");
    try {
        return handlebars.compile(template)({ mod, game });
    } catch (err) {
        console.log({ template, templatePath, mod, game });
        throw new Error(`Failed to render template ${templatePath}: \n${err}`);
    }
}

export async function updateReadme(context: Context): Promise<void> {
    const readmePath = path.join(context.build.baseDir, "README.md");
    await fs.writeFile(readmePath, await getGithubDescription(context), "utf8");
    Task.Log("update readme", "success");
}

export async function getChangelog(context: Context): Promise<string> {
    const log = await getRawChangeLog(context.build.baseDir);
    return log.map((c) => `- ${c.author.name} :: ${c.message}`).join("\n");
}
