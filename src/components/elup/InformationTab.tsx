import { useState, useEffect, useCallback } from "react";
import { useElup } from "@/lib/elup/store";
import { INFO_LANGUAGES, type InfoLanguage } from "@/lib/elup/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info, ImageIcon, HelpCircle, Languages, Volume2, Square, ChevronDown } from "lucide-react";

// Primary BCP 47 tag set on utterance.lang (used as the final fallback)
const LANG_PRIMARY: Record<InfoLanguage, string> = {
  en: "en-SG",
  ms: "ms-SG",
  zh: "zh-CN",
  ta: "ta-IN",  // ta-SG does not exist in any browser; ta-IN is the only shipped Tamil voice
};

// Ordered locale prefixes to try when searching available voices.
// Most browsers ship: ta-IN (Chrome), ms-MY (Chrome/Safari), zh-CN/zh-TW, en-*
const LANG_VOICE_PRIORITY: Record<InfoLanguage, string[]> = {
  en: ["en-SG", "en-GB", "en-US", "en-AU", "en"],
  ms: ["ms-SG", "ms-MY", "ms"],
  zh: ["zh-CN", "zh-TW", "zh-HK", "zh"],
  ta: ["ta-SG", "ta-IN", "ta"],   // ta-SG tried first in case future browsers add it
};

function findVoice(lang: InfoLanguage): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const prefix of LANG_VOICE_PRIORITY[lang]) {
    const match = voices.find((v) =>
      v.lang.toLowerCase() === prefix.toLowerCase() ||
      v.lang.toLowerCase().startsWith(prefix.toLowerCase() + "-")
    );
    if (match) return match;
  }
  // Last resort: any voice whose lang starts with the language code
  const langCode = LANG_VOICE_PRIORITY[lang].at(-1)!; // e.g. "ta"
  return voices.find((v) => v.lang.toLowerCase().startsWith(langCode)) ?? null;
}

function speakText(text: string, lang: InfoLanguage): SpeechSynthesisUtterance {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_PRIMARY[lang];

  const voice = findVoice(lang);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang; // align lang to the actual voice locale
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}

// Standalone read-aloud toggle button (never nested inside another button)
function ReadAloudButton({
  id,
  text,
  lang,
  playingId,
  onPlay,
  onStop,
}: {
  id: string;
  text: string;
  lang: InfoLanguage;
  playingId: string | null;
  onPlay: (id: string, text: string) => void;
  onStop: () => void;
}) {
  const isPlaying = playingId === id;
  return (
    <Button
      size="icon"
      variant="ghost"
      className={`h-7 w-7 shrink-0 ${
        isPlaying ? "text-sky-600" : "text-muted-foreground hover:text-sky-600"
      }`}
      title={isPlaying ? "Stop reading" : "Read aloud"}
      onClick={(e) => {
        e.stopPropagation();
        isPlaying ? onStop() : onPlay(id, text);
      }}
    >
      {isPlaying ? (
        <Square className="h-3.5 w-3.5 fill-sky-600" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

export function InformationTab() {
  const { state } = useElup();
  const { paragraphs, diagrams, faqs } = state.infoPageContent;
  const [lang, setLang] = useState<InfoLanguage>("en");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const t = (map: Record<InfoLanguage, string> | undefined): string => {
    if (!map) return "";
    return map[lang] || map["en"] || "";
  };

  // Rule 4: cancel immediately when language changes
  const switchLang = (code: InfoLanguage) => {
    window.speechSynthesis.cancel();
    setPlayingId(null);
    setLang(code);
  };

  // Rule 4: cancel when component unmounts (tab navigation)
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handlePlay = useCallback(
    (id: string, text: string) => {
      setPlayingId(id);
      const utterance = speakText(text, lang);
      utterance.onend = () => setPlayingId(null);
      utterance.onerror = () => setPlayingId(null);
    },
    [lang]
  );

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setPlayingId(null);
  }, []);

  return (
    <div className="space-y-5">
      {/* Language switcher */}
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <Languages className="h-4 w-4 shrink-0 text-sky-600" />
        <span className="text-xs font-medium text-muted-foreground mr-1">Language:</span>
        <div className="flex flex-wrap gap-1.5">
          {INFO_LANGUAGES.map((l) => (
            <Button
              key={l.code}
              size="sm"
              variant={lang === l.code ? "default" : "outline"}
              className={`h-7 px-2.5 text-xs ${
                lang === l.code ? "bg-sky-600 hover:bg-sky-700" : ""
              }`}
              onClick={() => switchLang(l.code)}
            >
              {l.nativeLabel}
            </Button>
          ))}
        </div>
      </div>

      {/* About the Programme — TTS per card */}
      {paragraphs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 uppercase tracking-wide">
            <Info className="h-4 w-4" />
            About the Programme
          </div>
          {paragraphs.map((p) => {
            const titleText = t(p.title);
            const bodyText = t(p.content);
            return (
              <Card key={p.id} className="border-sky-100">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-snug text-foreground">
                      {titleText}
                    </CardTitle>
                    <ReadAloudButton
                      id={p.id}
                      text={`${titleText}. ${bodyText}`}
                      lang={lang}
                      playingId={playingId}
                      onPlay={handlePlay}
                      onStop={handleStop}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {bodyText}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Diagram Illustrations — no TTS */}
      {diagrams.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 uppercase tracking-wide">
            <ImageIcon className="h-4 w-4" />
            Diagram Illustrations
          </div>
          <div className="space-y-4">
            {diagrams.map((d) => (
              <div key={d.id} className="overflow-hidden rounded-lg border bg-card">
                <img
                  src={d.imageUrl}
                  alt={d.caption ? t(d.caption) : "ELUP diagram"}
                  className="w-full object-contain max-h-[340px]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                {d.caption && (
                  <div className="border-t bg-muted/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t(d.caption)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQs — custom collapsible to avoid button-in-button (TTS per item) */}
      {faqs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 uppercase tracking-wide">
            <HelpCircle className="h-4 w-4" />
            Frequently Asked Questions
            <Badge variant="outline" className="ml-auto text-xs">{faqs.length}</Badge>
          </div>
          <div className="rounded-lg border divide-y">
            {faqs.map((faq, i) => {
              const questionText = t(faq.question);
              const answerText = t(faq.answer);
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id}>
                  {/* Header row: expand toggle + question + TTS button as siblings */}
                  <div className="flex items-center gap-1 px-3">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 py-3 text-left text-sm font-medium hover:text-sky-700 transition-colors"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    >
                      <span className="shrink-0 text-sky-600 font-bold text-xs">Q{i + 1}</span>
                      <span className="flex-1">{questionText}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {/* TTS button is a sibling of the toggle button, not nested inside it */}
                    <ReadAloudButton
                      id={faq.id}
                      text={`${questionText}. ${answerText}`}
                      lang={lang}
                      playingId={playingId}
                      onPlay={handlePlay}
                      onStop={handleStop}
                    />
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 pl-9 text-sm text-muted-foreground leading-relaxed">
                      {answerText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {paragraphs.length === 0 && diagrams.length === 0 && faqs.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No information content yet. The project manager will add details here.
        </div>
      )}
    </div>
  );
}
