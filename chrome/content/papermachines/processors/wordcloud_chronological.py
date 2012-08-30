#!/usr/bin/env python
import sys, os, json, cStringIO, tempfile, logging, traceback, codecs, math
import wordcloud_multiple

class WordCloudChronological(wordcloud_multiple.MultipleWordClouds):
	"""
	Generate word clouds based on time interval
	"""
	def _basic_params(self):
		self.name = "wordcloud_chronological"
		self.width = "300"
		self.height = "150"
		self.fontsize = "[10,32]"
		self.n = 50
		self.tfidf_scoring = True
		self.MWW = False
		if len(self.extra_args) > 0:
			self.interval = self.extra_args[0]

	def _split_into_labels(self):
		years = [item["year"] for item in self.metadata.values()]
		for filename, data in self.metadata.iteritems():
			if data["label"] not in self.labels:
				self.labels[data["label"]] = set()
			self.labels[data["label"]].add(filename)

if __name__ == "__main__":
	try:
		processor = WordCloudChronological(track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())