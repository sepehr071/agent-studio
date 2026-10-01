import type { Metadata } from "next";
import { ImageStudio } from "@/components/app/image-studio";
import { listGeneratedImages } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "استودیو تصویر" };

export default function StudioPage() {
  const images = listGeneratedImages({ limit: 200 });
  return <ImageStudio initialImages={images} />;
}
