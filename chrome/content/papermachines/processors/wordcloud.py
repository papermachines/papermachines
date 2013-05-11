#!/usr/bin/env python2.7
import sys, os, json, cStringIO, tempfile, logging, traceback, codecs, math
import textprocessor
from collections import Counter
from lib.stemutil import stem

class WordCloud(textprocessor.TextProcessor):
	"""
	Generate word cloud
	"""
	def _basic_params(self):
		self.name = "wordcloud"
		self.width = 300
		self.height = 150
		self.fontsize = [10, 32]
		self.n = 50
		self.ngram = 1
		self.tfidf_scoring = False

	def _findTfIdfScores(self, scale=True):
		self.freqs = Counter()
		self.tf_by_doc = {}
		self.max_tf = {}
		self.df = Counter()
		ngram = 1 if not hasattr(self, "ngram") else self.ngram
		self.stemming = getattr(self, "stemming", False)
		for filename in self.files:
			flen = 0
			self.tf_by_doc[filename] = self.getNgrams(filename, n = ngram, stemming = self.stemming)
			flen = sum(self.tf_by_doc[filename].values())
			self.df.update(self.tf_by_doc[filename].keys())

			self.freqs.update(self.tf_by_doc[filename])

			for stem in self.tf_by_doc[filename].keys():
				if scale:
					self.tf_by_doc[filename][stem] /= float(flen) #max_tf_d
					this_tf = self.tf_by_doc[filename][stem]
				else:
					this_tf = self.tf_by_doc[filename][stem] / float(flen)

				if stem not in self.max_tf or self.max_tf[stem] < this_tf:
					self.max_tf[stem] = this_tf
			self.update_progress()
		n = float(len(self.files))
		self.idf = dict((term, math.log10(n/df)) for term, df in self.df.iteritems())
		self.tfidf = dict((term, self.max_tf[term] * self.idf[term]) for term in self.max_tf.keys())
		tfidf_values = self.tfidf.values()
		top_terms = min(int(len(self.freqs.keys()) * 0.7), 5000)
		min_score = sorted(tfidf_values, reverse=True)[min(top_terms, len(tfidf_values) - 1)]
		self.filtered_freqs = dict((term, freq) for term, freq in self.freqs.iteritems() if self.tfidf[term] > min_score and self.df[term] > 3)

	def _topN(self, freqs, n = None):
		if n is None:
			n = self.n
		final_freqs = []
		top_freqs = sorted(freqs.values())
		if len(top_freqs) == 0:
			return []
		min_freq = top_freqs[-min(n,len(top_freqs))] # find nth frequency from end, or start of list
		for word, freq in freqs.iteritems():
			if freq >= min_freq:
				final_freqs.append({'text': word, 'value': freq})
		return final_freqs

	def _mostExtremeN(self, freqs, n = None):
		if n is None:
			n = self.n
		final_freqs = []
		freqs_sort = sorted(freqs.values())
		if len(freqs_sort) == 0:
			return []
		min_freq_top = freqs_sort[-min(n/2,len(freqs_sort))]
		max_freq_bottom = freqs_sort[min(n/2, len(freqs_sort) - 1)]
		for word, freq in freqs.iteritems():
			if freq >= min_freq_top or freq < max_freq_bottom:
				final_freqs.append({'text': word, 'value': freq})
		return final_freqs

	def _findWordFreqs(self, filenames):
		self.stemming = getattr(self, "stemming", False)
		freqs = Counter()
		for filename in filenames:
			freqs.update(self.getNgrams(filename, stemming = self.stemming))
			self.update_progress()
		return self._topN(freqs)

	def process(self):
		logging.info("starting to process")

		self.template_filename = os.path.join(self.cwd, "templates", "wordcloud.html")

		logging.info("finding word frequencies")

		if self.tfidf_scoring:
			self._findTfIdfScores()
			freqs = self._topN(self.filtered_freqs)
		else:
			freqs = self._findWordFreqs(self.files)

		params = {"DATA": freqs,
				"WIDTH": self.width,
				"HEIGHT": self.height,
				"FONTSIZE": self.fontsize,
				"FORMAT": u"tf-idf: {0}" if self.tfidf_scoring else u"{0} occurrences in corpus"
		}

		self.write_html(params)


if __name__ == "__main__":
	try:
		processor = WordCloud(track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())