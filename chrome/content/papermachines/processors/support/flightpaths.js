var linksByYear = data["LINKS_BY_YEAR"];
var entityURIs = data["ENTITYURIS"];
var startDate = data["STARTDATE"];
var endDate = data["ENDDATE"];
var doc_metadata = data["DOC_METADATA"];

var map;
var circleOverlay, arcOverlay;
var lastMax = 0;
var circleScale = d3.scale.linear().clamp(true).domain([1,2]).range([5, 30]);
var originColors = d3.scale.category10(); // d3.scale.ordinal().range(["#3E4095", "#00A859", "#FFCC29"]);
var origin_labels;
var animating;
var animationInterval = 250;
var linksByText = {};
var legend = d3.select("#legend");
var legend_m = [30, 30, 30, 30], // margins
    legend_w = 240 - legend_m[1] - legend_m[3], // width
    legend_h = 340 - legend_m[0] - legend_m[2]; // height

var yearTaper = d3.scale.linear().domain([0, 20]).range([0,1]);
var link_polylines = {};

function geoid(uri) {
  return uri.split('/').slice(-1)[0];
}
function yearStillShowing(year){
  return endDate == year;
  // return endDate - year >= 0 && endDate - year < 20;
}

function fadeWithTime(d) {
  return 0.8; //* yearTaper(endDate - d.year);
}

var playPause = function () {
  if (animating) {
    clearInterval(animating);
    animating = false;
    document.getElementById("playPause").textContent = "\u25b6";
  } else {
    var searchTime = document.getElementById("searchTime"),
      now = parseInt(searchTime.value),
      min = parseInt(searchTime.min),
      max = parseInt(searchTime.max);
    if (now == max) {
      searchTime.value = min;
    }
    document.getElementById("playPause").textContent = "\u2759\u2759"; //.style("letter-spacing", "-2px")
    animating = setInterval(incrementTime, animationInterval);
  }
};

var incrementTime = function () {
  var searchTime = document.getElementById("searchTime"),
    now = parseInt(searchTime.value),
    max = parseInt(searchTime.max);
  if (now > (max - 1)) {
    playPause();
  } else {
    searchTime.value = (now + 1);
    timeAction();   
  }
};

var timeAction = function () {
  var queryTime = document.getElementById("searchTime").value;
  document.getElementById("timeDisplay").textContent = queryTime;
  endDate = parseInt(queryTime);
  updateCircleData();
  for (var year in link_polylines) {
    (function (displaying) {
      link_polylines[year].forEach(function (d) { 
        d.setVisible(displaying);

        if (displaying) {
          if (!(d.edge[0] in entityURIs[d.edge[1]].sources)) {
            entityURIs[d.edge[1]].sources[d.edge[0]] = 0;
          }
          entityURIs[d.edge[1]].sources[d.edge[0]] += 1;
        }
      });
    })(yearStillShowing(year)); //(year == endDate);
    // })(year >= startDate && ((startDate == endDate && year == endDate) || year < endDate));
  }
  circleOverlay.draw(true);
};

var updateCircleData = function () {
  var data = [], max = 0;
  for (var uri in entityURIs) {
    var d = entityURIs[uri];

    var sum = 0;
    for (var year in d.counts) {
      if (d.counts[year] > max) {
        max = d.counts[year];
      }
      // if (year >= startDate && ((startDate == endDate && year == endDate) || year < endDate)) {
      // if (year == endDate) {
      if (yearStillShowing(year)) {
        sum = d.counts[year];
        entityURIs[uri].year = year;
      }
    }
    // if (sum > max) { max = sum; }
    entityURIs[uri].sum = sum;
    entityURIs[uri].sources = {};
  }
  // if (max > lastMax) {
    // lastMax = max;
    circleScale.domain([1, max]);
    updateLegend();
  // }
};

window.onload = function(){
  var searchTime = document.getElementById("searchTime");
  searchTime.min = startDate;
  searchTime.max = endDate;
  searchTime.value = startDate;
  searchTime.onchange = timeAction;

  var playPauseButton = document.createElement("button");
  playPauseButton.id = "playPause"
  playPauseButton.className = "first last";
  playPauseButton.onclick = playPause;

  document.getElementById("searches").appendChild(playPauseButton);
  document.getElementById("playPause").textContent = "\u25b6";
  document.getElementById("timeDisplay").textContent = startDate;

  var myLatlng = new google.maps.LatLng(-15.6778, -47.4384);
  var myOptions = {
    zoom: 2,
    minZoom: 2,
    center: myLatlng,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    disableDefaultUI: false,
    scrollwheel: true,
    draggable: true,
    navigationControl: true,
    mapTypeControl: false,
    scaleControl: true,
    disableDoubleClickZoom: false
  };
  map = new google.maps.Map(document.getElementById("heatmapArea"), myOptions);
  
  circleOverlay = new CircleOverlay(map);
  arcOverlay = new ArcOverlay(map);
  
  document.getElementById("togLegend").onclick = function(){
    legend = d3.select("#legend");
    if (!legend.empty()) {
      if (legend.style("display") !== "none") {
        legend.style("display", "none");
      } else {
        legend.style("display", "block");      
      }      
    }   
  };
  
  // this is important, because if you set the data set too early, the latlng/pixel projection doesn't work
  google.maps.event.addListenerOnce(map, "idle", function(){
    updateCircleData();
    for (var entityURI in entityURIs) {
      var circle = circleOverlay.Circle(entityURI, entityURIs[entityURI]);
    }
    for (var year in linksByYear) {
        for (var i in linksByYear[year]) {
          var link = linksByYear[year][i];
          if (!(year in link_polylines)) {
            link_polylines[year] = [];
          }
          var line = arcOverlay.Arc(link.edge);

          link_polylines[year].push(line);

          link.texts.forEach(function (text) {
            if (!(text in linksByText)) { linksByText[text] = [];}
            linksByText[text].push(line);            
          });
        }
    }
    timeAction();
    arcOverlay.draw(true);
    circleOverlay.draw(true);

    buildLegend();

     google.maps.event.addListener(map, "idle", function () {
      arcOverlay.draw();
      circleOverlay.draw();
     });

  });
};

var globalArcId = 0;

function Arc(edge) {
  this.id = globalArcId++;
  this.edge = edge;
  var edgeCoords = edge.map(function (d) { return entityURIs[d]["coordinates"]; })
  this.source = edgeCoords[0];
  this.target = edgeCoords[1];
  this.showing = false;
}

function Circle(entityURI, entity) {
  this.id = entityURI;
  this.x = entity.coordinates[1];
  this.y = entity.coordinates[0];
  this.entity = entity;
  this.counts = entity.counts;
}

Arc.prototype.setVisible = function (display) {
  this.showing = display;
  d3.select("#arc" + this.id).style("display", display ? "block" : "none");
}

function ArcOverlay(map) {
  this.div_ = null;
  this.arcs = [];
  this.arc_paths = null;
  this.svg = null;
  this.bounds = null;

  this.greatArc = d3.geo.greatArc();

  this.setMap(map);
}

ArcOverlay.prototype = new google.maps.OverlayView();

ArcOverlay.prototype.Arc = function (edge) {
  var arc = new Arc(edge);
  this.arcs.push(arc);
  return arc;
};


ArcOverlay.prototype.onAdd = function() {
  var w = this.getMap().getDiv().clientWidth,
      h = this.getMap().getDiv().clientHeight;

  // Add the container when the overlay is added to the map.
  this.div_ = d3.select(this.getPanes().overlayLayer).append("div")
      .attr("class", "arcoverlay")
      .style("width", w + "px")
      .style("height", h + "px")
      .style("position", "absolute")
      .style("top", "0")
      .style("left", "0");
  this.svg = this.div_.append("svg")
    .attr("width", w + 500)
    .attr("height", h + 500);

  setGradient(this.svg);
}

ArcOverlay.prototype.draw = function(force) {
  var me = this;
  var projection = this.getProjection(),
      currentBounds = this.map.getBounds(),
      padding = 10;

  if (currentBounds.equals(this.bounds) && !force) {
    return;
  }

  function _projection(lat, lng) {
    var e = new google.maps.LatLng(lat, lng);
    e = projection.fromLatLngToDivPixel(e);
    e = new google.maps.Point(e.x - leftX, e.y - topY);

    // return [ e.x - padding, e.y - padding]
    return [e.x, e.y];
  }
  function transform_path(data) {
    var d = [];
    for(var i = 0; i < data.length; i++) {
      var c = _projection(data[i][1], data[i][0]);
      d.push(c);
    }
    return d;
  }

  function pathFromArc(d) {
    var e = transform_path(me.greatArc(d.value).coordinates);
    var p = 'M' + e.join('L') + 'Z';
    return p;
  }
  function colorArcsByOrigin(d) {
    return originColors(d.value.edge ? d.value.edge[0] : 0);
  }

  this.bounds = currentBounds;

  var ne = projection.fromLatLngToDivPixel(currentBounds.getNorthEast()),
      sw = projection.fromLatLngToDivPixel(currentBounds.getSouthWest()),
      topY = ne.y,
      leftX = sw.x,
      h = sw.y - ne.y,
      w = ne.x - sw.x;

  this.div_.style("left", leftX + "px")
      .style("top", topY + "px")
      .style("width", w + "px")
      .style("height", h + "px");

  this.arc_paths = this.svg.selectAll("path.arc")
      .data(d3.entries(this.arcs))
      .attr("d", pathFromArc)
      .attr("fill", "none")      
      // .attr("stroke", "url(#fade)")
      .attr("stroke", colorArcsByOrigin)
      .attr("stroke-opacity", 0.5)
    .enter().append("path")
      .attr("d", pathFromArc)
      .attr("fill", "none")
      .attr("class", "arc")
      .attr("display", function (d) { return d.value.showing ? "block" : "none";})
      .attr("id", function (d) { return "arc" + d.value.id; })
      // .attr("stroke","url(#fade)")
      .attr("stroke", colorArcsByOrigin)
      .attr("stroke-opacity", 0.5);
};

function sanitize(key) {
  return key.replace(/[^\w]/g,'');
}

function CircleOverlay(map) {
  this.div_ = null;
  this.circles = {};
  this.positions = {};
  this.circles_svg = null;
  this.svg = null;
  this.bounds = null;
  this.setMap(map);
}

CircleOverlay.prototype = new google.maps.OverlayView();

CircleOverlay.prototype.Circle = function (entityURI, entity) {
  var circle = new Circle(entityURI, entity);
  this.circles[entityURI] = circle;
  return circle;
};

CircleOverlay.prototype.onAdd = function() {
  var w = this.getMap().getDiv().clientWidth,
      h = this.getMap().getDiv().clientHeight;

  // Add the container when the overlay is added to the map.
  this.div_ = d3.select(this.getPanes().overlayMouseTarget).append("div")
      .attr("class", "circleoverlay")
      .style("width", w + "px")
      .style("height", h + "px")
      .style("position", "absolute")
      .style("top", "0")
      .style("left", "0");

  this.svg = this.div_.append("svg")
    .attr("width", w + 500)
    .attr("height", h + 500);
};

CircleOverlay.prototype.draw = function(force) {
  var me = this;
  var projection = this.getProjection(),
      currentBounds = this.map.getBounds(),
      padding = 10;

  if (currentBounds.equals(this.bounds) && !force) {
    return;
  }

  this.bounds = currentBounds;

  var ne = projection.fromLatLngToDivPixel(currentBounds.getNorthEast()),
      sw = projection.fromLatLngToDivPixel(currentBounds.getSouthWest()),
      topY = ne.y,
      leftX = sw.x,
      h = sw.y - ne.y,
      w = ne.x - sw.x;

  this.div_.style("left", leftX + "px")
      .style("top", topY + "px")
      .style("width", w + "px")
      .style("height", h + "px");

  function _projection(lat, lng) {
    var e = new google.maps.LatLng(lat, lng);
    e = projection.fromLatLngToDivPixel(e);
    e = new google.maps.Point(e.x - leftX, e.y - topY);

    // return [ e.x - padding, e.y - padding]
    return [e.x, e.y];
  }

  function circleX(d) {
    me.positions[d.key] = _projection(d.value.x, d.value.y);
    return me.positions[d.key][0];
  }
  function circleY(d) {
    return me.positions[d.key][1];
  }

  function circleRadius(d) {
    var sum = entityURIs[d.key].sum || 1;
    return circleScale(sum);      
  }
  function colorBySources(d) {
    var color = d3.lab(0,0,0);
    var sources = d3.entries(entityURIs[d.key].sources);
    var colors_to_average = [];
    var total_refs = d3.sum(sources, function (d) { return d.value; });
    for (var i in sources) {
      var c = d3.lab(originColors(sources[i].key)),
          weight = (sources[i].value/total_refs);
      color.l += c.l * weight;
      color.a += c.a * weight;
      color.b += c.b * weight;
    }
    return color || originColors(originColors.domain()[0]);
  }

  this.circles_svg = this.svg.selectAll("circle")
      .data(d3.entries(this.circles))
      .attr("cx", circleX)
      .attr("cy", circleY)
      .attr("r", circleRadius)
      .attr("fill", colorBySources)
      .attr("fill-opacity", fadeWithTime)
      .attr("stroke", "#fff").attr("stroke-opacity", "0.3")
      .attr("display", function (d) { return entityURIs[d.key].sum ? "block" : "none";})
    .enter().append("circle")
      .attr("cx", circleX)
      .attr("cy", circleY)
      .attr("r", circleRadius)
      .attr("fill", colorBySources)
      .attr("fill-opacity", fadeWithTime)
      .attr("stroke", "#fff").attr("stroke-opacity", "0.3")
      .attr("class", "circle")
      .attr("id", function (d) { return "circle" + geoid(d.key); })
      .attr("display", function (d) { return entityURIs[d.key].sum ? "block" : "none";})
      .style("cursor", "pointer")
      .on("mouseover", function (d) {
        d3.select("#circle" + geoid(d.key)).attr("fill-opacity", "1");
      })
      .on("mouseout", function (d) {
        d3.select("#circle" + geoid(d.key)).attr("fill-opacity", "0.8");
      })
      .on("click", displayCircleInfo);
};

// CircleOverlay.prototype.updateCircles = function () {
//   this.svg.selectAll("circle")
//     .attr("r", circleRadius)
// };

function displayCircleInfo(d) {
  // console.log(entityURIs[d.value.id]);
  var bbox = d3.select("#circle" + geoid(d.key))[0][0].getBBox(),
      popup_x = bbox.x + bbox.width,
      popup_y = Math.max(bbox.y + bbox.height, 300);
  var entity = entityURIs[d.key],
      name = entity.name,
      population = entity.population || "?",
      entity_str = "<b>" + name + "</b><hr/><span class='popupinfo'>loading...</span>";
      // entity_str = "<b>" + name + "</b><br/><i>pop.</i> " + population.toString() + "<hr/><span class='popupinfo'>loading...</span>";
  var popup = new Popup(entity_str, popup_x, popup_y);
  var json = data["CONTEXTS"][geoid(d.key)];
  var contexts_str = "";
  for (var text in json) {
    var text_obj = doc_metadata[text];
    if (!text_obj || !text_obj.date || !yearStillShowing(text_obj.date.substring(0,4))) continue;
    contexts_str += "<div>"
    var title = text_obj.label + ": <a href='zotero://select/" + text + "'>" + text_obj.title + "</a>",
        date = text_obj.date.split(' ')[0];
    contexts_str += title + "\n<br/>\n" + date;
    for (var i in json[text]) {
      contexts_str += "<blockquote>" + json[text][i] + "</blockquote>";
    }
    contexts_str += "</div>";        
  }
  d3.select(".popupinfo").html(contexts_str);
}

function buildLegend() {
  legend = d3.select("body").append("svg:svg")
        .attr("width", legend_w + legend_m[1] + legend_m[3])
        .attr("height", legend_h + legend_m[0] + legend_m[2])
        .attr("id", "legend")
        .style("position", "absolute")
        .style("right", "150px")
        .style("top", "50px")
        .style("background", "white")
        .style("border", "1px solid black")
        .append("svg:g")
          .attr("transform", "translate(" + legend_m[3] + "," + legend_m[0] + ")");

  var labels = legend.append("svg:g").attr("id", "legend_labels");
  labels.append("svg:text")
    .text("Mentions in Corpus")
    .style("font-size", "1.2em");

  var origin_box = labels.append("svg:g")
    .attr("id", "origin_labels")
    .attr("transform", "translate(120, 40)");

  origin_box.append("svg:text")
    .text("Origin")
    .style("fill", "#000")
    .style("font-size", "1em");    

  origin_labels = origin_box.append("svg:g").selectAll(".originlabel").data(originColors.domain())
    .enter().append("svg:g")
      .attr("class", "originlabel")
      .attr("transform", function (d, i) { return "translate(0," + ((i+1)*20 + 5) +")"});

  origin_labels.append("svg:text")
    .text(function (d) { return entityURIs[d].name;})
    .style("font-size", "0.8em")
    .attr("fill", function (d) { return originColors(d); });

    updateLegend();
}
function updateLegend() {
  legend.selectAll("#circle_boxes").remove();
    var minmax = circleScale.domain(),
      step = (minmax[1] - minmax[0]) / 4,
      example_range = d3.range(minmax[0], minmax[1] + step, step),
      circleBoxes = legend.append("svg:g").selectAll("circle")
        .data(example_range).enter().append("svg:g")
          .attr("id", "circle_boxes")
          .attr("transform", function (d, i) { return "translate(20," + ((i*60) + 20) + ")"; });

      circleBoxes.append("svg:circle")
        .attr("r", function (d) { return circleScale(d);})
        .style("fill", originColors.range()[0])
        .style("fill-opacity", "0.3");

      circleBoxes.append("text")
        .attr("transform", "translate(35,0)")
        .style("text-anchor", "start")
        .style("alignment-baseline", "middle")
        .text(function(d) { var n = d3.round(d, -1); return n || 1;});
}

function setGradient(svg) {
  var defs = svg.append("svg:defs");

  var gradient = defs.append("svg:linearGradient")
    .attr("id", "fade")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  var gradientColors = ["#ff0000", "#0000ff"];
  gradient.selectAll("stop")
    .data(gradientColors)
    .enter().append("svg:stop")
    .attr("offset", function (d,i) { return ((i * 100.0)/gradientColors.length).toString() + "%";})
      .style("stop-color", function (d) { return d; });
}

function closePopup() {
  d3.select("#popup").remove();
}

function Popup(text, x, y) {
  d3.select("#popup").remove();
  this.div = d3.select("body").append("div")
    .attr("id", "popup")
    .html("<span class='popupclose' onclick='closePopup()'>x</span>");
  this.inner = this.div.append("span").attr("class", "popupText");
  this.display = function() {
    this.inner.html(text);
    this.div.style("display", "block")
      .style("position", "absolute")
      .style("z-index", "999");
    return this;
  };
  this.update = function (x, y) {
    this.div.style("left", Math.floor(x) + "px");
    this.div.style("top", Math.floor(y)  + "px");
  };

  if (x && y) this.update(x, y);
  this.display();
};