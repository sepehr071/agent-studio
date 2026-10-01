/**
 * Stream meeting audio from disk, Range-request-friendly (the `<audio>` element
 * sends `Range: bytes=...` for seeking). Streams via a Node read stream — never
 * buffers the whole file.
 */
import { createReadStream } from "node:fs";
import { getMeeting } from "@/lib/db/queries";
import { audioFileSize, resolveAudioAbsPath } from "@/lib/meetings/storage";
import { nodeStreamToWeb } from "@/lib/server/node-stream";

const EXT_TO_MIME: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  mp3: "audio/mpeg",
  mpga: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  flac: "audio/flac",
};

function mimeFor(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const meeting = getMeeting(id);
  if (!meeting?.audioPath) {
    return Response.json({ error: "صدای جلسه یافت نشد." }, { status: 404 });
  }

  const absPath = resolveAudioAbsPath(meeting.audioPath);
  const size = await audioFileSize(meeting.audioPath);
  if (size === null) {
    return Response.json(
      { error: "فایل صوتی روی دیسک موجود نیست." },
      { status: 404 },
    );
  }

  const contentType = mimeFor(meeting.audioPath);
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : size - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= size) end = size - 1;
      if (start > end || start >= size) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const chunkStream = createReadStream(absPath, { start, end });
      return new Response(nodeStreamToWeb(chunkStream), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const fullStream = createReadStream(absPath);
  return new Response(nodeStreamToWeb(fullStream), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
