import { CommandModule } from "yargs";
import {
    createBranch,
    setDefaultBranch,
    setUpstreamBranch,
} from "../tasks/git";

const createBranchCommand: CommandModule<
    {},
    { name: string; "set-upstream": boolean; default: boolean }
> = {
    command: "create <name>",
    describe: "create a new branch",
    builder: (cmd) =>
        cmd
            .positional("name", {
                description: "branch name",
                demandOption: true,
                type: "string",
            })
            .option("set-upstream", {
                alias: "u",
                describe:
                    "should the upstream branch be set?\n" +
                    "NOTE: this will create a branch on the repository!",
                type: "boolean",
                default: false,
                demandOption: false,
            })
            .option("default", {
                alias: "d",
                describe: "set branch as default?",
                type: "boolean",
                default: false,
                demandOption: false,
            })
            .help(),
    handler: async (args) => {
        await createBranch(args.name, args["set-upstream"], args.default);
    },
};

const setUpstreamBranchCommand: CommandModule<
    {},
    { branch: string | undefined }
> = {
    command: "upstream [branch]",
    describe: "set upstream branch",
    builder: (cmd) =>
        cmd
            .positional("branch", {
                description: "branch name (defaults to local branch name)",
                demandOption: false,
                type: "string",
            })
            .help(),
    handler: async (args) => {
        await setUpstreamBranch(args.branch);
    },
};

const setDefaultBranchCommand: CommandModule<
    {},
    { branch: string | undefined }
> = {
    command: "default [branch]",
    describe: "set default branch",
    builder: (cmd) =>
        cmd
            .positional("branch", {
                description: "branch name (defaults to current branch)",
                demandOption: false,
                type: "string",
            })
            .help(),
    handler: async (args) => {
        await setDefaultBranch(args.branch);
    },
};

export const BranchCommand: CommandModule = {
    command: "branch",
    describe: "create, and update local and remote branches",
    builder: (cmd) =>
        cmd
            .command(createBranchCommand)
            .command(setDefaultBranchCommand)
            .command(setUpstreamBranchCommand)
            .demandCommand(1, 1)
            .help(),
    handler: (args) => true,
};
