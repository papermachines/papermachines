var pattern = data["PATTERN"];
var nodedata = data["DATA"]['nodes'];
var edgedata = data["DATA"]['edges'];

var fontSize = d3.scale.log().range([10,32]);
var linkSize = d3.scale.linear().range([2,10]);

var vals = nodedata.map(function (d) { return +d.freq});
fontSize.domain([d3.min(vals), d3.max(vals)]);

vals = edgedata.map(function (d) { return +d.weight});
linkSize.domain([d3.min(vals), d3.max(vals)]);

var diagonal = d3.svg.diagonal()
  .source(function (d) {
    var b_s = d3.select("#node" + d.source.index.toString())[0][0].getBBox(),
        b_t = d3.select("#node" + d.target.index.toString())[0][0].getBBox();

    return {'x': d.source.x, 'y': d.source.y + (d.source.y < d.target.y ? b_s.height * 0.5 : b_s.height * -0.5)};

  })
  .target(function (d) {
    var b_s = d3.select("#node" + d.source.index.toString())[0][0].getBBox(),
        b_t = d3.select("#node" + d.target.index.toString())[0][0].getBBox();

    return {'x': d.target.x, 'y': d.target.y + (d.source.y < d.target.y ? b_t.height * -0.5 : b_t.height * 0.5)};

    // return {'x': d.target.x, 'y': d.target.y - (d.source.y < d.target.y ? textOffset : -textOffset)};
  });

var width = 1024, height = 768;

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

var force = d3.layout.force().size([width, height])
    .distance(100)
    .charge(-300)
    .gravity(0.15)
    .nodes(nodedata)
    .links(edgedata)
    .start();

var node = svg.selectAll(".node")
    .data(nodedata)
  .enter().append("svg:g")
    .attr("class", "node")
    .call(force.drag);

node.append("text")
    .attr("dx", 0)
    .attr("dy", ".35em")
    .style("font-size", function (d) { return fontSize(+d.freq); })
    .attr("id", function (d, i) { return "node" + i.toString();})
    .text(function(d) { return d.name; });

var link = svg.selectAll(".link")
    .data(edgedata)
  .enter().append("path")
    .attr("class", "link")
    .style("stroke-width", function (d) { return linkSize(+d.weight);})
    .style("stroke", "#000")
    .attr("d", diagonal)
    .attr("marker-end", "url(#defaultmarker)");


force.on("tick", function() {
  link.attr("d", diagonal);

  // var q = d3.geom.quadtree(nodedata),
  //   i = 0,
  //   n = nodedata.length;
  // while (++i < n) {
  //   q.visit(collide(nodedata[i]));
  // }

  node.attr("transform", function(d) {
    d.x = Math.max(fontSize(+d.freq), Math.min(d.x, width - fontSize(+d.freq)));
    d.y = Math.max(fontSize(+d.freq), Math.min(d.y, height - fontSize(+d.freq)));
  return "translate(" + d.x + "," + d.y + ")"; });
});

function collide(d) {
  var b = d3.select("#node" + d.index.toString())[0][0].getBBox(),
    nx1 = b.x,
    nx2 = b.x + b.width,
    ny1 = b.y,
    ny2 = b.y + b.height;

  return function (quad, x1, y1, x2, y2) {
    if (quad.point && (quad.point !== d)) {
      var b2 = d3.select("#node" + quad.point.index.toString())[0][0].getBBox(),
        ox1 = b2.x,
        ox2 = b2.x + b2.width,
        oy1 = b2.y,
        oy2 = b2.y + b2.height,
        x = nx1 - ox1,
        y = ny1 - oy1;

      if (nx1 <= ox2 && ox1 <= nx2) { // overlap in x's
        d.x += x * 0.005;
        quad.point.x -= x * 0.005;
      }

      if (ny1 <= oy2 && oy1 <= ny2) { // overlap in y's
        d.y += y * 0.005;
        quad.point.y -= y * 0.005;
      }
    }

    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
  };
}