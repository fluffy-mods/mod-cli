import { Octokit } from "@octokit/rest";
import merge from "lodash/merge.js";
import { fs } from "mz";
import Git, { SimpleGit } from "simple-git";

import { ReleaseOptions } from "../commands/release.js";
import { AuthorInfo, ChangelogEntry, Context, Contribution, GitInfo, ModInfo, Version } from "../core/context.js";
import { Task } from "../core/log.js";
import { readSystemConfig } from "./context.js";
import { createVersion, versionString } from "./version.js";

export async function getStatus(dir: string = process.cwd()) {
    const git = Git(dir);
    return await git.status();
}

export async function getChangelog(
    dir: string = process.cwd()
): Promise<ChangelogEntry[]> {
    const git = Git(dir);
    const latest = await git.raw(["describe", "--abbrev=0", "--tags"]);
    const log = await git.log({ from: latest.trim(), to: "HEAD" });
    const entries: ChangelogEntry[] = await Promise.all(
        log.all
            .filter((e) => !e.message.includes("[nolog]"))
            .map(async (e) => {
                return {
                    date: new Date(e.date),
                    message: e.message,
                    author: {
                        name: e.author_name,
                        email: e.author_email,
                    },
                    hash: e.hash,
                    version: await getVersionTag(git, e.hash),
                };
            })
    );
    return entries;
}

async function getVersionTag(
    git: SimpleGit,
    hash: string
): Promise<Version | undefined> {
    try {
        const tag = await git.raw(["describe", "--contains", hash]);
        return createVersion(tag);
    } catch {
        return undefined;
    }
}

export async function updateChangeLog({ mod, build: { baseDir } }: Context) {
    const task = await Task.Long("update changelog");
    try {
        const changes = await getChangelog(baseDir);
        const newChanges: ChangelogEntry[] = [];
        if (!mod.changelog) {
            mod.changelog = changes;
            newChanges.push(...changes);
        } else {
            for (const change of changes) {
                const index = mod.changelog.findIndex(
                    (e) => e.hash === change.hash
                );
                if (index >= 0) {
                    merge(mod.changelog[index], change);
                } else {
                    mod.changelog.push(change);
                    newChanges.push(change);
                }
            }
        }
        mod.changelog.sort(changelogCompareFn);
        newChanges.sort(changelogCompareFn);
        if (newChanges.length > 0) {
            await task.success(
                newChanges
                    .map(
                        (c) =>
                            `${new Date(c.date).toLocaleDateString()} :: ${
                                c.author.name
                            } :: ${c.message}`
                    )
                    .join("\n")
            );
        } else {
            await task.info("no new changes");
        }
    } catch (e) {
        await task.danger(e);
    }
}

function changelogCompareFn(a: ChangelogEntry, b: ChangelogEntry): number {
    const timeA = new Date(a.date).getTime(),
        timeB = new Date(b.date).getTime();
    if (timeA === timeB) return 0;
    return timeB > timeA ? 1 : -1;
}

export async function createBranch(
    branch: string,
    upstream: boolean = false,
    setDefault: boolean = false,
    dir: string = process.cwd()
): Promise<void> {
    const task = await Task.Long("create branch");
    try {
        const git = Git(dir);
        const remoteBranches = await git.branch(["--remote"]);
        if (remoteBranches.all.includes(branch)) {
            throw new Error(`${branch} already exists`);
        }
        await git.raw("checkout", "-b", branch);
        await task.success();
    } catch (e) {
        await task.danger(e);
    }
    if (upstream) {
        await setUpstreamBranch(branch, dir);
    }
    if (setDefault) {
        await setDefaultBranch(branch, dir);
    }
}

export async function setUpstreamBranch(
    branch?: string,
    dir: string = process.cwd()
): Promise<void> {
    const task = await Task.Long("set upstream branch");
    try {
        const git = Git(dir);
        const localBranches = await git.branch();
        const remoteBranches = await git.branch(["--remotes"]);
        branch ||= localBranches.current;
        const upstream = remoteBranches.all.find(
            (b) => b === `origin/${branch}`
        );
        if (upstream) {
            await git.raw("branch", "-u", `origin/${branch}`);
        } else {
            await git.raw("push", "-u", "origin", branch);
        }
        await task.success(`origin/${branch}`);
    } catch (err) {
        await task.danger(err);
        throw err;
    }
}

export async function createGitHubRelease(
    context: Context,
    { major, prerelease, draft }: ReleaseOptions
) {
    const task = await Task.Long("create GitHub release");
    const {
        mod: {
            name,
            version,

            git: { owner, repo },
        },
        build: { archivePath },
        system: { githubToken },
    } = context;
    try {
        // create release
        const github = new Octokit({ auth: githubToken });
        const releaseResponse = await github.repos.createRelease({
            owner,
            repo,
            tag_name: `v${versionString(version)}`,
            name: `${name} v${versionString(version)}`,
            body: (await getChangelog())
                .map(({ message, author: { name } }) => `${message} (${name})`)
                .join("\n"),
            draft,
            prerelease,
        });
        await task.success(releaseResponse.data.html_url);

        // upload archive
        const archive = fs.readFileSync(archivePath!);
        const archiveResponse = await github.repos.uploadReleaseAsset({
            owner,
            repo,
            release_id: releaseResponse.data.id,
            name: `${name}.zip`,
            label: `${name} v${versionString(version)}`,
            data: archive as unknown as string, // really?! "bytes"?!
            headers: {
                "Content-Type": "application/zip",
                "Content-Length": archive.length,
            },
        });
        await task.success(archiveResponse.data.browser_download_url);
    } catch (err) {
        await task.danger(err);
        throw err;
    }
}

export async function setDefaultBranch(
    branch?: string,
    dir: string = process.cwd()
): Promise<void> {
    const task = await Task.Long("set default branch");
    try {
        const { githubToken } = await readSystemConfig(undefined, dir);

        const git = Git(dir);
        const github = new Octokit({ /** log: console, */ auth: githubToken });
        const { owner, repo } = await getGitInfo(dir);

        // get default branch if needed
        const localBranches = await git.branch();
        branch ||= localBranches.current;

        // check local branch exists
        if (!localBranches.all.includes(branch)) {
            throw new Error(`${branch} does not exist locally`);
        }

        // make sure remote branch exists
        const remoteBranches = await git.branch(["--remote"]);
        if (!remoteBranches.all.includes(`origin/${branch}`)) {
            throw new Error(`${branch} does not exist on origin`);
        }

        // update default branch
        await github.repos.update({
            owner,
            repo,
            default_branch: branch,
        });
        await task.success(`default branch set to ${branch}`);
    } catch (err) {
        await task.danger(err);
        process.exit(1);
    }
}

export async function getGitInfo(
    dir: string,
    stopOnFailure?: true
): Promise<GitInfo>;
export async function getGitInfo(
    dir: string,
    stopOnFailure?: false
): Promise<GitInfo | undefined>;
export async function getGitInfo(
    dir: string = process.cwd(),
    stopOnFailure = false
): Promise<GitInfo | undefined> {
    const task = await Task.Long("get git info");
    try {
        const git = Git(dir);
        if (!git) {
            if (stopOnFailure) {
                throw new Error(`no git repository found at ${dir}`);
            }
            return undefined;
        }
        const remotes = await git.getRemotes(true);
        const origin =
            remotes.find((r) => r.name === "origin") || remotes.shift();
        if (!origin) {
            if (stopOnFailure) {
                throw new Error(`no remote 'origin' found for ${dir}`);
            }
            return undefined;
        }
        const match = origin.refs.push.match(
            /https?:\/\/github.com\/(?<owner>.+)\/(?<repo>.+)\.git/i
        );
        if (match?.groups?.owner && match.groups.repo) {
            return {
                owner: match.groups.owner,
                repo: match.groups.repo,
                url: origin.refs.push.replace(".git", ""),
            };
        }

        if (stopOnFailure) {
            throw new Error(
                `could not extract owner/repo: ${origin.refs.push}`
            );
        }
    } catch (err) {
        await task.danger(err);
        process.exit(1);
    }
}

export async function getGitUser(
    dir: string = process.cwd(),
    reportFailure = false
): Promise<AuthorInfo | undefined> {
    const git = Git(dir);
    const config = await git.listConfig();
    const author = {
        name: config.all["user.name"] as string,
        email: config.all["user.email"] as string,
    };
    if (!author.name || !author.email) {
        if (reportFailure) {
            await Task.Short(
                "get git user",
                "danger",
                "could not get git user"
            );
        }
        return;
    }
    return author;
}

export async function checkUncommitedChanges(
    { build: { baseDir } }: Context,
    continueWithChanges: boolean = false
): Promise<void> {
    const git = Git(baseDir);
    const status = await git.status();

    if (status.files.length) {
        if (continueWithChanges) {
            Task.Log(
                "check uncommited changes",
                "warning",
                `forced to continue despite uncommited changes:\n- ${status.files
                    .map((f) => f.path)
                    .join("\n- ")}`
            );
        } else {
            Task.Log(
                "check uncommited changes",
                "danger",
                undefined,
                `local branch has uncommitted changes:\n- ${status.files
                    .map((f) => f.path)
                    .join("\n- ")}`
            );
            process.exit(-1);
        }
    }
}

export async function checkUnpushedCommits(
    { build: { baseDir } }: Context,
    pushCommits: boolean = false
): Promise<void> {
    const task = await Task.Long("check unpushed commits");
    try {
        const git = Git(baseDir);
        await git.fetch();
        const status = await git.status();

        if (status.ahead) {
            if (pushCommits) {
                await task.warning(
                    `forced to continue despits unpushed commits.`
                );
                await git.push();
                await task.info(`pushed ${status.ahead} commits`);
            } else {
                throw new Error(
                    `local branch is ${status.ahead} commits ahead of remote`
                );
            }
        }
        if (status.behind) {
            throw new Error(
                `local branch is ${status.behind} commits behind remote`
            );
        }
        await task.success("no unpushed commits");
    } catch (err) {
        await task.danger(err);
        process.exit(1);
    }
}

export async function createReleaseCommit({
    build: { baseDir },
    mod,
}: Context) {
    const task = await Task.Long("create release commit");
    const version = versionString(mod.version);
    const message = `release v${version}`;
    const commit = await gitCommitAll(baseDir, message);
    await task.success(`commit '${commit.commit}' created`);
}

export async function createAndPushReleaseCommit(
    context: Context
): Promise<void> {
    const task = await Task.Long("create and push release commit");
    try {
        await createReleaseCommit(context);
        const push = await gitPush(context.build.baseDir);
        await task.success(`push completed:\n- ${push.pushed.join("\n- ")}`);
    } catch (err) {
        await task.danger(err);
        process.exit(1);
    }
}

// get git status, then commit all changed files
export async function gitCommitAll(
    dir: string = process.cwd(),
    message: string = "commit changes [nolog]"
) {
    const git = Git(dir);
    const status = await git.status();
    if (status.not_added) {
        await git.add(status.not_added);
    }
    return await git.commit(
        message,
        status.files.map((f) => f.path)
    );
}

export async function gitPush(dir: string = process.cwd()) {
    const git = Git(dir);
    return await git.push();
}

// update list of contributions from git log
export async function updateContributions({
    build: { baseDir },
    mod,
    mod: {
        contributions,
        author: modAuthor,
        git: { owner },
    },
    game: { defaultAuthor: defaultGameAuthor },
    system: { defaultAuthor, ignoredContributors },
}: Context) {
    const git = Git(baseDir);
    const log = await git.log();
    if (!mod.contributions) {
        mod.contributions = contributions = [];
    }

    // add new contributions
    log.all.forEach(
        ({
            author_name: author,
            author_email: email,
            message: description,
            hash,
        }) => {
            if (
                contributions.some((c) => c.hash === hash) ||
                author === modAuthor.name ||
                author === owner ||
                author === defaultGameAuthor?.name ||
                author === defaultAuthor?.name ||
                ignoredContributors?.includes(author) ||
                ignoredContributors?.includes(email)
            ) {
                return;
            }
            contributions.push({ hash, author, description });
        }
    );

    // remove old contributions by now ignored authors
    mod.contributions = contributions.filter(
        (c) => !ignoredContributors?.includes(c.author) && c.hash.length >= 10
    );
    updateContributors(mod);
}

export function updateContributors(mod: ModInfo) {
    mod.contributors = mod.contributions
        .filter((c) => !c.suppressed)
        .reduce((acc, cur) => {
            if (!acc[cur.author]) {
                acc[cur.author] = [];
            }
            acc[cur.author].push({
                ...cur,
                hash: cur.hash.substr(0, 7),
            });
            return acc;
        }, {} as { [key: string]: Contribution[] });
}
