// src/components/CityReportBlock.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { BookOpen, ChevronDown, ChevronUp, Loader2, PlusCircle, Camera, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface CityReportBlockProps {
  cityName: string;
  stateName?: string;
  countryName?: string;
  lat?: number;
  lng?: number;
  timezone?: string;
  onOpenInsights?: () => void;
}

interface TableRow {
  key: string;
  value: string;
}

export default function CityReportBlock({
  cityName,
  stateName,
  countryName,
  lat,
  lng,
  timezone,
  onOpenInsights,
}: CityReportBlockProps) {
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    async function loadReport() {
      try {
        setLoading(true);
        const res = await fetch("/api/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cityName,
            stateName,
            countryName: countryName || "United States",
            lat,
            lng,
            timezone,
            type: "about",
          }),
        });

        if (!res.ok) throw new Error("Failed to load report");
        const data = await res.json();
        if (!isCancelled && data.report) {
          setReport(data.report);
        }
      } catch (err) {
        console.error("CityReportBlock load error:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    if (cityName) {
      loadReport();
    }

    return () => {
      isCancelled = true;
    };
  }, [cityName, stateName, countryName, lat, lng, timezone]);

  // Listen for navigation clicks to auto-expand
  useEffect(() => {
    const handleScrollToGuide = () => {
      setIsExpanded(true);
    };
    window.addEventListener("expandCommunityGuide", handleScrollToGuide);
    return () => window.removeEventListener("expandCommunityGuide", handleScrollToGuide);
  }, []);

  // Separate narrative text from the Wikipedia-style table
  const { narrativeText, tableRows, tableHeader } = useMemo(() => {
    if (!report) return { narrativeText: "", tableRows: [], tableHeader: "At a Glance: Municipal Profile" };

    const lines = report.split("\n");
    const storyLines: string[] = [];
    const tableLines: string[] = [];
    let inTable = false;
    let customHeader = "At a Glance: Municipal Profile";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("### At a Glance") || line.includes("### Municipal Profile") || line.includes("PART 2:")) {
        inTable = true;
        if (line.startsWith("###")) {
          customHeader = line.replace(/^###\s*/, "").replace(/PART 2:\s*/, "").trim();
        }
        continue;
      }

      if (inTable || line.trim().startsWith("|")) {
        inTable = true;
        if (line.trim().startsWith("|")) {
          tableLines.push(line);
        }
      } else {
        storyLines.push(line);
      }
    }

    // Parse table rows
    const parsedRows: TableRow[] = [];
    const contentRows = tableLines.filter((l) => !l.includes("---"));

    for (let i = 0; i < contentRows.length; i++) {
      const parts = contentRows[i]
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        if (i === 0 && (parts[0].toLowerCase().includes("indicator") || parts[0].toLowerCase().includes("metric"))) {
          continue;
        }
        parsedRows.push({
          key: parts[0].replace(/\*\*/g, ""),
          value: parts[1],
        });
      }
    }

    return {
      narrativeText: storyLines.join("\n").trim(),
      tableRows: parsedRows,
      tableHeader: customHeader,
    };
  }, [report]);

  // Split narrative into lead segment vs remainder
  const { firstParagraph, remainingStory } = useMemo(() => {
    if (!narrativeText) return { firstParagraph: "", remainingStory: "" };

    const sections = narrativeText.split(/\n\s*\n/);
    if (sections.length <= 1) {
      return { firstParagraph: narrativeText, remainingStory: "" };
    }

    // First section is typically the header + first paragraph
    const first = sections.slice(0, 2).join("\n\n");
    const rest = sections.slice(2).join("\n\n");
    return { firstParagraph: first, remainingStory: rest };
  }, [narrativeText]);

  return (
    <section 
      id="community-guide" 
      className="bg-white rounded-3xl border border-slate-200 p-6 md:p-9 shadow-xs my-6 w-full scroll-mt-24 transition-all"
    >
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-2 border border-blue-100">
            <BookOpen size={12} />
            Community Guide & Municipal Profile
          </div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 leading-tight">
            About {cityName}{stateName ? `, ${stateName}` : ""}{countryName && countryName !== "United States" ? ` · ${countryName}` : ""}
          </h2>
        </div>

        {/* Top Share Insights action */}
        {onOpenInsights && (
          <button
            type="button"
            onClick={onOpenInsights}
            className="self-start sm:self-center inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-[10.5px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm shrink-0"
          >
            <PlusCircle size={14} />
            Share Insights
          </button>
        )}
      </div>

      {/* CONTENT CANVAS */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 animate-pulse">
            Compiling Community Intelligence for {cityName}...
          </p>
        </div>
      ) : (
        <div className="pt-6 space-y-8">
          {/* PART 1: THE STORY NARRATIVE */}
          <div className="prose prose-slate max-w-none text-slate-700 font-normal leading-relaxed text-sm md:text-base">
            {/* On Mobile (< md): show first paragraph when collapsed, full story when expanded */}
            <div className="md:hidden">
              <ReactMarkdown
                components={{
                  h3: ({ children }) => (
                    <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-5 mb-2.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => <p className="mb-3.5 text-slate-700 leading-relaxed text-[14px]">{children}</p>,
                }}
              >
                {isExpanded ? narrativeText : firstParagraph}
              </ReactMarkdown>

              {/* Mobile gradient fade when collapsed */}
              {!isExpanded && remainingStory && (
                <div className="h-10 bg-gradient-to-t from-white to-transparent -mt-10 relative pointer-events-none" />
              )}

              {/* Mobile Read More / Read Less Toggle Pill */}
              {remainingStory && (
                <div className="pt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="inline-flex items-center gap-2 bg-slate-950 hover:bg-blue-600 text-white px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                  >
                    {isExpanded ? (
                      <>
                        Show Less <ChevronUp size={14} />
                      </>
                    ) : (
                      <>
                        Read Full Community Story <ChevronDown size={14} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* On Desktop (md+): show full narrative with clean section headers */}
            <div className="hidden md:block">
              <ReactMarkdown
                components={{
                  h3: ({ children }) => (
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 mt-7 mb-2.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => <p className="mb-4 text-slate-700 leading-relaxed text-[15px]">{children}</p>,
                }}
              >
                {narrativeText}
              </ReactMarkdown>
            </div>
          </div>

          {/* PART 2: CLASSIC WIKIPEDIA-STYLE MUNICIPAL PROFILE TABLE */}
          {tableRows.length > 0 && (
            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 border border-slate-200 shrink-0">
                  <BookOpen size={16} />
                </div>
                <h3 className="text-sm md:text-base font-black uppercase tracking-tight text-slate-900">
                  {tableHeader}
                </h3>
              </div>

              <div className="overflow-hidden border border-slate-300 rounded-2xl shadow-xs bg-white">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="w-2/5 sm:w-1/3 px-5 py-3 font-black uppercase tracking-wider text-slate-800 text-[11px]">
                        Indicator
                      </th>
                      <th className="px-5 py-3 font-black uppercase tracking-wider text-slate-800 text-[11px]">
                        Detail / Municipal Record
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-slate-200 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                        } hover:bg-blue-50/60`}
                      >
                        <td className="px-5 py-3 font-bold text-slate-900 bg-slate-50/50 border-r border-slate-200 align-top whitespace-normal">
                          {row.key}
                        </td>
                        <td className="px-5 py-3 text-slate-700 font-medium leading-relaxed">
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PART 3: COMMUNITY CONTRIBUTION ACTION BAR (Zero Placeholders) */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-semibold text-slate-500 text-center sm:text-left">
              Have local knowledge, updates, or photos for {cityName}? Help keep our community guide current.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full sm:w-auto shrink-0">
              {onOpenInsights && (
                <button
                  type="button"
                  onClick={onOpenInsights}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                >
                  Suggest an Update
                </button>
              )}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("openModal", { detail: "submit_event" }))}
                className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
              >
                <Calendar size={13} />
                Submit Event
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("openModal", { detail: "submit_photo" }))}
                className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
              >
                <Camera size={13} />
                Submit Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}