import { loadCampusInvolvementData } from "./parse-data.js";

const svg = d3.select("#circular-link-graph");

const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const TOP_CLUB_COUNT = 25;
const OTHER_LABEL = "Other";
const MARGIN = {
  top: 125,
  left: 100,
  bottom: 125,
  right: 100,
};

// Select which field to visualize: 'clubs' | 'major' | 'minor'
export const SELECT_FIELD = 'clubs';

const FIELD_LABELS = {
	major: "Major",
	fresh_dorm: "Freshman Dorm",
	minor: "Minor",
	clubs: "Clubs",
	greek_life: "Greek Life",
	campus_job: "Campus Job"
};

function getFieldNames(entry) {
  const field = entry && entry[SELECT_FIELD];
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map((v) => (v || '').trim()).filter(Boolean);
  }
  return String(field).split(/\n|,|;/).map((v) => v.trim()).filter(Boolean);
}

function buildClubMatrix(graphData) {
  const clubCounts = new Map();

  for (const entry of graphData) {
    const uniqueClubs = new Set(getFieldNames(entry));
    for (const club of uniqueClubs) {
      clubCounts.set(club, (clubCounts.get(club) || 0) + 1);
    }
  }

  const topClubs = Array.from(clubCounts.entries())
    .sort((a, b) => d3.descending(a[1], b[1]) || d3.ascending(a[0], b[0]))
    .slice(0, TOP_CLUB_COUNT)
    .map(([club]) => club);

  const names = [...topClubs, OTHER_LABEL];
  const index = new Map(names.map((name, i) => [name, i]));
  const matrix = Array.from({ length: names.length }, () => Array(names.length).fill(0));

  for (const entry of graphData) {
    const uniqueClubs = new Set(getFieldNames(entry));
    const mappedClubs = new Set();

    for (const club of uniqueClubs) {
      mappedClubs.add(topClubs.includes(club) ? club : OTHER_LABEL);
    }

    const clubList = Array.from(mappedClubs);

    for (const club of clubList) {
      const clubIndex = index.get(club);
      matrix[clubIndex][clubIndex] += 1;
    }

    for (let i = 0; i < clubList.length; i += 1) {
      for (let j = i + 1; j < clubList.length; j += 1) {
        const sourceIndex = index.get(clubList[i]);
        const targetIndex = index.get(clubList[j]);
        matrix[sourceIndex][targetIndex] += 1;
        matrix[targetIndex][sourceIndex] += 1;
      }
    }
  }

  return { names, matrix };
}

function renderChordChart({ names, matrix }) {
  const chartWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const chartHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const outerRadius = Math.min(chartWidth, chartHeight) * 0.5 - 72;
  const innerRadius = outerRadius - 18;

  const chart = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left + chartWidth / 2},${MARGIN.top + chartHeight / 2})`);

  const chord = d3
    .chord()
    .padAngle(12 / innerRadius)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending);

  const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
  const ribbon = d3.ribbon().radius(innerRadius - 1);
  const colors = d3.scaleOrdinal(names, d3.schemeTableau10.concat(d3.schemeSet3));

  const chords = chord(matrix);

  chart
    .append("g")
    .selectAll("path")
    .data(chords)
    .join("path")
    .attr("d", ribbon)
    .attr("fill", (d) => colors(names[d.source.index]))
    .attr("fill-opacity", 0.75)
    .attr("stroke", "none")
    .append("title")
    .text((d) => `${names[d.source.index]} ↔ ${names[d.target.index]}: ${d.source.value}`);

  const group = chart
    .append("g")
    .selectAll("g")
    .data(chords.groups)
    .join("g");

  group
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => colors(names[d.index]))
    .attr("stroke", "#fff")
    .append("title")
    .text((d) => `${names[d.index]}: ${d.value}`);

  group
    .append("text")
    .each((d) => {
      d.angle = (d.startAngle + d.endAngle) / 2;
    })
    .attr("dy", "0.35em")
    .attr("transform", (d) => {
      const rotate = (d.angle * 180) / Math.PI - 90;
      const flip = d.angle > Math.PI ? 180 : 0;
      return `rotate(${rotate}) translate(${outerRadius + 18}) rotate(${flip})`;
    })
    .attr("text-anchor", (d) => (d.angle > Math.PI ? "end" : "start"))
    .attr("font-size", 11)
    .text((d) => names[d.index]);
}

async function initCircularLinkGraph() {
	const graphData = await loadCampusInvolvementData();
  const clubData = buildClubMatrix(graphData);
  renderChordChart(clubData);
}

initCircularLinkGraph();
