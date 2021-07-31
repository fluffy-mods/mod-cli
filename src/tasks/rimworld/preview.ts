import path from "path";
import { generatePreviewImage } from "preview-generator";

import { Context } from "../../core/context";
import { Task } from "../../core/log";
import { findDown } from "../../core/utils";

export async function updatePreview(context: Context) {
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
        await generatePreviewImage(context.mod.name, previewPath, modIcon);
        await task.success(undefined, previewPath);
    } catch (e) {
        await task.failure(e);
    }
}
