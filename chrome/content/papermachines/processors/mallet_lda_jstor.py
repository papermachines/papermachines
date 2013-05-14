#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import json
import codecs
import logging
import traceback
from zipfile import ZipFile
from lib.merge_jstor import merge_dfr_dirs
import mallet_lda

class MalletJSTOR(mallet_lda.MalletLDA):

    """
    Alias to distinguish mallet queries with JSTOR attached
    """

    def _extractAll(self, zipName, dest):
        z = ZipFile(zipName)
        z.extractall(dest, filter(lambda f: not f.endswith('/'),
                     z.namelist()))

    def _basic_params(self):
        self.name = 'mallet_lda_jstor'
        self.categorical = False
        self.template_name = 'mallet_lda'
        self.dry_run = False
        self.topics = 50
        self.dfr = True
        self.use_bulkloader = True
        dfr_dirs = []
        for dfr_path in self.extra_args:
            if dfr_path.lower().endswith('.zip'):
                dfr_dir = os.path.basename(dfr_path).replace('.zip', '')
                this_dfr_dir = os.path.join(self.out_dir, dfr_dir)
                self._extractAll(dfr_path, this_dfr_dir)
                dfr_dirs.append(this_dfr_dir)
        if len(dfr_dirs) > 1:
            self.dfr_dir = merge_dfr_dirs(dfr_dirs)
        else:
            self.dfr_dir = dfr_dirs[0]

if __name__ == '__main__':
    try:
        processor = MalletJSTOR(track_progress=False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
