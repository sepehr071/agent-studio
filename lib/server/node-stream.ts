/**
 * Adapt a Node read stream to a web `ReadableStream` without using
 * `Readable.toWeb()`.
 *
 * Why hand-roll this: `Readable.toWeb()`'s adapter races on client abort. When
 * the client cancels (e.g. an `<audio>` element drops its first Range probe),
 * the web stream is cancelled and the underlying controller is closed, but the
 * Node adapter may still fire a buffered `data`/`end` and call enqueue/close on
 * the now-closed controller → `ERR_INVALID_STATE: Controller is already closed`
 * surfaces as an uncaughtException that kills the whole server process.
 *
 * This adapter guards every controller call behind a `closed` flag and a
 * try/catch, so an enqueue/close/error after cancellation is a no-op instead of
 * a process-killing throw. Backpressure is honoured via desiredSize + pause/
 * resume.
 */
import type { Readable } from "node:stream";

export function nodeStreamToWeb(
  stream: Readable,
): ReadableStream<Uint8Array> {
  // Single source of truth: once the web side is done with the stream (end,
  // error, or cancel) no further controller call may run.
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: Buffer) => {
        if (closed) return;
        try {
          controller.enqueue(
            new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
          );
        } catch {
          // Controller closed out from under us (client aborted mid-chunk).
          return;
        }
        // Respect downstream backpressure: pause until pull() resumes.
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          stream.pause();
        }
      });

      stream.on("end", () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by a cancel — nothing to do.
        }
      });

      stream.on("error", (err) => {
        if (closed) return;
        closed = true;
        try {
          controller.error(err);
        } catch {
          // Controller already torn down.
        }
        stream.destroy();
      });
    },

    pull() {
      // Downstream wants more — undo any backpressure pause.
      stream.resume();
    },

    cancel() {
      // Client/consumer aborted: stop the controller path and free the fd.
      closed = true;
      stream.destroy();
    },
  });
}
