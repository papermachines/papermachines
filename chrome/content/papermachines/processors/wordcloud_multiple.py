#!/usr/bin/env python
import sys, os, json, cStringIO, tempfile, logging, traceback, codecs
import wordcloud

class MultipleWordClouds(wordcloud.WordCloud):
	"""
	Generate word clouds based on labels
	"""
	def _basic_params(self):
		self.name = "wordcloud_multiple"
		self.width = "300"
		self.height = "150"
		self.fontsize = "[10,32]"
		self.n = 50

	def _findWordFreqs(self, filenames):
		freqs = {}
		for filename in filenames:
			with codecs.open(filename, 'r', encoding = 'utf8') as f:
				logging.info("processing " + filename)
				for line in f:
					for stem in self._tokenizeAndStem(line):
						if stem not in freqs:
							freqs[stem] = 1
						else:
							freqs[stem] += 1
			self.update_progress()
		final_freqs = []

		top_freqs = sorted(freqs.values())
		min_freq = top_freqs[-min(self.n,len(top_freqs))] # find nth frequency from end, or start of list
		for word, freq in freqs.iteritems():
			if freq >= min_freq:
				final_freqs.append({'text': word, 'value': freq})
		return final_freqs

	def process(self):
		logging.info("splitting by labels")
		self.labels = {}
		for filename, data in self.metadata.iteritems():
			if data["label"] not in self.labels:
				self.labels[data["label"]] = []
			self.labels[data["label"]].append(filename)

		clouds = {}
		for label, filenames in self.labels.iteritems():
			logging.info("finding word frequencies for " + str(label))
			clouds[label] = self._findWordFreqs(filenames)

		params = {"CLOUDS": json.dumps(clouds),
				"WIDTH": self.width,
				"HEIGHT": self.height,
				"FONTSIZE": self.fontsize
		}

		self.write_html(params)


if __name__ == "__main__":
	try:
		processor = MultipleWordClouds(track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())