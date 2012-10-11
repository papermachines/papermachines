#!/usr/bin/env python2.7
import sys, os, csv, logging, tempfile, traceback, urllib, codecs, json, operator, platform
from itertools import izip

class TextProcessor:
	"""
	Base class for text processing in Paper Machines
	"""

	def __init__(self, track_progress=True):
		self.sys = platform.system()
		
		# take in command line options

		self.args_filename = sys.argv[1]
		self.args_basename = os.path.basename(self.args_filename).replace(".json", "")

		with codecs.open(self.args_filename, 'r', encoding='utf-8') as args_file:
			args = json.load(args_file)

		self.cwd = args[0]
		csv_file = args[1]
		self.out_dir = args[2]
		self.collection_name = args[3]
		self.extra_args = args[4:]

		if "json" in self.extra_args:
			json_starts_at = self.extra_args.index("json")
			self.named_args = json.loads(self.extra_args[json_starts_at + 1])
			self.extra_args = self.extra_args[:json_starts_at]
		else:
			self.named_args = None

		self.collection = os.path.basename(csv_file).replace(".csv","")

		self.require_stopwords = True # load stopwords by default

		# call a function to set processor name, etc.
		self._basic_params()

		if self.require_stopwords:
			self.stoplist = os.path.join(self.cwd, "stopwords.txt")
			self.stopwords = [x.strip() for x in codecs.open(self.stoplist, 'r', encoding='utf-8').readlines()]

		self.out_filename = os.path.join(self.out_dir, self.name + self.collection + "-" + self.args_basename + ".html")

		# logging.basicConfig(filename=os.path.join(self.out_dir, "logs", self.name + ".log"), level=logging.INFO)
		logging.basicConfig(filename=self.out_filename.replace(".html", ".log"), filemode='w', level=logging.INFO)

		fh = logging.FileHandler(os.path.join(self.out_dir, "logs", self.name + ".log"))
		formatter = logging.Formatter('%(name)s: %(levelname)-8s %(message)s')
		fh.setFormatter(formatter)

		logging.getLogger('').addHandler(fh)

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
			self.progress_file.write('<' + str(int(self.count*1000.0/float(self.total))) + '>\n')
			self.progress_file.flush()

	def xpartition(self, seq, n=2):
		return izip(*(iter(seq),) * n)

	def argmax(self, obj):
		if hasattr(obj, "index"):
			return obj.index(max(obj))
		elif hasattr(obj, "iteritems"):
			return max(obj.iteritems(), key=operator.itemgetter(1))[0]

	def write_html(self, user_params):
		logging.info("writing HTML")
		params = {"COLLECTION_NAME": self.collection_name, "DOC_METADATA": json.dumps({v["itemID"]: v for k, v in self.metadata.iteritems()})}
		params.update(user_params)
		try:
			template_filename = getattr(self, "template_filename", os.path.join(self.cwd, "templates", self.name + ".html"))

			with codecs.open(self.out_filename, 'w', encoding='utf-8') as outfile:
				with codecs.open(template_filename, 'r', encoding='utf-8') as template:
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