#!/usr/bin/env python2.7
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
		self.width = 483
		self.height = 300
		self.fontsize = [10,32]
		self.n = 100
		self.tfidf_scoring = False
		self.MWW = False
		self.dunning = False
		self.comparison_type = "plain"
		if len(self.extra_args) == 1:
			self.comparison_type = self.extra_args[0]
			if self.extra_args[0] == "tfidf":
				self.tfidf_scoring = True
			elif self.extra_args[0] == "mww":
				self.tfidf_scoring = True
				self.MWW = True
			elif self.extra_args[0] == "dunning":
				self.tfidf_scoring = True
				self.dunning = True
		self.interval = int(self.named_args.get("interval", "90"))
		self.start_date = None
		self.end_date = None

		if self.named_args.get("start_date", "") != "":
			try:
				self.start_date = datetime.strptime(self.named_args["start_date"], "%Y-%m-%d")
			except:
				logging.error("Start date {:} not valid! Must be formatted like 2013-01-05")
		if self.named_args.get("end_date", "") != "":
			try:
				self.end_date = datetime.strptime(self.named_args["end_date"], "%Y-%m-%d")
			except:
				logging.error("End date {:} not valid! Must be formatted like 2013-01-05")

	def _split_into_labels(self):
		datestr_to_datetime = {}
		for filename in self.metadata.keys():
			date_str = self.metadata[filename]["date"]
			if date_str.strip() == "":
				logging.error("File {:} has invalid date -- removing...".format(filename))
				del self.metadata[filename]
				continue
			cleaned_date = date_str[0:10]
			if "-00" in cleaned_date:
				cleaned_date = cleaned_date[0:4] + "-01-01"
			try:
				date_for_doc = datetime.strptime(cleaned_date, "%Y-%m-%d")
				datestr_to_datetime[date_str] = date_for_doc
				if self.start_date is not None and date_for_doc < self.start_date:
					logging.error("File {:} is before date range -- removing...".format(filename))
					del self.metadata[filename]
					continue
				if self.end_date is not None and date_for_doc > self.end_date:
					logging.error("File {:} is after date range -- removing...".format(filename))
					del self.metadata[filename]
					continue
			except:
				logging.error(traceback.format_exc())
				logging.error("Date {:} not recognized".format(cleaned_date))
		datetimes = sorted(datestr_to_datetime.values())
		start_date = datetimes[0] if self.start_date is None else self.start_date
		end_date = datetimes[-1] if self.end_date is None else self.end_date

		interval = timedelta(self.interval)

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