import { getCatalog } from "@/lib/openrouter-models";

export async function GET(req: Request) {
  try {
    const catalog = await getCatalog();
    const modality = new URL(req.url).searchParams.get("modality");
    const filtered =
      modality === "image"
        ? catalog.filter((m) => m.supportsImageOutput)
        : catalog;
    return Response.json(filtered);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Catalog fetch failed",
      },
      { status: 502 },
    );
  }
}
