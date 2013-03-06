#!/usr/bin/env python2.7
import sys, os, json, logging, urllib, urllib2, codecs, traceback
import textprocessor


class DBpedia(textprocessor.TextProcessor):
	"""
	annotates texts using DBpedia Spotlight
	"""

	def _basic_params(self):
		self.name = "dbpedia"
		self.dry_run = False
		self.require_stopwords = False

	def _get_annotated(self, text, confidence = 0.2, support = 20):
		values = {'text': text[0:10000].encode('utf-8'),
			'confidence': confidence,
			'support': support}
		data = urllib.urlencode(values)
		req = urllib2.Request(self.url, data, self.headers)
		response = urllib2.urlopen(req)
		annotation = response.read()
		encoding = req.headers.get('content-type', 'charset=utf8').split('charset=')[-1]

		return unicode(annotation, encoding)

	def process(self):
		"""
		create JSON files with named entity recognition by DBpedia
		"""

		logging.info("beginning annotation")

		self.url = "http://spotlight.dbpedia.org/rest/annotate"
		self.headers = {'Accept': 'application/json', 'content-type': 'application/x-www-form-urlencoded'}

		annotated = {}
		if not self.dry_run:
			for filename in self.files:
				logging.info("processing " + filename)
				self.update_progress()
				try:
					annotated_filename = filename.replace(".txt", "_dbpedia.json")
					if os.path.exists(annotated_filename):
						annotated[annotated_filename] = filename
					else:
						with codecs.open(filename, 'r', encoding='utf-8') as f:
							annotation = self._get_annotated(f.read())
							if len(annotation) > 0:
								annotated[annotated_filename] = filename
								with codecs.open(annotated_filename, 'w', encoding='utf-8') as out:
									out.write(annotation)
				except (KeyboardInterrupt, SystemExit):
					raise
				except:
					logging.error(traceback.format_exc())
		else:
			for filename in self.files:
				annotated_filename = filename.replace(".txt", "_dbpedia.json")
				if os.path.exists(annotated_filename):
					annotated[annotated_filename] = filename

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

		filtered_uris = {}
		weights = []
		for uri, items in uris_to_docs.iteritems():
			weights.append(sum(items.values()))
		weights.sort()
		min_weight = weights[max(-100, -len(weights))]

		for uri, items in uris_to_docs.iteritems():
			if sum(items.values()) > min_weight:
				filtered_uris[uri] = items

		# params = {"DATA": json.dumps(uris_to_docs)}
		params = {"URIS_TO_DOCS": filtered_uris}
		self.write_html(params)

		logging.info("finished")


if __name__ == "__main__":
	try:
		processor = DBpedia(track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())