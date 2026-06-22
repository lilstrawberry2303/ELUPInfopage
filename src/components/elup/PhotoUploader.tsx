import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { uploadPhoto } from "@/lib/firebase";
import { toast } from "sonner";

interface Props {
  photos: string[];
  onChange: (next: string[]) => void;
  pathPrefix: string;
  accent?: "sky" | "orange";
  columns?: number;
  /** When true, only renders the upload button — no thumbnail grid */
  uploadOnly?: boolean;
}

export function PhotoUploader({ photos, onChange, pathPrefix, accent = "sky", columns = 4, uploadOnly = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const url = await uploadPhoto(file, pathPrefix);
          urls.push(url);
        } catch (err: any) {
          toast.error(err?.message ?? "Upload failed", { description: file.name });
        }
      }
      if (urls.length) {
        onChange([...photos, ...urls]);
        toast.success(`Uploaded ${urls.length} photo${urls.length > 1 ? "s" : ""}`);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const accentBorder =
    accent === "orange"
      ? "border-orange-300 text-orange-700 hover:bg-orange-50"
      : "border-input text-muted-foreground hover:bg-muted";

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
      multiple
      className="hidden"
      onChange={(e) => handleFiles(e.target.files)}
    />
  );

  if (uploadOnly) {
    return (
      <div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={`flex items-center gap-1.5 rounded-md border-2 border-dashed px-3 py-1.5 text-xs transition disabled:opacity-50 ${accentBorder}`}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Upload photo"}
        </button>
        {input}
      </div>
    );
  }

  const gridCls = columns === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className={`grid ${gridCls} gap-2`}>
      {photos.map((p, i) => (
        <div key={p + i} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
          {/^https?:|^data:/.test(p) ? (
            <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">{p.slice(0, 8)}</div>
          )}
        </div>
      ))}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={`flex aspect-square flex-col items-center justify-center rounded-md border-2 border-dashed text-xs transition disabled:opacity-50 ${accentBorder}`}
      >
        {uploading ? <Loader2 className="mb-1 h-4 w-4 animate-spin" /> : <Upload className="mb-1 h-4 w-4" />}
        {uploading ? "Uploading…" : "Add photo"}
      </button>
      {input}
    </div>
  );
}
