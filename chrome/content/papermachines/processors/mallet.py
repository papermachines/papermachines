#!/usr/bin/env python
import sys, os, logging, tempfile, time, subprocess, math, re, urllib, json, codecs, csv, traceback
import xml.etree.ElementTree as et
from itertools import izip
import copy
import textprocessor

class Mallet(textprocessor.TextProcessor):
	"""
	Base class for MALLET functionality
	"""

	def _basic_params(self):
		self.name = "mallet"

	def _import_dfr_metadata(self, dfr_dir):
		citation_file = os.path.join(dfr_dir, "citations.CSV")
		citations = {}
		for rowdict in self.parse_csv(citation_file):
			doi = rowdict.pop("id")
			citations[doi] = rowdict
			self.metadata[doi] = {'title': citations[doi].get("title", ""), 'year': citations[doi].get('pubdate','')[0:4], 'label': "jstor", 'itemID': doi}
		return citations

	def _import_dfr(self, dfr_dir):
		citations = self._import_dfr_metadata(dfr_dir)

		wordcounts_dir = os.path.join(dfr_dir, "wordcounts")
		for doi in citations.keys():
			try:
				this_text = ''		
				for rowdict in self.parse_csv(os.path.join(wordcounts_dir, "wordcounts_" + doi.replace('/','_') + ".CSV")):
					word = rowdict["WORDCOUNTS"]
					count = int(rowdict["WEIGHT"])
					if word in self.stopwords:
						continue
					this_text += (word + u' ') * count
				if len(this_text) < 20:
					continue
				yield doi, this_text
			except:
				logging.error(doi)
				logging.error(traceback.format_exc())

	def _import_files(self):
		self.docs = []
		with codecs.open(self.texts_file, 'w', encoding='utf-8') as f:
			for filename in self.files:
				with codecs.open(filename, 'r', encoding='utf-8') as input_file:
					text = input_file.read()
					text = re.sub(r"[^\w ]+", u'', text.lower(), flags=re.UNICODE)
					f.write(u'\t'.join([filename, self.metadata[filename]["label"], text]) + u'\n')
					self.docs.append(filename)
			if self.dfr:
				for doi, text in self._import_dfr(self.dfr_dir):
					f.write(u'\t'.join([doi, self.metadata[doi]["label"], text]) + u'\n')
					self.docs.append(doi)
		self.doc_count = len(self.docs)

	def _tfidf_filter(self, top_terms = None, min_df = 5):
		vocab = {}
		inverse_vocab = {}
		df = {}
		tf = {}
		tf_all_docs = {}
		tfidf = {}

		i = 0
		with codecs.open(self.texts_file, 'r', encoding='utf-8') as f:
			for line in f:
				j = 0
				filename = ""
				for part in line.split(u'\t'):
					if j == 0:
						filename = part
					elif j == 2:
						tf_for_doc = {}
						flen = 0
						for word in part.split():
							if len(word) < 3:
								continue
							flen += 1
							if word not in vocab:
								vocab[word] = i
								tf_for_doc[i] = 1
								tf[i] = 0
								df[i] = 1
								i += 1
							else:
								index = vocab[word]
								if index not in tf_for_doc:
									tf_for_doc[index] = 0
									df[index] += 1
								tf_for_doc[index] += 1
						tf_all_docs[filename] = copy.deepcopy(tf_for_doc)
						for word_index in tf_for_doc.keys():
							tf_val = float(tf_for_doc[word_index])/flen
							if tf_val > tf[word_index]:
								tf[word_index] = tf_val
					j += 1
			self.tf_all_docs = tf_all_docs
			for index in vocab.values():
				tfidf[index] = tf[index] * math.log10(float(self.doc_count)/df[index])
			tfidf_values = tfidf.values()

			if top_terms is None:
				top_terms = min(len(vocab.keys()) * 0.7, 5000)
			min_score = sorted(tfidf_values, reverse=True)[min(top_terms, len(tfidf_values) - 1)]

		os.rename(self.texts_file, self.texts_file + '-pre_tf-idf')
		inverse_vocab = {v : k for k, v in vocab.iteritems()}
		new_vocab = {}

		with codecs.open(self.texts_file, 'w', encoding='utf-8') as f:
			for filename, freqs in tf_all_docs.iteritems():
				text = u''
				flen = 0
				for index, count in freqs.iteritems():
					if tfidf[index] < min_score or df[index] < min_df:
						continue
					word = inverse_vocab[index]
					if word in self.stopwords:
						continue
					if word not in new_vocab:
						new_vocab[word] = 0
					new_vocab[word] += count
					text += (word + u' ') * count
					flen += count
				if flen > 25:
					f.write(u'\t'.join([filename, self.metadata[filename]["label"], text]) + u'\n')
				else:
					self.docs.remove(filename)
		logging.info("tf-idf complete; retained {:} of {:} words; minimum tf-idf score: {:}".format(len(new_vocab.keys()), len(vocab.keys()), min_score))

	def _setup_mallet_command(self):
		self.mallet_cp_dir = os.path.join(self.cwd, "lib", "mallet-2.0.7", "dist")
		self.mallet_classpath = os.path.join(self.mallet_cp_dir, "mallet.jar") + ":" + os.path.join(self.mallet_cp_dir, "mallet-deps.jar")

		self.mallet = "java -Xmx1g -ea -Djava.awt.headless=true -Dfile.encoding=UTF-8 -server".split(' ')
		self.mallet += ["-classpath", self.mallet_classpath]

		self.mallet_out_dir = os.path.join(self.out_dir, self.name + self.collection)

		if not os.path.exists(self.mallet_out_dir):
			os.makedirs(self.mallet_out_dir)

		self.progress_filename = os.path.join(self.out_dir, self.name + self.collection + "progress.txt")
		self.progress_file = file(self.progress_filename, 'w')

	def _import_texts(self):

		logging.info("copying texts into single file")
		self.texts_file = os.path.join(self.mallet_out_dir, self.collection + ".txt")

		if not os.path.exists(self.texts_file):
			if not self.dry_run:
				self._import_files()
		else:
			if len(self.extra_args) > 0 and self.dfr:
				self._import_dfr_metadata(self.extra_args[0])
			self.docs = []
			with codecs.open(self.texts_file, 'r', 'utf-8') as f:
				for line in f:
					self.docs.append(line.split(u'\t')[0])
			self.doc_count = len(self.docs)

	def _setup_mallet_instances(self, sequence=True, tfidf = False):
		self._setup_mallet_command()
		self._import_texts()

		self.instance_file = os.path.join(self.mallet_out_dir, self.collection + ".mallet")

		logging.info("beginning text import")

		if tfidf and not self.dry_run:
			self._tfidf_filter()

		import_args = self.mallet + ["cc.mallet.classify.tui.Csv2Vectors", 
			"--remove-stopwords",
			"--stoplist-file", self.stoplist, 
			"--input", self.texts_file,
			"--token-regex", '[\p{L}\p{M}]+',
			"--output", self.instance_file]
		if sequence:
			import_args.append("--keep-sequence")

		if not self.dry_run and not os.path.exists(self.instance_file):
			import_return = subprocess.call(import_args, stdout=self.progress_file)	
	
	def process(self):
		"""
		Should be redefined!
		"""
		pass

if __name__ == "__main__":
	try:
		processor = Mallet(track_progress = False)
		processor.process()
	except:
		logging.error(traceback.format_exc())