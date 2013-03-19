#!/usr/bin/env python2.7
import sys, os, json, re, cStringIO, logging, traceback, codecs, urllib, subprocess
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
        html = codecs.open(filename, 'r', encoding='utf-8', errors='ignore').read()
        s = MLStripper()
        s.feed(html)
        return s.get_data()
    except:
        logging.error("Non-fatal HTML error on {:} -- continuing".format(os.path.basename(filename)))
#       logging.error(traceback.format_exc())
        return ""

class Extract(textprocessor.TextProcessor):
    """
    Extract text from PDF or HTML files
    """
    import java.io.File

    def _basic_params(self):
        self.name = "extract"
        self.pdftotext = self.extra_args[0]
        jarLoad = classPathHacker()
        tikaPath = os.path.join(self.cwd, "lib", "tika-app-1.2.jar")
        if os.path.exists(tikaPath):
            jarLoad.addFile(tikaPath)
            from org.apache.tika import Tika
            self.tika = Tika()


    def process(self):
        logging.info("starting to process")

        itemIDs = {}
        for filename in self.files:
            id = self.metadata[filename]["itemID"]
            if id not in itemIDs:
                itemIDs[id] = []
            itemIDs[id].append(filename)

        saved = []
        for itemID, filenames in itemIDs.iteritems():
            try:
                out_file = self.metadata[filenames[0]]["outfile"]
                out_dir = os.path.dirname(out_file)
                if not os.path.exists(out_dir):
                    os.makedirs(out_dir)
                text = u''
                for filename in filenames:
                    if filename.lower().endswith(".txt"):
                        text += codecs.open(filename, 'r', encoding='utf-8', errors='ignore').read()
                    elif filename.lower().endswith(".html"):
                        text += strip_tags(filename)
                    elif filename.lower().endswith(".doc") or filename.lower().endswith(".docx"):
                        if getattr(self, "tika", None) is not None:
                            txtfile = self.java.io.File(filename)
                            b = self.tika.parse(txtfile)
                            d = u""
                            c = b.read()
                            while c > 0:
                                d += unichr(c)
                                c = b.read()
                            b.close()
                            text += d
                    elif filename.lower().endswith(".pdf"):
                        import_args = [self.pdftotext, '-enc', 'UTF-8', '-nopgbrk', filename, '-']
                        import_proc = subprocess.Popen(import_args, stdout = subprocess.PIPE)
                        text += import_proc.communicate()[0].decode('utf-8')
                logging.info("processed "+out_file)
                with codecs.open(out_file, 'w', encoding="utf-8") as f:
                    f.write(text)
                    saved.append({"itemID": itemID, "collection": self.metadata[filename]["collection"], "filename": out_file})
                self.update_progress()
            except:
                logging.error(traceback.format_exc())
        if self.progress_initialized:
            self.progress_file.write('<1000>\n')
        json_out = os.path.join(self.out_dir, self.name + self.collection + ".json")
        with codecs.open(json_out, 'wb', encoding='utf-8') as f:
            json.dump(saved, f)
        params = {"SUCCEEDED": str(len(saved)), "TOTAL": str(len(itemIDs.keys()))}
        self.write_html(params)

if __name__ == "__main__":
    try:
        processor = Extract(track_progress=True)
        processor.process()
    except:
        logging.error(traceback.format_exc())