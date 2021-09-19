import { generatePreviewImage, PreviewImageSettings } from "@fluffy-mods/preview-generator";
import merge from "lodash/merge.js";
import path from "path";

import { Context } from "../../core/context.js";
import { Task } from "../../core/log.js";
import { findDown } from "../../core/utils.js";

export async function updatePreview(
    context: Context,
    settings?: Partial<PreviewImageSettings>
) {
    if (settings) {
        settings = merge({ randomAngle: 0, randomPosition: 0 }, settings);
    }
    const task = await Task.Long("update preview image");
    try {
        const previewPath = path.join(
            context.build.baseDir,
            "About",
            "Preview.png"
        );
        const modIcon = await findDown(
            "preview{.png,.jpg,.svg}",
            context.build.baseDir,
            ["About"]
        );
        await generatePreviewImage(
            context.mod.name,
            previewPath,
            modIcon,
            undefined,
            settings
        );
        await task.success(undefined, previewPath);
    } catch (e) {
        await task.danger(e);
    }
}
