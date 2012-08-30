#!/usr/bin/env python
import sys, os, csv, logging, tempfile, traceback, urllib, codecs, json

class TextProcessor:
	"""
	Base class for text processing in Paper Machines
	"""

	def __init__(self, track_progress=True):
		# take in command line options
		self.cwd = sys.argv[1]
		csv_file = sys.argv[2]
		self.out_dir = sys.argv[3]
		self.collection_name = sys.argv[4]
		self.extra_args = sys.argv[5:]

		self.collection = os.path.basename(csv_file).replace(".csv","")

		self.require_stopwords = True # load stopwords by default

		# call a function to set processor name, etc.
		self._basic_params()

		if self.require_stopwords:
			self.stoplist = os.path.join(self.cwd, "stopwords.txt")
			self.stopwords = [x.strip() for x in codecs.open(self.stoplist, 'r', encoding='utf-8').readlines()]

		logging.basicConfig(filename=os.path.join(sys.argv[3], "logs", self.name + ".log"), level=logging.INFO)

		logging.info("command: " + ' '.join([x.replace(' ','''\ ''') for x in sys.argv]))

		self.metadata = {}

		for rowdict in self.parse_csv(csv_file):
			filename = rowdict.pop("filename")
			self.metadata[filename] = rowdict

		self.files = self.metadata.keys()
		if track_progress:
			self.track_progress = True
			self.progress_initialized = False

	def _basic_params(self):
		self.name = "textprocessor"

	def parse_csv(self, filename, dialect=csv.excel, **kwargs):
		with file(filename, 'rb') as f:
			csv_rows = self.unicode_csv_reader(f, dialect=dialect, **kwargs)
			header = csv_rows.next()
			for row in csv_rows:
				if len(row) > 0:
					rowdict = dict(zip(header, row))
					yield rowdict

	def unicode_csv_reader(self, utf8_data, dialect=csv.excel, **kwargs):
		csv_reader = csv.reader(utf8_data, dialect=dialect, **kwargs)
		for row in csv_reader:
			yield [unicode(cell, 'utf-8') for cell in row]

	def update_progress(self):
		if self.track_progress:
			if not self.progress_initialized:
				self.progress_filename = os.path.join(self.out_dir, self.name + self.collection + "progress.txt")
				self.progress_file = file(self.progress_filename, 'w')
				self.count = 0
				self.total = len(self.files)
				self.progress_initialized = True

			self.count += 1
			self.progress_file.write('<' + str(self.count*1000.0/float(self.total)) + '>\n')
			self.progress_file.flush()

	def write_html(self, user_params):
		logging.info("writing HTML")
		params = {"COLLECTION_NAME": self.collection_name, "DOC_METADATA": json.dumps({v["itemID"]: v for k, v in self.metadata.iteritems()})}
		params.update(user_params)
		try:
			template_filename = getattr(self, "template_filename", os.path.join(self.cwd, "templates", self.name + ".html"))
			additional_arg_str = "_" + "_".join([urllib.quote_plus(x).replace('+',"%20") for x in self.extra_args]) if len(self.extra_args) > 0 else ""
			out_filename = getattr(self, "out_filename", os.path.join(self.out_dir, self.name + self.collection + additional_arg_str + ".html"))
			with file(out_filename, 'w') as outfile:
				with file(template_filename) as template:
					template_str = template.read()
					for k, v in params.iteritems():
						template_str = template_str.replace(k, v)
					outfile.write(template_str)
		except:
			logging.error(traceback.format_exc())

	def process(self):
		"""
		Example process -- should be overridden
		"""
		output = file(os.path.join(self.out_dir, self.name + '.txt'), 'w')
		for filename in self.files:
			output.write(' '.join([filename, self.metadata[filename]]) + '\n')
		output.close()

if __name__ == "__main__":
	try:
		processor = TextProcessor(track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())