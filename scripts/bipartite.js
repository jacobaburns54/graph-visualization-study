import { loadCampusInvolvementData } from "./parse-data.js";

const svg = d3.select("#bipartite-graph");

const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const MARGIN = {
	top: 32,
	right: 48,
	bottom: 32,
	left: 48
};

const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

const SOURCE_FIELD = "major";
const TARGET_FIELD = "fresh_dorm";
const NODE_BAR_WIDTH = 18;
const SOURCE_FILL = "#2563eb";
const TARGET_FILL = "#10b981";

const FIELD_LABELS = {
	major: "Major",
	fresh_dorm: "Freshman Dorm",
	minor: "Minor",
	clubs: "Clubs",
	greek_life: "Greek Life",
	campus_job: "Campus Job"
};

function getFieldValues(entry, fieldName) {
  const field = entry?.[fieldName];
  if (Array.isArray(field)) {
    return field.map((value) => (value || "").trim()).filter(Boolean);
  }

  if (typeof field === "string") {
    return field
      .split(/\n|,|;/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

function buildClubMajorFlows(graphData) {
  const flowCounts = new Map();

  for (const entry of graphData) {
    const clubs = [...new Set(getFieldValues(entry, SOURCE_FIELD))];
    const majors = [...new Set(getFieldValues(entry, TARGET_FIELD))];

    for (const club of clubs) {
      for (const major of majors) {
        const key = `${club}||${major}`;
        flowCounts.set(key, (flowCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...flowCounts.entries()].map(([key, value]) => {
    const [source, target] = key.split("||");
    return { source, target, value };
  });
}

async function initBipartiteGraph() {
	const graphData = await loadCampusInvolvementData();

	const flows = buildClubMajorFlows(graphData);
	const layoutFactory = globalThis.d3bipartite;

	if (typeof layoutFactory !== "function") {
		throw new Error("d3-bipartite is not available. Ensure the library script is loaded before scripts/bipartite.js.");
	}

	svg.selectAll("*").remove();

	if (flows.length === 0) {
		svg
			.append("text")
			.attr("x", width / 2)
			.attr("y", height / 2)
			.attr("text-anchor", "middle")
			.attr("fill", "#6b7280")
			.attr("font-size", 16)
			.text("No combinations found.");
		return svg.node();
	}

	const layout = layoutFactory()
		.width(innerWidth)
		.height(innerHeight)
		.padding(10)
		.source((d) => d.source)
		.target((d) => d.target)
		.value((d) => d.value);

	const result = layout(flows);
	const root = svg.append("g").attr("class", "bipartite-root").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
	const linkLayer = root.append("g").attr("fill", "none");
	const nodeLayer = root.append("g");
	const labelLayer = root.append("g");

	linkLayer
		.selectAll("path")
		.data(result.flows)
		.join("path")
		.attr("d", (d) => d.path)
		.attr("fill", "none")
		.attr("stroke", SOURCE_FILL)
		.attr("stroke-opacity", 0.35)
		.attr("stroke-width", (d) => Math.max(1, d.thickness))
		.append("title")
		.text((d) => `${d.source} ↔ ${d.target}: ${d.value} students`);

	const sourceNodes = nodeLayer
		.selectAll("g.source-node")
		.data(result.sources)
		.join("g")
		.attr("class", "source-node");

	sourceNodes
		.append("rect")
		.attr("x", (d) => d.x)
		.attr("y", (d) => d.y)
		.attr("width", NODE_BAR_WIDTH)
		.attr("height", (d) => Math.max(1, d.height))
		.attr("rx", 4)
		.attr("fill", SOURCE_FILL)
		.attr("opacity", 0.9)
		.append("title")
		.text((d) => `${d.key}: ${d.value} students`);

	const targetNodes = nodeLayer
		.selectAll("g.target-node")
		.data(result.targets)
		.join("g")
		.attr("class", "target-node");

	targetNodes
		.append("rect")
		.attr("x", (d) => d.x - NODE_BAR_WIDTH)
		.attr("y", (d) => d.y)
		.attr("width", NODE_BAR_WIDTH)
		.attr("height", (d) => Math.max(1, d.height))
		.attr("rx", 4)
		.attr("fill", TARGET_FILL)
		.attr("opacity", 0.9)
		.append("title")
		.text((d) => `${d.key}: ${d.value} students`);

	labelLayer
		.selectAll("text.source-label")
		.data(result.sources)
		.join("text")
		.attr("class", "source-label")
		.attr("x", (d) => d.x + NODE_BAR_WIDTH + 8)
		.attr("y", (d) => d.y + d.height / 2)
		.attr("dominant-baseline", "middle")
		.attr("fill", "#1f2937")
		.attr("font-size", 11)
		.text((d) => d.key);

	labelLayer
		.selectAll("text.target-label")
		.data(result.targets)
		.join("text")
		.attr("class", "target-label")
		.attr("x", (d) => d.x - NODE_BAR_WIDTH - 8)
		.attr("y", (d) => d.y + d.height / 2)
		.attr("dominant-baseline", "middle")
		.attr("text-anchor", "end")
		.attr("fill", "#1f2937")
		.attr("font-size", 11)
		.text((d) => d.key);

	labelLayer
		.append("text")
		.attr("class", "source-header")
		.attr("x", NODE_BAR_WIDTH / 2)
		.attr("y", -8)
		.attr("text-anchor", "middle")
		.attr("fill", "#0f172a")
		.attr("font-size", 13)
		.attr("font-weight", 700)
		.text(() => FIELD_LABELS[SOURCE_FIELD] || SOURCE_FIELD);

	labelLayer
		.append("text")
		.attr("class", "target-header")
		.attr("x", innerWidth - NODE_BAR_WIDTH / 2)
		.attr("y", -8)
		.attr("text-anchor", "middle")
		.attr("fill", "#0f172a")
		.attr("font-size", 13)
		.attr("font-weight", 700)
		.text(() => FIELD_LABELS[TARGET_FIELD] || TARGET_FIELD);

	return svg.node();


}

initBipartiteGraph();