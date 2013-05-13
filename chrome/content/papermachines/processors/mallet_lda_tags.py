#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import logging
import traceback
import mallet_lda


class MalletTagTopics(mallet_lda.MalletLDA):

    """
    Topic modeling with separation based on tags
    """

    def _basic_params(self):
        self.name = 'mallet_lda_tags'
        self.categorical = False
        self.template_name = 'mallet_lda'
        self.dry_run = False
        self.topics = 50
        self.dfr = len(self.extra_args) > 0
        if self.dfr:
            self.dfr_dir = self.extra_args[0]

    def post_setup(self):
        if self.named_args is not None:
            if 'tags' in self.named_args:
                self.tags = self.named_args['tags']
                for filename in self.metadata.keys():
                    my_tags = [x for (x, y) in self.tags.iteritems()
                               if int(self.metadata[filename]['itemID'
                               ]) in y]
                    if len(my_tags) > 0:
                        self.metadata[filename]['label'] = my_tags[0]
                    else:
                        del self.metadata[filename]
                        self.files.remove(filename)


if __name__ == '__main__':
    try:
        processor = MalletTagTopics(track_progress=False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
