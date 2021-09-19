import { Attribution, Context } from "../core/context.js";
import { Task } from "../core/log.js";
import { writeModInfo } from "./context.js";

export async function listAttributions({ mod }: Context) {
    const task = await Task.Long(`listing attributions`);
    if (!mod.attributions) {
        return await task.info("no attributions listed");
    }
    for (const attribution of mod.attributions) {
        await Task.Log(
            attribution.author || "",
            "info",
            attribution.description || "",
            attribution.license || ""
        );
    }
}

export async function addAttribution(
    { mod, build: { baseDir } }: Context,
    attribution: Attribution
) {
    const task = await Task.Long(`adding attribution`);
    const attributions = (mod.attributions ??= []);
    attributions.push(attribution);

    await writeModInfo(mod, baseDir);
    await task.success(`added attribution to ${attribution.author}`);
}

export async function findAttributions({ mod }: Context, query: string) {
    const attributions = (mod.attributions ??= []);
    const matchAuthor = attributions.filter((a) => a.author === query);
    const matchDescription = attributions.filter((a) =>
        a.description.toLowerCase().includes(query.toLowerCase())
    );
    return matchAuthor.length > 0 ? matchAuthor : matchDescription;
}

export async function removeAttribution(
    { mod, build: { baseDir } }: Context,
    attribution: Attribution
) {
    const task = await Task.Long(`removing attribution`);
    if (!mod.attributions) {
        return;
    }

    mod.attributions = mod.attributions.filter((a) => a !== attribution);
    await writeModInfo(mod, baseDir);
    await task.success(`removed attribution to ${attribution.author}`);
}
