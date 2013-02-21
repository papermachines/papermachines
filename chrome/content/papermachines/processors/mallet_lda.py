#!/usr/bin/env python2.7
import sys, os, logging, tempfile, time, subprocess, math, re, urllib, json, codecs, csv, traceback
import xml.etree.ElementTree as et
from itertools import izip
import mallet

class MalletLDA(mallet.Mallet):
	"""
	Perform LDA using MALLET
	"""

	def _basic_params(self):
		self.categorical = False
		self.template_name = "mallet_lda"
		self.name = "mallet_lda"
		self.topics = 50
		self.dry_run = False
		self.dfr = len(self.extra_args) > 0
		if self.dfr:
			self.dfr_dir = self.extra_args[0]

	def process(self):
		"""
		run LDA, creating an output file divided by time
		"""

		if self.named_args is not None:
			self.tfidf = self.named_args["tfidf"]
			self.min_df = int(self.named_args["min_df"])
			self.stemming = self.named_args["stemming"]
			self.topics = int(self.named_args["topics"])
			self.iterations = int(self.named_args["iterations"])
			self.alpha = self.named_args["alpha"]
			self.beta = self.named_args["beta"]
			self.symmetric_alpha = str(self.named_args["symmetric_alpha"]).lower()
			self.optimize_interval = self.named_args["optimize_interval"]
			self.burn_in = int(self.named_args["burn_in"])
			self.lang = self.named_args["lang"]
			self.segmentation = self.named_args["segmentation"]
		else:
			self.tfidf = True
			self.min_df = 5
			self.topics = 50
			self.stemming = True
			self.iterations = 1000
			self.alpha = "50.0"
			self.beta = "0.01"
			self.burn_in = 200
			self.symmetric_alpha = "false"
			self.optimize_interval = 0
			self.segmentation = False
			self.lang = "en"

		self._setup_mallet_instances(sequence=True, tfidf=self.tfidf, stemming=self.stemming)

		self.mallet_files = {'state': os.path.join(self.mallet_out_dir, "topic-state.gz"),
			'doc-topics': os.path.join(self.mallet_out_dir, "doc-topics.txt"),
			'topic-keys': os.path.join(self.mallet_out_dir, "topic-keys.txt"),
			'word-topics': os.path.join(self.mallet_out_dir, "word-topics.txt"),
			'diagnostics-file': os.path.join(self.mallet_out_dir, "diagnostics-file.txt")}
		from cc.mallet.topics.tui.TopicTrainer import main as TopicTrainer

		process_args = ["--input", self.instance_file,
			"--num-topics", str(self.topics),
			"--num-iterations", str(self.iterations),
			"--optimize-interval", str(self.optimize_interval),
			"--optimize-burn-in", str(self.burn_in),
			"--use-symmetric-alpha", self.symmetric_alpha,
			"--alpha", self.alpha,
			"--beta", self.beta,
			"--output-state", self.mallet_files['state'],
			"--output-doc-topics", self.mallet_files['doc-topics'],
			"--output-topic-keys", self.mallet_files['topic-keys'],
			"--diagnostics-file", self.mallet_files['diagnostics-file'],
			"--word-topic-counts-file", self.mallet_files['word-topics']]

		logging.info("begin LDA")

		start_time = time.time()
		if not self.dry_run:
			self.set_java_log(self.progress_filename)
			TopicTrainer(process_args)

		logging.info("LDA complete in " + str(time.time() - start_time) + " seconds")

		coherence = {}
		wordProbs = {}
		allocationRatios = {}
		with codecs.open(self.mallet_files['diagnostics-file'], 'r', encoding='utf-8', errors='ignore') as diagnostics:
			try:
				tree = et.parse(diagnostics)
				for elem in tree.getiterator("topic"):
					topic = elem.get("id")
					coherence[topic] = float(elem.get("coherence"))
					allocationRatios[topic] = float(elem.get("allocation_ratio"))
					wordProbs[topic] = []
					for word in elem.getiterator("word"):
						wordProbs[topic].append({'text': word.text, 'prob': word.get("prob")})
			except:
				logging.error("The diagnostics file could not be parsed!")
				logging.error("The error is reproduced below.")
				logging.error(traceback.format_exc())

		labels = {x[0]: {"label": x[2:5], "fulltopic": wordProbs[x[0]], "allocation_ratio": allocationRatios[x[0]]} for x in [y.split() for y in codecs.open(self.mallet_files['topic-keys'], 'r', encoding='utf-8').readlines()]}

		weights_by_topic = []
		doc_metadata = {}	

		for line in codecs.open(self.mallet_files['doc-topics'], 'r', encoding='utf-8'):
			try:
				values = line.split('\t')
				
				id = values.pop(0)
				if id.startswith("#doc"):
					continue
				filename = self.docs[int(id)]
				del values[0]

				itemid = self.metadata[filename]["itemID"]

				freqs = dict((int(y[0]), float(y[1])) for y in self.xpartition(values))
				main_topic = None
				topic_max = 0.0
				for i in freqs.keys():
					if freqs[i] > topic_max:
						main_topic = i
						topic_max = freqs[i]
				self.metadata[filename]["main_topic"] = main_topic
				self.metadata[filename]["topics"] = freqs
			except KeyboardInterrupt:
				sys.exit(1)
			except:
				logging.error(traceback.format_exc())

		self.template_filename = os.path.join(self.cwd, "templates", self.template_name + ".html")

		params = {"CATEGORICAL": self.categorical,
				"TOPIC_LABELS": labels,
				"TOPIC_COHERENCE": coherence,
				"TAGS": getattr(self, "tags", {}),
				"INDEX": getattr(self, "index", {})
		}

		self.write_html(params)

if __name__ == "__main__":
	try:
		processor = MalletLDA(track_progress = False)
		processor.process()
	except:
		logging.error(traceback.format_exc())