import { useState, useRef } from "react";
import { useElup } from "@/lib/elup/store";
import { INFO_LANGUAGES, DEFAULT_INFO_PAGE, type InfoLanguage, type InfoParagraph, type InfoDiagram, type InfoFAQ, type InfoPageContent } from "@/lib/elup/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadDiagramImage } from "@/lib/firebase";
import { Plus, Trash2, Pencil, Check, X, Upload, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const LANG_LABELS: Record<InfoLanguage, string> = { en: "EN", zh: "中", ms: "MS", ta: "TA" };

function emptyI18n(): Record<InfoLanguage, string> {
  return { en: "", zh: "", ms: "", ta: "" };
}

function I18nTextarea({
  label, value, onChange, rows = 3,
}: {
  label: string;
  value: Record<InfoLanguage, string>;
  onChange: (v: Record<InfoLanguage, string>) => void;
  rows?: number;
}) {
  const [activeLang, setActiveLang] = useState<InfoLanguage>("en");
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex gap-0.5">
          {INFO_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setActiveLang(l.code)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                activeLang === l.code
                  ? "bg-sky-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {LANG_LABELS[l.code]}
            </button>
          ))}
        </div>
      </div>
      <Textarea
        rows={rows}
        value={value[activeLang] ?? ""}
        onChange={(e) => onChange({ ...value, [activeLang]: e.target.value })}
        placeholder={`${label} (${INFO_LANGUAGES.find((l) => l.code === activeLang)?.label})`}
        className="text-xs"
      />
    </div>
  );
}

function I18nInput({
  label, value, onChange,
}: {
  label: string;
  value: Record<InfoLanguage, string>;
  onChange: (v: Record<InfoLanguage, string>) => void;
}) {
  const [activeLang, setActiveLang] = useState<InfoLanguage>("en");
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex gap-0.5">
          {INFO_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setActiveLang(l.code)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                activeLang === l.code
                  ? "bg-sky-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {LANG_LABELS[l.code]}
            </button>
          ))}
        </div>
      </div>
      <Input
        value={value[activeLang] ?? ""}
        onChange={(e) => onChange({ ...value, [activeLang]: e.target.value })}
        placeholder={`${label} (${INFO_LANGUAGES.find((l) => l.code === activeLang)?.label})`}
        className="text-xs"
      />
    </div>
  );
}

// ---- Paragraphs ----
function ParagraphsEditor({ content, onChange }: { content: InfoPageContent; onChange: (c: InfoPageContent) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InfoParagraph | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPara, setNewPara] = useState<InfoParagraph>({ id: "", title: emptyI18n(), content: emptyI18n() });

  const startEdit = (p: InfoParagraph) => { setEditingId(p.id); setDraft({ ...p, title: { ...p.title }, content: { ...p.content } }); };
  const cancelEdit = () => { setEditingId(null); setDraft(null); };
  const saveEdit = () => {
    if (!draft) return;
    if (!draft.title.en.trim()) return toast.error("English title required");
    onChange({ ...content, paragraphs: content.paragraphs.map((p) => p.id === draft.id ? draft : p) });
    setEditingId(null); setDraft(null);
    toast.success("Paragraph updated");
  };
  const deletePara = (id: string) => {
    onChange({ ...content, paragraphs: content.paragraphs.filter((p) => p.id !== id) });
    toast.success("Paragraph removed");
  };
  const addPara = () => {
    if (!newPara.title.en.trim()) return toast.error("English title required");
    if (!newPara.content.en.trim()) return toast.error("English content required");
    onChange({ ...content, paragraphs: [...content.paragraphs, { ...newPara, id: `p-${Date.now()}` }] });
    setNewPara({ id: "", title: emptyI18n(), content: emptyI18n() });
    setAdding(false);
    toast.success("Paragraph added");
  };

  return (
    <div className="space-y-2">
      {content.paragraphs.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No paragraphs yet.</p>
      )}
      {content.paragraphs.map((p) => (
        <div key={p.id} className="rounded border bg-muted/20 p-2.5 space-y-2">
          {editingId === p.id && draft ? (
            <>
              <I18nInput label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
              <I18nTextarea label="Content" value={draft.content} onChange={(v) => setDraft({ ...draft, content: v })} rows={4} />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 bg-sky-600 hover:bg-sky-700" onClick={saveEdit}><Check className="h-3.5 w-3.5 mr-1" /> Save</Button>
                <Button size="sm" variant="outline" className="h-7" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{p.title.en || "(No English title)"}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{p.content.en || "(No English content)"}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(p)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deletePara(p.id)}><Trash2 className="h-3 w-3 text-rose-500" /></Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {adding ? (
        <div className="rounded border bg-sky-50/40 p-2.5 space-y-2">
          <I18nInput label="Title" value={newPara.title} onChange={(v) => setNewPara({ ...newPara, title: v })} />
          <I18nTextarea label="Content" value={newPara.content} onChange={(v) => setNewPara({ ...newPara, content: v })} rows={4} />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 bg-sky-600 hover:bg-sky-700" onClick={addPara}><Check className="h-3.5 w-3.5 mr-1" /> Add</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => { setAdding(false); setNewPara({ id: "", title: emptyI18n(), content: emptyI18n() }); }}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Paragraph
        </Button>
      )}
    </div>
  );
}

// ---- Diagrams ----
function DiagramsEditor({ content, onChange }: { content: InfoPageContent; onChange: (c: InfoPageContent) => void }) {
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState<Record<InfoLanguage, string>>(emptyI18n());
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadDiagramImage(file);
      const newDiagram: InfoDiagram = { id: `d-${Date.now()}`, imageUrl: url, caption: emptyI18n() };
      onChange({ ...content, diagrams: [...content.diagrams, newDiagram] });
      toast.success("Diagram uploaded");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const startEditCaption = (d: InfoDiagram) => {
    setEditingId(d.id);
    setDraftCaption(d.caption ? { ...d.caption } : emptyI18n());
  };
  const saveCaption = (id: string) => {
    onChange({ ...content, diagrams: content.diagrams.map((d) => d.id === id ? { ...d, caption: draftCaption } : d) });
    setEditingId(null);
    toast.success("Caption saved");
  };
  const deleteDiagram = (id: string) => {
    onChange({ ...content, diagrams: content.diagrams.filter((d) => d.id !== id) });
    toast.success("Diagram removed");
  };

  return (
    <div className="space-y-3">
      {content.diagrams.length === 0 && (
        <p className="text-xs text-muted-foreground">No diagrams yet.</p>
      )}
      {content.diagrams.map((d) => (
        <div key={d.id} className="rounded border bg-muted/20 p-2.5 space-y-2">
          <img
            src={d.imageUrl}
            alt="diagram"
            className="w-full max-h-48 object-contain rounded"
            onError={(e) => { (e.currentTarget as HTMLImageElement).alt = "Image unavailable"; }}
          />
          {editingId === d.id ? (
            <div className="space-y-2">
              <I18nTextarea label="Caption" value={draftCaption} onChange={setDraftCaption} rows={2} />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 bg-sky-600 hover:bg-sky-700" onClick={() => saveCaption(d.id)}><Check className="h-3.5 w-3.5 mr-1" /> Save</Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground line-clamp-2">{d.caption?.en || "(No caption)"}</p>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditCaption(d)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteDiagram(d.id)}><Trash2 className="h-3 w-3 text-rose-500" /></Button>
              </div>
            </div>
          )}
        </div>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />
      <Button
        size="sm"
        variant="outline"
        className="w-full h-8 text-xs"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Uploading…</> : <><Upload className="h-3.5 w-3.5 mr-1" /> Upload Diagram Image</>}
      </Button>
    </div>
  );
}

// ---- FAQs ----
function FAQsEditor({ content, onChange }: { content: InfoPageContent; onChange: (c: InfoPageContent) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InfoFAQ | null>(null);
  const [adding, setAdding] = useState(false);
  const [newFaq, setNewFaq] = useState<InfoFAQ>({ id: "", question: emptyI18n(), answer: emptyI18n() });

  const startEdit = (f: InfoFAQ) => { setEditingId(f.id); setDraft({ ...f, question: { ...f.question }, answer: { ...f.answer } }); };
  const cancelEdit = () => { setEditingId(null); setDraft(null); };
  const saveEdit = () => {
    if (!draft) return;
    if (!draft.question.en.trim()) return toast.error("English question required");
    onChange({ ...content, faqs: content.faqs.map((f) => f.id === draft.id ? draft : f) });
    setEditingId(null); setDraft(null);
    toast.success("FAQ updated");
  };
  const deleteFaq = (id: string) => {
    onChange({ ...content, faqs: content.faqs.filter((f) => f.id !== id) });
    toast.success("FAQ removed");
  };
  const addFaq = () => {
    if (!newFaq.question.en.trim()) return toast.error("English question required");
    if (!newFaq.answer.en.trim()) return toast.error("English answer required");
    onChange({ ...content, faqs: [...content.faqs, { ...newFaq, id: `faq-${Date.now()}` }] });
    setNewFaq({ id: "", question: emptyI18n(), answer: emptyI18n() });
    setAdding(false);
    toast.success("FAQ added");
  };

  return (
    <div className="space-y-2">
      {content.faqs.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No FAQs yet.</p>
      )}
      {content.faqs.map((f, i) => (
        <div key={f.id} className="rounded border bg-muted/20 p-2.5 space-y-2">
          {editingId === f.id && draft ? (
            <>
              <I18nInput label="Question" value={draft.question} onChange={(v) => setDraft({ ...draft, question: v })} />
              <I18nTextarea label="Answer" value={draft.answer} onChange={(v) => setDraft({ ...draft, answer: v })} rows={3} />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 bg-sky-600 hover:bg-sky-700" onClick={saveEdit}><Check className="h-3.5 w-3.5 mr-1" /> Save</Button>
                <Button size="sm" variant="outline" className="h-7" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-sky-700">Q{i + 1}</p>
                <p className="text-xs font-medium truncate">{f.question.en || "(No English question)"}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{f.answer.en || "(No English answer)"}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(f)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteFaq(f.id)}><Trash2 className="h-3 w-3 text-rose-500" /></Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {adding ? (
        <div className="rounded border bg-sky-50/40 p-2.5 space-y-2">
          <I18nInput label="Question" value={newFaq.question} onChange={(v) => setNewFaq({ ...newFaq, question: v })} />
          <I18nTextarea label="Answer" value={newFaq.answer} onChange={(v) => setNewFaq({ ...newFaq, answer: v })} rows={3} />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 bg-sky-600 hover:bg-sky-700" onClick={addFaq}><Check className="h-3.5 w-3.5 mr-1" /> Add</Button>
            <Button size="sm" variant="outline" className="h-7" onClick={() => { setAdding(false); setNewFaq({ id: "", question: emptyI18n(), answer: emptyI18n() }); }}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add FAQ
        </Button>
      )}
    </div>
  );
}

// ---- Main exported component ----
export function InfoPageCustomizer() {
  const { state, dispatch } = useElup();
  const [localContent, setLocalContent] = useState<InfoPageContent>(() => state.infoPageContent);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const handleChange = (updated: InfoPageContent) => {
    setLocalContent(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      dispatch({ type: "SAVE_INFO_CONTENT", content: localContent });
      setDirty(false);
      toast.success("Information page saved");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalContent(DEFAULT_INFO_PAGE);
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Manage the content shown to surveyors in the Information tab, with translations for all 4 languages.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground"
          onClick={handleReset}
          title="Reset to default content"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset defaults
        </Button>
      </div>

      <Tabs defaultValue="paragraphs">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="paragraphs" className="text-xs">Paragraphs</TabsTrigger>
          <TabsTrigger value="diagrams" className="text-xs">Diagrams</TabsTrigger>
          <TabsTrigger value="faqs" className="text-xs">FAQs</TabsTrigger>
        </TabsList>
        <TabsContent value="paragraphs" className="mt-3 max-h-[380px] overflow-y-auto pr-0.5">
          <ParagraphsEditor content={localContent} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="diagrams" className="mt-3 max-h-[380px] overflow-y-auto pr-0.5">
          <DiagramsEditor content={localContent} onChange={handleChange} />
        </TabsContent>
        <TabsContent value="faqs" className="mt-3 max-h-[380px] overflow-y-auto pr-0.5">
          <FAQsEditor content={localContent} onChange={handleChange} />
        </TabsContent>
      </Tabs>

      {dirty && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-sky-700 font-medium">You have unsaved changes.</p>
          <Button
            size="sm"
            className="h-7 bg-sky-600 hover:bg-sky-700 text-xs"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</> : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
