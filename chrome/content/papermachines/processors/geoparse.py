#!/usr/bin/env python
import sys, os, json, logging, traceback, base64, time, codecs
import cPickle as pickle
from lib.placemaker import placemaker
from lib.placemaker.placemaker_api import placemaker_api_key
import textprocessor


class Geoparse(textprocessor.TextProcessor):
	"""
	Geoparsing using Yahoo! Placemaker
	"""

	def _basic_params(self):
		self.name = "geoparse"
		self.dry_run = False
		self.require_stopwords = False

	def process(self):
		"""
		create a JSON file with geographical data extracted from texts
		"""

		self.name = "geoparse"

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

		self.places_by_woeid = places_by_woeid
		max_country_weight = 0

		for place in sorted(places.keys()):
			if places[place]["type"] == "Country":
				country_sum = sum(places[place]["weight"].values())
				if country_sum > max_country_weight:
					max_country_weight = country_sum

		placeIDsToNames = {k: v["name"] for k, v in places_by_woeid.iteritems()}
		placeIDsToCoords = {k: v["coordinates"] for k, v in places_by_woeid.iteritems()}

		linksByYear = {}
		sources = {}

		for filename in self.files:
			if self.metadata[filename].get('city') is None or len(geo_parsed[filename]) < 2:
				continue
			try:
				title = os.path.basename(filename)
				itemID = self.metadata[filename]['itemID']
				year = self.metadata[filename]['year']
				if year not in linksByYear:
					linksByYear[year] = {}
				source = self.metadata[filename]['city']
				if source != None:
					if source not in sources:
						sources[source] = {}
					if year not in sources[source]:
						sources[source][year] = 0
					sources[source][year] += 1
				targets = geo_parsed[filename]
				for target in targets:
					edge = str(source) + ',' + str(target)
					if edge not in linksByYear[year]:
						linksByYear[year][edge] = 0
					linksByYear[year][edge] += 1
			except:
				logging.info(traceback.format_exc())

		years = sorted(linksByYear.keys())
		groupedLinksByYear = []

		for year in years:
			groupedLinksByYear.append([])
			for edge in linksByYear[year]:
				weight = linksByYear[year][edge]
				source, target = [int(x) for x in edge.split(',')]
				groupedLinksByYear[-1].append({'source': source, 'target': target, 'year': year, 'weight': weight})


		params = {"PLACEIDSTOCOORDS": json.dumps(placeIDsToCoords),
			"PLACEIDSTONAMES": json.dumps(placeIDsToNames),
			"PLACESMENTIONED": json.dumps({k : v["weight"] for k, v in places.iteritems() if v["type"] != "Country"}),
			"TEXTSFROMPLACE": json.dumps(sources),
			"COUNTRIES": json.dumps({v["name"] : v["weight"] for k, v in places.iteritems() if v["type"] == "Country"}),
			"MAX_COUNTRY_WEIGHT": str(max_country_weight),
			"STARTDATE": str(min([int(x["year"]) for x in self.metadata.values() if x["year"].isdigit() and x["year"] != "0000"])),
			"ENDDATE": str(max([int(x["year"]) for x in self.metadata.values() if x["year"].isdigit()])),
			"LINKS_BY_YEAR": json.dumps(groupedLinksByYear)
		}
		self.write_html(params)

		logging.info("finished")


if __name__ == "__main__":
	try:
		processor = Geoparse(track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())