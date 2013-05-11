#!/usr/bin/env python2.7
import sys, os, json, logging, traceback, base64, time, codecs, urllib, urllib2
from collections import defaultdict
from lib.classpath import classPathHacker

import textprocessor

class Geoparser(textprocessor.TextProcessor):
    """
    Geoparsing using Pete Warden's geodict
    """

    def get_containing_paragraph(self, text, match):
        start = match[0]
        end = match[1]
        chars_added = 0
        c = text[start]
        while c != '\n' and chars_added < 50 and start > 0:
            start -= 1
            chars_added += 1
            c = text[start]

        chars_added = 0
        end = min(len(text) - 1, end)
        c = text[end]

        while c != '\n' and chars_added < 50 and end < len(text):
            c = text[end]
            end += 1
            chars_added += 1

        return text[start:end]

    def contexts_from_geoparse_obj(self, geoparse_obj, filename):
        contexts_obj = defaultdict(list)
        with codecs.open(filename, 'rU', encoding='utf-8') as f:
            text = f.read()

        for entityURI, matchlist in geoparse_obj.get("references", {}).iteritems():
            for match in matchlist:
                paragraph = self.get_containing_paragraph(text, match)
                geonameid = entityURI.split('/')[-1]
                contexts_obj[geonameid].append(paragraph)

        contexts_json = filename.replace(".txt", "_contexts.json")
        contexts_obj = dict(contexts_obj)
        with file(contexts_json, 'w') as f:
            json.dump(contexts_obj, f)
        return contexts_obj

    def get_places(self, string, find_func):
        try:
            geodict_locations = find_func(string)
            for location in geodict_locations:
                found_tokens = location['found_tokens']
                start_index = found_tokens[0]['start_index']
                end_index = found_tokens[len(found_tokens)-1]['end_index']
                name = string[start_index:(end_index+1)]
                geonameid = found_tokens[0].get('geonameid', None)
                entityURI = "http://sws.geonames.org/" + str(geonameid) if geonameid else None
                geotype = found_tokens[0]['type'].lower()
                lat = found_tokens[0]['lat']
                lon = found_tokens[0]['lon']

                if entityURI is None:
                    continue

                place = {"name": name, "entityURI": entityURI, "latitude": lat, "longitude": lon, "type": geotype}
                reference = [start_index, end_index]
                yield place, reference
        except:
            logging.error(traceback.format_exc())

    def run_geoparser(self):
        import __builtin__
        jarLoad = classPathHacker()
        sqlitePath = os.path.join(self.cwd, "lib", "geodict", "sqlite-jdbc-3.7.2.jar")
        jarLoad.addFile(sqlitePath)

        import lib.geodict.geodict_config

        self.database_path = os.path.join(self.cwd, "lib", "geodict", "geodict.db")

        from lib.geodict.geodict_lib import GeodictParser

        geo_parsed = {}
        places_by_entityURI = {}

        self.cache_filename = os.path.join(self.out_dir, "geoparser.cache")
        if os.path.exists(self.cache_filename):
            self.cache = json.load(file(self.cache_filename))
        else:
            self.cache = {}

        for filename in self.files:
            logging.info("processing " + filename)
            self.update_progress()

            file_geoparsed = filename.replace(".txt", "_geoparse.json")
            contexts_json = filename.replace(".txt", "_contexts.json")

            if os.path.exists(file_geoparsed):
                try:
                    geoparse_obj = json.load(file(file_geoparsed))
                    if "places_by_entityURI" in geoparse_obj:
                        if not os.path.exists(contexts_json):
                            self.contexts_from_geoparse_obj(geoparse_obj, filename)
                        continue
                    else:
                        os.remove(file_geoparsed)
                except:
                    logging.error("File " + file_geoparsed + " could not be read.")
                    logging.error(traceback.format_exc())

            if not self.dry_run:
                geoparse_obj = {'places_by_entityURI': {}, 'references': {}}
                try:
                    id = self.metadata[filename]['itemID']
                    str_to_parse = self.metadata[filename]['place']
                    last_index = len(str_to_parse)
                    str_to_parse += codecs.open(filename, 'rU', encoding='utf8').read()

                    city = None
                    places = set()

                    json_filename = filename.replace('.txt', '_geodict.json')

                    if not os.path.exists(json_filename):
                        parser = GeodictParser(self.database_path)
                        places_found = list(self.get_places(str_to_parse, parser.find_locations_in_text))
                        with codecs.open(json_filename, 'w', encoding='utf8') as json_file:
                            json.dump(places_found, json_file)
                    else:
                        with codecs.open(json_filename, 'r', encoding='utf8') as json_file:
                            places_found = json.load(json_file)

                    for (place, reference) in places_found:
                        entityURI = place["entityURI"]
                        geoparse_obj['places_by_entityURI'][entityURI] = {'name': place["name"], 'type': place["type"], 'coordinates': [place["longitude"], place["latitude"]]}

                        if reference[0] < last_index:
                            city = entityURI
                        else:
                            places.add(entityURI)
                            if not entityURI in geoparse_obj['references']:
                                geoparse_obj['references'][entityURI] = []
                            geoparse_obj['references'][entityURI].append((reference[0] - last_index, reference[1] - last_index))

                    if city is None and self.metadata[filename]['place'] != "":
                        try:
                            query_str = self.metadata[filename]['place']
                            if query_str in self.cache:
                                result = self.cache.get(query_str)
                                if result is not None:
                                    geoparse_obj['places_by_entityURI'][result["entityURI"]] = {'name': result["name"], 'type': result["fcodeName"], 'coordinates': [result["lng"], result["lat"]]}
                                    places.add(result["entityURI"])
                                    city = result["entityURI"]
                            else:
                                search_for = {"q": query_str}
                                query_url = "http://ws.geonames.org/searchJSON?%s" % urllib.urlencode(search_for)
                                result_obj = json.load(urllib2.urlopen(query_url))
                                result_places = result_obj.get("geonames", [])
                                if len(result_places) > 0:
                                    result_place = result_places[0]
                                    self.cache[query_str] = result_place
                                    self.cache[query_str].update({"entityURI": "http://sws.geonames.org/" + str(result_place.get("geonameId")) })
                                    result = self.cache[query_str]
                                    geoparse_obj['places_by_entityURI'][result["entityURI"]] = {'name': result["name"], 'type': result["fcodeName"], 'coordinates': [result["lng"], result["lat"]]}
                                    places.add(result["entityURI"])
                                    city = result["entityURI"]
                                else:
                                    self.cache[query_str] = None
                                json.dump(self.cache, file(self.cache_filename, 'w'))
                        except:
                            logging.error("No city found for %s" % id)
                            logging.error(traceback.format_exc())

                    geoparse_obj['places'] = list(places)
                    geoparse_obj['city'] = city
                    with file(file_geoparsed, 'w') as f:
                        json.dump(geoparse_obj, f)
                    if not os.path.exists(contexts_json):
                        self.contexts_from_geoparse_obj(geoparse_obj, filename)
                    time.sleep(0.2)
                except (KeyboardInterrupt, SystemExit):
                    raise
                except:
                    logging.error(traceback.format_exc())

            geo_parsed[filename] = geoparse_obj.get('places', [])
            self.metadata[filename]['city'] = geoparse_obj.get('city')
            for entityURI, data in geoparse_obj.get('places_by_entityURI', {}).iteritems():
                places_by_entityURI[entityURI] = data

        places = {}
        for filename, entityURIs in geo_parsed.iteritems():
            year = self.metadata[filename]["year"]
            for entityURI in entityURIs:
                if entityURI in places_by_entityURI:
                    if entityURI not in places:
                        places[entityURI] = {}
                        places[entityURI]["name"] = places_by_entityURI[entityURI]["name"]
                        places[entityURI]["type"] = places_by_entityURI[entityURI]["type"]
                        places[entityURI]["coordinates"] = places_by_entityURI[entityURI]["coordinates"]
                        places[entityURI]["weight"] = {year: 1}
                    else:
                        if year not in places[entityURI]["weight"]:
                            places[entityURI]["weight"][year] = 1
                        else:
                            places[entityURI]["weight"][year] += 1
        self.geo_parsed = geo_parsed
        self.places = places
        self.places_by_entityURI = places_by_entityURI
