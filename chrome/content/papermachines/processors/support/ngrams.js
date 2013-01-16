var m = [80, 80, 80, 80]; // margins
var w = 1000 - m[1] - m[3]; // width
var h = 400 - m[0] - m[2]; // height


data = d3.entries(data);

times = times.map(function (d) { return new Date(d);});
var x = d3.time.scale().domain(d3.extent(times)).range([0, w]);
var y = d3.scale.linear().domain([0, maxFreq]).range([h, 0]);

var line = d3.svg.line()
	.x(function(d, i) { 
		return x(times[i]);
	})
	.y(function(d) { 
		return y(d); 
	});

var graph = d3.select("body").append("svg:svg")
      .attr("width", w + m[1] + m[3])
      .attr("height", h + m[0] + m[2])
    .append("svg:g")
      .attr("transform", "translate(" + m[3] + "," + m[0] + ")");

var xAxis = d3.svg.axis().scale(x).tickSize(-h).tickSubdivide(true);
graph.append("svg:g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + h + ")")
      .call(xAxis);

var yAxisLeft = d3.svg.axis().scale(y).ticks(4).orient("left");
graph.append("svg:g")
      .attr("class", "y axis")
      .attr("transform", "translate(-25,0)")
      .call(yAxisLeft);

graph.selectAll("path.line")
	.data(data)
	.enter().append("svg:path")
		.attr("class", function (d) { return "line " + d.key; })
		.attr("d", function (d) { return line(d.value); })
	.append("svg:title")
		.text(function (d) { return d.key; });