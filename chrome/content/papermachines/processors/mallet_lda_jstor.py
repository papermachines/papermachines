#!/usr/bin/env python
import sys, os, logging, traceback
import mallet_lda

class MalletJSTOR(mallet_lda.MalletLDA):
	"""
	Alias to distinguish mallet queries with JSTOR attached
	"""
	def _basic_params(self):
		self.name = "mallet_lda"
		self.categorical = False
		self.template_name = "mallet_lda"
		self.dry_run = False
		self.topics = 50
		self.dfr = len(self.extra_args) > 0
		if self.dfr:
			self.dfr_dir = self.extra_args[0]

if __name__ == "__main__":
	try:
		processor = MalletJSTOR(track_progress=False)
		processor.process()
	except:
		logging.error(traceback.format_exc())