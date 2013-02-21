var m = [80, 80, 80, 80]; // margins
var w = 1000 - m[1] - m[3]; // width
var h = 400 - m[0] - m[2]; // height

var smoothing = "mean",
	windowSize = 1;

maxFreq = 0.0;

// smooth data

for (var i in data) {
	var d = data[i];
    var smoothed = [];
    for (var j = 0, n = d.length; j < n; j++) {
      var sample = [];
      for (var k = -windowSize; k <= windowSize; k++) {
        if (j+k >= 0 && j+k < n) {
          sample.push(d[j + k]);              
        } else {
          sample.push(d[j]);
        }
      }
      if (smoothing == "median") {
        smoothed.push(d3.median(sample));            
      } else if (smoothing == "mean") {
        smoothed.push(d3.mean(sample));            
      }
    }
    for (var j = 0, n = d.length; j < n; j++) {
    	d[j] = smoothed[j];
    }
    var max_for_d = d3.max(d);
    if (max_for_d > maxFreq) maxFreq = max_for_d;
}

times = times.map(function (d) { return new Date(d);});


data = d3.entries(data);
for (var i in data) {
	var new_data = [];
	for (var j = 0; j < data[i].value.length; j++) {
		var e = {'x': times[j], 'y': data[i].value[j]};
		new_data.push(e);
	}
	data[i].value = new_data;
}


// for (var i in data) {
// 	data[i].active = false;
// }

var x = d3.time.scale().domain(d3.extent(times)).range([0, w]);
var y = d3.scale.linear().domain([0, maxFreq]).range([h, 0]);

var line = d3.svg.line()
	.interpolate("basis")
	.x(function(d) { 
		return x(d.x);
	})
	.y(function(d) { 
		return y(d.y); 
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

function sanitizeKey(text) {
	return text.replace(/\W+/g, '_');
}
graph.selectAll("path.line")
	.data(data)
	.enter().append("svg:path")
		.attr("class", function (d) { return "line " + sanitizeKey(d.key); })
		.attr("d", function (d) { return line(d.value); })
		.style("display", "none")
	.append("svg:title")
		.text(function (d) { return d.key; });

function activate(key) {
	graph.selectAll("path.line." + sanitizeKey(key))
		.style("display", "block");
}
function deactivate(key) {
	graph.selectAll("path.line." + sanitizeKey(key))
		.style("display", "none");
}

function deactivateAll() {
	graph.selectAll("path.line")
		.style("display", "none");	
}

function onNgramSelect() {
	var selectObj = document.getElementById("ngramSelector");
	var idx = selectObj.selectedIndex;
	var ngram = selectObj.options[idx].value;
	deactivateAll();
	activate(ngram);
}

function generateList() {
	var keys = [];
	for (var i in data) {
		keys.push(data[i].key);
	}

	var sel = document.createElement("select");
	sel.id = "ngramSelector";
	sel.onchange = onNgramSelect;

	keys.forEach(function(key) {
		var opt = document.createElement("option");
		opt.value = sanitizeKey(key);
		opt.text = key;
		sel.add(opt, null);
	});

	var div = document.createElement("div");
	var label = document.createElement("div");
	var labeltext = document.createTextNode("Select ngram:");
	label.style.float = "left";
	label.appendChild(labeltext);
	div.appendChild(label);
	div.appendChild(sel);
	document.body.appendChild(div);
}

window.onload = generateList;