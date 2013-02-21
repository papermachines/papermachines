#!/usr/bin/env python2.7
import sys, os, json, csv, re, shutil, logging, traceback, base64, time, codecs, urllib
import cPickle as pickle
import geoparser

class GeoparserExport(geoparser.Geoparser):
	"""
	Export geoparsing results
	"""

	def _basic_params(self):
		self.name = "geoparser_export"
		self.dry_run = False
		self.require_stopwords = False

	def _sanitize_context(self, context):
		return re.sub(r'[^\w ]+', u' ', context, flags=re.UNICODE)

	def process(self):
		"""
		create a JSON file with geographical data extracted from texts
		"""

		self.run_geoparser()

		header = ["name", "lat", "lng", "entityURI", "itemID", "context"]

		csv_output_filename = os.path.join(self.out_dir, self.name + self.collection + '.csv')
		with open(csv_output_filename, 'wb') as f:
			exportWriter = csv.writer(f)
			exportWriter.writerow(header)

			for filename in self.files:
				file_geoparsed = filename.replace(".txt", "_geoparse.json")

				if os.path.exists(file_geoparsed):
					geoparse_obj = json.load(file(file_geoparsed))
				else:
					continue # stop here if no geoparser results

				try:
					title = os.path.basename(filename)
					itemID = self.metadata[filename]['itemID']
					year = self.metadata[filename]['year']
					text = codecs.open(filename, 'r', encoding='utf-8', errors='ignore').read()
					maximum_length = len(text)

					for entityURI, ranges in geoparse_obj["references"].iteritems():
						place = geoparse_obj["places_by_entityURI"][entityURI]
						name = place["name"]
						row_dict = {}
						row_dict["name"] = name
						row_dict["itemID"] = itemID
						row_dict["entityURI"] = entityURI
						row_dict["lat"] = place["coordinates"][1]
						row_dict["lng"] = place["coordinates"][0]

						offset = 15
						for context_range in ranges:
							context = text[max(context_range[0] - offset, 0):min(context_range[1] + offset, maximum_length)]
							row_dict["context"] = self._sanitize_context(context)
							exportWriter.writerow([unicode(row_dict.get(x, '')).encode('utf-8') for x in header])

				except:
					logging.info(traceback.format_exc())

		params = {"CSVPATH": csv_output_filename}
#			"CSVFILEURL": "file://" + urllib.pathname2url(os.path.dirname(csv_output_filename))}
		self.write_html(params)

		logging.info("finished")


if __name__ == "__main__":
	try:
		processor = GeoparserExport(track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())