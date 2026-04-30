import { loadCampusInvolvementData } from "./parse-data.js";

const svg = d3.select("#treemap-graph");

const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

svg.attr("viewBox", `0 0 ${width} ${height}`);

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

function buildMajorClubHierarchy(graphData) {
  const majorClubCounts = new Map();

  for (const entry of graphData) {
    const majors = [...new Set(getFieldValues(entry, "major"))];
    const clubs = [...new Set(getFieldValues(entry, "fresh_dorm"))];

    for (const major of majors) {
      if (!majorClubCounts.has(major)) {
        majorClubCounts.set(major, new Map());
      }

      const clubCounts = majorClubCounts.get(major);

      for (const club of clubs) {
        clubCounts.set(club, (clubCounts.get(club) ?? 0) + 1);
      }
    }
  }

  return {
    name: "Majors",
    children: [...majorClubCounts.entries()]
      .map(([major, clubCounts]) => ({
        name: major,
        children: [...clubCounts.entries()]
          .map(([club, count]) => ({ name: club, value: count }))
          .sort((a, b) => d3.descending(a.value, b.value) || d3.ascending(a.name, b.name))
      }))
      .filter((major) => major.children.length > 0)
      .sort((a, b) => d3.descending(d3.sum(a.children, (d) => d.value), d3.sum(b.children, (d) => d.value)) || d3.ascending(a.name, b.name))
  };
}

function wrapSvgText(textSelection, maxWidth, maxLines = 3) {
  textSelection.each(function (d) {
    const text = d3.select(this);
    const words = String(text.text()).split(/\s+/).filter(Boolean);
    const lineHeight = 1.15;
    const x = text.attr("x");
    const y = text.attr("y");
    const dy = Number.parseFloat(text.attr("dy") || 0);

    text.text(null);

    if (words.length === 0 || maxWidth <= 0) {
      return;
    }

    let line = [];
    let lineNumber = 0;
    let tspan = text
      .append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("dy", `${dy}em`);

    for (const word of words) {
      line.push(word);
      tspan.text(line.join(" "));

      if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        lineNumber += 1;

        if (lineNumber >= maxLines) {
          tspan.text(`${line.join(" ")}…`);
          return;
        }

        tspan = text
          .append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", `${lineHeight}em`)
          .text(word);
      }
    }
  });
}

function createClipId(node) {
  return `clip-${node.depth}-${String(node.ancestors().map((ancestor) => ancestor.data.name).join("-")).replace(/[^a-zA-Z0-9-]+/g, "-")}`;
}

async function initTreemapGraph() {
  const graphData = await loadCampusInvolvementData();
  const hierarchyData = buildMajorClubHierarchy(graphData);

  svg.selectAll("*").remove();

  if (!hierarchyData.children.length) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280")
      .attr("font-size", 16)
      .text("No major/club combinations found.");
    return svg.node();
  }

  const root = d3
    .hierarchy(hierarchyData)
    .sum((d) => d.value ?? 0)
    .sort((a, b) => d3.descending(a.value, b.value) || d3.ascending(a.data.name, b.data.name));

  d3
    .treemap()
    .size([width, height])
    .paddingOuter(8)
    .paddingTop((d) => (d.depth === 1 ? 26 : 0))
    .paddingInner(2)
    .round(true)(root);

  const majorColor = d3.scaleOrdinal(d3.schemeTableau10);
  const leaves = root.leaves();
  const clipDefs = svg.append("defs");

  root.descendants().forEach((node) => {
    if (node.depth === 0) {
      return;
    }

    clipDefs
      .append("clipPath")
      .attr("id", createClipId(node))
      .append("rect")
      .attr("x", node.x0)
      .attr("y", node.y0)
      .attr("width", Math.max(0, node.x1 - node.x0))
      .attr("height", Math.max(0, node.y1 - node.y0));
  });

  const nodes = svg
    .append("g")
    .selectAll("g")
    .data(root.descendants().filter((node) => node.depth > 0))
    .join("g")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  nodes
    .append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("fill", (d) => {
      if (d.depth === 1) {
        return d3.color(majorColor(d.data.name)).copy({ opacity: 0.18 });
      }

      return d3.color(majorColor(d.parent.data.name)).copy({ opacity: 0.78 });
    })
    .attr("stroke", (d) => (d.depth === 1 ? majorColor(d.data.name) : "#ffffff"))
    .attr("stroke-width", (d) => (d.depth === 1 ? 1.4 : 1));

  nodes
    .append("title")
    .text((d) => {
      if (d.depth === 1) {
        return `${d.data.name}: ${d.value} students across clubs`;
      }

      return `${d.parent.data.name} > ${d.data.name}: ${d.value} students`;
    });

  const majorLabels = svg
    .append("g")
    .selectAll("text.major-label")
    .data(root.children || [])
    .join("text")
    .attr("class", "major-label")
    .attr("x", (d) => d.x0 + 8)
    .attr("y", (d) => d.y0 + 18)
    .attr("fill", "#0f172a")
    .attr("font-size", 12)
    .attr("font-weight", 700)
    .attr("clip-path", (d) => `url(#${createClipId(d)})`)
    .text((d) => d.data.name);

  wrapSvgText(majorLabels, 140, 2);

  const leafLabels = svg
    .append("g")
    .selectAll("text.club-label")
    .data(leaves)
    .join("text")
    .attr("class", "club-label")
    .attr("x", (d) => d.x0 + 6)
    .attr("y", (d) => d.y0 + 16)
    .attr("fill", "#ffffff")
    .attr("font-size", 10)
    .attr("pointer-events", "none")
    .attr("clip-path", (d) => `url(#${createClipId(d)})`)
    .text((d) => d.data.name);

  wrapSvgText(leafLabels, 110, 2);

  return svg.node();
}

initTreemapGraph();