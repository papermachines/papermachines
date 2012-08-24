#!/usr/bin/env python
import sys, os, logging, tempfile, time, subprocess, math, re, urllib, json, codecs, csv, traceback
import xml.etree.ElementTree as et
from itertools import izip
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
		with codecs.open(self.texts_file, 'w', encoding='utf-8') as f:
			for filename in self.files:
				with codecs.open(filename, 'r', encoding='utf-8') as input_file:
					text = input_file.read()
					text = re.sub(u"""[^\w,.'" ]+""", u'', text.replace(u"\n", u" "))
					f.write(u'\t'.join([filename.replace(u" ",u"_"), self.metadata[filename]["label"], text]) + u'\n')
			if self.dfr:
				for doi, text in self._import_dfr(self.dfr_dir):
					f.write(u'\t'.join([doi, self.metadata[doi]["label"], text]) + u'\n')

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

		if not self.dry_run and not os.path.exists(self.texts_file):
			self._import_files()
		elif len(self.extra_args) > 0 and self.dfr:
			self._import_dfr_metadata(self.extra_args[0])

	def _setup_mallet_instances(self, sequence=True):
		self._setup_mallet_command()
		self._import_texts()

		self.instance_file = os.path.join(self.mallet_out_dir, self.collection + ".mallet")

		import_args = self.mallet + ["cc.mallet.classify.tui.Csv2Vectors", 
			"--remove-stopwords",
			"--stoplist-file", self.stoplist, 
			"--input", self.texts_file,
			"--token-regex", '[\p{L}\p{M}]+',
			"--output", self.instance_file]
		if sequence:
			import_args.append("--keep-sequence")


		logging.info("beginning text import")
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