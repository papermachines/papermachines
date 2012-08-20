#!/usr/bin/env python
import sys, os, json, logging, urllib, urllib2, codecs, traceback
import textprocessor


class DBpedia(textprocessor.TextProcessor):
	"""
	annotates texts using DBpedia Spotlight
	"""

	def _basic_params(self):
		self.name = "dbpedia"
		self.dry_run = False

	def _get_annotated(self, text, confidence = 0.2, support = 20):
		values = {'text': text[0:10000].encode('utf-8'),
			'confidence': confidence,
			'support': support}
		data = urllib.urlencode(values)
		req = urllib2.Request(self.url, data, self.headers)
		response = urllib2.urlopen(req)
		annotation = response.read()
		encoding = req.headers.get('content-type', 'charset=latin1').split('charset=')[-1]

		return unicode(annotation, encoding)

	def process(self):
		"""
		create a folder of JSON files with named entity recognition by DBpedia
		"""

		annotations_out_dir = os.path.join(self.out_dir, self.name + self.collection)
		if not os.path.exists(annotations_out_dir):
			os.makedirs(annotations_out_dir)

		logging.info("beginning annotation")

		self.url = "http://spotlight.dbpedia.org/rest/annotate"
		self.headers = {'Accept': 'application/json', 'content-type': 'application/x-www-form-urlencoded'}

		annotated = {}
		if not self.dry_run:
			for filename in self.files:
				logging.info("processing " + filename)
				self.update_progress()
				try:
					with codecs.open(filename, 'r', encoding='utf-8') as f:
						annotation = self._get_annotated(f.read())
						if len(annotation) > 0:
							out_filename = os.path.join(annotations_out_dir, os.path.basename(filename).replace(".txt",".json"))
							annotated[out_filename] = filename
							with codecs.open(out_filename, 'w', encoding='utf-8') as out:
								out.write(annotation)
				except (KeyboardInterrupt, SystemExit):
					raise
				except:
					logging.error(traceback.format_exc())
		else:
			for filename in self.files:
				out_filename = os.path.join(annotations_out_dir, os.path.basename(filename).replace(".txt",".json"))
				if os.path.exists(out_filename):
					annotated[out_filename] = filename

		uris_to_docs = {}
		for json_annotation, filename in annotated.iteritems():
			itemID = self.metadata[filename]["itemID"]
			notes = json.load(file(json_annotation))
			entities = notes.get("Resources", [])
			for entity in entities:
				uri = entity.get("@URI", "http://dbpedia.org/resource/")
				if not uri in uris_to_docs:
					uris_to_docs[uri] = {}
				if not itemID in uris_to_docs[uri]:
					uris_to_docs[uri][itemID] = 0
				uris_to_docs[uri][itemID] += 1


		params = {"DATA": json.dumps(uris_to_docs)}
		self.write_html(params)

		logging.info("finished")


if __name__ == "__main__":
	try:
		processor = DBpedia(track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())