var fontSizeRange = data["FONTSIZE"];
var fontSizes = {};

var color = d3.scale.category10().domain(d3.range(10));
var randomColor = function (d) { return color(~~(Math.random() * 7)); };
var colorWord = function () { return randomColor(); };
var width = data["WIDTH"], height = data["HEIGHT"];

var clouds = data["CLOUDS"];
var order = data["ORDER"];
var cloudVis = {}, cloudHash = {};
var comparison_type = data["COMPARISON_TYPE"];
var format;

if (comparison_type == "tfidf") {
  format = "tf-idf:{0}";
} else if (comparison_type == "mww") {
  format = "\u03c1:{0}";
  colorWord = function (d) {
    return d > 0.5 ? randomColor() : "#ccc";
  };
} else if (comparison_type == "dunning") {
  format = "G\u00b2: {0}";
  colorWord = function (d) {
    return d > 0 ? randomColor() : "#ccc";
  };
} else {
  format = '{0} occurrences in subset';
}

function valueformat(value) {
  if (value === undefined) return '';
  return format.replace("{0}", value.toString());
}

for (var i in order) {
  cloudVis[order[i]] = d3.select("body").append("svg")
      .attr("width", width)
      .attr("height", height + 16)
    .append("g")
      .attr("transform", "translate(" + width/2 + "," + height/2 + ")");
}

function draw(label, words) {
  var vis = cloudVis[label];
  vis.selectAll("text.cloud")
      .data(words)
    .enter().append("text")
      .style("font-size", function(d) { return d.size + "px"; })
      .attr("text-anchor", "middle")
      .attr("data-value", function (d) { return cloudHash[label][d.text];})
      .attr("class", "cloud")
      .style("fill", function (d) { return colorWord(this.getAttribute("data-value")); })
      .attr("transform", function(d) {
        return "translate(" + [d.x, d.y] +")rotate(" + d.rotate + ")";
      })
      .text(function(d) { return d.text; })
      .append("svg:title").text(function (d) { return valueformat(cloudHash[label][d.text])});
      // .filter(function (d) { return d.hasOwnProperty("original_text");})
      // .append("title")
      // .text(function (d) { return d.original_text; });

  vis.append("text")
    .attr("transform", "translate(0," + ((height/2)) + ")")
    .attr("class", "label")
    .attr("text-anchor", "middle")
    .text(label);

}  
order.forEach(function (i) {
  var data = clouds[i];
  cloudHash[i] = {};
  data.forEach(function (d) {
     cloudHash[i][d.text] = d.value;
  });
  var vals = data.map(function (d) { return +d.value});
  var valExtent = d3.extent(vals);
  var linear1 = d3.scale.linear().domain(valExtent).range([0,1]);
  var linear2 = d3.scale.linear().domain([0,1]).range(fontSizeRange);
  fontSizes[i] = function (d) {
    var scaled = Math.log(linear1(d) + 1) / Math.log(2);
    return linear2(scaled);
  };

  //d3.scale.log().range(fontSizeRange).domain(d3.extent(vals));

  var myDraw = function (thisLabel) {
    return function(words) { draw(thisLabel, words);};
  };
  var layout = d3.layout.cloud().size([width, height])
    .words(data)
    .timeInterval(10)
    .rotate(function() { return 0 }) //return ~~(Math.random() * 2) * 90; })
    .fontSize(function(d) { return fontSizes[i](+d.value); })
    .on("end", (myDraw)(i))
    .start();
});