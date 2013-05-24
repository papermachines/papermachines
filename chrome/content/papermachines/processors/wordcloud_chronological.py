#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import json
import cStringIO
import tempfile
import logging
import traceback
import codecs
import math
from datetime import datetime, timedelta
from collections import defaultdict
import wordcloud_multiple


class WordCloudChronological(wordcloud_multiple.MultipleWordClouds):

    """
    Generate word clouds based on time interval
    """

    def _basic_params(self):
        self.name = 'wordcloud_chronological'
        self.template_filename = os.path.join(self.cwd, 'templates',
                'wordcloud_multiple.html')
        self.width = 483
        self.height = 300
        self.fontsize = [10, 32]
        self.n = 100
        self.ngram = int(self.named_args.get('ngram', 1))
        self.tfidf_scoring = False
        self.MWW = False
        self.dunning = False
        self.comparison_type = 'plain'
        if len(self.extra_args) == 1:
            self.comparison_type = self.extra_args[0]
            if self.extra_args[0] == 'tfidf':
                self.tfidf_scoring = True
            elif self.extra_args[0] == 'mww':
                self.tfidf_scoring = True
                self.MWW = True
            elif self.extra_args[0] == 'dunning':
                self.tfidf_scoring = True
                self.dunning = True
        self.interval = int(self.named_args.get('interval', '90'))
        self.start_date = None
        self.end_date = None

        if self.named_args.get('start_date', '') != '':
            try:
                self.start_date = \
                    datetime.strptime(self.named_args['start_date'],
                        '%Y-%m-%d')
            except:
                logging.error('Start date {:} not valid! Must be formatted like 2013-01-05'
                              )
        if self.named_args.get('end_date', '') != '':
            try:
                self.end_date = \
                    datetime.strptime(self.named_args['end_date'],
                        '%Y-%m-%d')
            except:
                logging.error('End date {:} not valid! Must be formatted like 2013-01-05'
                              )

    def _split_into_labels(self):
        self.split_into_intervals(start_and_end_dates=True)


if __name__ == '__main__':
    try:
        processor = WordCloudChronological(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())
