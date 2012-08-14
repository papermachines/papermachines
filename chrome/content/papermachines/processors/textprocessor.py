#!/usr/bin/env python
import sys, os, csv, logging, tempfile, traceback

class TextProcessor:
	"""
	Base class for text processing in Paper Machines
	"""

	def __init__(self, sysargs, track_progress=True):
		logging.info("command: " + ' '.join([x.replace(' ','''\ ''') for x in sysargs]))
		self.cwd = sysargs[1]
		csv_file = sysargs[2]
		self.out_dir = sysargs[3]

		self.extra_args = sysargs[4:]

		self.collection = os.path.basename(csv_file).replace(".csv","")
		self.metadata = {}

		# parse CSV
		csv_rows = csv.reader(file(csv_file, 'rb'))
		header = csv_rows.next()

		for row in csv_rows:
			rowdict = dict(zip(header, row))
			filename = rowdict.pop("filename")
			self.metadata[filename] = rowdict

		self.files = self.metadata.keys()
		if track_progress:
			self.track_progress = True
			self.progress_initialized = False


	def update_progress(self):
		if self.track_progress:
			if not self.progress_initialized:
				self.progress_filename = os.path.join(self.out_dir, self.name + self.collection + "progress.txt")
				self.progress_file = file(self.progress_filename, 'w')
				self.count = 0
				self.total = len(self.files)

			self.count += 1
			self.progress_file.write('<' + str(self.count*1000.0/float(self.total)) + '>\n')
			self.progress_file.flush()

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
		logging.basicConfig(filename=os.path.join(sys.argv[3], "logs", "textprocessor.log"), level=logging.INFO)
		processor = TextProcessor(sys.argv, track_progress = True)
		processor.process()
	except:
		logging.error(traceback.format_exc())