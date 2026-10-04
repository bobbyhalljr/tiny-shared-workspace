// Tiny shared workspace: pages, ACLs, agents, optimistic concurrency, memory leak demo.
// No API key. Everything is mocked.

type Role = "view" | "edit" | "owner";

type Actor = {
  id: string;
  kind: "human" | "agent";
  // Agents act on behalf of a human. ACL checks use ownerId for agents.
  ownerId?: string;
};

type Section = {
  id: string;
  heading: string;
  body: string;
  revision: number;
};

type AclEntry = {
  actorId: string;
  role: Role;
};

type Page = {
  id: string;
  title: string;
  sections: Section[];
  acl: AclEntry[];
};

type EventKind =
  | "page.created"
  | "section.edited"
  | "edit.denied"
  | "conflict"
  | "memory.leaked"
  | "share.changed";

type SpaceEvent = {
  at: string;
  kind: EventKind;
  actorId: string;
  pageId: string;
  detail: string;
};

const rank: Record<Role, number> = { view: 1, edit: 2, owner: 3 };

class Space {
  private pages = new Map<string, Page>();
  private log: SpaceEvent[] = [];
  private clock = 0;

  private tick(base = "10:00"): string {
    const mins = this.clock++;
    const h = 10 + Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  private record(kind: EventKind, actorId: string, pageId: string, detail: string) {
    this.log.push({ at: this.tick(), kind, actorId, pageId, detail });
  }

  createPage(
    owner: Actor,
    id: string,
    title: string,
    sections: { id: string; heading: string; body: string }[],
  ): Page {
    const page: Page = {
      id,
      title,
      sections: sections.map((s) => ({ ...s, revision: 1 })),
      acl: [{ actorId: owner.id, role: "owner" }],
    };
    this.pages.set(id, page);
    this.record("page.created", owner.id, id, `title="${title}"`);
    return page;
  }

  share(owner: Actor, pageId: string, actorId: string, role: Role) {
    const page = this.requirePage(pageId);
    this.requireRole(owner, page, "owner");
    const existing = page.acl.find((e) => e.actorId === actorId);
    if (existing) existing.role = role;
    else page.acl.push({ actorId, role });
    this.record("share.changed", owner.id, pageId, `${actorId} -> ${role}`);
  }

  /** Effective actor id for ACL: agents inherit their human owner's grants. */
  private effectiveId(actor: Actor): string {
    return actor.kind === "agent" ? (actor.ownerId ?? actor.id) : actor.id;
  }

  private roleOf(actor: Actor, page: Page): Role | null {
    const id = this.effectiveId(actor);
    return page.acl.find((e) => e.actorId === id)?.role ?? null;
  }

  private requirePage(pageId: string): Page {
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`unknown page: ${pageId}`);
    return page;
  }

  private requireRole(actor: Actor, page: Page, need: Role) {
    const have = this.roleOf(actor, page);
    if (!have || rank[have] < rank[need]) {
      const who = this.effectiveId(actor);
      this.record(
        "edit.denied",
        actor.id,
        page.id,
        `${who} needs ${need}, has ${have ?? "none"}`,
      );
      throw new Error(
        `denied: ${actor.id} needs ${need} on ${page.id} (has ${have ?? "none"})`,
      );
    }
  }

  readSection(actor: Actor, pageId: string, sectionId: string): Section {
    const page = this.requirePage(pageId);
    this.requireRole(actor, page, "view");
    const section = page.sections.find((s) => s.id === sectionId);
    if (!section) throw new Error(`unknown section: ${sectionId}`);
    // Return a snapshot so callers hold a revision number.
    return { ...section };
  }

  applyEdit(
    actor: Actor,
    pageId: string,
    sectionId: string,
    newBody: string,
    expectedRevision: number,
  ): Section {
    const page = this.requirePage(pageId);
    this.requireRole(actor, page, "edit");
    const section = page.sections.find((s) => s.id === sectionId);
    if (!section) throw new Error(`unknown section: ${sectionId}`);

    if (section.revision !== expectedRevision) {
      this.record(
        "conflict",
        actor.id,
        pageId,
        `${sectionId}: expected rev ${expectedRevision}, actual ${section.revision}`,
      );
      throw new Error(
        `conflict on ${sectionId}: you read rev ${expectedRevision}, page is at ${section.revision}. Re-read, then edit.`,
      );
    }

    section.body = newBody;
    section.revision += 1;
    this.record(
      "section.edited",
      actor.id,
      pageId,
      `${sectionId} -> rev ${section.revision}`,
    );
    return { ...section };
  }

  /**
   * Memory can write personal context onto a page.
   * Once on the page, viewers can read it. Mirrors OpenAI's Space warning.
   */
  draftFromMemory(
    actor: Actor,
    pageId: string,
    sectionId: string,
    privateNote: string,
    expectedRevision: number,
  ): Section {
    const framed = `[from memory] ${privateNote}`;
    const section = this.applyEdit(actor, pageId, sectionId, framed, expectedRevision);
    this.record(
      "memory.leaked",
      actor.id,
      pageId,
      `${sectionId}: private note is now on the shared page`,
    );
    return section;
  }

  printTimeline() {
    console.log("Activity Timeline");
    for (const e of this.log) {
      const cols = [
        e.at,
        e.actorId.padEnd(12),
        e.kind.padEnd(16),
        e.pageId.padEnd(8),
      ];
      console.log(`${cols.join(" ")}${e.detail}`);
    }
  }

  printPage(pageId: string) {
    const page = this.requirePage(pageId);
    console.log(`\nPage: ${page.title} (${page.id})`);
    console.log(
      "ACL:",
      page.acl.map((e) => `${e.actorId}:${e.role}`).join(", "),
    );
    for (const s of page.sections) {
      console.log(`  [${s.id} rev=${s.revision}] ${s.heading}`);
      console.log(`    ${s.body}`);
    }
  }
}

// --- Demo: Ana owns a briefing page. Ben and two agents collaborate. ---

const ana: Actor = { id: "ana", kind: "human" };
const ben: Actor = { id: "ben", kind: "human" };
const anaAgent: Actor = { id: "ana-agent", kind: "agent", ownerId: "ana" };
const benAgent: Actor = { id: "ben-agent", kind: "agent", ownerId: "ben" };
const stranger: Actor = { id: "casey", kind: "human" };

const space = new Space();

space.createPage(ana, "brief-1", "Q4 launch brief", [
  {
    id: "goals",
    heading: "Goals",
    body: "Ship shared pages for humans and agents.",
  },
  {
    id: "risks",
    heading: "Risks",
    body: "TBD",
  },
]);

space.share(ana, "brief-1", "ben", "edit");

// Each person uses their own agent against the shared page.
const goalsForAna = space.readSection(anaAgent, "brief-1", "goals");
space.applyEdit(
  anaAgent,
  "brief-1",
  "goals",
  "Ship shared pages. Keep private chats private.",
  goalsForAna.revision,
);

const risksForBen = space.readSection(benAgent, "brief-1", "risks");
space.applyEdit(
  benAgent,
  "brief-1",
  "risks",
  "Two agents editing the same section without a re-read.",
  risksForBen.revision,
);

// Conflict: both agents read goals at the same revision, then both write.
const staleA = space.readSection(anaAgent, "brief-1", "goals");
const staleB = space.readSection(benAgent, "brief-1", "goals");

space.applyEdit(
  anaAgent,
  "brief-1",
  "goals",
  "Ship shared pages. Review before share.",
  staleA.revision,
);

try {
  space.applyEdit(
    benAgent,
    "brief-1",
    "goals",
    "Ship shared pages. Add a timeline.",
    staleB.revision, // stale: ana-agent already bumped revision
  );
} catch (err) {
  console.log("Expected conflict:");
  console.log(`  ${(err as Error).message}`);
}

// Denied: stranger has no ACL entry.
try {
  space.applyEdit(stranger, "brief-1", "risks", "Should not work", 1);
} catch (err) {
  console.log("\nExpected deny:");
  console.log(`  ${(err as Error).message}`);
}

// Memory leak: Ana's agent writes a private note onto the shared page.
const risksNow = space.readSection(anaAgent, "brief-1", "risks");
space.draftFromMemory(
  anaAgent,
  "brief-1",
  "risks",
  "Ana's salary band is $180k (example input). Do not share.",
  risksNow.revision,
);

console.log("\nAfter memory draft, Ben can read the page:");
const leaked = space.readSection(ben, "brief-1", "risks");
console.log(`  ${leaked.body}`);

space.printPage("brief-1");
console.log("");
space.printTimeline();
