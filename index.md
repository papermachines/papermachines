---
layout: default
title: Paper Machines
---
## Overview

Paper Machines is an open-source extension for the [Zotero](http://www.zotero.org/) bibliographic management software. Its purpose is to allow individual researchers to generate analyses and visualizations of user-provided corpora, without requiring extensive computational resources or technical knowledge.

This project is a collaboration between historian [Jo Guldi](http://www.joguldi.com) and digital ethnomusicologist [Chris Johnson-Roberson](http://www.chrisjr.org), graciously supported by Google Summer of Code, the William F. Milton Fund, and [metaLAB @ Harvard](http://metalab.harvard.edu/).

## Prerequisites

In order to run Paper Machines, you will need the following (Python and Java should be installed automatically on Mac OS X 10.6 and above):

* [Zotero](http://www.zotero.org/) with PDF indexing tools installed (see the Search pane of Zotero's Preferences)
* a corpus of documents with full text PDF/HTML and high-quality metadata (recommended: at least 1,000 for topic modeling purposes)
* Python ([download page](http://www.python.org/download/releases/2.7.3))
* Java ([download page](http://java.com/en/download/index.jsp))

## Installation
Paper Machines should work either in Zotero for Firefox or Zotero Standalone. To install, click <a href="https://github.com/downloads/chrisjr/papermachines/papermachines-0.3.0.xpi" onclick="return install(event);">here</a> while using Firefox. If you wish to use the extension in the Standalone version, right-click on the link and save the XPI file in your Downloads folder. Then, in Zotero Standalone, go to the Tools menu -> Add-Ons. Select the gear icon at the right, then "Install Add-On From File." Navigate to your Downloads folder (or wherever you have saved the XPI file) and open it.

## Usage
To begin, right-click (control-click for Mac) on the collection you wish to analyze and select "Extract Texts for Paper Machines." Once the extraction process is complete, this right-click menu will offer several different processes that may be run on a collection, each with an accompanying visualization. Once these processes have been run, selecting "Export Output of Paper Machines..." will allow you to choose which visualizations to export.

### Word Cloud
Displays words scaled according to the frequency of their occurrence. An [oft-maligned](http://www.niemanlab.org/2011/10/word-clouds-considered-harmful/), but still arguably useful way to get a quick impression of the most common words in your collection. Either a basic word cloud, a word cloud with <a href="http://en.wikipedia.org/wiki/Tf*idf">tf*idf</a> filtering to remove unimportant words, or multiple word clouds (divided up by subcollection or time interval, specified in days) can be generated. The multiple word clouds can be filtered using tf*idf, [Dunning's log-likelihood](http://wordhoard.northwestern.edu/userman/analysis-comparewords.html#loglike), or [Mann-Whitney U](http://tedunderwood.wordpress.com/2011/11/09/identifying-the-terms-that-characterize-an-author-or-genre-why-dunnings-may-not-be-the-best-method/) tests, each of which will provide different results depending on the data. By default, a basic word cloud will appear in the Tags pane of Zotero once text has been extracted.

### Phrase Net
Finds phrases that follow a certain pattern, such as "x and y," and displays the most common pairings. This method is derived from a [Many Eyes visualization](http://www-958.ibm.com/software/data/cognos/manyeyes/page/Phrase_Net.html)).

### Mapping
#### Flight Paths
Generates a map linking texts from their places of publication to the places they mention, filtered by time.

#### Heatmap
Generates a map showing regions of relative intensity for mentions in the text. Same as the flight path visualization without the link data; may be more usable on large datasets).

#### Export Geodata to CSV
Creates a CSV file with place name, latitude/longitude, the Zotero item ID number, and some context around the mention.

### DBpedia Annotation
Annotates files using the DBpedia Spotlight service, providing a look at what named entities (people, places, organizations, etc.) are mentioned in the texts. Entities are scaled according to the frequency of their occurrence.

### Topic Modeling
Shows the proportional prevalence of different "topics" (collections of words likely to co-occur) in the corpus, by time or by subcollection. This uses the [MALLET](http://mallet.cs.umass.edu) package to perform [latent Dirichlet allocation](http://en.wikipedia.org/wiki/Latent_Dirichlet_allocation), and by default displays the 5 most "coherent" topics, based on a metric devised by [Mimno et al.](http://www.cs.princeton.edu/~mimno/papers/mimno-semantic-emnlp.pdf) A variety of topic model parameters can be specified before the model is created. The default values should be suitable for general purpose use, but they may be adjusted to produce a better model.

After the model is generated, clicking "Save" in display will open a new window with the graph displayed free of interactive controls; this window may be saved as an ".SVG" file or captured via screenshot. It will also, in the original window, preserve the current selection of topics, search terms, and time scale as a permalink; please bookmark this if you wish to return to a specific view with interactive controls intact.

#### JSTOR Data For Research
The topic model can be supplemented with datasets from [JSTOR Data For Research](http://dfr.jstor.org/). You must first [register](http://dfr.jstor.org/accounts/register/) for an account, after which you may search for additional articles based on keywords, years of publiation, specific journals, and so on. Once the search is to your liking, go to the Dataset Requests menu at the upper right and click "Submit New Request." Check the "Citations" and "Word Counts" boxes, select CSV output format, and enter a short job title that describes your query. Once you click "Submit Job", you will be taken to a history of your submitted requests. You will be e-mailed once the dataset is complete. Click "Download (#### docs)" in the Full Dataset column, and a zip file timestamped with the request time will be downloaded. This file (or several files with related queries) may then be incorporated into a model by selecting "By Time (With JSTOR DFR)" in the Topic Modeling submenu of Paper Machines. Multiple dataset zips will be merged and duplicates discarded before analysis begins; be warned, this may take a considerable amount of time before it begins to show progress (~15-30 minutes).

### Classification
This allows you to train the computer to infer the common features of the documents under each subcollection; subsequently, a set of texts in a different folder can be sorted automatically based on this training. At the moment, the probability distribution for each text is given in plain text; the ability to automatically generate a new collection according to this sorting is forthcoming.

### Preferences

Currently, the language stoplist in use, types of data to extract, default parameters for topic modeling, and an experimental periodical import feature (intended for PDFs with OCR and correct metadata) may be adjusted in the preference pane.

## Acknowledgements
Special thanks to [Matthew Battles](http://metalab.harvard.edu/people/) for providing space, guidance, and support for me at metaLAB. My gratitude also to the creators of all the open-source projects and services upon which this project relies:

* [ColorBrewer](http://colorbrewer2.org/)
* [d3.js](http://d3js.org/)
* [d3.layout.cloud.js](https://github.com/jasondavies/d3-cloud)
* [DBpedia Spotlight](https://github.com/dbpedia-spotlight/dbpedia-spotlight)
* [Europeana Geoparser](http://europeana-geo.isti.cnr.it/geoparser/geoparsing)
* [Firefox](http://www.firefox.com/)
* [html5slider](https://github.com/fryn/html5slider)
* [MALLET](http://mallet.cs.umass.edu)
* [PTStemmer](http://code.google.com/p/ptstemmer/)
* [Zotero](http://www.zotero.org/)
