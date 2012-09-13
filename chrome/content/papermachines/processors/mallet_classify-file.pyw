#!/usr/bin/env python
import sys, os, logging, traceback, time, subprocess, codecs, json
import mallet

class MalletClassifierTest(mallet.Mallet):
	"""
	Train a classifier
	"""
	def _basic_params(self):
		self.dry_run = False
		self.name = "mallet_classify-file"
		self.mallet_classifier = self.extra_args[0]
		self.dfr = len(self.extra_args) > 1
		if self.dfr:
			self.dfr_dir = self.extra_args[1]
		self.stemming = True

	def process(self):

		self._setup_mallet_command()
		self._import_texts()

		self.classified_filename = os.path.join(self.mallet_out_dir, "classified")

		process_args = self.mallet + ["cc.mallet.classify.tui.Csv2Classify",
			"--input", self.texts_file,
			"--line-regex", "^([^\\t]*)[\\t]([^\\t]*)[\\t](.*)$",
			"--classifier", self.mallet_classifier,
			"--output", self.classified_filename]

		logging.info("begin classifying texts")

		start_time = time.time()
#		if not self.dry_run:
		classifier_return = subprocess.call(process_args, stdout=self.progress_file, stderr=self.progress_file)

		finished = "Classifier finished in " + str(time.time() - start_time) + " seconds"
		logging.info(finished)

		classifications = {}
		for line in codecs.open(self.classified_filename, 'r', encoding='utf-8'):
			try:
				line_parts = line.split('\t')
				filename = line_parts.pop(0)
				probs = {y[0]: float(y[1]) for y in self.xpartition(line_parts)}
				classifications[filename] = self.argmax(probs)
			except:
				logging.error(traceback.format_exc())

		outfile_name = os.path.join(self.out_dir, "mallet_classify-file" + self.collection + ".json")

		with codecs.open(outfile_name, 'w', encoding='utf-8') as f:
			json.dump(classifications, f)

		params = {'CLASSIFIED': json.dumps(classifications)}

		self.write_html(params)

if __name__ == "__main__":
	try:
		processor = MalletClassifierTest(track_progress=False)
		processor.process()
	except:
		logging.error(traceback.format_exc())