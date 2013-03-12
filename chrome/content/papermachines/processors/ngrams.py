#!/usr/bin/env python2.7
import sys, os, json, logging, traceback, codecs, re, math, pickle, copy, itertools
from datetime import datetime, timedelta
import textprocessor

class NGrams(textprocessor.TextProcessor):
    """
    Generate N-grams for a corpus
    """
    def _basic_params(self):
        self.name = "ngrams"
        self.interval = int(self.named_args.get("interval", 1))
        self.min_df = int(self.named_args.get("min_df", 1))
        self.n = int(self.named_args.get("n", 1))
        self.n = min(max(self.n, 1), 5)
        self.top_ngrams = int(self.named_args.get("top_ngrams", 100))

    def _split_into_labels(self):
        logging.info("splitting by time interval")
        self.labels = {}
        datestr_to_datetime = {}
        for filename in self.metadata.keys():
            date_str = self.metadata[filename]["date"]
            cleaned_date = date_str[0:10]
            if "-00" in cleaned_date:
                cleaned_date = cleaned_date[0:4] + "-01-01"
            try:
                datestr_to_datetime[date_str] = datetime.strptime(cleaned_date, "%Y-%m-%d")
            except:
                logging.error("Failed on date '" + cleaned_date + "'. Removing " + filename)
                del self.metadata[filename]
        datetimes = sorted(datestr_to_datetime.values())
        start_date = datetimes[0]
        end_date = datetimes[-1]

        interval = timedelta(self.interval)

        intervals = []
        self.interval_names = []
        start = end = start_date
        while end <= end_date:
            end += interval
            intervals.append((start,end))
            self.interval_names.append(start.isoformat()) #+ ',' + end.isoformat())
            start = end

        for filename, metadata in self.metadata.iteritems():
            label = ""
            for i in range(len(intervals)):
                interval = intervals[i]
                if interval[0] <= datestr_to_datetime[metadata["date"]] < interval[1]:
                    label = self.interval_names[i]
                    break
            if label not in self.labels:
                self.labels[label] = set()
            self.labels[label].add(filename)

    def _findNgramFreqs(self, filenames):
        freqs = {}
        total_for_interval = 0.0
        for filename in filenames:
            doc_freqs = {}
            ngram_serialized = filename.replace(".txt", "_" + str(self.n) + "grams.pickle")
            ngram_json = ngram_serialized.replace(".pickle", ".json")
            if os.path.exists(ngram_json):
                os.remove(ngram_json)
            if os.path.exists(ngram_serialized):
                with open(ngram_serialized, 'rb') as ngram_serialized_file:
                    doc_freqs = pickle.load(ngram_serialized_file)
                # with codecs.open(ngram_serialized, 'r', encoding = 'utf8') as ngram_serialized_file:
                #     doc_freqs = json.load(ngram_serialized_file)
            else:
                with codecs.open(filename, 'r', encoding = 'utf8') as f:
                    logging.info("processing " + filename)
                    for ngram in self._ngrams(f.read(), self.n):
                        if ngram not in doc_freqs:
                            doc_freqs[ngram] = 0
                        doc_freqs[ngram] += 1
                with open(ngram_serialized, 'wb') as ngram_serialized_file:
                    pickle.dump(doc_freqs, ngram_serialized_file, protocol = pickle.HIGHEST_PROTOCOL)
                # with codecs.open(ngram_serialized, 'w', encoding = 'utf8') as ngram_serialized_file:
                #     json.dump(doc_freqs, ngram_serialized_file)
            for ngram, value in doc_freqs.iteritems():
                if ngram not in self.doc_freqs:
                    self.doc_freqs[ngram] = []
                self.doc_freqs[ngram].append(self.metadata[filename]["itemID"])

                if ngram not in freqs:
                    freqs[ngram] = 0
                freqs[ngram] += 1

                total_for_interval += float(value)
            self.update_progress()
        for key in freqs.keys():
            freqs[key] /= total_for_interval
        return freqs

    def _ngrams(self, text, n = 1):
        text = re.sub(r"[^\w ]+", u'', text.lower(), flags=re.UNICODE)
        words = [word for word in text.split()]
        total_n = len(words)
        i = 0
        while i < (total_n - (n - 1)):
            if not any([word in self.stopwords for word in words[i:i+n]]):
                yield u' '.join(words[i:i+n])
            i += 1

    def _filter_by_df(self):
        all_ngrams = len(self.doc_freqs.keys())
        rejected = set()
        for key in self.doc_freqs.keys():
            if len(self.doc_freqs[key]) < self.min_df:
                rejected.add(key)
                del self.doc_freqs[key]

        kept = len(self.doc_freqs.keys())
        logging.info("{:} ngrams below threshold".format(len(rejected)))
        logging.info("{:}/{:} = {:.0%} ngrams occured in {:} or more documents".format(kept, all_ngrams, (1.0*kept)/all_ngrams, self.min_df))        

        for interval in self.freqs.keys():
            for ngram_text in self.freqs[interval].keys():
                if ngram_text in rejected:
                    del self.freqs[interval][ngram_text]

        # rev_enumerate = lambda a: itertools.izip(a, xrange(len(a)))
        # self.num_to_ngram = self.doc_freqs.keys()
        # self.ngram_to_num = dict(rev_enumerate(self.num_to_ngram))


    def _filter_by_avg_value(self):
        avg_values = {}
        intervals_n = float(len(self.interval_names))
        for ngram, values_over_time in self.ngrams_intervals.iteritems():
            avg_values[ngram] = sum(values_over_time)/intervals_n
        avg_value_list = sorted(avg_values.values(), reverse = True)
        logging.info("range of avg frequencies: {:} to {:}".format(avg_value_list[-1], avg_value_list[0]))
        min_value = avg_value_list[min(self.top_ngrams - 1, len(avg_value_list) - 1)]
        logging.info("minimum avg ngram frequency: {:%}".format(min_value))
        for ngram, value in avg_values.iteritems():
            if value < min_value:
                del self.ngrams_intervals[ngram]
    
    def process(self):
        self._split_into_labels()
        self.freqs = {}
        self.doc_freqs = {}

        self.occupied_intervals = sorted(self.labels.keys())

        for interval in self.occupied_intervals:
            current_docs = self.labels[interval]
            self.freqs[interval] = self._findNgramFreqs(current_docs)

        logging.info("ngram counts complete")

        self._filter_by_df()

        self.ngrams_intervals = {}

        for i, interval in enumerate(self.interval_names):
            if interval in self.occupied_intervals:
                ngrams = self.freqs[interval]
                for ngram, value in ngrams.iteritems():
                    if ngram not in self.ngrams_intervals:
                        self.ngrams_intervals[ngram] = [0.0 for x in self.interval_names]
                    self.ngrams_intervals[ngram][i] = value

        self._filter_by_avg_value()

        self.max_freq = max([max(l) for l in self.ngrams_intervals.values()])
        # self.ngrams_intervals = dict((self.num_to_ngram[ngram], values) for ngram, values in self.ngrams_intervals.iteritems())

        params = {"NGRAMS_INTERVALS": self.ngrams_intervals,
            "TIMES": self.interval_names,
            "MAX_FREQ": self.max_freq,
            "NGRAMS_TO_DOCS": self.doc_freqs
        }

        self.write_html(params)

if __name__ == "__main__":
    try:
        processor = NGrams(track_progress = True)
        processor.process()
    except:
        logging.error(traceback.format_exc())