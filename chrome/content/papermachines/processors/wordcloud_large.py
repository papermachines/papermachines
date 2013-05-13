#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import logging
import traceback
import codecs
import wordcloud


class LargeWordCloud(wordcloud.WordCloud):

    """
    Generate large word cloud
    """

    def _basic_params(self):
        self.width = 960
        self.height = 500
        self.fontsize = [10, 72]
        self.name = 'wordcloud_large'
        self.n = 150
        self.tfidf_scoring = len(self.extra_args) > 0


if __name__ == '__main__':
    try:
        processor = LargeWordCloud(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())
