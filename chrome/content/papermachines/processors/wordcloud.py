#!/usr/bin/env python
import sys, os, json, cStringIO, tempfile, logging, traceback
import textprocessor
from lib.porter2 import stem

class WordCloud(textprocessor.TextProcessor):
	"""
	Generate word cloud
	"""
	def _findWordFreqs(self):
		self.freqs = {}
		for filename in self.files:
			with file(filename) as f:
				logging.info("processing " + filename)
				for line in f:
					for stem in self._tokenizeAndStem(line):
						if stem not in self.freqs:
							self.freqs[stem] = 1
						else:
							self.freqs[stem] += 1
			self.update_progress()

	def _tokenizeAndStem(self, line):
		# uncomment for Porter stemming (slower, but groups words with their plurals, etc.)
		# return [stem(word.strip('.,')) for word in line.split() if word.lower() not in self.stopwords and len(word) > 3]
		return [word.lower() for word in line.split() if word.lower() not in self.stopwords and word.isalpha()]

	def process(self):
		logging.info("starting to process")
		self.name = getattr(self, "name", "wordcloud")
		self.template_filename = os.path.join(self.cwd, "templates", "wordcloud.html")
		stopfile = os.path.join(self.cwd, "stopwords.txt")
		logging.info("reading stopwords from " + stopfile)
		self.stopwords = [line.strip() for line in file(stopfile)]

		self.width = getattr(self, "width", "300")
		self.height = getattr(self, "height", "150")
		self.fontsize = getattr(self, "fontsize", "[10,32]")
		self.n = getattr(self, "n", 50)

		logging.info("finding word frequencies")

		self._findWordFreqs()

		final_freqs = []

		top_freqs = sorted(self.freqs.values())
		min_freq = top_freqs[-min(self.n,len(top_freqs))] # find nth frequency from end, or start of list
		logging.info("generating JSON")
		for word, freq in self.freqs.iteritems():
			if freq >= min_freq:
				final_freqs.append({'text': word, 'value': freq})
				

		params = {"DATA": json.dumps(final_freqs),
				"WIDTH": self.width,
				"HEIGHT": self.height,
				"FONTSIZE": self.fontsize
		}

		self.write_html(params)


if __name__ == "__main__":
	try:
		logging.basicConfig(filename=os.path.join(sys.argv[3], "logs", "wordcloud.log"), level=logging.INFO)
		processor = WordCloud(sys.argv, track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())