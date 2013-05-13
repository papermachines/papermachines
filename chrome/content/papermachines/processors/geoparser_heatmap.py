#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import json
import csv
import re
import shutil
import logging
import traceback
import base64
import time
import codecs
import cPickle as pickle
import geoparser


class GeoparserHeatmap(geoparser.Geoparser):

    """
    Export geoparsing results
    """

    def _basic_params(self):
        self.name = 'geoparser_heatmap'
        self.dry_run = False
        self.require_stopwords = False

    def process(self):
        """
        Heatmap using Google Maps and heatmaps.js
        """

        data = []
        counts = {}
        max_count = 0

        csv_input = os.path.join(self.out_dir, 'geoparser_export'
                                 + self.collection + '.csv')
        if not os.path.exists(csv_input):
            import geoparser_export
            subprocessor = geoparser_export.GeoparserExport()
            subprocessor.process()

        for rowdict in self.parse_csv(csv_input):
            coords = ','.join([rowdict['lat'], rowdict['lng']])
            if coords not in counts:
                counts[coords] = 0
            counts[coords] += 1
            if counts[coords] > max_count:
                max_count = counts[coords]

        for (coords, count) in counts.iteritems():
            (lat, lng) = coords.split(',')
            data.append({'lat': lat, 'lng': lng, 'count': count})
        intensity = {'max': max_count, 'data': data}
        params = {'INTENSITY': intensity}
        self.write_html(params)


if __name__ == '__main__':
    try:
        processor = GeoparserHeatmap(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())
