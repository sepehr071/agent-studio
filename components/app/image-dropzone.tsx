"use client";

import { ImagePlusIcon, XIcon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DropzoneImage {
  /** base64 data URL */
  dataUrl: string;
  name: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Image-to-image reference dropzone. Reads selected/dropped images client-side
 * as base64 data URLs (the OpenRouter image route accepts `inputImages` data
 * URLs directly — no dependency on the uploads route). Capped at `maxImages`.
 */
export function ImageDropzone({
  images,
  onChange,
  maxImages = 4,
  disabled,
}: {
  images: DropzoneImage[];
  onChange: (images: DropzoneImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (incoming.length === 0) return;
      const room = maxImages - images.length;
      if (room <= 0) return;
      const slice = incoming.slice(0, room);
      const read = await Promise.all(
        slice.map(async (f) => ({
          dataUrl: await readFileAsDataUrl(f),
          name: f.name,
        })),
      );
      onChange([...images, ...read]);
    },
    [images, maxImages, onChange],
  );

  const remove = useCallback(
    (index: number) => {
      onChange(images.filter((_, i) => i !== index));
    },
    [images, onChange],
  );

  const full = images.length >= maxImages;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          if (disabled || full) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled || full) return;
          void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/20 px-4 py-6 text-center text-sm text-fg-3 transition-colors",
          dragging && "border-primary/60 bg-primary/5",
          (disabled || full) && "cursor-not-allowed opacity-50",
        )}
      >
        <ImagePlusIcon className="size-6 text-fg-4" />
        <span>
          {full
            ? `حداکثر ${maxImages} تصویر مرجع`
            : "تصویر مرجع را اینجا رها کنید یا برای انتخاب کلیک کنید"}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          disabled={disabled || full}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            // Reset so re-selecting the same file fires change again.
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </label>

      {images.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <li key={`${img.name}-${i}`} className="group relative">
              {/* biome-ignore lint/a11y/useAltText: decorative reference preview */}
              <img
                src={img.dataUrl}
                alt={img.name}
                className="aspect-square w-full rounded-md object-cover ring-1 ring-foreground/10"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(i)}
                aria-label="حذف تصویر مرجع"
                className="absolute end-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
