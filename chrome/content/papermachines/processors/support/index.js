var vocab = data["VOCAB"],
    index = data["INDEX"],
    doc_metadata = data["DOC_METADATA"],
    vocab_obj = {};

// console.log(Object.keys(doc_metadata).length);
for (var i in doc_metadata) {
  var date = new Date(doc_metadata[i]["date"].substring(0,10));
  if (date.toJSON() != null) {
    doc_metadata[i]["date"] = date;
  } else {
    delete doc_metadata[i];
  }
}
// console.log(Object.keys(doc_metadata).length);

for (var i = 0; i < vocab.length; i++) {
  vocab_obj[vocab[i]] = i;
}

function b64toInt16Array(s) {
    var raw = window.atob(s.replace(/-/g, "+").replace(/_/g, "/")),
        rawLength = raw.length,
        buffer = new ArrayBuffer(rawLength),
        uint = new Uint8Array(buffer),
        view = new DataView(buffer),
        array = new Array(rawLength/2);
    while (rawLength--) {
      uint[rawLength] = raw.charCodeAt(rawLength);
    }
    for (var i = 0; i < array.length; i++) {
      array[i] = view.getInt16(i * 2);
    }
    return array;
}


function getIntersect(arr1, arr2) {
  var r = [], o = {};
  for (var i = 0; i < arr2.length; i++) {
      o[arr2[i]] = true;
  }
  for (var i = 0; i < arr1.length; i++) {
      var v = arr1[i];
      if (v in o) {
          r.push(v);
      }
  }
  return r;
}

function split( val ) {
  return val.split( /,\s*/ );
}

function getWords(itemID) {
  var words_encoded = doc_metadata[itemID]['words'],
      words_idx;

  if (typeof words_encoded === "string") {
    words_idx = b64toInt16Array(words_encoded);
    doc_metadata[itemID]['words'] = words_idx;
  } else {
    words_idx = words_encoded;
  }
  return words_idx.map(function (d) { return vocab[d];});
}
function showItem(itemID) {
  var title_td = $('#row'+itemID);
  if (title_td.has(".doc_words").length) {
    title_td.children(".doc_words").remove();
    return;
  }

  var words = getWords(itemID),
      word_obj = $("<div class='doc_words'></div>");

  var terms = split($("#query")[0].value);

  for (var i in words) {
    if (terms.indexOf(words[i]) != -1) {
      words[i] = '<span style="color: red;">' + words[i] + '</span>';
    }
  }
  word_obj.html(words.join(' '));
  word_obj.appendTo(title_td);
}

var total_docs = function (title, data, width, height) {
  $("#summary svg.decades").remove();
  var m = {top: 30, right: 10, bottom: 60, left: 60},
      w = width - m.left - m.right,
      h = height - m.top - m.bottom;

  var years = d3.keys(data);
  years.sort();
  var x = d3.scale.ordinal()
      .domain(years)
      .rangeRoundBands([0, w], 0.05);

  var y = d3.scale.linear()
      .domain([0, 1])
      // .domain([0, d3.max(d3.values(data))])
      .range([h, 0]);

  var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom");
  
  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .tickFormat(d3.format("%d"))
      .tickSize(-w, -w);

  var chart = d3.select("#summary")
      .append("svg:svg")
      .attr("class", "chart decades")
      .attr("width", w + m.left + m.right)
      .attr("height", h + m.top + m.bottom)
      .append('svg:g')
          .attr("transform", "translate(" + m.left + ',' + m.top + ')')
          .attr("width", w)
          .attr("height", h);

  chart.append("svg:text")
      .attr("x", w/2 )
      .attr("y", 0 - (m.top/2))
      .style("text-anchor", "middle")
      .style("font-weight", "bold")
      .text(title);
  chart.append("svg:g")
      .attr("class", "axis")
      .attr("transform", 'translate(0,' + h + ')')
      .call(xAxis)       
      .selectAll("text")  
          .style("text-anchor", "end")
          .attr("dx", "-.8em")
          .attr("dy", ".15em")
          .attr("transform", function(d) {
              return "rotate(-65)" 
              });

  chart.append("svg:text")
      .attr("x", w/2 )
      .attr("y", h + m.bottom)
      .style("text-anchor", "middle")
      .text("Decade");

  chart.append("svg:text")
      .attr("transform", "rotate(90)")
      .attr("x", (h / 2))
      .attr("y", m.left * 0.85)
      // .attr("y", w + m.right)
      .style("text-anchor", "middle")
      .text("% of Documents");

  chart.selectAll("rect")
      .data(years)
    .enter().append("rect")
      .attr("x", x)
      .attr("y", function (d) { return y(data[d]); })
      .attr("height", function (d) { return h - y(data[d]); })
      .attr("width", x.rangeBand());

  chart.append("svg:g")
      .attr("class", "axis")
      // .attr("transform", 'translate(' + w + ',0)')
      .call(yAxis);
};

function histogramItems(itemIDs) {
  // var earliest = doc_metadata[itemIDs[0]].date;
  // var latest = doc_metadata[itemIDs[itemIDs.length - 1]].date;
  var data = {};
  for (var i in itemIDs) {
    var item = doc_metadata[itemIDs[i]];
    var year = item.date.getFullYear();
    year = year - (year % 10);
    if (year >= 1820 && year < 2000) {
      if (!(year in data)) data[year] = 0;
      data[year]++;
    }
  }
  return data;
}

var overall_histogram = histogramItems(Object.keys(doc_metadata));

var LN10 = Math.log(10);

function log10(val) {
  return Math.log(val)/LN10;
}

function histogramItemsScaled(itemIDs) {
  var scaled = histogramItems(itemIDs);
  for (var i in scaled) {
    scaled[i] /= overall_histogram[i];
  }
  return scaled;
}

var wc_data = {
  // "FORMAT": "{0} occurrences in search results",
  "FORMAT": "TF-IDF: {0}",
  "HEIGHT": 300, "WIDTH": 450, "FONTSIZE": [10, 32]};

function wordcloud(itemIDs, useTfIdf) {
  // if (itemIDs.length > 100) return;
  var word_data = [];
  if (!useTfIdf) {
    var word_counts = {};
    for (var i in itemIDs) {
      var words = getWords(itemIDs[i]);
      for (var j in words) {
        if (!(words[j] in word_counts)) word_counts[words[j]] = 0;
        word_counts[words[j]]++;
      }
    }
    for (var word in word_counts) {
      word_data.push({'text': word, 'value': word_counts[word]});
    }
  } else {
    var tfMaxima = {};
    var df = {};
    for (var i in itemIDs) {
      var localTf = {};
      var words = getWords(itemIDs[i]);
      for (var j in words) {
        var word = words[j];
        if (!(word in localTf)) localTf[words[j]] = 0;
        localTf[words[j]]++;
      }
      var total = d3.sum(d3.values(localTf)) || 1;
      for (var word in localTf) {
        localTf[word] /= total;
        if (!(word in tfMaxima) || tfMaxima[word] < localTf[word]) tfMaxima[word] = localTf[word];
        if (!(word in df)) df[word] = 0;  
        df[word]++;
      }
    }
    var tfidf = {};
    for (var i in df) {
      if (df[i] > 3) {
        tfidf[i] = tfMaxima[i] * log10((1.0*itemIDs.length)/df[i]);      
      }
    }

    for (var word in tfidf) {
      word_data.push({'text': word, 'value': tfidf[word]});
    }
  }

  wordcloud_inner(word_data);
}

function wordcloud_inner(word_data) {
  $("#summary svg.wordcloud").remove();
  var fontSize = d3.scale.linear().range(wc_data["FONTSIZE"]);

  var color = d3.scale.category10().domain(d3.range(10));

  var width = wc_data["WIDTH"], height = wc_data["HEIGHT"],
    m = {top: 30, right: 10, bottom: 30, left: 10},
    w = width - m.left - m.right,
    h = height - m.top - m.bottom;

  function valueformat(value) {
    if (value === undefined) return '';
    return wc_data["FORMAT"] ? wc_data["FORMAT"].replace("{0}", value.toString()) : value;
  }

  var word_hash = {};
  word_data.forEach(function (d) {
     word_hash[d.text] = valueformat(d.value);
  });

  var vals = word_data.map(function (d) { return +d.value});
  fontSize.domain([d3.min(vals), d3.max(vals)]);

  var layout = d3.layout.cloud().size([w, h])
      .words(word_data)
      .timeInterval(10)
      .rotate(0) //function() { return ~~(Math.random() * 2) * 90; })
      .font("Helvetica Neue")
      .fontSize(function(d) { return fontSize(+d.value); })
      .on("end", draw)
      .start();

  function draw(words) {
    var drawn = d3.select("#summary").append("svg")
        .attr("class", "wordcloud")
        .attr("width", w + m.left + m.right)
        .attr("height", h + m.top + m.bottom)
    .append('svg:g')
        .attr("transform", "translate(" + m.left + ',' + m.top + ')')
        .attr("width", w)
        .attr("height", h)
      .append("g")
        .attr("transform", "translate(" + w/2 + "," + h/2 + ")")
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

    d3.select("#summary_wordcloud").select("svg")
        .append("svg:text")
        .attr("x", w/2 )
        .attr("y", 0 + (m.top / 2))
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Most Frequent Words");
  }
}

$(function() {
    function appendTd(html, appendTarget, id) {
      var td = $("<td></td>").html(html);
      if (id) td.attr('id', id);
      td.appendTo(appendTarget);
    }
    function titleLink(itemID) {
      var title = doc_metadata[itemID]["title"];
      return "<a href='#' onclick='showItem(" + itemID + "); return false;'>" + title + "</a>";
    }

    function updateResults(terms) {
      var termsTitle = terms.join(" & ");
      var results_elem = $("#results");
      results_elem.empty();

      var table = $("<table class='table' id='results_table'></table>");
      $("<tr><th>Date</th><th>Title</th><th>Database</th></tr>").appendTo(table);
      table.appendTo(results_elem);

      var firstTerm = terms.pop(),
          items = index[vocab_obj[firstTerm]].filter(function (d) { return d in doc_metadata;});
      while (terms.length > 0) {
        var term = terms.pop(),
            more_docs = index[vocab_obj[term]];
        items = getIntersect(items, more_docs);
      }

      items.sort(function (a,b) { return doc_metadata[a]["date"] - doc_metadata[b]["date"];});

      var by_decade = histogramItemsScaled(items);
      total_docs(termsTitle + " by decade", by_decade, 450, 300);

      setTimeout(function () { wordcloud(items, false); }, 0);

      for (var i in items) {
        var itemID = items[i],
            date = doc_metadata[itemID]["date"],
            resultRow;

        if (date && typeof date.toISOString == "function") {
          resultRow = $("<tr></tr>");
          appendTd(date.toISOString().substring(0,10), resultRow);
          appendTd(titleLink(itemID), resultRow, 'row' + itemID);
          appendTd(doc_metadata[itemID]['label'], resultRow);
          resultRow.appendTo(table);          
        }
      }
    }

    function split( val ) {
      return val.split( /,\s*/ );
    }
    function extractLast( term ) {
      return split( term ).pop();
    }

    $( "#query" )
      // don't navigate away from the field on tab when selecting an item
      .bind( "keydown", function( event ) {
        if ( event.keyCode === $.ui.keyCode.TAB &&
            $( this ).data( "ui-autocomplete" ).menu.active ) {
          event.preventDefault();
        }
        if (event.keyCode === $.ui.keyCode.ENTER) {
          var terms = split( this.value );
          updateResults(terms.slice(0, -1));
        }
      })
      .autocomplete({
        minLength: 0,
        source: function( request, response ) {
          // delegate back to autocomplete, but extract the last term
          response( $.ui.autocomplete.filter(
            vocab, extractLast( request.term ) ) );
        },
        focus: function() {
          // prevent value inserted on focus
          return false;
        },
        select: function( event, ui ) {
          var terms = split( this.value );
          // remove the current input
          terms.pop();
          // add the selected item
          terms.push( ui.item.value );
          // add placeholder to get the comma-and-space at the end
          terms.push( "" );
          this.value = terms.join( ", " );
          updateResults(terms.slice(0, -1));
          return false;
        }
      });
});