#!/usr/bin/env python
import sys, os, logging, traceback
import wordcloud

class LargeWordCloud(wordcloud.WordCloud):
	"""
	Generate large word cloud
	"""
	def _adjustSize(self):
		self.width = "960"
		self.height = "500"
		self.fontsize = "[10,72]"
		self.name = "largewordcloud"
		self.n = 150

if __name__ == "__main__":
	try:
		logging.basicConfig(filename=os.path.join(sys.argv[3], "logs", "largewordcloud.log"), level=logging.INFO)
		processor = LargeWordCloud(sys.argv, track_progress=True)
		processor._adjustSize()
		processor.process()
	except:
		logging.error(traceback.format_exc())