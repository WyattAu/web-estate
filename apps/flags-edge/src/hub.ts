// flags-edge FlagHub: the broadcast core, extracted pure so it is
// unit-testable without a Durable Object runtime. Manages subscriber
// message queues; a flag flip enqueues flag-update frames per the
// conformance/ws contract.

import type { ServerMessage } from "@est/ws";

export class FlagHubCore {
  #flags: Record<string, boolean>;
  /** One serialized-message queue per subscriber id. */
  #queues = new Map<string, string[]>();

  constructor(flags: Record<string, boolean> = {}) {
    this.#flags = { ...flags };
  }

  /** Register a subscriber; delivery is the hello snapshot. */
  subscribe(id: string): string[] {
    this.#queues.set(id, []);
    return [JSON.stringify({ type: "hello", flags: { ...this.#flags } })];
  }

  unsubscribe(id: string): void {
    this.#queues.delete(id);
  }

  /** Subscriber count (for tests and stats). */
  get subscriberCount(): number {
    return this.#queues.size;
  }

  /** Flip a flag; every subscriber queue gains a flag-update frame. */
  setFlag(name: string, enabled: boolean): void {
    this.#flags[name] = enabled;
    const frame = JSON.stringify({ type: "flag-update", name, enabled });
    for (const queue of this.#queues.values()) queue.push(frame);
  }

  /** Drain one subscriber's queue (returns and clears). */
  drain(id: string): string[] {
    const queue = this.#queues.get(id) ?? [];
    this.#queues.set(id, []);
    return queue;
  }

  /** Current flag state snapshot. */
  snapshot(): Record<string, boolean> {
    return { ...this.#flags };
  }

  /** Evaluate one flag (the /evaluate contract). */
  evaluate(name: string): boolean {
    return this.#flags[name] ?? false;
  }
}
