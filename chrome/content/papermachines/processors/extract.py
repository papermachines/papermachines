#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import json
import logging
import traceback
import codecs
import subprocess
import sys
from lib.classpath import classPathHacker
from HTMLParser import HTMLParser
import textprocessor


class MLStripper(HTMLParser):

    def __init__(self):
        self.reset()
        self.fed = []

    def handle_data(self, d):
        self.fed.append(d)

    def get_data(self):
        return u''.join(self.fed)


def strip_tags(filename):
    try:
        html = codecs.open(filename, 'r', encoding='utf-8',
                           errors='ignore').read()
        s = MLStripper()
        s.feed(html)
        return s.get_data()
    except:
        err_string = 'Non-fatal HTML error on {:} -- continuing'
        logging.error(err_string.format(os.path.basename(filename)))

#       logging.error(traceback.format_exc())

        return ''


class Extract(textprocessor.TextProcessor):

    """
    Extract text from PDF or HTML files
    """

    import java.io.File

    def _basic_params(self):
        self.name = 'extract'
        self.pdftotext = self.extra_args[0]
        self.force_update = False
        if len(self.extra_args) > 1:
            self.force_update = True
        jarLoad = classPathHacker()
        tikaPath = os.path.join(self.cwd, 'lib', 'tika-app-1.2.jar')
        if os.path.exists(tikaPath):
            jarLoad.addFile(tikaPath)
            from org.apache.tika import Tika
            self.tika = Tika()

    def process(self):
        if not os.path.exists(self.pdftotext):
            logging.error('pdftotext not found!')

        logging.info('starting to process')

        itemIDs = {}
        for filename in self.files:
            itemid = self.metadata[filename]['itemID']
            if itemid not in itemIDs:
                itemIDs[itemid] = []
            itemIDs[itemid].append(filename)

        saved = []
        for (itemID, filenames) in itemIDs.iteritems():
            try:
                out_file = self.metadata[filenames[0]]['outfile']
                out_dir = os.path.dirname(out_file)
                if not os.path.exists(out_dir):
                    os.makedirs(out_dir)
                text = u''
                if not os.path.exists(out_file) or self.force_update:
                    for filename in filenames:
                        fname = filename.lower()
                        if fname.endswith('.txt'):
                            text += codecs.open(filename, 'r',
                                    encoding='utf-8', errors='ignore'
                                    ).read()
                        elif fname.endswith('.html'):
                            text += strip_tags(filename)
                        elif fname.endswith('.doc') \
                            or fname.endswith('.docx'):
                            if getattr(self, 'tika', None) is not None:
                                txtfile = self.java.io.File(filename)
                                b = self.tika.parse(txtfile)
                                d = u''
                                c = b.read()
                                while c > 0:
                                    d += unichr(c)
                                    c = b.read()
                                b.close()
                                text += d
                        elif fname.endswith('.pdf'):
                            import_args = [
                                self.pdftotext,
                                '-enc',
                                'UTF-8',
                                '-nopgbrk',
                                filename,
                                '-',
                                ]
                            try:
                                import_proc = subprocess.Popen(import_args,
                                        stdout=subprocess.PIPE)
                                text += \
                                    import_proc.communicate()[0].decode('utf-8'
                                        )
                            except:
                                logging.error(traceback.format_exc())
                    logging.info('processed ' + out_file)
                    with codecs.open(out_file, 'w', encoding='utf-8'
                            ) as f:
                        f.write(text)
                saved.append(
                    {'itemID': itemID,
                     'collection': self.metadata[filename]['collection'], 
                     'filename': out_file
                    }
                )
                self.update_progress()
            except:
                logging.error(traceback.format_exc())
        if self.progress_initialized:
            self.progress_file.write('<1000>\n')
        json_out = os.path.join(self.out_dir, self.name
                                + self.collection + '.json')
        with codecs.open(json_out, 'wb', encoding='utf-8') as f:
            json.dump(saved, f)
        params = {'SUCCEEDED': str(len(saved)),
                  'TOTAL': str(len(itemIDs.keys()))}
        self.write_html(params)


if __name__ == '__main__':
    try:
        processor = Extract(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())
