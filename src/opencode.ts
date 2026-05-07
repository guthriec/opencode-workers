import { createOpencode, type OpencodeClient } from "@opencode-ai/sdk/v2";

export interface OpenCodeInstance {
  client: OpencodeClient;
  close: () => void;
}

export class OpencodeManager {
  private instances = new Map<string, OpenCodeInstance>();

  async getOrCreateServer(repoPath: string): Promise<OpenCodeInstance> {
    const existing = this.instances.get(repoPath);
    if (existing) return existing;

    const { client, server } = await createOpencode({});
    const instance: OpenCodeInstance = { client, close: () => server.close() };
    this.instances.set(repoPath, instance);
    return instance;
  }

  async ensureSession(
    client: OpencodeClient,
    worktreePath: string,
    existingSessionId?: string,
    title?: string,
    agent?: string,
  ): Promise<string> {
    if (existingSessionId) {
      return existingSessionId;
    }

    const result = await client.session.create({
      directory: worktreePath,
      title: title ?? "oc-work session",
      agent,
    });
    return (result as { data: { id: string } }).data.id;
  }

  async runPrompt(
    client: OpencodeClient,
    sessionId: string,
    worktreePath: string,
    prompt: string,
    agent?: string,
  ): Promise<void> {
    const events = await client.event.subscribe({ directory: worktreePath });

    const streamDone = this.processEventStream(client, events, worktreePath);

    try {
      await client.session.prompt({
        sessionID: sessionId,
        directory: worktreePath,
        agent,
        system: "You are working in an oc-work session. Resolve any merge conflicts that arise during your work.",
        parts: [{ type: "text" as const, text: prompt }],
      });
    } finally {
      await streamDone;
    }
  }

  private async processEventStream(
    client: OpencodeClient,
    result: Awaited<ReturnType<OpencodeClient["event"]["subscribe"]>>,
    directory: string,
  ): Promise<void> {
    try {
      for await (const raw of result.stream) {
        const event = raw as Record<string, unknown>;
        if (!event) continue;

        const eventType = event.type as string;

        if (eventType === "sync") {
          const syncData = event.data as Record<string, unknown> | undefined;
          switch (event.name as string) {
            case "session.next.text.delta.1":
              process.stdout.write(String(syncData?.delta ?? ""));
              break;
            case "session.next.reasoning.delta.1":
              break;
            case "session.next.step.ended.1":
              process.stdout.write("\n");
              break;
          }
          if (event.name === "session.idle" || event.name === "session.error") return;
        }

        if (eventType === "session.next.text.delta" || eventType === "message.part.delta") {
          const props = event.properties as Record<string, unknown> | undefined;
          process.stdout.write(String(props?.delta ?? (props?.text ?? "")));
        }

        if (eventType === "session.idle") {
          return;
        }

        if (eventType === "session.error") {
          const props = event.properties as Record<string, unknown> | undefined;
          process.stderr.write(`\nSession error: ${JSON.stringify(props?.error)}\n`);
          return;
        }

        if (eventType === "session.next.text.ended" || eventType === "session.next.reasoning.ended" || eventType === "session.next.step.ended") {
          process.stdout.write("\n");
        }

        if (eventType === "permission.asked") {
          const properties = event.properties as Record<string, unknown> | undefined;
          const requestID = properties?.id as string | undefined;
          if (requestID) {
            try {
              await client.permission.reply({ requestID, directory, reply: "reject" as const });
            } catch {}
          }
        }
      }
    } catch (error) {
      process.stderr.write(`\nStream error: ${error}\n`);
    }
  }

  close(repoPath?: string): void {
    if (repoPath) {
      const instance = this.instances.get(repoPath);
      if (instance) {
        instance.close();
        this.instances.delete(repoPath);
      }
      return;
    }
    for (const [, instance] of this.instances) {
      instance.close();
    }
    this.instances.clear();
  }
}