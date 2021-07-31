#!/usr/bin/env -S node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { AttributeCommand } from "./commands/attribute";
import { BranchCommand } from "./commands/branch";
import { ConfigCommand } from "./commands/config";
import { ContributeCommand } from "./commands/contribute";
import { DependencyCommand } from "./commands/dependency";
import { ReleaseCommand } from "./commands/release";
import { TestCommand } from "./commands/test";
import { UpdateCommand } from "./commands/update";

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
