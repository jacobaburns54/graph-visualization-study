const DEFAULT_CSV_PATH = "campus_involvement_data.csv";

function normalizeText(value) {
  return (value ?? "").replace(/\r/g, "").trim();
}

function parseListField(value) {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberField(value) {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return null;
  }

  const asNumber = Number(cleaned);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function normalizeRows(rows) {
  return rows
    .map((row) => ({
      submission_date: normalizeText(row["Submission Date"]),
      clubs: parseListField(row["Clubs/Honor Societies"]),
      greek_life: normalizeText(row["Greek Life Affiliation"]),
      campus_job: normalizeText(row["Campus Job Title"]),
      major: parseListField(row["Major"]),
      minor: parseListField(row["Minor"]),
      fresh_dorm: normalizeText(row["Freshman Dorm"]),
      class_year: parseNumberField(row["Class Year"]),
      submission_id: parseNumberField(row["Submission ID"])
    }))
    .filter((entry) => entry.submission_id !== null);
}

export function parseGraphData(rawData) {
  // raw data: in ../campus_involvement_data.csv
  // columns:
  // submission date    | clubs/honor societes    | greek life affiliation | campus job tite | major                  | minor                   | freshman dorm | class year  | submission id
  // string (mon dd, yyyy) | '\n' separated strings  | string                 | string          | '\n' separated strings | '\n' separated strings  | string        | number      | number

  // JSON shape:
  /*
  [
    {
      submission_date: 'Apr 22, 2026',
      clubs:
      [
        'Food Recovery Network',
        'Tau Beta Pi',
        'Alden Voices',
      ],
      greek_life: '',
      campus_job: 'TA',
      major:
      [
        'Aerospace Engineering',
      ],
      minor:
      [
      ],
      fresh_dorm: 'Morgan Hall',
      class_year: 2026,
      submission_id: 652681259128912,
    }
  ]
  */

  if (Array.isArray(rawData)) {
    return normalizeRows(rawData);
  }

  if (typeof rawData !== "string") {
    return [];
  }

  const trimmed = rawData.trim();
  if (!trimmed) {
    return [];
  }

  const rows = d3.csvParse(trimmed);
  return normalizeRows(rows);
}

export async function loadCampusInvolvementData(csvPath = DEFAULT_CSV_PATH) {
  const response = await fetch(csvPath);
  if (!response.ok) {
    throw new Error(`Failed to load CSV data from ${csvPath}`);
  }

  const rawCsv = await response.text();
  return parseGraphData(rawCsv);
}
