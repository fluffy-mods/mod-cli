// import { Boudewijn } from "boudewijn";
import { Boudewijn } from "boudewijn";
import chalk from "chalk";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { colours } from "./context";

dayjs.extend(relativeTime);

type Status = "success" | "info" | "warning" | "danger";

const boudewijn = new Boudewijn([
    { width: 8, align: "center" },
    { width: 25 },
    { width: 10, style: chalk.cyan, align: "right" },
    { wrap: true, style: chalk.gray },
]);

export class Task {
    start: dayjs.Dayjs;
    shouldReplaceLastMessage = false;
    constructor(
        public task: string,
        public context?: string,
        public info?: string,
        public longTask: boolean = false
    ) {
        this.start = dayjs();
    }

    static async Short(task: string, context?: string, info?: string) {
        await Task.Log(task, "success", context, info);
    }

    static async Long(task: string, context?: string, info?: string) {
        const _task = new Task(task, context, info, true);
        await _task.update("success", "starting...");
        _task.shouldReplaceLastMessage = true;
        return _task;
    }

    async update(status: Status, context?: string, info?: string) {
        await Task.Log(
            this.task,
            status,
            context ?? this.context,
            info ?? this.longTask
                ? `${dayjs().diff(this.start, "ms")} ms`
                : this.info,
            this.shouldReplaceLastMessage
        );
        this.shouldReplaceLastMessage = false;
    }

    async success(context?: string, info?: string) {
        await this.update("success", context, info);
    }

    failure(context?: Error, info?: string): Promise<void>;
    failure(context?: string, info?: string): Promise<void>;
    async failure(context?: Error | string, info?: string): Promise<void> {
        if (context instanceof Error) {
            await this.update("danger", context.toString(), info);
        } else {
            await this.update("danger", context, info);
        }
    }

    async inform(context?: string, info?: string) {
        await this.update("info", context, info);
    }

    async warn(context?: string, info?: string) {
        await this.update("warning", context, info);
    }

    static async Log(
        task: string,
        status: Status,
        context?: string,
        info?: string,
        replace = false
    ) {
        await logTask(status, task, info, context, replace);
    }
}

async function logTask(
    status: Status,
    task: string,
    info?: string,
    context?: string,
    replace = false
) {
    let tag: string;
    switch (status) {
        case "danger":
            tag = chalk.bgHex(colours.danger)(
                boudewijn.alignText("ERROR", { align: "center" }, 8)
            );
            break;
        case "warning":
            tag = chalk.bgHex(colours.warning)(
                boudewijn.alignText("WARN", { align: "center" }, 8)
            );
            break;
        case "success":
            tag = chalk.bgHex(colours.success)(
                boudewijn.alignText("OK", { align: "center" }, 8)
            );
            break;
        case "info":
            tag = chalk.bgHex(colours.info)(
                boudewijn.alignText("INFO", { align: "center" }, 8)
            );
            break;
    }
    if (replace) {
        await boudewijn.update(tag, task, info ?? "test", context ?? "");
    } else {
        await boudewijn.log(tag, task, info ?? "", context ?? "asd");
    }
}
