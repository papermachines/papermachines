
var map;
var heatmap, heatmapData;
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
          // var line = new google.maps.Polyline({
          //     "map": map, 
          //     "geodesic": true,
          //     "strokeOpacity": 0.1,
          //     "strokeWidth": 1,
          //     "path": link.edge.map(function (d) { var coords = entityURIs[d]["coordinates"]; return new google.maps.LatLng(coords[1], coords[0]); })
          // });
          var line = new GradientPolyline({
              "map": map,
              "strokeOpacity": 0.1,
              "strokeWidth": 1,
              "colors": ["#ff0000", "#0000ff"],
              "path": link.edge.map(function (d) { var coords = entityURIs[d]["coordinates"]; return new google.maps.LatLng(coords[1], coords[0]); })
          });

          link_polylines[year].push(line);

          link.texts.forEach(function (text) {
            if (!(text in linksByText)) { linksByText[text] = [];}
            linksByText[text].push(line);            
          });
        }
    }
  });
};


function colorComponents(color_str) {
  var hex;
  if (color_str.length >= 6) {
    hex = parseInt(color_str.replace("#",""), 16);
  } else {
    hex = 0xffffff;
  }
  var r = (hex & 0xff0000) >> 16;
  var g = (hex & 0x00ff00) >> 8;
  var b = hex & 0x0000ff;
  return [r,g,b];
}

function GradientPolyline(obj) {
  var colors = obj["colors"];
  var map = obj["map"];
  var path = obj["path"];
  this.strokeOpacity = obj["strokeOpacity"] || 0.1;

  this.set('map', map);
  this.set('visible', true);
  var points = 50;

  this.segments = this.generateSegments(path[0], path[1], points);
  this.colors = this.generateColors(colors[0], colors[1], points);
  this.segments_polylines = new Array();
  for (var i = 0; i < this.segments.length - 1; i++) {
    var new_poly = new google.maps.Polyline({
      "path": [this.segments[i], this.segments[i+1]],
      "strokeColor": this.colors[i],
      "strokeOpacity": this.strokeOpacity
    });
    new_poly.bindTo('map', this);
    new_poly.bindTo('visible', this);
    this.segments_polylines.push(new_poly);
  }
}

GradientPolyline.prototype = new google.maps.MVCObject();

GradientPolyline.prototype.setVisible = function (visible) {
  this.set('visible', visible);
};

GradientPolyline.prototype.generateColors = function (start_color, end_color, points) {
  var colors = new Array();
  var start_rgb = colorComponents(start_color);
  var end_rgb = colorComponents(end_color);

  for (var i = 0, n = points - 1; i < n; i++) {
    var p = (i*1.0)/n;
    var new_color = new Array(3);
    for (var j = 0; j < 3; j++) {
      new_color[j] = Math.round((start_rgb[j] * (1-p)) + (end_rgb[j] * (p)));
    }
    var new_rgb = new_color.reduce(function (a, b) {
      var b_hex = b.toString(16);
      if (b_hex.length == 1) {
        b_hex = "0" + b_hex;
      }
      return a + b_hex;
    }, "#");
    colors.push(new_rgb);
  }
  return colors;
};

GradientPolyline.prototype.generateSegments = function (start, end, points) {

  var geodesicPoints = new Array();
  with (Math) {
    var lat1 = start.lat() * (PI/180);
    var lon1 = start.lng() * (PI/180);
    var lat2 = end.lat() * (PI/180);
    var lon2 = end.lng() * (PI/180);

    var d = 2*asin(sqrt( pow((sin((lat1-lat2)/2)),2) + cos(lat1)*cos(lat2)*pow((sin((lon1-lon2)/2)),2)));

    for (var n = 0 ; n < points+1 ; n++ ) {
      var f = (1/points) * n;
      // f = f.toFixed(6);
      var A = sin((1-f)*d)/sin(d)
      var B = sin(f*d)/sin(d)
      var x = A*cos(lat1)*cos(lon1) +  B*cos(lat2)*cos(lon2)
      var y = A*cos(lat1)*sin(lon1) +  B*cos(lat2)*sin(lon2)
      var z = A*sin(lat1)           +  B*sin(lat2)

      var latN = atan2(z,sqrt(pow(x,2)+pow(y,2)))
      var lonN = atan2(y,x)
      var p = new google.maps.LatLng(latN/(PI/180), lonN/(PI/180));
      geodesicPoints.push(p);
    }
  }
  return geodesicPoints;
};
