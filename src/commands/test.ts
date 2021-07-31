import fs from "fs-extra";
import { CommandModule } from "yargs";

import { getContext, updateModInfo } from "../tasks/context";
import { getGithubDescription, getUnityDescription, getWorkshopDescription } from "../tasks/description";
import { buildModSolution } from "../tasks/dotnet";
import { getChangelog, gitCommitAll, setDefaultBranch, updateChangeLog, updateContributions } from "../tasks/git";
import { clearDirectory, copyDirectory } from "../tasks/io";
import { updateAbout } from "../tasks/rimworld/about";
import { mergeVersions } from "../tasks/rimworld/merge";
import { updatePreview } from "../tasks/rimworld/preview";
import { steamWorkshopUpdate } from "../tasks/workshop";

export const TestCommand: CommandModule = {
    command: "test",
    describe: "Test subtasks in isolation",
    builder: (yarg) =>
        yarg
            .version("1.0.0")
            .command({
                command: "merge",
                describe: "create merged release",
                handler: async () => {
                    const context = await getContext();
                    context.debug = true;
                    await clearDirectory(context.build.targetDir);
                    await mergeVersions(context);
                },
            })
            .command({
                command: "about",
                describe: "update about.xml",
                handler: async () => {
                    const context = await getContext();
                    await updateAbout(context);
                },
            })
            .command({
                command: "changelog",
                describe: "get changelog",
                handler: async () => {
                    const entries = await getChangelog();
                    console.log({ entries: JSON.stringify(entries, null, 2) });
                },
            })
            .command<{ branch: string }>({
                command: "setDefaultBranch <branch>",
                describe: "Set the default branch",
                builder: (yarg) =>
                    yarg
                        .positional("branch", {
                            type: "string",
                        })
                        .demandOption("branch"),
                handler: async (args) => {
                    await setDefaultBranch(args.branch);
                },
            })
            .command({
                command: "steam-release",
                describe: "Create a Steam release",
                handler: async () => {
                    const context = await getContext();
                    context.build.buildTarget = "RELEASE";

                    await fs.ensureDir(context.build.targetDir);

                    await updateChangeLog(context);
                    await updateContributions(context);
                    await updateModInfo(context);
                    await buildModSolution(context);

                    // updateReadme,
                    // updateLicense,

                    if (context.game.name === "RimWorld") {
                        await updateAbout(context);
                    }

                    // temp commit - NOT PUSHED!
                    await gitCommitAll(context.build.baseDir);

                    await clearDirectory(context.build.targetDir);
                    if (context.game.name === "RimWorld") {
                        await mergeVersions(context);
                    } else {
                        await copyDirectory(
                            context.build.sourceDir,
                            context.build.targetDir,
                            context.game.exclude
                        );
                    }
                    await steamWorkshopUpdate(context);
                },
            })
            .command<{
                target: string;
                outFile?: string;
            }>({
                command: "description <target>",
                describe: "compile description",
                builder: (yarg) =>
                    yarg
                        .positional("target", {
                            choices: ["workshop", "github", "unity"] as const,
                            default: "github",
                        })
                        .option("outFile", {
                            alias: "o",
                            type: "string",
                        }),
                handler: async (args) => {
                    const context = await getContext();
                    await updateContributions(context);

                    let desc: string;
                    switch (args.target) {
                        case "workshop":
                            desc = await getWorkshopDescription(context);
                            break;
                        case "github":
                            desc = await getGithubDescription(context);
                            break;
                        case "unity":
                            desc = await getUnityDescription(context);
                            break;
                        default:
                            desc = "";
                            console.warn(`Unknown target: ${args.target}`);
                    }
                    if (args.outFile) {
                        await fs.outputFile(args.outFile, desc);
                    }
                    console.log({ desc });
                },
            })
            .command({
                command: "contributions",
                describe: "list contributors and contributions",
                handler: async () => {
                    const context = await getContext();
                    await updateContributions(context);

                    console.log({ contributions: context.mod.contributions });
                },
            })
            .command({
                command: "preview",
                describe: "create preview image",
                builder: (yarg) =>
                    yarg
                        .option("x-offset", {
                            alias: "x",
                            type: "number",
                            default: 0,
                        })
                        .option("y-offset", {
                            alias: "y",
                            type: "number",
                            default: 0,
                        })
                        .option("scale", {
                            alias: "s",
                            type: "number",
                            default: 0.95,
                        }),
                handler: async () => {
                    const context = await getContext();
                    await updatePreview(context);
                },
            })
            .help()
            .demandCommand(1, 1),
    handler: () => undefined,
};
