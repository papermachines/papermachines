
var map;
var heatmap;

var link_polylines;

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
/*  d3.select("#playPause").text("\u25b6").style("margin-left", "1em");
  d3.select("#timeDisplay").text(endDate); */

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

    var myData = INTENSITY;
  
  // this is important, because if you set the data set too early, the latlng/pixel projection doesn't work
  google.maps.event.addListenerOnce(map, "idle", function(){
    heatmap.setDataSet(myData);
  });
};
    </div>