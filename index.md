---
layout: default
title: Paper Machines
---
## Overview

Paper Machines is an open-source extension for the [Zotero](http://www.zotero.org/) bibliographic management software. Its purpose is to allow individual researchers to generate analyses and visualizations of user-provided corpora, without requiring extensive computational resources or technical knowledge.

## Prerequisites

In order to run Paper Machines, you will need the following (note that Python and Java are installed automatically on Mac OS X):

* [Zotero](http://www.zotero.org/)
* a corpus of documents, preferably with high-quality metadata
* Python ([download for Windows](http://www.python.org/ftp/python/2.7.3/python-2.7.3.msi))
* Java ([download for Windows/Mac/Linux/etc.](http://java.com/en/download/index.jsp))

## Installation
Paper Machines should work either in Zotero for Firefox or Zotero Standalone. To install, click <a href="https://github.com/downloads/chrisjr/papermachines/papermachines-0.1.4.xpi" hash="sha1:0fb5d8188d73341ba530216452ef19a37942ac32" onclick="return install(event);">here</a> while using Firefox. If you wish to use the extension in the Standalone version, right-click on the link and save the XPI file in your Downloads folder. Then, in Zotero Standalone, go to the Tools menu -> Add-Ons. Select the gear icon at the right, then "Install Add-On From File." Navigate to your Downloads folder (or wherever you have saved the XPI file) and open it.

## Usage
To begin, right-click (control-click for Mac) on the collection you wish to analyze and select "Extract Texts for Paper Machines." Once the extraction process is complete, this right-click menu will offer several different processes that may be run on a collection, each with an accompanying visualization.

### Word Cloud
Displays words scaled according to the frequency of their occurrence. An [oft-maligned](http://www.niemanlab.org/2011/10/word-clouds-considered-harmful/), but still arguably useful way to get a quick impression of the most common words in your collection. Either a basic word cloud, a word cloud with [TF-IDF](http://en.wikipedia.org/wiki/Tf*idf) filtering to remove unimportant words, or multiple word clouds (divided up by subcollection) can be generated; by default, the basic word cloud will appear in the Tags pane of Zotero once text has been extracted.

### Phrase Net
Finds phrases that follow a certain pattern, such as "x and y," and displays the most common pairings. This method is derived from a [Many Eyes visualization](http://www-958.ibm.com/software/data/cognos/manyeyes/page/Phrase_Net.html)).

### Geoparser
Generates a map linking texts to the places they mention, filtered by time. This uses Yahoo!'s Placemaker service, and is limited to the first 50k of each file (approximately 10,000 words per text).

### DBpedia Annotation
Annotates files using the DBpedia Spotlight service, providing a look at what named entities (people, places, organizations, etc.) are mentioned in the texts. Entities are scaled according to the frequency of their occurrence.

### Topic Modeling
Shows the proportional prevalence of different "topics" (collections of words likely to co-occur) in the corpus, by time or by subcollection. This uses the [MALLET](http://mallet.cs.umass.edu) package to perform [latent Dirichlet allocation](http://en.wikipedia.org/wiki/Latent_Dirichlet_allocation), and by default displays the 5 most "coherent" topics, based on a metric devised by [Mimno et al.](http://www.cs.princeton.edu/~mimno/papers/mimno-semantic-emnlp.pdf)

Note that clicking "Save" in this display will open a new window with the graph displayed free of interactive controls; this window may be saved as an ".SVG" file or captured via screenshot. It will also, in the original window, preserve the current selection of topics, search terms, and time scale as a permalink; please bookmark this if you wish to return to a specific view with interactive controls intact.

### Classification
This allows you to train the computer to infer the common features of the documents under each subcollection; subsequently, a set of texts in a different folder can be sorted automatically based on this training. At the moment, the probability distribution for each text is given in plain text; the ability to automatically generate a new collection according to this sorting is forthcoming.

## Acknowledgements
Thanks to Google Summer of Code for funding this work, and to [Matthew Battles](http://metalab.harvard.edu/people/) and [Jo Guldi](http://www.joguldi.com/) for overseeing it. My gratitude also to the creators of all the open-source projects and services upon which this work relies:

* [ColorBrewer](http://colorbrewer2.org/)
* [d3.js](http://d3js.org/)
* [d3.layout.cloud.js](https://github.com/jasondavies/d3-cloud)
* [DBpedia Spotlight](https://github.com/dbpedia-spotlight/dbpedia-spotlight)
* [Firefox](http://www.firefox.com/)
* [html5slider](https://github.com/fryn/html5slider)
* [MALLET](http://mallet.cs.umass.edu)
* [python-placemaker](https://github.com/bycoffe/python-placemaker/)
* [Yahoo! Placemaker](http://developer.yahoo.com/geo/placemaker/)
* [Zotero](http://www.zotero.org/)
