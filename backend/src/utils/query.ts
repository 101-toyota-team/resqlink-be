export function preprocessQuery(query: string): {
  raw: string;
  expanded: string;
} {
  const raw = query.trim();

  const abbreviations: Record<string, string> = {
    rs: "Rumah Sakit",
    rsud: "Rumah Sakit Umum Daerah",
    rsia: "Rumah Sakit Ibu dan Anak",
    puskesmas: "Pusat Kesehatan Masyarakat",
  };

  const words = raw.split(/\s+/);
  const expandedWords = words.map((word) => {
    const lower = word.toLowerCase();
    return abbreviations[lower] || word;
  });

  return { raw, expanded: expandedWords.join(" ") };
}
