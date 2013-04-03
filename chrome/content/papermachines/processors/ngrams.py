#!/usr/bin/env python2.7
import sys, os, json, logging, traceback, codecs, re, math, pickle, copy, itertools
from datetime import datetime, timedelta
from collections import Counter, defaultdict
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
        self.start_date = None
        self.end_date = None

        if self.named_args.get("start_date", "") != "":
            try:
                self.start_date = datetime.strptime(self.named_args["start_date"], "%Y-%m-%d")
            except:
                logging.error("Start date {:} not valid! Must be formatted like 2013-01-05")
        if self.named_args.get("end_date", "") != "":
            try:
                self.end_date = datetime.strptime(self.named_args["end_date"], "%Y-%m-%d")
            except:
                logging.error("End date {:} not valid! Must be formatted like 2013-01-05")

    def _split_into_labels(self):
        datestr_to_datetime = {}
        for filename in self.metadata.keys():
            date_str = self.metadata[filename]["date"]
            if date_str.strip() == "":
                logging.error("File {:} has invalid date -- removing...".format(filename))
                del self.metadata[filename]
                continue
            cleaned_date = date_str[0:10]
            if "-00" in cleaned_date:
                cleaned_date = cleaned_date[0:4] + "-01-01"
            try:
                date_for_doc = datetime.strptime(cleaned_date, "%Y-%m-%d")
                datestr_to_datetime[date_str] = date_for_doc
                if self.start_date is not None and date_for_doc < self.start_date:
                    logging.error("File {:} is before date range -- removing...".format(filename))
                    del self.metadata[filename]
                    continue
                if self.end_date is not None and date_for_doc > self.end_date:
                    logging.error("File {:} is after date range -- removing...".format(filename))
                    del self.metadata[filename]
                    continue
            except:
                logging.error(traceback.format_exc())
                logging.error("Date {:} not recognized".format(cleaned_date))
        datetimes = sorted(datestr_to_datetime.values())
        start_date = datetimes[0] if self.start_date is None else self.start_date
        end_date = datetimes[-1] if self.end_date is None else self.end_date

        interval = timedelta(self.interval)

        intervals = []
        self.interval_names = []
        start = end = start_date
        while end <= end_date:
            end += interval
            intervals.append((start,end))
            self.interval_names.append(start.isoformat())
            start = end

        for filename, metadata in self.metadata.iteritems():
            label = ""
            for i in range(len(intervals)):
                interval = intervals[i]
                if interval[0] <= datestr_to_datetime[metadata["date"]] < interval[1]:
                    label = self.interval_names[i]
                    break
            self.labels[label].add(filename)

    def _findNgramFreqs(self, filenames):
        freqs = Counter()
        total_for_interval = 0.0
        for filename in filenames:
            doc_freqs = self.getNgrams(filename, n = self.n)
            for ngram, value in doc_freqs.iteritems():
                self.doc_freqs[ngram].append(self.metadata[filename]["itemID"])
                freqs[ngram] += value
                total_for_interval += float(value)
            self.update_progress()
        for key in freqs.keys():
            freqs[key] /= total_for_interval
        return freqs

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
        self.labels = defaultdict(set)
        self._split_into_labels()
        self.freqs = {}
        self.doc_freqs = defaultdict(list)

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
            "NGRAMS_TO_DOCS": dict(self.doc_freqs)
        }

        self.write_html(params)

if __name__ == "__main__":
    try:
        processor = NGrams(track_progress = True)
        processor.process()
    except:
        logging.error(traceback.format_exc())