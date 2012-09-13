#!/usr/bin/env python
import sys, os, json, cStringIO, tempfile, logging, traceback, codecs, math
from datetime import datetime, timedelta
import wordcloud_multiple

class WordCloudChronological(wordcloud_multiple.MultipleWordClouds):
	"""
	Generate word clouds based on time interval
	"""
	def _basic_params(self):
		self.name = "wordcloud_chronological"
		self.template_filename = os.path.join(self.cwd, "templates", "wordcloud_multiple.html")
		self.width = "483"
		self.height = "300"
		self.fontsize = "[10,32]"
		self.n = 100
		self.tfidf_scoring = False
		self.MWW = False
		self.dunning = False
		if len(self.extra_args) == 1:
			self.interval = self.extra_args[0]
		elif len(self.extra_args) > 1:
			if self.extra_args[0] == "tfidf":
				self.tfidf_scoring = True
			elif self.extra_args[0] == "mww":
				self.tfidf_scoring = True
				self.MWW = True
			elif self.extra_args[0] == "dunning":
				self.tfidf_scoring = True
				self.dunning = True
			self.interval = self.extra_args[1]
		else:
			self.interval = "90"

	def _split_into_labels(self):
		datestr_to_datetime = {}
		for filename in self.metadata.keys():
			date_str = self.metadata[filename]["date"]
			cleaned_date = date_str[0:10]
			if "-00" in cleaned_date:
				cleaned_date = cleaned_date[0:4] + "-01-01"
			datestr_to_datetime[date_str] = datetime.strptime(cleaned_date, "%Y-%m-%d")
		datetimes = sorted(datestr_to_datetime.values())
		start_date = datetimes[0]
		end_date = datetimes[-1]

		if self.interval.isdigit():
			interval = timedelta(int(self.interval))
		else:
			interval = timedelta(90)

		intervals = []
		interval_names = []
		start = end = start_date
		while end <= end_date:
			end += interval
			intervals.append((start,end))
			interval_names.append(start.isoformat()[0:10].replace('-','/') + '-' + end.isoformat()[0:10].replace('-','/'))
			start = end

		for filename, metadata in self.metadata.iteritems():
			label = ""
			for i in range(len(intervals)):
				interval = intervals[i]
				if interval[0] <= datestr_to_datetime[metadata["date"]] < interval[1]:
					label = interval_names[i]
					break
			if label not in self.labels:
				self.labels[label] = set()
			self.labels[label].add(filename)

if __name__ == "__main__":
	try:
		processor = WordCloudChronological(track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())