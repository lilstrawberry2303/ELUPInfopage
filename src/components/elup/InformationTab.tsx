import { useState } from "react";
import { useElup } from "@/lib/elup/store";
import { INFO_LANGUAGES, type InfoLanguage } from "@/lib/elup/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Info, ImageIcon, HelpCircle, Languages } from "lucide-react";

export function InformationTab() {
  const { state } = useElup();
  const { paragraphs, diagrams, faqs } = state.infoPageContent;
  const [lang, setLang] = useState<InfoLanguage>("en");

  const t = (map: Record<InfoLanguage, string> | undefined): string => {
    if (!map) return "";
    return map[lang] || map["en"] || "";
  };

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
              className={`h-7 px-2.5 text-xs ${lang === l.code ? "bg-sky-600 hover:bg-sky-700" : ""}`}
              onClick={() => setLang(l.code)}
            >
              {l.nativeLabel}
            </Button>
          ))}
        </div>
      </div>

      {/* Paragraphs */}
      {paragraphs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 uppercase tracking-wide">
            <Info className="h-4 w-4" />
            About the Programme
          </div>
          {paragraphs.map((p) => (
            <Card key={p.id} className="border-sky-100">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold leading-snug text-foreground">
                  {t(p.title)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {t(p.content)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diagrams */}
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

      {/* FAQs */}
      {faqs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 uppercase tracking-wide">
            <HelpCircle className="h-4 w-4" />
            Frequently Asked Questions
            <Badge variant="outline" className="ml-auto text-xs">{faqs.length}</Badge>
          </div>
          <Accordion type="single" collapsible className="rounded-lg border divide-y">
            {faqs.map((faq, i) => (
              <AccordionItem key={faq.id} value={faq.id} className="border-0 px-3">
                <AccordionTrigger className="text-sm font-medium text-left py-3 hover:no-underline">
                  <span className="mr-2 shrink-0 text-sky-600 font-bold text-xs">Q{i + 1}</span>
                  {t(faq.question)}
                </AccordionTrigger>
                <AccordionContent className="pb-3 text-sm text-muted-foreground leading-relaxed pl-5">
                  {t(faq.answer)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
