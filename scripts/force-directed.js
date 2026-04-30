import { loadCampusInvolvementData } from "./parse-data.js";

const svg = d3.select("#force-directed-graph");

const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

svg.attr("viewBox", `0 0 ${width} ${height}`);

// Select which field to visualize: 'clubs' | 'major' | 'minor'
export const SELECT_FIELD = "major";

const TOP_FIELD_COUNT = 40;

const FIELD_LABELS = {
	major: "Major",
	fresh_dorm: "Freshman Dorm",
	minor: "Minor",
	clubs: "Clubs",
	greek_life: "Greek Life",
	campus_job: "Campus Job"
};

const NODE_RADIUS = 8;
const LINK_STROKE_SCALE = 1;
const GRAPH_PADDING = NODE_RADIUS + 12;

function getSelectedField(entry) {
  const field = entry?.[SELECT_FIELD];
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

async function initForceDirectedGraph() {
	const graphData = await loadCampusInvolvementData();

  const clubMemberships = new Map();
  const linkWeights = new Map();

  for (const entry of graphData) {
    const clubs = [...new Set(getSelectedField(entry))];

    for (const club of clubs) {
      if (!clubMemberships.has(club)) {
        clubMemberships.set(club, new Set());
      }
      clubMemberships.get(club).add(entry.submission_id);
    }

    for (let i = 0; i < clubs.length; i += 1) {
      for (let j = i + 1; j < clubs.length; j += 1) {
        const source = clubs[i];
        const target = clubs[j];
        const key = source < target ? `${source}||${target}` : `${target}||${source}`;
        linkWeights.set(key, (linkWeights.get(key) ?? 0) + 1);
      }
    }
  }

  const topFieldNames = [...clubMemberships.entries()]
    .sort((a, b) => d3.descending(a[1].size, b[1].size) || d3.ascending(a[0], b[0]))
    .slice(0, TOP_FIELD_COUNT)
    .map(([club]) => club);

  const topFieldSet = new Set(topFieldNames);

  const nodes = topFieldNames.map((club) => ({
    id: club,
    group: clubMemberships.get(club).size
  }));

  const links = [...linkWeights.entries()].map(([key, value]) => {
    const [source, target] = key.split("||");

    if (!topFieldSet.has(source) || !topFieldSet.has(target)) {
      return null;
    }

    return {
      source,
      target,
      value
    };
  }).filter(Boolean);

  // Specify the dimensions of the chart.
  const width = 928;
  const height = 600;

  // Specify the color scale.
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  function clampNodePosition(node) {
    node.x = Math.max(GRAPH_PADDING, Math.min(width - GRAPH_PADDING, node.x));
    node.y = Math.max(GRAPH_PADDING, Math.min(height - GRAPH_PADDING, node.y));
  }

    svg.selectAll("*").remove();

    // The force simulation mutates links and nodes, so create a copy
    // so that re-evaluating this cell produces the same result.
    const simulationLinks = links.map((d) => ({ ...d }));
    const simulationNodes = nodes.map((d) => ({ ...d }));

  // Create a simulation with several forces.
    const simulation = d3.forceSimulation(simulationNodes)
      .force("link", d3.forceLink(simulationLinks).id(d => d.id))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", ticked);


  // Add a line for each link, and a circle for each node.
  const link = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
    .selectAll()
    .data(simulationLinks)
    .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value) * LINK_STROKE_SCALE);

  link.append("title")
      .text(d => `${d.source.id ?? d.source} ↔ ${d.target.id ?? d.target}: ${d.value} shared ${SELECT_FIELD}`);

  const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
    .selectAll()
    .data(simulationNodes)
    .join("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", d => color(d.group));

  node.append("title")
      .text(d => d.id);

  const nodeLabel = svg.append("g")
      .attr("fill", "#1f2937")
      .attr("font-size", 7)
      .attr("font-family", "Segoe UI, Tahoma, Geneva, Verdana, sans-serif")
      .attr("pointer-events", "none")
    .selectAll()
    .data(simulationNodes)
    .join("text")
      .text(d => d.id);

  // Add a drag behavior.
  node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

  // Set the position attributes of links and nodes each time the simulation ticks.
  function ticked() {
    simulationNodes.forEach(clampNodePosition);

    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

    nodeLabel
      .attr("x", d => d.x + NODE_RADIUS + 6)
      .attr("y", d => d.y + 4);
  }

  // Reheat the simulation when drag starts, and fix the subject position.
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  // Update the subject (dragged node) position during drag.
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
    clampNodePosition(event.subject);
  }

  // Restore the target alpha so the simulation cools after dragging ends.
  // Unfix the subject position now that it’s no longer being dragged.
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  // When this cell is re-run, stop the previous simulation. (This doesn’t
  // really matter since the target alpha is zero and the simulation will
  // stop naturally, but it’s a good practice.)
  invalidation.then(() => simulation.stop());

  return svg.node();
}

initForceDirectedGraph();
