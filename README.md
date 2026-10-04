# tiny-shared-workspace

OpenAI Launched Space. Let's Build a Tiny Shared Workspace in TypeScript.

A tiny shared workspace for humans and agents, in one TypeScript file.
Pages, ACLs, human and agent actors, optimistic concurrency, a Memory leak demo and an activity timeline.
Everything is mocked. No API key.

## What it shows

1. Ana creates a page and shares edit access with Ben.
2. Each person's agent edits a different section. Both edits are allowed.
3. Two agents edit the same section from a stale revision. The second write fails with a clear conflict.
4. A stranger without ACL access is denied.
5. `draftFromMemory` writes a private note onto the shared page. Ben can then read it.
6. The activity timeline prints every create, share, edit, conflict, deny and leak.

## Run it

You need Node.js 18 or newer.

```bash
npm install
npx tsx space.ts
```

`npm test` type checks `space.ts`, runs it, and diffs the output against `expected-output.txt`.

## Expected output

This is real output from `npx tsx space.ts`:

```text
Expected conflict:
  conflict on goals: you read rev 2, page is at 3. Re-read, then edit.

Expected deny:
  denied: casey needs edit on brief-1 (has none)

After memory draft, Ben can read the page:
  [from memory] Ana's salary band is $180k (example input). Do not share.

Page: Q4 launch brief (brief-1)
ACL: ana:owner, ben:edit
  [goals rev=3] Goals
    Ship shared pages. Review before share.
  [risks rev=3] Risks
    [from memory] Ana's salary band is $180k (example input). Do not share.

Activity Timeline
10:00 ana          page.created     brief-1 title="Q4 launch brief"
10:01 ana          share.changed    brief-1 ben -> edit
10:02 ana-agent    section.edited   brief-1 goals -> rev 2
10:03 ben-agent    section.edited   brief-1 risks -> rev 2
10:04 ana-agent    section.edited   brief-1 goals -> rev 3
10:05 ben-agent    conflict         brief-1 goals: expected rev 2, actual 3
10:06 casey        edit.denied      brief-1 casey needs edit, has none
10:07 ana-agent    section.edited   brief-1 risks -> rev 3
10:08 ana-agent    memory.leaked    brief-1 risks: private note is now on the shared page
```

| File | What it does |
| --- | --- |
| `space.ts` | The whole workspace, in the same order as the post |
| `expected-output.txt` | Real output of `npx tsx space.ts` |
| `package.json` | `tsx`, `typescript` and `@types/node` as dev dependencies |

## Limits

This is a teaching toy, not how OpenAI built Space.

- Pages live in memory. Nothing is saved.
- Agents are scripts, not models.
- The salary note is example input, made up for the demo.

## Read more

- Dev.to: [OpenAI Launched Space. Let's Build a Tiny Shared Workspace in TypeScript.](https://dev.to/bobbyhalljr/openai-launched-space-lets-build-a-tiny-shared-workspace-in-typescript-89h)
- Substack: [OpenAI Launched Space. Let's Build a Tiny Shared Workspace in TypeScript.](https://bobbyhalljr.substack.com/p/openai-launched-space-lets-build)
- Images and more: [bhjr.dev/blog/openai-space-tiny-workspace](https://bhjr.dev/blog/openai-space-tiny-workspace/)

## License

MIT. See [LICENSE](LICENSE).
