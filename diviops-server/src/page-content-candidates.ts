import { createHash, randomBytes } from "node:crypto";
import type { DiviopsResponse } from "./envelope.js";

export const PAGE_CANDIDATE_LIMITS = Object.freeze({ ttlMs: 300_000, count: 8, candidateBytes: 2 * 1024 * 1024, totalBytes: 8 * 1024 * 1024 });
type Binding = { site: string; page_id: number; expected_checksum: string; backup: boolean };
type Candidate = Binding & { content: string; content_checksum: string; bytes: number; expires: number; ready: boolean };
export const candidateError = (code: string, message: string): DiviopsResponse<never> => ({ ok: false, error: { code, message } });
const checksum = (content: string) => `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;

/** Memory-only, process-local, single-use references. No payload is written to disk. */
export class PageContentCandidates {
  private entries = new Map<string, Candidate>();
  private bytes = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly now = Date.now) {}

  private prune(): void {
    for (const [ref, entry] of this.entries) {
      if (entry.expires <= this.now()) this.remove(ref, entry);
    }
  }

  private remove(ref: string, entry: Candidate): void {
    this.entries.delete(ref);
    this.bytes -= entry.bytes;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.entries.size) return;
    const expires = Math.min(...Array.from(this.entries.values(), e => e.expires));
    this.timer = setTimeout(() => { this.prune(); this.schedule(); }, Math.max(1, expires - this.now()));
    this.timer.unref();
  }

  reserve(binding: Binding, content: string): DiviopsResponse<{ content_ref: string; content_checksum: string; expires_at: string }> {
    this.prune();
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > PAGE_CANDIDATE_LIMITS.candidateBytes || this.entries.size >= PAGE_CANDIDATE_LIMITS.count || this.bytes + bytes > PAGE_CANDIDATE_LIMITS.totalBytes) {
      return candidateError("page.content_ref_capacity", "Candidate retention capacity exceeded; resend content after capacity becomes available.");
    }
    const ref = `pcr_${randomBytes(32).toString("hex")}`;
    const entry = { ...binding, content, content_checksum: checksum(content), bytes, expires: this.now() + PAGE_CANDIDATE_LIMITS.ttlMs, ready: false };
    this.entries.set(ref, entry);
    this.bytes += bytes;
    this.schedule();
    return { ok: true, data: { content_ref: ref, content_checksum: entry.content_checksum, expires_at: new Date(entry.expires).toISOString() } };
  }

  confirm(ref: string): boolean {
    this.prune();
    const entry = this.entries.get(ref);
    if (!entry) return false;
    entry.ready = true;
    return true;
  }

  cancel(ref: string): void {
    const entry = this.entries.get(ref);
    if (entry && !entry.ready) this.remove(ref, entry);
    this.schedule();
  }

  consume(ref: string, binding: Binding): DiviopsResponse<string> {
    this.prune();
    const entry = this.entries.get(ref);
    if (!entry || !entry.ready) return candidateError("page.content_ref_invalid", "Unknown, expired, or consumed content_ref. Run a new retained dry-run.");
    if (entry.site !== binding.site || entry.page_id !== binding.page_id || entry.expected_checksum !== binding.expected_checksum || entry.backup !== binding.backup || checksum(entry.content) !== entry.content_checksum) {
      return candidateError("page.content_ref_mismatch", "content_ref does not match the site, page, reviewed checksum, or backup intent.");
    }
    // Synchronous removal precedes every asynchronous writer dispatch, including failures.
    this.remove(ref, entry);
    this.schedule();
    return { ok: true, data: entry.content };
  }
}
