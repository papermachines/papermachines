"""
Python wrapper for the Yahoo Placemaker API.

Requires Python 2.5 or above.

Requires an API key from the Yahoo Developer network: 
    https://developer.yahoo.com/wsregapp/

See also:

Yahoo Placemaker API Documentation:
    http://developer.yahoo.com/geo/placemaker/guide/api_docs.html

Yahoo Placemaker API Reference:
    http://developer.yahoo.com/geo/placemaker/guide/api-reference.html
"""

__author__ = "Aaron Bycoffe (bycoffe@gmail.com)"
__version__ = "0.1.0"
__copyright__ = "Copyright (c) 2009 Aaron Bycoffe"
__license__ = "BSD"


import urllib
import urllib2
from xml.etree import ElementTree


# When using ElementTree to parse the XML returned by the API,
# each tag is prefixed by the schema URL. We need to use this
# prefix when finding tags in the document.
TAG_PREFIX = '{http://wherein.yahooapis.com/v1/schema}'


class PlacemakerApiError(Exception):
    """Exceptions for Yahoo Placemaker API errors"""
    pass


class Place(object):

    def __init__(self, tree):
        self.place = tree.find('%splace' % TAG_PREFIX)

        self.placeId = tree.find('%splaceId' % TAG_PREFIX).text
        try:
            self.placeId = int(self.placeId)
        except ValueError:
            pass

        self.placeReferenceIds = tree.find('%splaceReferenceIds' % TAG_PREFIX).text
        try:
            self.placeReferenceIds = [int(x) for x in self.placeReferenceIds.split()]
        except ValueError:
            pass

        self.woeid = self.place.find('%swoeId' % TAG_PREFIX).text
        try:
            self.woeid = int(self.woeid)
        except ValueError:
            pass

        self.placetype = self.place.find('%stype' % TAG_PREFIX).text
        self.name = self.place.find('%sname' % TAG_PREFIX).text
        self.name = self.name.encode('utf-8', 'ignore')

        self.centroid = PlacemakerPoint(self.place.find('%scentroid' % TAG_PREFIX))
        self.match_type = tree.find('%smatchType' % TAG_PREFIX).text
        try:
            self.match_type = int(self.match_type)
        except ValueError:
            pass

        self.weight = tree.find('%sweight' % TAG_PREFIX).text
        try:
            self.weight = int(self.weight)
        except ValueError:
            pass

        self.confidence = tree.find('%sconfidence' % TAG_PREFIX).text
        try:
            self.confidence = int(self.confidence)
        except ValueError:
            pass

    def __repr__(self):
        return "<Placemaker Place: '%s'>" % self.name


class Scope(object):

    def __init__(self, tree):
        self.name = tree.find('%sname' % TAG_PREFIX).text
        if self.name:
            self.name = self.name.encode('utf-8', 'ignore')

        self.woeid = tree.find('%swoeId' % TAG_PREFIX).text
        try:
            self.woeid = int(self.woeid)
        except ValueError:
            pass

        self.placetype = tree.find('%stype' % TAG_PREFIX).text
        self.centroid = PlacemakerPoint(tree.find('%scentroid' % TAG_PREFIX))

    def __repr__(self):
        return u"<Placemaker Scope: '%s'>" % self.name


class AdministrativeScope(Scope):
    
    def __repr__(self):
        return u"<Placemaker AdministrativeScope: '%s'>" % self.name


class GeographicScope(Scope):

    def __repr__(self):
        return u"<Placemaker GeographicScope: '%s'>" % self.name


class PlacemakerPoint(object):

    def __init__(self, tree):
        self.latitude = tree.find('%slatitude' % TAG_PREFIX).text
        if self.latitude:
            self.latitude = float(self.latitude)

        self.longitude = tree.find('%slongitude' % TAG_PREFIX).text
        if self.longitude:
            self.longitude = float(self.longitude)

    def __repr__(self):
        return u"<Placemaker Point: '%s, %s'>" % (self.latitude, self.longitude)


class Extents(object):

    def __init__(self, tree):
        self.center = PlacemakerPoint(tree.find('%scenter' % TAG_PREFIX))
        self.southwest = PlacemakerPoint(tree.find('%ssouthwest' % TAG_PREFIX))
        self.northeast = PlacemakerPoint(tree.find('%snortheast' % TAG_PREFIX))

class Reference(object):

    def __init__(self, tree):
        self.woeIds = tree.find('%swoeIds' % TAG_PREFIX).text
        try:
            self.woeIds = self.woeIds.split()
        except ValueError:
            pass

        self.placeReferenceId = tree.find('%splaceReferenceId' % TAG_PREFIX).text
        try:
            self.placeReferenceId = int(self.placeReferenceId)
        except ValueError:
            pass

        self.placeIds = tree.find('%splaceIds' % TAG_PREFIX).text
        try:
            self.placeIds = [int(x) for x in self.placeIds.split()]
        except ValueError:
            pass

        self.type = tree.find('%stype' % TAG_PREFIX).text

        self.start = tree.find('%sstart' % TAG_PREFIX).text
        try:
            self.start = int(self.start)
        except ValueError:
            pass
        self.end = tree.find('%send' % TAG_PREFIX).text
        try:
            self.end = int(self.end)
        except ValueError:
            pass

    def __repr__(self):
        return "<Placemaker Reference: '%s'>" % self.placeReferenceId

class placemaker(object):

    def __init__(self, api_key):
        self.api_key = api_key 
        self.url = 'http://wherein.yahooapis.com/v1/document'
    

    def find_places(self, input, documentType='text/plain', inputLanguage='en-US', 
                    outputType='xml', documentTitle='', autoDisambiguate='true',
                    focusWoeid=''):

        self.values = {'appid': self.api_key,
                       'documentType': documentType,
                       'inputLanguage': inputLanguage,
                       'outputType': outputType,
                       'documentTitle': documentTitle,
                       'autoDisambiguate': autoDisambiguate,
                       'focusWoeid': focusWoeid, }

        self.values[('documentURL' if input.startswith('http://') 
                                else 'documentContent')] = input

        self.data = urllib.urlencode(self.values)
        self.req = urllib2.Request(self.url, self.data)
        self.response = urllib2.urlopen(self.req)

        response_codes = {400: 'Bad Request',
                          404: 'Not Found',
                          413: 'Request Entity Too Large',
                          415: 'Unsupported Media Type',
                          999: 'Unable to process request at this time', }

        if self.response.code != 200:
            raise PlacemakerApiError('Request received a response code of %d: %s' % (self.response.code, response_codes[self.response.code]))

        self.response_xml = self.response.read()

        self.tree = ElementTree.fromstring(self.response_xml)

        self.doc = self.tree.find('%sdocument' % TAG_PREFIX)

        administrative_scope_tree = self.doc.find('%sadministrativeScope' % TAG_PREFIX)
        if administrative_scope_tree is not None:
            self.administrative_scope = AdministrativeScope(administrative_scope_tree)

        geographic_scope_tree = self.doc.find('%sgeographicScope' % TAG_PREFIX)
        if geographic_scope_tree is not None:
            self.geographic_scope = GeographicScope(geographic_scope_tree)

        place_details = self.doc.findall('%splaceDetails' % TAG_PREFIX)

        reference_list = self.doc.find('%sreferenceList' % TAG_PREFIX)
        references = reference_list.findall('%sreference' % TAG_PREFIX)

        self.places = [Place(place) for place in place_details]

        self.references = {}
        for reference in references:
            r = Reference(reference)
            self.references[r.placeReferenceId] = r

        self.referencedPlaces = {}
        for place in self.places:
            self.referencedPlaces[place.woeid] = {"place": place, "references": [self.references[i] for i in place.placeReferenceIds]}

        return self.referencedPlaces
