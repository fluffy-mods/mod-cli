import { PreviewImageSettings } from "@fluffy-mods/preview-generator";
import yargs, { Arguments, CommandModule } from "yargs";

import { getContext } from "../tasks/context.js";
import { updatePreview } from "../tasks/rimworld/preview.js";

interface PreviewOptions {
    scale: number;
    x?: number;
    y?: number;
    angle?: number;
}

export const PreviewCommand: CommandModule<{}, PreviewOptions> = {
    command: "preview",
    describe: "generate preview image",
    builder: (yargs: yargs.Argv<{}>) => {
        return yargs
            .option("scale", {
                describe: "content image scale",
                type: "number",
                default: 0.9,
            })
            .option("x", {
                describe: "content image x position along baseline, 0-1 scale",
                type: "number",
            })
            .option("y", {
                describe: "content image y position from baseline, 0-1 scale",
                type: "number",
            })
            .option("angle", {
                describe: "content image rotation angle",
                type: "number",
            });
    },
    handler: async (args: Arguments<PreviewOptions>) => {
        const { scale, x, y, angle } = args;

        let settings: Partial<PreviewImageSettings> = {};

        if (x !== undefined || y !== undefined) {
            settings.position = {
                x: x ?? 0.5,
                y: y ?? 0.5,
            };
            settings.randomPosition = 0;
        }

        if (angle !== undefined) {
            settings.angle = angle;
            settings.randomAngle = 0;
        }

        if (scale !== undefined) {
            settings.scale = scale;
        }

        const context = await getContext();
        await updatePreview(context, settings);
    },
};
