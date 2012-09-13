var w = 960,
    h = 500;

var vis = d3.select("body").append("svg:svg").attr("width", w).attr("height", h);

var threshold = 2.0;

function filterEdges(edge_list, threshold) {
	return edge_list.filter(function (d) { return d.mi > threshold; });
}

function update() {
	node.attr("transform", function(d) {
		return "translate(" + d.x + "," + d.y + ")";
	});
	link.attr("x1", function(d) { return d.source.x; })
		.attr("y1", function(d) { return d.source.y; })
		.attr("x2", function(d) { return d.target.x; })
		.attr("y2", function(d) { return d.target.y; });
}

var links = filterEdges(edges, threshold);

var slider = document.getElementById("MIthreshold");
var extents = d3.extent(edges.map(function (d) { return d.mi;}));
slider.min = extents[0];
slider.max = extents[1];
slider.value = threshold;
slider.onchange = function () {
	threshold = document.getElementById("MIthreshold").value;
	document.getElementById("MIthresholdLabel").innerText = threshold.toString();
	links = filterEdges(edges, threshold);
	var linkSelection = vis.selectAll("line.link").data(links);
	linkSelection.enter().append("svg:line")
		.attr("class", "link").style("stroke", "#CCC");
	linkSelection.exit().remove();
	update();
};

var points = nodes.map(function (d) { return {"name": d};});
var force = d3.layout.force()
	.nodes(points)
	.links(links)
	.size([w,h])
	.gravity(0.5).linkDistance(100).charge(-3000)
	.on("tick", update);

var node = vis.selectAll("g.node").data(points).enter().append("svg:g").attr("class", "node");
node.append("svg:circle")
	.attr("r", 5)
	.style("fill", "#000")
	.style("stroke", "#FFF")
	.style("stroke-width", 3);
node.append("svg:text")
	.style("#fill", "#000")
	.text(function (d) { return d.name;});

var link = vis.selectAll("line.link")
	.data(links).enter().append("svg:line")
	.attr("class", "link").style("stroke", "#CCC");
force.start();