import fs from "fs-extra";
import { CommandModule } from "yargs";

import { Version } from "../core/context.js";
import { getContext, updateModInfo } from "../tasks/context.js";
import { getWorkshopDescription, updateReadme } from "../tasks/description.js";
import { buildModSolution, formatProject, updateProjectReferences } from "../tasks/dotnet.js";
import { updateChangeLog, updateContributions } from "../tasks/git.js";
import { clearDirectory, copyDirectory } from "../tasks/io.js";
import { updateAbout } from "../tasks/rimworld/about.js";
import { bumpVersion } from "../tasks/version.js";

interface UpdateOptions {
    "no-build"?: boolean;
    release?: boolean;
    bump: keyof Version;
    "no-bump"?: boolean;
    format?: boolean;
    "update-refs"?: boolean;
}

export const UpdateCommand: CommandModule<{}, UpdateOptions> = {
    command: "update",
    describe:
        "update the mod, recompiling if necessary, and move files to output target.",
    builder: (yarg) =>
        yarg
            .option("release", {
                desc: "build in release mode",
                alias: "R",
                boolean: true,
                conflicts: "no-build",
            })
            .option("update-refs", {
                desc: "update project references",
                boolean: true,
                conflicts: "no-build",
            })
            .option("format", {
                desc: "format project",
                boolean: true,
                conflicts: "no-build",
            })
            .option("no-build", {
                desc: "do not rebuild assemblies",
                alias: "N",
                boolean: true,
                conflicts: "release",
                implies: "no-bump",
            })
            .option("no-bump", {
                desc: "do not bump version",
                alias: "V",
                boolean: true,
            })
            .option("bump", {
                desc: "version part to bump",
                alias: "v",
                string: true,
                default: "build",
                choices: ["major", "minor", "build"] as const,
                coerce: (arg) => arg as keyof Version,
            })
            .strict()
            .help()
            .version("1.0.2")
            .example("mod update", "update the mod")
            .example(
                "mod update --update-refs",
                "update the mod and update the project references"
            )
            .example(
                "mod update --format",
                "update the mod and format the project"
            )
            .example(
                "mod update --no-build",
                "update the mod and don't build the mod"
            )
            .example(
                "mod update --no-bump",
                "update the mod and don't bump version number"
            )
            .example(
                "mod update --bump minor",
                "update the mod and bump minor version number"
            )
            .example(
                "mod update --bump major",
                "update the mod and bump major version number"
            ),
    handler: updateHandler,
};

async function updateHandler(args: UpdateOptions) {
    const context = await getContext();
    context.build.buildTarget = args.release ? "RELEASE" : "DEBUG";
    await fs.ensureDir(context.build.targetDir);

    if (!args["no-bump"]) {
        await bumpVersion(context, args.bump);
    }
    await updateChangeLog(context);
    await updateContributions(context);
    await updateModInfo(context);
    await updateReadme(context);

    // check workshop description length
    await getWorkshopDescription(context);

    if (!args["no-build"]) {
        if (args["update-refs"]) {
            await updateProjectReferences(context);
        }
        if (args.format) {
            await formatProject(context);
        }
        await buildModSolution(context);
    }

    if (context.game.name === "RimWorld") {
        await updateAbout(context);
    }

    await clearDirectory(context.build.targetDir);
    await copyDirectory(
        context.build.sourceDir,
        context.build.targetDir,
        context.game.exclude
    );

    // updateLicense,
}
