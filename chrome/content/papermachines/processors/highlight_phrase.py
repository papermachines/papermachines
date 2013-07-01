#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys
import os
import re
import logging
import traceback
import codecs
import textprocessor

class HighlightPhrase(textprocessor.TextProcessor):

    """
    Generate word cloud
    """

    def _basic_params(self):
        self.name = 'highlight_phrase'
        self.phrase = u'human rights'

    def get_containing_paragraph(self, text, match, max_chars_added=500):
        max_length = len(text) - 1
        start = max(match[0] - (max_chars_added/2), 0)
        end = min(max_length, match[1] + (max_chars_added / 2))
        while not text[start].isspace() and start > 0:
            start -= 1
        while not text[end].isspace() and end < max_length:
            end += 1
        return text[start:end]
        # start = match[0]
        # end = match[1]
        # chars_added = 0
        # c = text[start]
        # while c != '\n' and chars_added < max_chars_added and start > 0:
        #     start -= 1
        #     chars_added += 1
        #     c = text[start]

        # chars_added = 0
        # end = min(len(text) - 1, end)
        # c = text[end]

        # while c != '\n' and chars_added < max_chars_added and end < len(text):
        #     c = text[end]
        #     end += 1
        #     chars_added += 1

        # return text[start:end]

    def process(self):
        logging.info('starting to process')

        self.notes_dir = os.path.join(self.out_dir, self.name + self.collection)
        if not os.path.exists(self.notes_dir):
            os.makedirs(self.notes_dir)

        for filename in self.files:
            try:
                out_filename = os.path.join(self.notes_dir, self.metadata[filename]["itemID"] + '.html')
                with codecs.open(filename, 'r', encoding='utf-8') as f:
                    text = f.read()
                    paras = []
                    for match in re.finditer(self.phrase, text, flags=(re.IGNORECASE | re.UNICODE)):
                        para = self.get_containing_paragraph(text, match.span())
                        para = re.sub(self.phrase, 
                            u'<strong><em><span style="color: red;">\g<0></span></em></strong>',
                            para,
                            flags=(re.IGNORECASE | re.UNICODE))
                        paras.append('<p>' + para + '</p>\n')
                    if len(paras) > 0:
                        with codecs.open(out_filename, 'w', encoding='utf-8') as g:
                            g.write(u'<p>[...]</p>\n'.join(paras))
            except:
                logging.error(traceback.format_exc())

        params = {
            'DATA_DIR': self.notes_dir
        }

        self.write_html(params)


if __name__ == '__main__':
    try:
        processor = HighlightPhrase(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())
