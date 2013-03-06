var w = 1280,
    h = 800;

var color = d3.scale.ordinal().domain(["entity", "document"]).range(["#333", "#38b"]);

var nodeSize = d3.scale.linear().range([9,20]);

var nodes, links;

var overallWeight = {}, nameLinks = {}, links, nodes;

var dbData = data["URIS_TO_DOCS"],
	docMetadata = data["DOC_METADATA"];
for (var i in dbData) {
	var sum = 0;
	var name = decodeURIComponent(i.replace("http://dbpedia.org/resource/","")).replace(/_/g, " ");
	for (var item in dbData[i]) {
		console.log(item);
		sum += dbData[i][item];
		if (!overallWeight.hasOwnProperty(item) && docMetadata.hasOwnProperty(item)){
			overallWeight[item] = {"name": docMetadata[item]["title"].substring(0,20), "value": 1, "id": item, "url": "zotero://select/item/" + item, "group": "document"};
		} else {
			overallWeight[item]["value"] += 1;
		}
		if (!(name in nameLinks)) {
			nameLinks[name] = [item];
		} else {
			nameLinks[name].push(item);
		}
	}
	overallWeight[i] = {"name": name, "id": name, "value": sum, "url": i, "group": "entity"};
}
var nodeValues = d3.values(overallWeight).map(function (d) { return +d.value; });
nodeValues.sort(d3.ascending);

var aboveX = d3.quantile(nodeValues, 0.75);

nodes = d3.values(overallWeight).filter(function (d) { return d.value >= aboveX || d.group == "document";});

nodeIndex = {};
nodeValues = [];

nodes.forEach(function (d, i) {
	nodeIndex[d.id] = i;
});


links = [];

for (var source in nameLinks) {
	nameLinks[source].forEach(function (target) {
		if (source in nodeIndex && target in nodeIndex) {
			links.push({"source": nodeIndex[source], "target": nodeIndex[target], "weight": 1});			
		}
	});
}

var labelDistance = 0;

var vis = d3.select("body").append("svg:svg").attr("width", w).attr("height", h);

var labelAnchors = [];
var labelAnchorLinks = [];

nodes.forEach(function (node, i) {
	labelAnchors.push({"node": node});
	labelAnchors.push({"node": node});
	labelAnchorLinks.push({
		source : i * 2,
		target : i * 2 + 1,
		weight : 1
	});
});

var force = d3.layout.force().size([w, h]).nodes(nodes).links(links).gravity(1).linkDistance(50).charge(-3000).linkStrength(function(x) {
	return x.weight * 10
});


force.start();

var force2 = d3.layout.force().nodes(labelAnchors).links(labelAnchorLinks).gravity(0).linkDistance(0).linkStrength(8).charge(-100).size([w, h]);
force2.start();

var link = vis.selectAll("line.link").data(links).enter().append("svg:line").attr("class", "link").style("stroke", "#CCC");

var node = vis.selectAll("g.node").data(nodes).enter().append("svg:g").attr("class", "node");
node.append("svg:circle").attr("r", 5).style("fill", function (d) { return color(d.group); }).style("stroke", "#FFF").style("stroke-width", 3);
node.call(force.drag);

var anchorLink = vis.selectAll("line.anchorLink").data(labelAnchorLinks)//.enter().append("svg:line").attr("class", "anchorLink").style("stroke", "#999");

var anchorNode = vis.selectAll("g.anchorNode").data(labelAnchors).enter().append("svg:g").attr("class", "anchorNode")
	.on("click", function (d) { if (d.node.url.indexOf("zotero") != -1) window.location.href = d.node.url; else window.open(d.node.url);});
anchorNode.append("svg:circle").attr("r", 0);


nodeSize.domain(d3.extent(nodes.map(function (d) { return d.weight; })));
anchorNode.append("svg:text").text(function(d, i) { return i % 2 == 0 ? "" : d.node.name })
	.style("fill", function (d) { return color(d.node.group); })
	.style("font-family", "Arial")
	.style("font-size", function (d) { return nodeSize(d.node.value) +"px";});

var updateLink = function(selection) {
	selection.attr("x1", function(d) { return d.source.x; })
		.attr("y1", function(d) { return d.source.y; })
		.attr("x2", function(d) { return d.target.x; })
		.attr("y2", function(d) { return d.target.y; });
};

var updateNode = function(selection) {
	selection.attr("transform", function(d) {
		return "translate(" + d.x + "," + d.y + ")";
	});
};


force.on("tick", function() {

	force2.start();

	node.call(updateNode);

	anchorNode.each(function(d, i) {
		if(i % 2 == 0) {
			d.x = d.node.x;
			d.y = d.node.y;
		} else {
			var b = this.childNodes[1].getBBox();

			var diffX = d.x - d.node.x;
			var diffY = d.y - d.node.y;

			var dist = Math.sqrt(diffX * diffX + diffY * diffY);

			var shiftX = b.width * (diffX - dist) / (dist * 2);
			shiftX = Math.max(-b.width, Math.min(0, shiftX));
			var shiftY = 5;
			this.childNodes[1].setAttribute("transform", "translate(" + shiftX + "," + shiftY + ")");
		}
	});


	anchorNode.call(updateNode);

	link.call(updateLink);
	anchorLink.call(updateLink);

});