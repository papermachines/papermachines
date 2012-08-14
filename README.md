# Paper Machines

## Overview

Paper Machines is an open-source extension for the [Zotero](http://www.zotero.org/) bibliographic management software. Its purpose is to allow individual researchers to generate analyses and visualizations of user-provided corpora, without requiring extensive computational resources or technical knowledge.

## Prerequisites

In order to run Paper Machines, you will need the following:

* Zotero
* a corpus of documents (preferably with high-quality metadata)
* Python ([download for Windows](http://www.python.org/ftp/python/2.7.3/python-2.7.3.msi))
* Java ([download](http://java.com/en/download/index.jsp))

## Usage
To begin, right-click (control-click) on the collection you wish to analyze and select "Extract Texts for Paper Machines." Once the extraction process is complete, this right-click menu will offer several different processes that may be run on a collection, each with an accompanying visualization.

### Word Cloud
Show word frequency as a function of size. An [oft-maligned](http://www.niemanlab.org/2011/10/word-clouds-considered-harmful/), but still arguably useful way to get a quick impression of the most common words in your collection. After it is generated, it will appear in the Tags pane of Zotero.

### Phrase Net
Finds phrases that follow a certain pattern, such as "x and y," and displays the most common pairings. This method is derived from a [Many Eyes visualization](http://www-958.ibm.com/software/data/cognos/manyeyes/page/Phrase_Net.html)).

### Geoparser
Generates a map linking texts to the places they mention, filtered by time. The underlying functionality is based on Pete Warden's [geodict](https://github.com/petewarden/geodict). NOTE: you must download the "geodict" version for this, as it adds an extra 70 megs to the download.

### Topic Modeling
Shows the proportional prevalence of different "topics" (collections of words likely to co-occur) in the corpus over time, highlighting spots where topics are more common. This uses the [MALLET](http://mallet.cs.umass.edu) package to perform [latent Dirichlet allocation](http://en.wikipedia.org/wiki/Latent_Dirichlet_allocation), and by default displays the 20 most "coherent" topics, based on a metric devised by [Mimno et al.](http://www.cs.princeton.edu/~mimno/papers/mimno-semantic-emnlp.pdf)

## Acknowledgements
Thanks to Google Summer of Code for funding this work, and to [Matthew Battles](http://metalab.harvard.edu/people/) and [Jo Guldi](http://www.joguldi.com/) for overseeing it. My gratitude also to the creators of all the open-source projects upon which this work relies:

* [d3.js](http://d3js.org/)
* [d3.layout.cloud.js](https://github.com/jasondavies/d3-cloud)
* [geodict](https://github.com/petewarden/geodict)
* [html5slider](https://github.com/fryn/html5slider)
* [MALLET](http://mallet.cs.umass.edu)
* [Zotero](http://www.zotero.org/)

