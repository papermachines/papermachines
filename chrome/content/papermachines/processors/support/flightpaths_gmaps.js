var map;
var heatmap, heatmapData;
var arcOverlay;
var animating;
var animationInterval = 250;
var linksByText = {};

var link_polylines = {};

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
  updateHeatmapData();
  for (var year in link_polylines) {
    (function (displaying) {
      link_polylines[year].forEach(function (d) { d.setVisible(displaying); });
    })(year >= startDate && year < endDate);
  }
  // max_country_weight = d3.max(Object.keys(countries).map(function (d) { return getCountryWeight(d);}))
  // feature.style("fill", countryColor);
  // layers.style("stroke-opacity", fadeOldConnections).style("display", timeFilter);
  // data.attr("r", function(d) {return valueToRadius(d) * currentScale / height;});
};

var updateHeatmapData = function () {
  var data = [], max = 0;
  for (var uri in entityURIs) {
    var d = entityURIs[uri];
    var sum = 0;
    for (var year in d.counts) {
      if (year >= startDate && year < endDate) {
        sum += d.counts[year];
      }
    }
    if (sum > max) { max = sum; }
    if (sum > 0) {
      data.push({"lat": d["coordinates"][1], "lng": d["coordinates"][0], "count": sum});      
    }
  }
  heatmapData = {"max": max, "data": data};
  heatmap.setDataSet(heatmapData);
};

window.onload = function(){
  var searchTime = document.getElementById("searchTime");
  searchTime.min = startDate;
  searchTime.max = endDate;
  searchTime.value = endDate;
  searchTime.onchange = timeAction;

  var playPauseButton = document.createElement("button");
  playPauseButton.id = "playPause"
  playPauseButton.className = "first last";
  playPauseButton.onclick = playPause;

  document.getElementById("searches").appendChild(playPauseButton);
  document.getElementById("playPause").textContent = "\u25b6";
  document.getElementById("timeDisplay").textContent = endDate;

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
  
  heatmap = new HeatmapOverlay(map, {"radius":15, "visible":true, "opacity":60, "legend": {
                            "title": "Mentions in Corpus",
                            "position": "br",
                            "offset": 30
                        }});

  arcOverlay = new ArcOverlay(map);
  
  document.getElementById("togLegend").onclick = function(){
    var legend = heatmap.heatmap.get("legend").get("element");
    legend.hidden = !legend.hidden;
  };
  
  // this is important, because if you set the data set too early, the latlng/pixel projection doesn't work
  google.maps.event.addListenerOnce(map, "idle", function(){
    updateHeatmapData();
    for (var year in linksByYear) {
        for (var i in linksByYear[year]) {
          var link = linksByYear[year][i];
          if (!(year in link_polylines)) {
            link_polylines[year] = [];
          }
          var line = arcOverlay.Arc(link.edge.map(function (d) { return entityURIs[d]["coordinates"]; }));

          link_polylines[year].push(line);

          link.texts.forEach(function (text) {
            if (!(text in linksByText)) { linksByText[text] = [];}
            linksByText[text].push(line);            
          });
        }
    }
  });
};

var globalArcId = 0;
function Arc(edge) {
  this.id = globalArcId++;
  this.source = edge[0];
  this.target = edge[1];
}

Arc.prototype.setVisible = function (display) {
  d3.select("#arc" + this.id).style("display", display ? "block" : none);
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

ArcOverlay.prototype.draw = function() {
  var me = this;
  var projection = this.getProjection(),
      currentBounds = this.map.getBounds(),
      padding = 10;

  if (currentBounds.equals(this.bounds)) {
    // return;
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

  function transform(d) {
    d = new google.maps.LatLng(d.value[0][1], d.value[0][0]);
    d = projection.fromLatLngToDivPixel(d);
    return d3.select(this)
        .style("left", (d.x - padding) + "px")
        .style("top", (d.y - padding) + "px");
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
      .attr("stroke", "url(#fade)")
      .attr("stroke-opacity", 0.1)
    .enter().append("path")
      .attr("d", pathFromArc)
      .attr("fill", "none")
      .attr("class", "arc")
      .attr("id", function (d) { return d.value.id; })
      .attr("stroke-opacity", 0.1)
      .attr("stroke","url(#fade)");
};

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
