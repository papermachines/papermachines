#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import logging
import traceback
import mallet_lda


class MalletSubcollections(mallet_lda.MalletLDA):

    """
    Set topic modeling to categorical view by default
    """

    def _basic_params(self):
        self.name = 'mallet_lda_categorical'
        self.categorical = True
        self.template_name = 'mallet_lda'
        self.dry_run = False
        self.topics = 50
        self.dfr = len(self.extra_args) > 0
        if self.dfr:
            self.dfr_dir = self.extra_args[0]

if __name__ == '__main__':
    try:
        processor = MalletSubcollections(track_progress=False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
