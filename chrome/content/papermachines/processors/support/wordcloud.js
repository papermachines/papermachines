var fontSize = d3.scale.log().range(data["FONTSIZE"]);

var color = d3.scale.category10().domain(d3.range(10));

var width = data["WIDTH"], height = data["HEIGHT"],
    word_data = data["DATA"];

function valueformat(value) {
  if (value === undefined) return '';
  return data["FORMAT"] ? data["FORMAT"].replace("{0}", value.toString()) : value;
}

var word_hash = {};
word_data.forEach(function (d) {
   word_hash[d.text] = valueformat(d.value);
});

var vals = word_data.map(function (d) { return +d.value});
fontSize.domain([d3.min(vals), d3.max(vals)]);

var layout = d3.layout.cloud().size([width, height])
    .words(word_data)
    .timeInterval(10)
    .rotate(function() { return ~~(Math.random() * 2) * 90; })
    .fontSize(function(d) { return fontSize(+d.value); })
    .on("end", draw)
    .start();

  function draw(words) {
    var drawn = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height)
      .append("g")
        .attr("transform", "translate(" + width/2 + "," + height/2 + ")")
      .selectAll("text")
        .data(words)
      .enter().append("g")
        .attr("transform", function(d) {
          return "translate(" + [d.x, d.y] +")rotate(" + d.rotate + ")";
        });

      drawn
        .append("text")
        .style("font-size", function(d) { return d.size + "px"; })
        .attr("text-anchor", "middle")
        .style("fill", function (d) { return color(~~(Math.random() * 10));})
        .text(function(d) { return d.text; });

      drawn
        .append("svg:title").text(function (d) { return word_hash[d.text];});
  }
