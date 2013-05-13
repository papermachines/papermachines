#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import logging
import traceback
import time
import subprocess
import mallet


class MalletClassifier(mallet.Mallet):

    """
    Train a classifier
    """

    def _basic_params(self):
        self.dry_run = False
        self.name = 'mallet_train-classifier'
        self.dfr = False

    def process(self):
        self._setup_mallet_instances(sequence=False)

        self.mallet_output = os.path.join(self.mallet_out_dir,
                'trained.classifier')
        process_args = self.mallet + [
            'cc.mallet.classify.tui.Vectors2Classify',
            '--input',
            self.instance_file,
            '--output-classifier',
            self.mallet_output,
            '--trainer',
            'NaiveBayes',
            '--noOverwriteProgressMessages',
            'true',
            ]

        logging.info('begin training classifier')

        start_time = time.time()
        if not self.dry_run:
            classifier_return = subprocess.call(process_args,
                    stdout=self.progress_file,
                    stderr=self.progress_file)

        finished = 'Classifier trained in ' + str(time.time()
                - start_time) + ' seconds'
        logging.info(finished)

        params = {'DONE': finished}

        self.write_html(params)


if __name__ == '__main__':
    try:
        processor = MalletClassifier(track_progress=False)
        processor.process()
    except:
        logging.error(traceback.format_exc())
