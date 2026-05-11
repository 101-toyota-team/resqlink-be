export function preprocessQuery(query: string): string {
  const processed = query.trim();

  const abbreviations: Record<string, string> = {
    rs: "Rumah Sakit",
    rsud: "Rumah Sakit Umum Daerah",
    rsia: "Rumah Sakit Ibu dan Anak",
    puskesmas: "Pusat Kesehatan Masyarakat",
  };

  const words = processed.split(/\s+/);
  const expandedWords = words.map((word) => {
    const lower = word.toLowerCase();
    return abbreviations[lower] || word;
  });

  return expandedWords.join(" ");
}