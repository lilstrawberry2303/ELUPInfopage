import { useRef, useState } from "react";
import { FileText, Upload, Loader2, ExternalLink, X, Trash2 } from "lucide-react";
import { uploadDocument } from "@/lib/firebase";
import { toast } from "sonner";

export interface UnitDocument {
  name: string;
  url: string;
}

interface Props {
  docs: UnitDocument[];
  pathPrefix: string;
  onAdd: (doc: UnitDocument) => void;
  onRemove?: (idx: number) => void;
}

export function DocumentUploader({ docs, pathPrefix, onAdd, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const url = await uploadDocument(file, pathPrefix);
          onAdd({ name: file.name, url });
          toast.success(`Uploaded: ${file.name}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          toast.error(msg, { description: file.name });
        }
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {docs.length > 0 && (
        <div className="space-y-1.5">
          {docs.map((doc, i) => (
            <div
              key={`${doc.url}-${i}`}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={doc.name}>
                {doc.name}
              </span>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-0.5 text-sky-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="ml-1 shrink-0 text-muted-foreground hover:text-destructive"
                  title="Remove document"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-md border-2 border-dashed border-input px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {uploading ? "Uploading…" : "Upload document"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
