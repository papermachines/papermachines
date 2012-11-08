#!/usr/bin/env python2.7
import sys, os, json, logging, traceback, base64, time, codecs
import cPickle as pickle
from lib.placemaker import placemaker
from lib.placemaker.placemaker_api import placemaker_api_key
import textprocessor


class Geoparser(textprocessor.TextProcessor):
	"""
	Geoparsing using Yahoo! Placemaker -- base class only, do not use!
	"""

	def _basic_params(self):
		self.name = "geoparser"
		self.dry_run = False
		self.require_stopwords = False

	def run_geoparser(self):
		p = placemaker(base64.b64decode(placemaker_api_key))
		
		geo_parsed = {}
		places_by_woeid = {}

		for filename in self.files:
			logging.info("processing " + filename)
			self.update_progress()

			file_geoparsed = filename.replace(".txt", "_geoparse.json")

			if os.path.exists(file_geoparsed):
				geoparse_obj = json.load(file(file_geoparsed))
			elif not self.dry_run:
				geoparse_obj = {'places_by_woeid': {}, 'references': {}}
				try:
					# id = self.metadata[filename]['itemID']
					str_to_parse = self.metadata[filename]['place']
					last_index = len(str_to_parse)
					str_to_parse += codecs.open(filename, 'r', encoding='utf8').read()[0:(48000 - last_index)] #50k characters, shortened by initial place string

					city = None
					places = []
					
					p.find_places(str_to_parse.encode('utf8', 'ignore'))
					with codecs.open(filename.replace('.txt', '_geoparse.xml'), 'w', encoding='utf8') as xml_file:
						xml_file.write(p.response.read())
					for woeid, referenced_place in p.referencedPlaces.iteritems():
						place = referenced_place["place"]
						geoparse_obj['places_by_woeid'][woeid] = {'name': place.name, 'type': place.placetype, 'coordinates': [place.centroid.longitude, place.centroid.latitude]}

						for reference in referenced_place["references"]:
							if reference.start < last_index:
								city = woeid
							else:
								places.append(woeid)
								if not woeid in geoparse_obj['references']:
									geoparse_obj['references'][woeid] = []
								geoparse_obj['references'][woeid].append((reference.start - last_index, reference.end - last_index))

					geoparse_obj['places'] = places
					geoparse_obj['city'] = city
					json.dump(geoparse_obj, file(file_geoparsed, 'w'))
					time.sleep(0.2)
				except (KeyboardInterrupt, SystemExit):
					raise
				except:
					logging.error(traceback.format_exc())

			geo_parsed[filename] = geoparse_obj.get('places', [])
			self.metadata[filename]['city'] = geoparse_obj.get('city')
			for woeid, data in geoparse_obj.get('places_by_woeid', {}).iteritems():
				places_by_woeid[int(woeid)] = data

		places = {}
		for filename, woeids in geo_parsed.iteritems():
			year = self.metadata[filename]["year"]
			for woeid in woeids:
				if woeid in places_by_woeid:
					if woeid not in places:
						places[woeid] = {}
						places[woeid]["name"] = places_by_woeid[woeid]["name"]
						places[woeid]["type"] = places_by_woeid[woeid]["type"]
						places[woeid]["coordinates"] = places_by_woeid[woeid]["coordinates"]
						places[woeid]["weight"] = {year: 1}
					else:
						if year not in places[woeid]["weight"]:
							places[woeid]["weight"][year] = 1
						else:
							places[woeid]["weight"][year] += 1
		self.geo_parsed = geo_parsed
		self.places = places
		self.places_by_woeid = places_by_woeid