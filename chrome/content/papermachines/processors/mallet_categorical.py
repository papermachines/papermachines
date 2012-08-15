#!/usr/bin/env python
import sys, os, logging, traceback
import mallet

class MalletSubcollections(mallet.MalletLDA):
	"""
	Set topic modeling to categorical view by default
	"""
	def _categorical(self):
		self.name = "mallet_categorical"
		self.categorical = True
		self.template_name = "mallet"

if __name__ == "__main__":
	try:
		logging.basicConfig(filename=os.path.join(sys.argv[3], "logs", "mallet_categorical.log"), level=logging.INFO)
		processor = MalletSubcollections(sys.argv, track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())