#!/usr/bin/env python
import sys, os, logging, traceback, time, subprocess
import mallet

class MalletClassifierTest(mallet.Mallet):
	"""
	Train a classifier
	"""
	def _basic_params(self):
		self.dry_run = False
		self.name = "mallet_classify-file"
		self.dfr = False

	def process(self):

		self._setup_mallet_command()
		self._import_texts()

		self.mallet_classifier = self.extra_args[0]

		self.classified_filename = os.path.join(self.mallet_out_dir, "classified")

		process_args = self.mallet + ["cc.mallet.classify.tui.Csv2Classify",
			"--input", self.texts_file,
			"--classifier", self.mallet_classifier,
			"--output", self.classified_filename]

		logging.info("begin classifying texts")

		start_time = time.time()
		if not self.dry_run:
			classifier_return = subprocess.call(process_args, stdout=self.progress_file, stderr=self.progress_file)

		finished = "Classifier finished in " + str(time.time() - start_time) + " seconds"
		logging.info(finished)


		params = {'CLASSIFIED': file(self.classified_filename).read()}

		self.write_html(params)

if __name__ == "__main__":
	try:
		processor = MalletClassifierTest(track_progress=False)
		processor.process()
	except:
		logging.error(traceback.format_exc())