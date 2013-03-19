var _Sequence = function (onDone) {
  this.list = [];
  this.onDone = onDone;
};

_Sequence.prototype = {
  add: function() { 
    var args = Array.prototype.slice.call(arguments);
    this.list.push(args);
  },
  next: function() { 
    if (this.list.length > 0) {
      var current = this.list.shift();
      setTimeout(function () { (current.shift()).apply(this, current); }, 1);
    } else {
      if (typeof this.onDone == "function"){
        setTimeout(this.onDone, 250);
      }
    }
  }
};

var deferUntilSearchComplete = new _Sequence();

var timeFilter = function() { return true;};
var timeRanges;
var searchN = 0;
var graphColors = d3.scale.category10().domain(d3.range(10));

var gradientExponentScale = 0.3;
var gradientOpacity = d3.scale.pow().exponent(gradientExponentScale).clamp(true).range([1,0]);
var gradientBox, gradientDomain;

var legend, showLegend = 2;
var index = data["INDEX"];
var startDate, endDate;
var activeTopicLabels = [], inactiveTopicLabels = [];
var graph = {};

var indexTerms = d3.keys(index);

var docMetadata = data["DOC_METADATA"],
    categorical = data["CATEGORICAL"],
    topicCoherence = data["TOPIC_COHERENCE"],
    labels = data["TOPIC_LABELS"],
    topicProportions,
    topicStdevs;

var streaming = true,
    stacked = false,
    my,
    toggleState = categorical ? 3 : 0,
    width = 960,
    height = 500,
    smoothing = "mean",
    windowSize = 2,
    interpolateType = "monotone",
    wordClouds = {};

var graphTypes = {0: "stream", 1: "stacked area", 2: "line (std. dev. from mean)", 3: "categorical"};

var maxStdDev = 3;

var intervalType = "year";
var interval = d3.time[intervalType];

function getIntervalName (date) {
  return interval.floor(date).toISOString();
}

var origTopicTimeData,
    dataSummed,
    xAxis,
    categories,
    legendLabels,
    topicLabels = null,
    topicLabelsSorted,
    sortMetric = 0, 
    total = 1;

var intervalsObj = {};
function binDocsIntoIntervals() {
  var topics_n, timeframe, intervals = [];
  for (var itemID in docMetadata) {
    var item = docMetadata[itemID],
        date_str = item.date,
        date_stripped = date_str.split(' ')[0].substring(0,10).replace(/-00/g, '-01'),
        date;
    if (!item.hasOwnProperty("topics")) continue;
    try { 
      date = new Date(date_stripped);
    } catch (e) { console.log(e); }

    if (date instanceof Date && isFinite(date)) {
      var my_interval = interval.floor(date),
          interval_name = getIntervalName(my_interval);
      intervals.push(my_interval);
      if (!(intervalsObj.hasOwnProperty(interval_name))) {
        intervalsObj[interval_name] = [];
      }
      intervalsObj[interval_name].push(itemID);
    }
    if (!topics_n) {
      topics_n = Object.keys(item.topics).length;
    }
  }
  timeframe = d3.extent(intervals);
  var interval_bins = interval.range(timeframe[0], interval.offset(timeframe[1], 1));
  var interval_names = interval_bins.map(getIntervalName);
  var intervals_n = interval_bins.length;
  topicProportions = new Array(topics_n);
  topicStdevs = new Array(topics_n);
  origTopicTimeData = [];
  for (var i = 0, n = topics_n; i < n; i++) {
    origTopicTimeData.push(new Array(intervals_n));
    for (var j = 0, m = intervals_n; j < m; j++) {
      var items = intervalsObj[interval_names[j]];
      origTopicTimeData[i][j] = {"topic": i,
        "x": interval_bins[j],
        "y": []
      };
      if (items) {
        items.forEach(function (itemID) {
          origTopicTimeData[i][j].y.push({"itemID": itemID, "ratio": docMetadata[itemID].topics[i] || 0});
        });       
      }
    }
  }
}

var sortMetrics = {
  0: {"text": "most common"},
  1: {"text": "most variable"},
  2: {"text": "most coherent"}
};
var dateParse = d3.time.format("%Y").parse;

var offsetLeft = 0,
    marginVertical = 0;

var x = d3.time.scale()
    .range([0, width]);

var xOrdinal = d3.scale.ordinal()
    .rangePoints([100, width - 100]);

var y = {"domain": function (range) {
  for (var i in graph) {
    graph[i].y.domain(range);
  }}
};

var y0, y1;

var bars;

createMenuOfGraphs();
createSortingMenu();
generateTimeSearch();
createGraphObject(0);

var vis = d3.select("#chart")
  .append("svg:svg")
    .attr("width", width + offsetLeft + 25)
    .attr("height", height + 50);

var defs = vis.append("svg:defs");

vis = vis.append("svg:g")
    .on("click", getDocs);

var graphGroup = vis.append("svg:g").attr("id", "graphGroup");
var axesGroup = vis.append("svg:g").attr("id", "axesGroup");
var legendGroup = vis.append("svg:g").attr("id", "legendGroup");
var wordCloudGroup = vis.append("svg:g").attr("id", "wordCloudGroup")
  .attr("transform", "translate(0," + (height - 100) + ")");

binDocsIntoIntervals();
dataSummed = [];
graph[0].active = true;
sumUpData(0);

y.domain([-maxStdDev, maxStdDev]);

startDate = graph[0].data[0][0].x;
endDate = graph[0].data[0][graph[0].data[0].length - 1].x;

x.domain([startDate, endDate]);
xOrdinal.domain(d3.keys(categories));


topicLabels = {};
for (i in labels) {
  // if (labels[i].allocation_ratio > 0.0) {
    topicLabels[i] = labels[i];
    topicLabels[i]["active"] = true;
  // }
}

xAxis = d3.svg.axis()
  .scale(x)
  // .ticks(interval.range, 10)
  .tickSubdivide(1)
  .tickSize(-height, -height);


xOrdinalAxis = d3.svg.axis()
  .scale(xOrdinal);

mostCommonTopics(5);

transition();
setStartParameters();

function onGraphSelect() {
  var selectObj = document.getElementById("graphSelector");
  var idx = selectObj.selectedIndex;
  toggleState = parseInt(selectObj.options[idx].value);
  transition();
}
function selectGraphState(state) {
  var sel = document.getElementById("graphSelector");
  for (var i in sel.options) {
    var val = parseInt(sel.options[i].value);
    if (val == state) {
      sel.selectedIndex = i;
    }
  }
}

function createMenuOfGraphs () {
  var sel = document.createElement("select");
  sel.id = "graphSelector";
  sel.onchange = onGraphSelect;

  var graphTypeKeys = Object.keys(graphTypes);
  graphTypeKeys.sort();
  graphTypeKeys.forEach(function(type) {
    var opt = document.createElement("option");
    opt.value = type;
    opt.text = graphTypes[type];
    sel.add(opt, null);
  });

  var div = document.createElement("div");
  var label = document.createElement("div");
  var labeltext = document.createTextNode("Graph type:");
  label.style.float = "left";
  label.appendChild(labeltext);
  div.appendChild(label);
  div.appendChild(sel);
  document.getElementById("searches").appendChild(div);
}

function onSortSelect() {
  var selectObj = document.getElementById("sortSelector");
  var idx = selectObj.selectedIndex;
  sortMetric = parseInt(selectObj.options[idx].value);
  topicLabelsSorted = Object.keys(topicLabels).sort(sortMetrics[sortMetric]["func"]);

  updateActiveLabels();
  updateLegend();
}

function selectSortMetric(metric) {
  var sel = document.getElementById("sortSelector");
  for (var i in sel.options) {
    var val = parseInt(sel.options[i].value);
    if (val == metric) {
      sel.selectedIndex = i;
    }
  }
}


function createSortingMenu () {
  var sel = document.createElement("select");
  sel.id = "sortSelector";
  sel.onchange = onSortSelect;

  var sortMetricKeys = Object.keys(sortMetrics);
  sortMetricKeys.sort();
  sortMetricKeys.forEach(function(type) {
    var opt = document.createElement("option");
    opt.value = type;
    opt.text = sortMetrics[type]["text"];
    sel.add(opt, null);
  });

  var div = document.createElement("div");
  var label = document.createElement("div");
  var labeltext = document.createTextNode("Sort topics by:");
  label.style.float = "left";
  label.appendChild(labeltext);
  div.appendChild(label);
  div.appendChild(sel);
  document.getElementById("searches").appendChild(div);
}


function doToggle(state) {
  switch(state) {
    case 0: // streamgraph 
      streaming = true;
      stacked = false;
      categorical = false;
      break;
    case 1: // stacked area graph
      streaming = true;
      stacked = true;
      categorical = false;
      break;
    case 2: // line graph of standard deviations
      streaming = false;
      stacked = false;
      categorical = false;
      break;
    case 3: // bar graph of each subcategory
      streaming = false;
      stacked = false;
      categorical = true;
  }
}
function transition() {
  if (toggleState == 3 && d3.keys(categories).length > 50) {
    toggleState = 0;
  }
  doToggle(toggleState);

  for (var i in graph) {
    if (streaming && !stacked) {
      graph[i].layout.offset("silhouette");
    }
    else if (stacked) {
      graph[i].layout.offset("zero");
    }
  }


  if (streaming) {
    createGradientScale();
  } else {
    d3.select("#gradientScale").remove();
  }

  updateActiveLabels();

  var my_graphs = [];
  for (var i in graph) {
    sumUpData(i);
    setGraphPositions();
    if (streaming) {
      graph[i].streamData = graph[i].layout(graph[i].data);
    }
  }

  if (streaming) {
    for (var i in graph) {
      if (graph[i].active) {
        my_graphs.push(d3.max(graph[i].streamData, function(d) {
            return d3.max(d, function(d) {
              return d.y0 + d.y;
            });
        }));
      }
    }
  }

  x.domain([startDate, endDate]);

  my = d3.max(my_graphs);

  if (!streaming) y.domain([-maxStdDev,maxStdDev]);
  else if (stacked) y.domain([0,1]);
  else y.domain([0, my]);

  resetColors();
  for (i in graph) {
    if (graph[i].active) createOrUpdateGraph(i);
    else graphGroup.selectAll("path.line.graph" + i.toString()).remove();
  }
  updateGradient();

  graphGroup.select("#density").remove();
  if (!categorical) {
    graphGroup.append("rect")
      .attr("id", "density")
      .style("fill", "url(#linearGradientDensity)")
      .style("pointer-events", "none")
      .attr("width", width)
      .attr("height", height);
  }

  refreshAxes();
  updateLegend();

}
function shuffle(array) {
    var tmp, current, top = array.length;

    if(top) while(--top) {
        current = Math.floor(Math.random() * (top + 1));
        tmp = array[current];
        array[current] = array[top];
        array[top] = tmp;
    }

    return array;
}

function resetColors(force) {
  var currentColors = activeTopicLabels.map(function (d) { return graphColors(d); });
  currentColors.sort();
  var anyRepeats = false;
  for (var i = 0, n = currentColors.length; i < n; i++) {
    if (currentColors[i] == currentColors[(i + 1) % n]) {
      anyRepeats = true;
    }
  }
  if (!anyRepeats && !force) {
    return;
  }

  // var newLabelColors = shuffle(activeTopicLabels.slice());
  var newLabelColors = activeTopicLabels.slice();
  if (newLabelColors.length <= 10) {
    graphColors = d3.scale.category10();
  } else {
    graphColors = d3.scale.category20();
  }
  graphColors.domain(newLabelColors);
  for (var i in wordClouds) {
    wordCloudGroup.select(".cloud" + i.toString()).transition().duration(250).style("fill", graphColors(i));
  }
}

function sumUpData(graphIndex) {
  graph[graphIndex].data = [];
  graph[graphIndex].categoricalData = [];
  categories = {};
  origTopicTimeData.forEach(function(d, i) { // for each topic
    if (topicLabels == null || i in topicLabels && topicLabels[i]["active"]) {
      d.forEach(function(e) { // for each interval
        e.y.forEach(function (f) { // for each item within interval
          var label = docMetadata[f.itemID]["label"];
          if (!categories.hasOwnProperty(label)) {
            categories[label] = {};
          }
          if (!categories[label].hasOwnProperty(i)) {
            categories[label][i] = {'x': label, 'topic': i, 'y': 0};
          }
        });
      });
    }
  });

  var firstRun = dataSummed.length == 0;

  var ordinalDocs = {};

  origTopicTimeData.forEach(function (d, i) { // for each topic
    if (topicLabels == null || i in topicLabels && topicLabels[i]["active"]) {
      var length = graph[graphIndex].data.push([]);
      d.forEach(function (e) { // for each interval
        if (timeFilter(e)) {
          var datum = {};
          datum.x = e.x;
          datum.topic = e.topic;
          datum.search = graphIndex;
          datum.y = 0.0;

          graph[graphIndex].contributingDocs[getIntervalName(e.x)] = []; 
          e.y.forEach(function (f) { // for each item within interval
            if (graph[graphIndex].searchFilter(f)) {
              graph[graphIndex].contributingDocs[getIntervalName(e.x)].push(f.itemID);              
              datum.y += f.ratio;
              var label = docMetadata[f.itemID]["label"];
              categories[label][i].y += f.ratio;
              if (!ordinalDocs.hasOwnProperty(label)) {
                ordinalDocs[label] = {};
              }
              ordinalDocs[label][f.itemID] = true;
            }
          });
          // if (!datum.y) console.log(e);

          graph[graphIndex].data[length - 1].push(datum);
        }
      });
    }
  });
  
  // if (firstRun) {
    for (var j in graph[graphIndex].data) {
      var i = graph[graphIndex].data[j][0].topic;
      findTopicProportionAndStdev(i, graph[graphIndex].contributingDocs, graph[graphIndex].data[j]);
    }    
  // }
  for (var label in ordinalDocs) {
    graph[graphIndex].contributingDocsOrdinal[label] = d3.keys(ordinalDocs[label]);    
  }


    graph[graphIndex].data.forEach(function (d,i) {
      d.forEach(function (e) {
        var docsForInterval = graph[graphIndex].contributingDocs[getIntervalName(interval.floor(e.x))];
        var s = (docsForInterval ? docsForInterval.length : 0) || 1;

        // s is both the total number of docs in a given interval and the sum of all topics
        // for that interval

        if (!streaming) { // find standard score
          e.y /= s;
          e.y -= topicProportions[d[0].topic];
          e.y /= topicStdevs[d[0].topic];

          // e.y is now a z-score for that topic

        } else {
          e.y /= s;
        }
      });
    });

    if (!categorical && smoothing) { // smooth using simple moving average/median
      graph[graphIndex].data.forEach(function (d,i) {
        var smoothed = [];
        for (var j = 0, n = d.length; j < n; j++) {
          var sample = [];
          for (var k = -windowSize; k <= windowSize; k++) {
            if (j+k >= 0 && j+k < n) {
              sample.push(d[j + k].y);              
            } else {
              sample.push(d[j].y);
            }
          }
          if (smoothing == "median") {
            smoothed.push(d3.median(sample));            
          } else if (smoothing == "mean") {
            smoothed.push(d3.mean(sample));            
          }
        }
        d.forEach(function (e, idx) {
          e.y = smoothed[idx];
        });
      });
    }

      var activeTopics = [];
      if (topicLabels != null) {
        for (var i in topicLabels) {
          if (topicLabels[i]["active"]) activeTopics.push(i);
        }
      } else {
        activeTopics = d3.range(origTopicTimeData.length);
      }
      for (var i in activeTopics) {
        graph[graphIndex].categoricalData.push([]);
      }

      var categoriesSorted = d3.keys(categories);
      categoriesSorted.sort();
      categoriesSorted.forEach(function (category) {
        var category_docs = graph[graphIndex].contributingDocsOrdinal[category] ? graph[graphIndex].contributingDocsOrdinal[category].length : 0;
        var s = category_docs || 1;
        for (var i in activeTopics) {
          var datum = categories[category][activeTopics[i]];
          if (datum) {
            datum.y /= s;
            graph[graphIndex].categoricalData[i].push(datum);
          }
        }
      });      

    if (firstRun) dataSummed = graph[graphIndex].data;
}

function showMore() {
  var _topics = topicLabelsSorted.slice();

  for (i in activeTopicLabels) {
    var idx = _topics.indexOf(activeTopicLabels[i]);
    _topics.splice(idx, 1);
  }

  _topics = _topics.slice(0,5);
  console.log(_topics);

  for (i in topicLabels) {
    topicLabels[i]["active"] = topicLabels[i]["active"] || _topics.indexOf(i) != -1;
  }
  transition();
}

function createOrUpdateGraph(i) {
  if (categorical) {
    createCategoricalGraph(i);
    return;
  }
  graphGroup.selectAll("g.layer").remove();
  var graphSelection = graphGroup.selectAll("path.line.graph" + i.toString())
    .data(streaming ? graph[i].streamData : graph[i].data, function(d) { return d[0].topic;});

  graphSelection
    .attr("stroke", function(d) { return !streaming ? graphColors(d[0].topic) : "#000"; })
    .style("fill", function(d) { return streaming ? graphColors(d[0].topic) : "none"; })
    .style("stroke-width", streaming ? "0.5" : "1.5")
    .style("stroke-opacity", streaming ? "0.5" : "1.0")
    .transition().duration(500).attr("d", streaming ? graph[i].area : graph[i].line);

  graphSelection.style("fill", function(d) { return streaming ? graphColors(d[0].topic) : "none"; });
  var graphEntering = graphSelection.enter();
    graphEntering.append("svg:path")
        .attr("class", function (d) { return "line graph" + i.toString() + " topic"+d[0].topic.toString(); })
        .attr("stroke", function(d) { return !streaming ? graphColors(d[0].topic) : "#fff"; })
        .style("fill", function(d) { return streaming ? graphColors(d[0].topic) : "none"; })
        .style("stroke-width", streaming ? "0.5" : "2")
        .style("stroke-opacity", "1")
        .style("stroke-dasharray", graph[i].dasharray)
        .on("mouseover", function (d) { highlightTopic(d[0]);})
        .on("mouseout", unhighlightTopic)
        .attr("d", streaming ? graph[i].area : graph[i].line)
        .append("svg:title")
          .text(function (d) { return topicLabels[d[0].topic]["label"]; });

  var graphExiting = graphSelection.exit();
  graphExiting.transition().duration(500).style("stroke-opacity", "0").remove();
  graph[i].graphCreated = true;
}

function createCategoricalGraph (i) {
  d3.layout.stack().offset("expand")(graph[i].categoricalData);
  my = d3.max(graph[i].categoricalData, function(d) {
      return d3.max(d, function(d) {
        return d.y0 + d.y;
      });
  });

  y0 = function(d) { return height - d.y0 * height / my; };
  y1 = function(d) { return height - (d.y + d.y0) * height / my; };

  var barWidth = (d3.max(xOrdinal.range()) - d3.min(xOrdinal.range())) / xOrdinal.domain().length / 3;

  graphGroup.selectAll("*").remove();
  var categoricalLayers = graphGroup.selectAll("g.layer").data(graph[i].categoricalData, function (d) { return d[0].topic; });
  categoricalLayers.style("fill", function(d) { return graphColors(d[0].topic);});

  categoricalLayers.exit().remove();

  categoricalLayers.enter().append("g")
      .attr("class", "layer")
      .style("fill", function(d) { return graphColors(d[0].topic);});

  bars = categoricalLayers.selectAll("g.bar.graph" + i.toString())
      .data(function (d) { return d;}, function (d) { return d.x + d.topic.toString(); });

  bars.selectAll("rect").transition()
      .delay(function(d, i) { return i * 10; })
      .attr("y", y1)
      .attr("height", function(d) { return y0(d) - y1(d); });

  bars.exit().remove();

  bars.enter().append("g")
      .attr("class", "bar graph" + i.toString())
      .attr("transform", function(d) { return "translate(" + (xOrdinal(d.x) - (barWidth / 2)) + ",0)"; })
      .on("click", getDocsForCategory)
    .append("rect")
      .attr("width", barWidth)
      .attr("x", 0)
      .attr("y", height)
      .attr("height", 0)
      .on("mouseover", function (d) { highlightTopic(d);})
      .on("mouseout", unhighlightTopic)
    .transition()
      .delay(function(d, i) { return i * 10; })
      .attr("y", y1)
      .attr("height", function(d) { return y0(d) - y1(d); });
}

function highlightTopic(e) {
//  return;
  var topic = e.topic;
  if (!topicLabels[topic].active) return;
  legend.style("fill-opacity", function (d) { return (d.topic == topic) ? 1.0 : (d.active ? 0.7 : 0.3);})
  for (i in graph) {
    var series = graphGroup.selectAll("path.line.graph" + i.toString());
    series.transition().style(streaming ? "fill-opacity": "stroke-opacity", function (d) {
        return (d[0].topic != topic) ? graph[i].defaultOpacity * 0.5 : graph[i].defaultOpacity;
      });

    if (categorical) {
      var bars = graphGroup.selectAll("g.bar.graph" + i.toString());
      bars.transition().style("fill-opacity", function (d) {
        return (d.topic != topic) ? graph[i].defaultOpacity * 0.5 : graph[i].defaultOpacity;
      });
    }

  }
}

function unhighlightTopic() {

  legend.style("fill-opacity", function (d) { return (d.active) ? 1.0 : 0.3;})
  for (i in graph) {
    var series = graphGroup.selectAll("path.line.graph" + i.toString());
    series.transition().style(streaming ? "fill-opacity" : "stroke-opacity", graph[i].defaultOpacity);
    if (categorical) {
      var bars = graphGroup.selectAll("g.bar.graph" + i.toString());
      bars.transition().style("fill-opacity", graph[i].defaultOpacity);
    }
  }
}

function refreshAxes() {
  if (axesGroup.select("g.x.axis").empty()) {
    var gXAxis = axesGroup.append("svg:g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(categorical ? xOrdinalAxis : xAxis);
  } else {
    axesGroup.select("g.x.axis").transition().duration(500).call(categorical ? xOrdinalAxis : xAxis);
  }

  if (categorical) {
    d3.select(".x.axis").selectAll("text")
    .attr("transform", function(d) {
        return "rotate(90)";
        // translate(" + this.getBBox().height/2 + "," +
        //     this.getBBox().width/2 + ")";
    });
  } else {
    d3.select(".x.axis").selectAll("text")
    .attr("transform", "");    
  }

  if (streaming && !stacked) {
    axesGroup.selectAll("g.y.axis").transition().duration(500).style("fill-opacity", 0);
    axesGroup.selectAll(".y.axis line").style("stroke-opacity", 0);
  } 
  if (categorical) {
    axesGroup.selectAll("g.y.axis").remove();
  }
  if ((!streaming || (streaming && stacked)) && !categorical) {
    axesGroup.selectAll("g.y.axis").remove();
    for (var i in graph) {
      if (axesGroup.selectAll("g.y.axis graph" +i.toString()).empty()) {
        axesGroup.append("svg:g")
        .attr("class", "y axis graph" +i.toString())
        .attr("transform", "translate(-15,0)")
        .call(graph[i].yAxis);        
      } else {
        axesGroup.select("g.y.axis graph" +i.toString()).transition().duration(500).style("fill-opacity", 1).call(graph[i].yAxis);        
      }
    }
    axesGroup.selectAll(".y.axis line").transition().duration(500).style("stroke-opacity", 1);
  }
}

function toggleTopic(d) {
  if (d3.event) {
    d3.event.preventDefault();
    d3.event.stopPropagation();
  }
  topicLabels[d.topic]["active"] = !topicLabels[d.topic]["active"];
  if (!topicLabels[d.topic]["active"] && d.topic in wordClouds) {
    delete wordClouds[d.topic];
    wordCloudGroup.select(".cloud" + d.topic).remove();
  }
  transition();
}

function wordCloudPositions (d, i) {
  return "translate(" + ((i+1)*310) + ",0)";
}

function displayFullTopic(d) {
  if (d3.event) {
    d3.event.preventDefault();
    d3.event.stopPropagation();
  }
  if (d.topic in wordClouds) {
    wordCloudGroup.selectAll(".cloud" + d.topic).remove();
    delete wordClouds[d.topic]
  } else {
    wordClouds[d.topic] = topicCloud(d.topic, wordCloudGroup);  
    wordCloudGroup.selectAll("g").attr("transform", wordCloudPositions)
  }
}

function updateActiveLabels() {
    activeTopicLabels = [], inactiveTopicLabels = [];

  if (topicLabelsSorted) {
    topicLabelsSorted.forEach(function(k) {
      if (topicLabels[k]["active"]) current = activeTopicLabels;
      else current = inactiveTopicLabels;
      current.push(k);
    });
  } else {
    for (var i in topicLabels) {
      if (topicLabels[i]["active"]) activeTopicLabels.push(i);
      else inactiveTopicLabels.push(i);
    }
  }
}
function updateLegend() {
  // legendGroup.select("#legend").remove();

  if (legendGroup.select("#legend").empty()) {
    legend = legendGroup.append("svg:g")
      .attr("id", "legend")
      // .attr("transform", "translate(" + (width/2 - 230 ) + ", 10)")
      .attr("transform", "translate(230,10)")
      .style("visibility", showLegend > 1 ? "visible" : "hidden");
  }

  var topics = [];
  var topicLabelsCurrent = activeTopicLabels.concat(inactiveTopicLabels);
  topicLabelsCurrent.forEach(function (i) {
    topics.push({'topic': i, 'label': topicLabels[i]['label'], 'active': topicLabels[i]["active"]});    
  });
  // legendLabels = vis.select("#legend").selectAll(".legend.label").remove();


  legend = legendGroup.select("#legend").selectAll(".legend.label").data(topics, function (d) { return d.topic;});

  legend.style("fill", legendLabelColor);

  var newLabels = legend.enter().append("svg:g")
      .attr("class", "legend label")
      .attr("transform", legendLabelPositions)
      .style("fill-opacity", function (d) { return (d.active) ? 1.0 : 0.3;})
      .style("fill", legendLabelColor)
      .on("mouseover", highlightTopic)
      .on("mouseout", unhighlightTopic)
      .on("click", toggleTopic)
      .on("contextmenu", displayFullTopic);
  newLabels.append("svg:circle")
      .attr("fill", "inherit")
      .attr("r", 5);
  newLabels.append("svg:text")
      .attr("transform", "translate(10, 0)")
      .attr("fill", "inherit")
      .attr("dy", "0.5em")
      .text(function(d) { return d.label})
      .append("svg:title")
      .text(function(d) { return (topicProportions[d.topic]*100.0).toFixed(2) + "% of corpus";});

  legendGroup.selectAll(".legend.label").transition().duration(500).attr("transform", legendLabelPositions)
      .style("fill-opacity", function (d) { return (d.active) ? 1.0 : 0.3;}); 

  legend.exit().remove();

}

function legendLabelColor(d) {
  return topicLabels[d.topic]["active"] ? graphColors(d.topic) : "#666666";
}

function legendLabelPositions (d) {
  var topic = d.topic,
    active = activeTopicLabels.indexOf(topic),
    i;

  if (active != -1) {
    i = active;
  } else {
    i = activeTopicLabels.length + inactiveTopicLabels.indexOf(topic);
  }
  var group = 10;
  return "translate(" + (Math.floor(i/group)*160) + "," + ((i % group)*15) + ")";
}

function legendToggle() {
  showLegend = (~~showLegend + 1) % 3; // 0 = all hidden, 1 = show legend, 2 = show legend and supporting docs scale
  updateLegend();
  var legend = d3.select("#legend");
  legend.style("visibility", showLegend > 0 ? "visible" : "hidden");
  var gradientScale = d3.select("#gradientScale");
  gradientScale.style("visibility", showLegend > 1 ? "visible" : "hidden");
}

function setStartParameters() {
  if (window.location.search != "") {
    var queryString = window.location.search.slice(1);
    var query = queryString.split("&");
    var query_obj = {};
    query.forEach(function (d) {
      var s = d.split("=");
      query_obj[s[0]] = decodeURIComponent(s[1]);
    });
    console.log(query_obj)
    for (i in query_obj) {
      if (i == "topics") {
        var topics = query_obj[i];
        topics = (topics.indexOf(",") != -1) ? topics.split(",") : [topics];

        for (i in topicLabels) {
          topicLabels[i].active = false;
        }
        for (i in topics) {
          topicLabels[topics[i]].active = true;
        }
      }
      else if (i == "legend") { 
        showLegend = parseInt(query_obj[i]) || 2;
      } else if (i == "compare") {
        for (var j = 1; j <= query_obj[i]; j++) { generateSearch(searchN++);}
      } else if (i == "popup") {
        deferUntilSearchComplete.add(getDocsForInterval, query_obj[i]);
      } else if (i == "state") {
        toggleState = parseInt(query_obj[i]);
        selectGraphState(toggleState);
      } else if (i == "sort") {
        sortMetric = parseInt(query_obj[i]);
        selectSortMetric(sortMetric);
      } else if (document.getElementById(i)) {
        document.getElementById(i).value = query_obj[i];
      }
    }
    // searchAction();
  } else {
    if (typeof tags === "object") {
      var tag_keys = Object.keys(tags);
      if (tag_keys && tag_keys.length > 0) {
        for (var i in tags) {
          index[i] = tags[i];
        }
        var tagsN = tag_keys.length;
        if (tagsN > 0 && tagsN < 5) {
          for (var i = 0; i < tagsN; i++) {
            generateSearch(searchN++, tag_keys[i]);
          }
        } 
      } else {
        generateSearch(searchN++);

      }
    } else {
      generateSearch(searchN++);    
    }
  }
  selectGraphState(toggleState);
  searchAction(); 
}

function save() {
  var url = "?";
  url += "&state="+(toggleState.toString());
  url += "&compare="+(searchN).toString();
  url += "&sort="+(sortMetric).toString();

  var fields = document.getElementsByTagName("input");
  for (i in fields) {
    if (fields[i].id != undefined) {
      var val = encodeURIComponent(fields[i].value);
      if (val != "") {
        url += "&" + fields[i].id+ "=" + val;
      }
    }
  }
  url += "&topics=" + Object.keys(topicLabels).filter(function (d) { return topicLabels[d].active;}).join(",");
  url += "&legend=" + showLegend;
  var popups = d3.selectAll(".popupHolder[display=block]");
  if (!popups.empty()) {
    url += "&popup=" + popups.attr("data-interval");  
  }

  for (var i in graph) {
    if (graph[i].active && graph[i].queryStr != "") {
      d3.select("svg").append("text")
        .text(graph[i].queryStr)
        .attr("x", 0)
        .attr("y", graph[i].baseline);
    }
  }

  saveSVG();
  window.location.href = url;
}

function reset() {
  location.href = window.location.pathname;
}

function compare() {
  generateSearch(searchN++);
}

function nMostTopicsByMetric(n, metric) {
  topicLabelsSorted = Object.keys(topicLabels).sort(metric);
  topicLabelsSorted.forEach(function (d, i) {
    topicLabels[d]["active"] = i < n;
  });
  transition();
}

function mostCoherentTopics(n) {
  if (Object.keys(topicCoherence).length > 0) {
    nMostTopicsByMetric(n, topicCoherenceSort);    
  } else {
    nMostTopicsByMetric(n, prevalenceSort);    
  }
}

function mostCommonTopics(n) {
  nMostTopicsByMetric(n, prevalenceSort);
}

function mostVariantTopics(n) {
  nMostTopicsByMetric(n, stdevSort)
}



sortMetrics[0]["func"] = prevalenceSort;
sortMetrics[1]["func"] = stdevSort;
sortMetrics[2]["func"] = topicCoherenceSort;

function topNCorrelatedTopicPairs(n) {
  var keys = d3.keys(topicCorrelations);
  var values = d3.values(topicCorrelations);
  var key_order = argmax(values, n);
  key_order.reverse();
  var descriptions = [];
  for (i in key_order) {
    var pair = keys[key_order[i]],
      split_pair = pair.split(','),
        a = split_pair[0],
        b = split_pair[1];
    var corr_str = '"' + topicLabels[a]['label'].join(', ') + '" and "' + topicLabels[b]['label'].join(', ') + '": ' + topicCorrelations[pair];
    descriptions.push(corr_str);
  }
  alert(descriptions.join("\n"));
}

function stdevSort(a, b) {
  return d3.max(dataSummed[b].map(function (e) { return e.y; })) - d3.max(dataSummed[a].map(function (e) { return e.y; }));
}
function prevalenceSort(a, b) {
  return topicProportions[b] - topicProportions[a];
}

function topicCoherenceSort(a, b) {
  if (topicCoherence[a] != 0 && topicCoherence[b] != 0) {
    return topicCoherence[b] - topicCoherence[a];
  } else {
    return topicCoherence[a] == 0 ? (topicCoherence[b] == 0 ? 0 : 1) : -1;
  }
}

function argmax(array, n) {
  if (n) {
    return argsort(array).slice(-n);
  } else {
    return array.indexOf(d3.max(array));    
  }
}

function argsort(array) {
  var indices = [];
  for (i in array) { indices.push(i); }
  indices.sort(function (a,b) { return d3.ascending(array[a], array[b]);});
  return indices;
}
function getDocs(d, i, p) {
  var mouse = [d3.event.pageX, d3.event.pageY];
  // var date = d3.time.year.floor(x.invert(mouse[0]));
  var intervalName = getIntervalName(x.invert(mouse[0]));

  getDocsForInterval(intervalName);
}

function getDocsForCategory(d) {
  var category = d.x;

  getSpecifiedDocs(category, xOrdinal, function (d) { return d; }, graph[0].contributingDocsOrdinal);
}

function getDocsForInterval(intervalName) {
  getSpecifiedDocs(intervalName, x, function (d) { return new Date(d); }, graph[0].contributingDocs);
}


function getSpecifiedDocs(xval, xfunc, xaccessor, contributing) {
  var i = 0;
  if (contributing.hasOwnProperty(xval)) {
    var docs = "";
    for (var doc in contributing[xval]) {
      var id = contributing[xval][doc];
      var title = docMetadata[id]["title"];
      if (title == "\t") title = id;
      var mainTopic = docMetadata[id]["main_topic"];
      var my_color = "#666";
      if (topicLabels[mainTopic] && topicLabels[mainTopic]["active"]) {
        my_color = graphColors(mainTopic);
      }
      docs += "<a style='color: " + my_color + ";' id='doc" + id + "' href='";

      if (id.indexOf("10.") != -1) {
        docs += "http://jstor.org/discover/" + id + "'>" 
      } else {
        docs += "zotero://select/item/" + id + "'>" 
      }
      docs += title + "</a><br/>";
    }
      
    d3.select("#popup" + i).html(docs);
    d3.select("#popupHolder" + i).style("display", "block");
    d3.select("#popupHolder" + i).style("left", xfunc(xaccessor(xval)) + "px");      
    d3.select("#popupHolder" + i).style("top", height/2 + "px");
    d3.select("#popupHolder" + i).attr("data-interval", xval);
  }
}

function createPopup(i) {
  var closeButton = document.createElement("button");
  closeButton.innerText = "x";
  closeButton.onclick = function () {
    d3.selectAll(".popupHolder").style("display", "none");
  };

  var popupHolder = document.createElement("div");
  popupHolder.id = "popupHolder" + i;
  popupHolder.className = "popupHolder";

  var popup = document.createElement("div");
  popup.id = "popup" + i;
  popup.className = "popup";

  popupHolder.appendChild(closeButton)
  popupHolder.appendChild(popup);
  return popupHolder;
}

function generateTimeSearch() {
  var form = document.createElement("form");
  form.id = "searchFormInitial";
  form.className = "search";
  form.action = "javascript:void(0);";

  var searchTimeLabel = document.createElement("label");
  searchTimeLabel.textContent = "Time:";
  searchTimeLabel.htmlFor = "searchTime0";
  searchTimeLabel.className = "searchLabel";

  var searchTime = document.createElement("input");
  searchTime.type = "text";
  searchTime.id="searchTime0";
  searchTime.alt="time";
  searchTime.className = "searchText";
  searchTime.onchange = searchAction;

  form.appendChild(searchTimeLabel);
  form.appendChild(searchTime);
  document.getElementById("searches").appendChild(form);
}

function generateSearch(i, initialValue) {
  var form = document.createElement("form");
  form.id = "searchForm" + i;
  form.className = "search";
  form.action = "javascript:void(0);";

  var searchid = "search" + i;
  var searchLabel = document.createElement("label");
  searchLabel.textContent = "Search " + (i + 1);
  searchLabel.htmlFor = searchid;
  searchLabel.className = "searchLabel";

  var search = document.createElement("input");
  search.type = "text";
  search.id = searchid;
  search.alt="enter to search";
  search.className = "searchText";
  if (initialValue) search.value = initialValue;
  search.onchange = searchAction;

  var searchAdd = document.createElement("button");
  searchAdd.innerHTML = "+";
  searchAdd.className = "searchAddRemove";
  searchAdd.type = "button";
  searchAdd.onclick = function () { generateSearch(searchN++) };

  form.appendChild(searchLabel);
  form.appendChild(search);
  form.appendChild(searchAdd);
  if (i != 0) {
    var searchRemove = document.createElement("button");
    searchRemove.innerHTML = "-";
    searchRemove.className = "searchAddRemove";
    searchRemove.type = "button";
    searchRemove.onclick = function () {
      var my_search = document.getElementById("search" + i);
      my_search.parentNode.parentNode.removeChild(my_search.parentNode);
      graph[i].active = false;
      searchN--;      
      searchAction();
    };
    form.appendChild(searchRemove);
  }

  document.getElementById("searches").appendChild(form);

  var popup = createPopup(i);
  document.getElementById("popupLayer").appendChild(popup);
  createGraphObject(i);
}


function createGraphObject(i) {
  graph[i] = {'searchFilter': function() { return true; }, 
    'data': null, 
    'defaultOpacity': 1.0 - (i/5.0), 
    'graphCreated': false,
    'results': null,
    'dasharray': i == 0 ? "" : 12 / (i+1),
    'contributingDocs': {},
    'contributingDocsOrdinal': {},
    'baseline': 0,
    'y': d3.scale.linear(),
    'layout': d3.layout.stack().offset("silhouette")
  };
  graph[i].line = (function (me) {
    return d3.svg.line()
      .interpolate(interpolateType)
      .x(function(d) { return x(d.x); })
      .y(function(d) { return me.y(d.y); });
    })(graph[i]);

  graph[i].area = (function (me) { 
    return d3.svg.area()
      .interpolate(interpolateType)
      .x(function(d) { return x(d.x); })
      .y0(function(d) { return me.y(d.y0); })
      .y1(function(d) { return me.y(d.y0 + d.y); });
  })(graph[i]);

  graph[i].yAxis = (function (me) {
    return d3.svg.axis()
      .scale(me.y)
      .orient("right")
      .ticks(5)
      .tickSize(width, width);
  })(graph[i]);
}

function setGraphPositions() {
  var totalHeight = height - (marginVertical * 2.0);
  var graphs_active = [];
  for (var i in graph) {
    if (graph[i].active) graphs_active.push(i);
  }

  for (var i = 0, n = graphs_active.length; i < n; i++) {
    var my_ambit = (totalHeight / n);
    var my_top = marginVertical + (my_ambit * i);
    var my_bottom = my_top + my_ambit;
    graph[graphs_active[i]].y.range([my_bottom, my_top]);
    graph[graphs_active[i]].baseline = (my_bottom + my_top)/2.0;
  }
}

function highlightItem(itemID) {
  getDocsForInterval(docMetadata[itemID]["interval"]);
  d3.select("#doc" + itemID.toString()).call(flash);
}

function flash(selection) {
    selection.transition().duration(2000)
      .ease("linear")
      .styleTween("fill-opacity", function (d, i, a) {
        return function (t) { 
          var x = (Math.sin(t * Math.PI * 4)) + 1;
          return x.toString(); 
        }
      });
}
function searchAction() {
  var queryTime = document.getElementById("searchTime0").value;
  if (queryTime == "") {
    timeFilter = function() { return true; }
    startDate = origTopicTimeData[0][0].x;
    endDate = origTopicTimeData[0][origTopicTimeData[0].length - 1].x;
  }
  else {
    var times = queryTime.split("-");
    startDate = dateParse(times[0]);
    endDate = dateParse(times[1]);
    timeFilter = function(d) {
      return d.x >= startDate && d.x <= endDate;
    };
  }

  var actives = 0;
  for (var i in graph) {
    if (document.getElementById("search" + i)) {
      graph[i].queryStr = document.getElementById("search" + i).value;
      if (graph[i].queryStr != "") {
        actives++;
      }      
    } else {
      graph[i].queryStr = "";
    }
  }
  for (var i in graph) {
    if (graph[i].queryStr == "" && actives > 0) {
      graph[i].active = false;
    } else {
      graph[i].active = true;
      actives++;
    }
  }

  for (var i = 0; i < searchN; i++ ) {
    if (graph[i].queryStr == "") {
      graph[i].searchFilter = function() { 
        return true; 
      };
    } else {
        var originalTerms = graph[i].queryStr.split(" ");
        var terms = {};
        graph[i].results = {};
        if (graph[i].queryStr in index) {
          terms[graph[i].queryStr] = true;          
        } else {
          for (var j in originalTerms) {
            var term = originalTerms[j];
            if (term in index) {
              terms[term] = true;
            } else {
              for (var k in indexTerms) {
                if (indexTerms[k].match(term)) {
                  terms[indexTerms[k]] = true;
                }
              }
            }
          }          
        }
        for (var term in terms) {
          for (var j in index[term]) {
            graph[i].results[index[term][j]] = true;
          }
        }

        graph[i].searchFilter = (function (graph) { return function (d) { return graph.results.hasOwnProperty(d.itemID) }; })(graph[i]);

        // var element = document.createElement("PaperMachinesDataElement");
        // element.setAttribute("query", graph[i].queryStr);
        // document.documentElement.appendChild(element);

        // me.searchCallback = function (search) {
        //   me.results = search;
        //   me.searchFilter = function (d) {
        //       return me.results.indexOf(parseInt(d.itemID)) != -1;
        //   };
        // };

        // document.addEventListener("papermachines-response", function(event) {
        //     var node = event.target, response = node.getUserData("response");
        //     document.documentElement.removeChild(node);
        //     document.removeEventListener("papermachines-response", arguments.callee, false);
        //     me.searchCallback(JSON.parse(response));
        //   }, false);

        // var evt = document.createEvent("HTMLEvents");
        // evt.initEvent("papermachines-request", true, false);
        // element.dispatchEvent(evt);

    }
  }
  setTimeout(function () {transition();}, 500);
  deferUntilSearchComplete.next();
}

function createGradientScale() {
  if (!gradientDomain) return;
  var my_range = d3.range(0, gradientDomain[1] + 0.2, 0.2);

  var gradientAxis = d3.svg.axis()
    .scale(d3.scale.linear().domain([0, gradientDomain[1]]).range([0,200]))
    .ticks(4)
    .tickFormat(d3.format("d"))
    .tickSize(0);

  d3.select("#gradientScale").remove();
  defs.select("#gradientScaleGradient").remove();

  defs.selectAll("#gradientScaleGradient").data([my_range]).enter().append("svg:linearGradient")
    .attr("id", "gradientScaleGradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%")
    .selectAll("stop").data(function (d) { return d; })
      .enter().append("svg:stop")
      .attr("offset", function (d) { return (d * 100.0 / gradientDomain[1]) + "%"; })
      .attr("stop-color", graphColors.range()[0])
      .attr("stop-opacity", function (d) { return 1 - gradientOpacity(d); });

  gradientBox = d3.select("#legendGroup").append("svg:g")
    .attr("id", "gradientScale")
    .attr("width", "200")
    .attr("height", "30")
    .attr("transform", "translate(10, 450)");

//  .attr("transform", "translate(" + ((width/2) - 100) + "," + (height - 100) + ")");
  gradientBox.append("svg:text")
    .attr("x", "100")
    .attr("y", "-10")
    .style("fill", "#000")
    .attr("text-anchor", "middle")
    .text("Supporting Documents");

  gradientBox.append("svg:rect")
      .attr("width", "200")
      .attr("height", "20")
      .style("stroke", "#666")
      .style("fill", "url(#gradientScaleGradient)");

  gradientBox.append("svg:g")
    .style("fill", "#000")
    .style("stroke", "none")
    .attr("transform", "translate(0,20)")
    .call(gradientAxis);
}

function updateGradient() {
  defs.select("#linearGradientDensity").remove();
  var docNumbers = [],
      intervalsObj = {};

  for (var i in graph) {
    if (graph[i].active) {
      for (var intervalName in graph[i].contributingDocs) {
        intervalsObj[intervalName] = {};
        graph[i].contributingDocs[intervalName].forEach(function (doc) {
          intervalsObj[intervalName][doc] = true;
        });
      }      
    }
  }
  var intervals = d3.keys(intervalsObj);
  intervals.sort();
  intervals.forEach(function (intervalName) {
    var intervalDate = new Date(intervalName);
    if (intervalDate >= startDate && intervalDate < endDate) {
      var sum = Object.keys(intervalsObj[intervalName]).length;
      docNumbers.push({"percentage": 100.0 * (intervalDate - startDate) / (endDate - startDate), "value": sum});
    }
  });

  gradientDomain = d3.extent(docNumbers.map(function(d) { return d.value;}));
  gradientOpacity.domain([0, gradientDomain[1]]);
  var gradients = defs.selectAll("#linearGradientDensity").data([docNumbers]);
  gradients.enter().append("svg:linearGradient")
      .attr("id", "linearGradientDensity")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%")
      .selectAll("stop").data(function (d) { return d; })
        .enter().append("svg:stop")
          .attr("offset", function (d, i) { return (d.percentage) + "%"; })
          // .attr("offset", function (d, i) { return (i * 100.0 / this.parentNode.__data__.length) + "%"; })
          .attr("stop-color", "#fff")
          .attr("stop-opacity", function (d) { return gradientOpacity(d.value); });
}

function topicCloud(i, parent) {
  var topicWords = topicLabels[i]["fulltopic"]
      cloudW = 300,
      cloudH = 150,
      cloudFontSize = d3.scale.log().domain(d3.extent(topicWords.map(function (d) { return +d.prob; }))).range([8,32]),
      cloud = d3.layout.cloud()
        .size([cloudW, cloudH])
        .padding(5)
        .words(topicWords)
        .rotate(0)
        .fontSize(function(d) { return cloudFontSize(d.prob); })
        .on("end", draw)
        .start();

  function draw(words) {
    if (parent.empty()) {
      parent = d3.select("body").append("svg")
        .attr("width", cloudW)
        .attr("height", cloudH);
    }
    parent.append("g")
        .attr("class", "cloud" + i.toString())
        .attr("transform", "translate(" + cloudW/2 + "," + cloudH / 2 + ")")
        .style("fill", graphColors(i))
      .selectAll("text")
        .data(words)
      .enter().append("text")
        .style("font-size", function(d) { return d.size + "px"; })
        .attr("text-anchor", "middle")
        .attr("transform", function(d) {
          return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
        })
        .text(function(d) { return d.text; });
  }

  return parent.select("g.cloud" + i.toString());
}

function findTopicProportionAndStdev(i, contributingDocs, intervals_data) {
  var vals = intervals_data.map(function (d) { var total = contributingDocs[getIntervalName(d.x)].length || 1; return d.y / total;});
  topicProportions[i] = d3.mean(vals);
  var variances = vals.map(function (val) { return Math.pow(val - topicProportions[i], 2); });
  topicStdevs[i] = Math.sqrt((1.0 / (vals.length - 1.0)) * d3.sum(variances));
}

function changeGradientScale(val) {
  gradientExponentScale = val;
  gradientOpacity.exponent(gradientExponentScale);
  updateGradient();
  createGradientScale();
}
function saveSVG() {
  var xml = "<svg xmlns='http://www.w3.org/2000/svg'><style>";
    for (i in document.styleSheets)
          for (j in document.styleSheets[i].cssRules)
            if (typeof(document.styleSheets[i].cssRules[j].cssText) != "undefined")
              xml += document.styleSheets[i].cssRules[j].cssText;

    xml += "</style>";  
    xml += d3.select("svg")[0][0].innerHTML;
    xml += "</svg>";
    window.open("data:image/svg+xml," + encodeURIComponent(xml));
}