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
		# return [stem(word.strip('.,')) for word in line.split() if word.lower() not in self.stopwords]
		return [word for word in line.split() if word.lower() not in self.stopwords and word.isalpha()]

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
				

		logging.info("writing HTML output")

		with file(os.path.join(self.out_dir, self.name + self.collection + ".html"), 'w') as outfile:
			with file(self.template_filename) as template:
				template_str = template.read()
				template_str = template_str.replace("DATA", json.dumps(final_freqs))
				template_str = template_str.replace("WIDTH", self.width)
				template_str = template_str.replace("HEIGHT", self.height)
				template_str = template_str.replace("FONTSIZE", self.fontsize)

				outfile.write(template_str)

if __name__ == "__main__":
	try:
		logging.basicConfig(filename=os.path.join(sys.argv[3], "logs", "wordcloud.log"), level=logging.INFO)
		processor = WordCloud(sys.argv, track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())