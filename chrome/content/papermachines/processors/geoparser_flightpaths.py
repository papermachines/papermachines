#!/usr/bin/env python2.7
import sys, os, json, logging, traceback, base64, time, codecs
import cPickle as pickle
from lib.placemaker import placemaker
from lib.placemaker.placemaker_api import placemaker_api_key
import geoparser

class GeoparserFlightPaths(geoparser.Geoparser):
	"""
	Geoparsing using Yahoo! Placemaker
	"""

	def _basic_params(self):
		self.name = "geoparser_flightpaths"
		self.dry_run = False
		self.require_stopwords = False

	def process(self):
		"""
		create a JSON file with geographical data extracted from texts
		"""

		self.run_geoparser()

		max_country_weight = 0

		for place in sorted(self.places.keys()):
			if self.places[place]["type"] == "Country":
				country_sum = sum(self.places[place]["weight"].values())
				if country_sum > max_country_weight:
					max_country_weight = country_sum

		placeIDsToNames = {k: v["name"] for k, v in self.places_by_woeid.iteritems()}
		placeIDsToCoords = {k: v["coordinates"] for k, v in self.places_by_woeid.iteritems()}

		linksByYear = {}
		sources = {}

		for filename in self.files:
			if self.metadata[filename].get('city') is None or len(self.geo_parsed[filename]) < 2:
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
				targets = self.geo_parsed[filename]
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
			"PLACESMENTIONED": json.dumps({k : v["weight"] for k, v in self.places.iteritems() if v["type"] != "Country"}),
			"TEXTSFROMPLACE": json.dumps(sources),
			"COUNTRIES": json.dumps({v["name"] : v["weight"] for k, v in self.places.iteritems() if v["type"] == "Country"}),
			"MAX_COUNTRY_WEIGHT": str(max_country_weight),
			"STARTDATE": str(min([int(x["year"]) for x in self.metadata.values() if x["year"].isdigit() and x["year"] != "0000"])),
			"ENDDATE": str(max([int(x["year"]) for x in self.metadata.values() if x["year"].isdigit()])),
			"LINKS_BY_YEAR": json.dumps(groupedLinksByYear)
		}
		self.write_html(params)

		logging.info("finished")


if __name__ == "__main__":
	try:
		processor = GeoparserFlightPaths(track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())