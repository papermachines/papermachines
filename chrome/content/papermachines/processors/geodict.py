#!/usr/bin/env python
import sys, os, json, logging, traceback
import lib.geodict.geodict_lib as geodict_lib
import textprocessor


class GeoDict(textprocessor.TextProcessor):
	"""
	Geoparsing using a fork of Pete Warden's geodict
	"""

	def process(self):
		"""
		create a JSON file with geographical data extracted from texts
		"""

		self.name = "geodict"

		out_filename = os.path.join(self.out_dir, self.name + self.collection + '.json')
		output = file(out_filename, 'w')

		geo_parsed = {}
		for filename in self.files:
			logging.info("processing " + filename)
			self.update_progress()
			try:
				# id = self.metadata[filename]['itemID']
				city = geodict_lib.find_location_in_string(self.metadata[filename]['place'])
				geo_parsed[filename] = geodict_lib.find_locations_in_text(file(filename).read())
				if city is not None:
					self.metadata[filename]['city'] = city
					geo_parsed[filename].append(city)
			except:
				pass

		logging.info("writing JSON")
		output.write(json.dumps(geo_parsed))
		output.close()

		data_filename = os.path.join(self.out_dir, self.name + self.collection + '.js')

		places = {}
		places_for_doc = {}
		for filename, place_array in geo_parsed.iteritems():
			year = self.metadata[filename]["year"]
			places_for_doc[filename] = {}
			for place_tokens in place_array:
				for place_dict in place_tokens["found_tokens"]:
					name = place_dict["matched_string"]
					if name not in places:
						places[name] = {x: place_dict[x] for x in ["type", "lon", "lat"]}
						places[name]["name"] = name
						places[name]["weight"] = {year: 1}
					else:
						if year not in places[name]["weight"]:
							places[name]["weight"][year] = 1
						else:
							places[name]["weight"][year] += 1
					if name not in places_for_doc[filename]:
						places_for_doc[filename][name] = 1
					else:
						places_for_doc[filename][name] += 1

		places_array = []
		places_index = {}

		max_country_weight = 0

		i = 0
		for place in sorted(places.keys()):
			places_array.append(places[place])
			if places[place]["type"] == "COUNTRY":
				country_sum = sum(places[place]["weight"].values())
				if country_sum > max_country_weight:
					max_country_weight = country_sum
			places_index[place] = i
			i += 1

		placeIDsToNames = {v : k for k, v in places_index.iteritems()}
		placeIDsToCoords = {places_index[k] : [v['lon'], v['lat']] for k, v in places.iteritems()}

		linksByYear = {}
		for filename in self.files:
			if not 'city' in self.metadata[filename] or len(geo_parsed[filename]) < 2:
				continue
			try:
				title = os.path.basename(filename)
				itemID = self.metadata[filename]['itemID']
				year = self.metadata[filename]['year']
				if year not in linksByYear:
					linksByYear[year] = {}
				source = places_index[self.metadata[filename]['city']['found_tokens'][0]['matched_string']]
				targets = [places_index[name] for name in places_for_doc[filename].keys()]
				for target in targets:
					edge = str(source) + ',' + str(target)
					if edge not in linksByYear[year]:
						linksByYear[year][edge] = 1
					else:
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


		data_vars = {"placeIDsToCoords": placeIDsToCoords,
			"placeIDsToNames": placeIDsToNames,
			"placesMentioned": {places_index[k] : v["weight"] for k, v in places.iteritems() if v["type"] != "COUNTRY"},
			"countries": {k : v["weight"] for k, v in places.iteritems() if v["type"] == "COUNTRY"},
			"max_country_weight": max_country_weight,
			"startDate": min([int(x["year"]) for x in self.metadata.values() if x["year"].isdigit()]),
			"endDate": max([int(x["year"]) for x in self.metadata.values() if x["year"].isdigit()])
		}

		data = ""

		for k, v in data_vars.iteritems():
			data += "var "+ k + "=" + json.dumps(v) + ";\n";

		logging.info("writing JS include file")

		with file(data_filename, 'w') as data_file:
			data_file.write(data)

		params = {"DATA_FILE": os.path.basename(data_filename), "LINKS_BY_YEAR": json.dumps(groupedLinksByYear)}
		self.write_html(params)

		logging.info("finished")


if __name__ == "__main__":
	try:
		processor = GeoDict(track_progress=True)
		processor.process()
	except:
		logging.error(traceback.format_exc())