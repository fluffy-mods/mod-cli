#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { AttributeCommand } from "./commands/attribute.js";
import { BranchCommand } from "./commands/branch.js";
import { ConfigCommand } from "./commands/config.js";
import { ContributeCommand } from "./commands/contribute.js";
import { DependencyCommand } from "./commands/dependency.js";
import { ReleaseCommand } from "./commands/release.js";
import { TestCommand } from "./commands/test.js";
import { UpdateCommand } from "./commands/update.js";

yargs(hideBin(process.argv))
    .scriptName("mod")
    .version("1.0.1")
    .command(ConfigCommand)
    .command(UpdateCommand)
    .command(BranchCommand)
    .command(ReleaseCommand)
    .command(AttributeCommand)
    .command(ContributeCommand)
    .command(DependencyCommand)
    .command(TestCommand)
    .demandCommand(1, 1)
    .help().argv;
