var nodedata = data['nodes'];
var edgedata = data['edges'];

var fontSize = d3.scale.log().range([10,32]);
var linkSize = d3.scale.linear().range([2,10]);

var vals = nodedata.map(function (d) { return +d.freq});
fontSize.domain([d3.min(vals), d3.max(vals)]);

vals = edgedata.map(function (d) { return +d.weight});
linkSize.domain([d3.min(vals), d3.max(vals)]);

var textOffset = 15;
var diagonal = d3.svg.diagonal()
  .source(function (d) {
    return {'x': d.source.x, 'y': d.source.y + (d.source.y < d.target.y ? textOffset : -textOffset)};
  })
  .target(function (d) {
    return {'x': d.target.x, 'y': d.target.y - (d.source.y < d.target.y ? textOffset : -textOffset)};
  });

var width = 960, height = 500;

d3.select("body").append("h1").text(pattern);

var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);

svg.append("svg:defs").selectAll("marker")
    .data(["defaultmarker"])
  .enter().append("svg:marker")
    .attr("id", String)
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 0)
    .attr("refY", 5)
    .attr("markerWidth", 4)
    .attr("markerHeight", 3)
    .attr("markerUnits", "strokeWidth")
    .attr("orient", "auto")
  .append("svg:path")
    .attr("d", "M0,0L10,5L0,10z");

var labelAnchors = [];
var labelAnchorLinks = [];

nodedata.forEach(function (node, i) {
  labelAnchors.push({"node": node});
  labelAnchors.push({"node": node});
  labelAnchorLinks.push({
    source : i * 2,
    target : i * 2 + 1,
    weight : 1
  });
});

var force = d3.layout.force().size([width, height])
    .distance(100)
    .charge(-200)
    .gravity(0.1)
    .nodes(nodedata)
    .links(edgedata)
    .start();

var force2 = d3.layout.force().nodes(labelAnchors).links(labelAnchorLinks).gravity(0).linkDistance(0).linkStrength(10).charge(-80).size([width, height]);
force2.start();

var node = svg.selectAll(".node")
    .data(nodedata)
  .enter().append("svg:circle")
    .attr("class", "node")
    .attr("r", "3");


var link = svg.selectAll(".link")
    .data(edgedata)
  .enter().append("path")
    .attr("class", "link")
    .style("stroke-width", function (d) { return linkSize(+d.weight);})
    .style("stroke", "#000")
    .attr("d", diagonal)
    .attr("marker-end", "url(#defaultmarker)");

// node.append("text")
//     .attr("dx", 0)
//     .attr("dy", ".35em")
//     .style("font-size", function (d) { return fontSize(+d.freq); })
//     .text(function(d) { return d.name; });

var anchorLink = svg.selectAll("line.anchorLink").data(labelAnchorLinks);

var anchorNode = svg.selectAll("g.anchorNode").data(labelAnchors).enter().append("svg:g").attr("class", "anchorNode");
anchorNode.append("svg:text")
    .attr("dx", 0)
    // .attr("dy", ".35em")
    .attr("text-anchor", "middle")
    .style("font-size", function (d) { return fontSize(+d.freq); })
    .text(function(d, i) { return i % 2 == 0 ? "" : d.node.name; });



var updateLink = function(selection) {
  selection.attr("x1", function(d) { return d.source.x; })
    .attr("y1", function(d) { return d.source.y; })
    .attr("x2", function(d) { return d.target.x; })
    .attr("y2", function(d) { return d.target.y; });
};

var updateNode = function(selection) {
  selection.attr("transform", function(d) {
    var freq = ("freq" in d) ? d.freq : d.node.freq;
    d.x = Math.max(fontSize(+freq), Math.min(d.x, width - fontSize(+freq)));
    d.y = Math.max(fontSize(+freq), Math.min(d.y, height - fontSize(+freq)));
    return "translate(" + d.x + "," + d.y + ")";
    // return "translate(" + d.x + "," + d.y + ")";
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
      var b = this.childNodes[0].getBBox();

      var diffX = d.x - d.node.x;
      var diffY = d.y - d.node.y;

      var dist = Math.sqrt(diffX * diffX + diffY * diffY);

      var shiftX = b.width * (diffX - dist) / (dist * 2);
      shiftX = Math.max(-b.width, Math.min(0, shiftX));
      var shiftY = 5;
      this.childNodes[0].setAttribute("transform", "translate(" + shiftX + "," + shiftY + ")");
    }
  });


  anchorNode.call(updateNode);

  link.attr("d", diagonal);
  anchorLink.call(updateLink);

});

// force.on("tick", function() {
//   link.attr("d", diagonal);

//   node.attr("transform", function(d) {
//     d.x = Math.max(fontSize(+d.freq), Math.min(d.x, width - fontSize(+d.freq)));
//     d.y = Math.max(fontSize(+d.freq), Math.min(d.y, height - fontSize(+d.freq)));
//   return "translate(" + d.x + "," + d.y + ")"; });
// });
