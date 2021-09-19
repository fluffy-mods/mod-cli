import fs from "fs-extra";
import { CommandModule } from "yargs";

import { createArchive } from "../tasks/archive.js";
import { getContext, updateModInfo } from "../tasks/context.js";
import { updateReadme } from "../tasks/description.js";
import {
    buildModSolution,
    formatProject,
    updateProjectReferences,
} from "../tasks/dotnet.js";
import {
    checkUncommitedChanges,
    checkUnpushedCommits,
    createGitHubRelease,
    createReleaseCommit,
    gitPush,
    updateChangeLog,
    updateContributions,
} from "../tasks/git.js";
import { clearDirectory, copyDirectory } from "../tasks/io.js";
import { updateAbout } from "../tasks/rimworld/about.js";
import { mergeVersions as mergeVersions } from "../tasks/rimworld/merge.js";
import { bumpVersion } from "../tasks/version.js";
import { steamWorkshopUpdate } from "../tasks/workshop.js";

export interface ReleaseOptions {
    "skip-bump"?: boolean;
    "skip-steam"?: boolean;
    "skip-github"?: boolean;
    force?: boolean;
    major?: boolean;
    prerelease?: boolean;
    draft?: boolean;
}

export const ReleaseCommand: CommandModule<{}, ReleaseOptions> = {
    command: "release",
    describe:
        "Build the mod in release mode, prepare a release archive and push to distributors.",
    builder: (yarg) =>
        yarg
            .option("skip-bump", {
                desc: "do not bump version",
                alias: "V",
                type: "boolean",
                conflicts: ["major"],
            })
            .option("skip-steam", {
                desc: "do not release to steam workshop",
                type: "boolean",
                group: "targets",
            })
            .option("skip-github", {
                desc: "do not release to github",
                type: "boolean",
                group: "targets",
            })
            .option("force", {
                desc: "force commit & push changes",
                alias: "f",
                type: "boolean",
            })
            .option("major", {
                desc: "create a new major release, bumping the major version",
                alias: "M",
                type: "boolean",
            })
            .option("prerelease", {
                desc: "release as a prerelease, implies github only",
                alias: "p",
                type: "boolean",
            })
            .option("draft", {
                desc: "release as a draft, implies github only",
                alias: "d",
                type: "boolean",
            })
            .version("1.0.0")
            .help(),
    handler: releaseHandler,
};

async function releaseHandler(args: ReleaseOptions) {
    const context = await getContext();
    context.build.buildTarget = "RELEASE";

    await fs.ensureDir(context.build.targetDir);

    await checkUncommitedChanges(context, args.force);
    await checkUnpushedCommits(context, args.force);
    if (!args["skip-bump"]) {
        await bumpVersion(context, args.major ? "major" : "minor");
    } else {
        await bumpVersion(context, "build");
    }
    await updateChangeLog(context);
    await updateContributions(context);
    await updateModInfo(context);
    await updateProjectReferences(context);
    // await formatProject(context);
    await buildModSolution(context);
    if (context.game.name === "RimWorld") {
        await updateAbout(context);
    }
    await updateReadme(context);
    await createReleaseCommit(context);

    if (!args["skip-steam"]) {
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
    }
    if (!args["skip-github"]) {
        await clearDirectory(context.build.targetDir);
        await copyDirectory(
            context.build.sourceDir,
            context.build.targetDir,
            context.game.exclude
        );

        await gitPush(context.build.baseDir);
        await createArchive(context);
        await createGitHubRelease(context, args);
    }
}
